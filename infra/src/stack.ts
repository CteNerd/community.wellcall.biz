import { CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as events from "aws-cdk-lib/aws-events";
import * as eventTargets from "aws-cdk-lib/aws-events-targets";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as destinations from "aws-cdk-lib/aws-lambda-destinations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { resolve } from "node:path";
import type { Configuration } from "./config.ts";

export class ApplicationStack extends Stack {
  constructor(scope: Construct, config: Configuration, customDomains = false, brandLaunchApproved = false) {
    super(scope, `${config.prefix}-foundation`, { env: { account: config.account, region: config.region } });
    if (customDomains && config.environment === "production" && !brandLaunchApproved) {
      throw new Error("Production custom domains require explicit brand/cutover approval");
    }
    Tags.of(this).add("Portfolio", "RCT");
    Tags.of(this).add("Application", "DotCom");
    Tags.of(this).add("Environment", config.environment);
    const production = config.environment === "production";
    const removalPolicy = production ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const core = new dynamodb.Table(this, "Core", {
      tableName: `${config.prefix}-core`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      deletionProtection: production,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: production },
      removalPolicy,
    });
    core.addGlobalSecondaryIndex({
      indexName: "CommunityApplicationsIndex",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    core.addGlobalSecondaryIndex({
      indexName: "OutboxPendingIndex",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    const bucket = new s3.Bucket(this, "WebAssets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const zone = customDomains && !config.importedCertificateArn ? route53.HostedZone.fromHostedZoneAttributes(this, "ExistingZone", {
      hostedZoneId: config.hostedZoneId, zoneName: config.hostedZoneName,
    }) : undefined;
    const certificate = config.importedCertificateArn
      ? acm.Certificate.fromCertificateArn(this, "ExistingDevelopmentWebCertificate", config.importedCertificateArn)
      : zone ? new acm.Certificate(this, "WebCertificate", {
      domainName: config.webDomain,
      subjectAlternativeNames: config.apiDomain ? [config.apiDomain] : [],
      validation: acm.CertificateValidation.fromDns(zone),
    }) : undefined;
    const internalRoute = new cloudfront.Function(this, "InternalWorkspaceRoute", {
      code: cloudfront.FunctionCode.fromInline(
        'function handler(event) { var request = event.request; if ((request.method === "GET" || request.method === "HEAD") && (request.uri === "/internal" || request.uri === "/internal/")) request.uri = "/index.html"; return request; }',
      ),
    });
    const privateHeaders = new cloudfront.ResponseHeadersPolicy(this, "PrivateWebHeaders", {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
      },
      customHeadersBehavior: { customHeaders: [{ header: "X-Robots-Tag", value: "noindex, nofollow", override: true }] },
    });
    const origin = S3BucketOrigin.withOriginAccessControl(bucket);
    const internalBehavior: cloudfront.BehaviorOptions = {
      origin, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      responseHeadersPolicy: privateHeaders, compress: true,
      functionAssociations: [{ function: internalRoute, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
    };
    const distribution = new cloudfront.Distribution(this, "Web", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: production ? cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS : privateHeaders,
        compress: true,
        ...(internalRoute ? { functionAssociations: [{
          function: internalRoute, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }] } : {}),
      },
      additionalBehaviors: { "/internal": internalBehavior, "/internal/": internalBehavior },
      ...(certificate ? {
        domainNames: [config.webDomain], certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      } : {}),
    });
    const webOrigin = certificate ? `https://${config.webDomain}` : `https://${distribution.distributionDomainName}`;
    if (zone) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      new route53.ARecord(this, "WebAlias", { zone, recordName: config.webDomain, target });
      new route53.AaaaRecord(this, "WebIpv6Alias", { zone, recordName: config.webDomain, target });
    }
    const pool = new cognito.UserPool(this, "Auth", {
      userPoolName: `${config.prefix}-users`, selfSignUpEnabled: false,
      signInAliases: { email: true }, mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 14, requireDigits: true, requireSymbols: true, requireLowercase: true, requireUppercase: true },
      removalPolicy,
    });
    new cognito.CfnUserPoolGroup(this, "CommunityAdministrators", {
      userPoolId: pool.userPoolId,
      groupName: "CommunityAdministrators",
      description: "Authorized reviewers for adult program applications",
    });
    const client = pool.addClient("Browser", {
      generateSecret: false, preventUserExistenceErrors: true,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [`${webOrigin}/internal`],
        logoutUrls: [`${webOrigin}/`],
        scopes: [cognito.OAuthScope.OPENID],
      },
    });
    {
      const hostedLogin = pool.addDomain(production ? "ProductionHostedLogin" : "DevelopmentHostedLogin", {
        cognitoDomain: { domainPrefix: `${config.prefix}-${config.account}` },
      });
      if (!production) {
        new CfnOutput(this, "DevelopmentOAuthOrigin", { value: hostedLogin.baseUrl() });
        new CfnOutput(this, "DevelopmentAuthIssuer", { value: pool.userPoolProviderUrl });
        new CfnOutput(this, "DevelopmentAuthRedirectUri", { value: `${webOrigin}/internal` });
        new CfnOutput(this, "DevelopmentAuthLogoutUri", { value: `${webOrigin}/` });
      }
      new CfnOutput(this, "OAuthOrigin", { value: hostedLogin.baseUrl() });
      new CfnOutput(this, "AuthIssuer", { value: pool.userPoolProviderUrl });
      new CfnOutput(this, "AuthRedirectUri", { value: `${webOrigin}/internal` });
      new CfnOutput(this, "AuthLogoutUri", { value: `${webOrigin}/` });
    }
    {
      const publisherPolicy = new iam.ManagedPolicy(this, "WebPublishPolicy", {
        description: "Web artifacts only; no infrastructure, identity or application data mutations",
        statements: [
          new iam.PolicyStatement({
            actions: ["s3:GetBucketLocation", "s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus", "s3:ListBucket"],
            resources: [bucket.bucketArn],
          }),
          new iam.PolicyStatement({
            actions: ["s3:GetObject", "s3:PutObject"],
            resources: [bucket.arnForObjects("assets/*"), bucket.arnForObjects("index.html")],
          }),
          new iam.PolicyStatement({
            actions: ["cloudfront:GetDistribution", "cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
            resources: [distribution.distributionArn],
          }),
          new iam.PolicyStatement({
            actions: ["cloudformation:DescribeStacks"],
            resources: [this.stackId],
          }),
        ],
      });
      const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this, "ExistingWebGitHubProvider",
        `arn:${this.partition}:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
      );
      const publisherRole = new iam.Role(this, "WebPublisher", {
        roleName: `${config.prefix}-web-publish`,
        path: `/rct/dotcom/${config.environment}/`,
        assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": `repo:CteNerd/community.wellcall.biz:environment:${config.environment}`,
          },
        }),
        managedPolicies: [publisherPolicy],
        permissionsBoundary: publisherPolicy,
        maxSessionDuration: Duration.hours(1),
      });
      new CfnOutput(this, "WebPublishRoleArn", { value: publisherRole.roleArn });
    }
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      logGroupName: `/rct/${config.prefix}/api`,
      retention: production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const role = new iam.Role(this, "ApiRole", { assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com") });
    logGroup.grantWrite(role);
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": ["APPLICATION#*", "IDEMPOTENCY#*", "MENTOR_APPROVAL#*"],
        },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${core.tableArn}/index/CommunityApplicationsIndex`],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAnyValue:StringEquals": { "dynamodb:EnclosingOperation": ["TransactWriteItems"] },
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": ["APPLICATION#*", "IDEMPOTENCY#*", "MENTOR_APPROVAL#*", "OUTBOX#????????-????-????-????-????????????"],
        },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [core.tableArn],
      conditions: { "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["APPLICATION#*"] } },
    }));
    const applicationIntakeEnabled = new CfnParameter(this, "ApplicationIntakeEnabled", {
      type: "String", default: "false", allowedValues: ["false", "true"],
      description: "Enable adult applications only after consent, screening and retention approval.",
    });
    const applicationConsentPolicyVersion = new CfnParameter(this, "ApplicationConsentPolicyVersion", {
      type: "String", default: "",
      description: "Approved adult-program consent version; leave blank to keep intake closed.",
    });
    const applicationRetentionDays = new CfnParameter(this, "ApplicationRetentionDays", {
      type: "Number", default: 0, minValue: 0, maxValue: 3650,
      description: "Approved application retention period in days; zero keeps intake closed.",
    });
    const handler = new NodejsFunction(this, "ApiHandler", {
      entry: resolve(import.meta.dirname, "../../apps/api/src/handler.ts"),
      depsLockFilePath: resolve(import.meta.dirname, "../../package-lock.json"),
      runtime: lambda.Runtime.NODEJS_24_X, handler: "handler",
      memorySize: 256, timeout: Duration.seconds(10), logGroup, role,
      environment: {
        CORE_TABLE_NAME: core.tableName,
        APPLICATION_INTAKE_ENABLED: applicationIntakeEnabled.valueAsString,
        APPLICATION_CONSENT_POLICY_VERSION: applicationConsentPolicyVersion.valueAsString,
        APPLICATION_RETENTION_DAYS: applicationRetentionDays.valueAsString,
      },
      bundling: { minify: true, sourceMap: false },
    });
    const api = new apigateway.HttpApi(this, "Api", {
      apiName: `${config.prefix}-api`,
      corsPreflight: {
        allowOrigins: [webOrigin],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PATCH,
        ],
        allowHeaders: ["authorization", "content-type", "idempotency-key"],
      },
    });
    const integration = new HttpLambdaIntegration("ApiIntegration", handler);
    const jwtAuthorizer = new HttpJwtAuthorizer("Cognito", pool.userPoolProviderUrl, {
      jwtAudience: [client.userPoolClientId],
    });
    api.addRoutes({ path: "/health", methods: [apigateway.HttpMethod.GET], integration });
    api.addRoutes({
      path: "/me", methods: [apigateway.HttpMethod.GET], integration,
      authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/applications", methods: [apigateway.HttpMethod.POST], integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/applications/{applicationId}", methods: [apigateway.HttpMethod.GET],
      integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/applications/{applicationId}/withdraw", methods: [apigateway.HttpMethod.POST],
      integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/admin/applications", methods: [apigateway.HttpMethod.GET], integration, authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/admin/applications/{applicationId}", methods: [apigateway.HttpMethod.PATCH],
      integration, authorizer: jwtAuthorizer,
    });
    const busArn = ssm.StringParameter.valueForStringParameter(
      this, `/rct/${config.environment}/portfolio/event-bus-arn`,
    );
    const bus = events.EventBus.fromEventBusArn(this, "PortfolioEventBus", busArn);
    const publisherLogGroup = new logs.LogGroup(this, "OutboxPublisherLogs", {
      logGroupName: `/rct/${config.prefix}/outbox-publisher`,
      retention: production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const publisherRole = new iam.Role(this, "OutboxPublisherRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    publisherLogGroup.grantWrite(publisherRole);
    core.grantStreamRead(publisherRole);
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": ["OUTBOX#RECONCILIATION"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["OUTBOX#????????-????-????-????-????????????"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [core.tableArn],
      conditions: {
        "ForAllValues:StringEquals": { "dynamodb:LeadingKeys": ["OUTBOX#RECONCILIATION"] },
        Null: { "dynamodb:LeadingKeys": "false" },
      },
    }));
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${core.tableArn}/index/OutboxPendingIndex`],
    }));
    publisherRole.addToPolicy(new iam.PolicyStatement({
      actions: ["events:PutEvents"],
      resources: [bus.eventBusArn],
      conditions: {
        StringEquals: {
          "events:source": "rct.dotcom",
          "events:detail-type": "dotcom.mentor.approved.v1",
        },
      },
    }));
    const publisher = new NodejsFunction(this, "OutboxPublisher", {
      entry: resolve(import.meta.dirname, "../../apps/api/src/outbox-publisher.ts"),
      depsLockFilePath: resolve(import.meta.dirname, "../../package-lock.json"),
      runtime: lambda.Runtime.NODEJS_24_X, handler: "handler",
      memorySize: 256, timeout: Duration.seconds(30), logGroup: publisherLogGroup, role: publisherRole,
      environment: { CORE_TABLE_NAME: core.tableName, EVENT_BUS_ARN: bus.eventBusArn },
      bundling: { minify: true, sourceMap: false },
    });
    const publisherFailures = new sqs.Queue(this, "OutboxPublisherFailures", {
      queueName: `${config.prefix}-outbox-publisher-failures`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      removalPolicy,
    });
    publisher.addEventSource(new eventSources.DynamoEventSource(core, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 10,
      bisectBatchOnError: true,
      retryAttempts: 5,
      maxRecordAge: Duration.hours(24),
      reportBatchItemFailures: true,
      filters: [lambda.FilterCriteria.filter({
        eventName: ["INSERT"],
        dynamodb: { NewImage: { recordType: { S: ["OUTBOX"] } } },
      })],
      onFailure: new destinations.SqsDestination(publisherFailures),
    }));
    new events.Rule(this, "OutboxReconciliation", {
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new eventTargets.LambdaFunction(publisher)],
    });
    if (zone && certificate && config.apiDomain) {
      const domain = new apigateway.DomainName(this, "ApiDomain", { domainName: config.apiDomain, certificate });
      new apigateway.ApiMapping(this, "ApiMapping", { api, domainName: domain });
      new route53.ARecord(this, "ApiAlias", {
        zone, recordName: config.apiDomain,
        target: route53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId)),
      });
    }
    new CfnOutput(this, "WebUrl", { value: webOrigin });
    new CfnOutput(this, "WebBucket", { value: bucket.bucketName });
    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: pool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });
  }
}
