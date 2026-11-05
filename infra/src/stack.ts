import { CfnOutput, Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
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
    new dynamodb.Table(this, "Core", {
      tableName: `${config.prefix}-core`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      deletionProtection: production,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: production },
      removalPolicy,
    });
    const bucket = new s3.Bucket(this, "WebAssets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const zone = customDomains ? route53.HostedZone.fromHostedZoneAttributes(this, "ExistingZone", {
      hostedZoneId: config.hostedZoneId, zoneName: config.hostedZoneName,
    }) : undefined;
    const certificate = zone ? new acm.Certificate(this, "WebCertificate", {
      domainName: config.webDomain,
      subjectAlternativeNames: config.apiDomain ? [config.apiDomain] : [],
      validation: acm.CertificateValidation.fromDns(zone),
    }) : undefined;
    const distribution = new cloudfront.Distribution(this, "Web", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      ...(certificate ? {
        domainNames: [config.webDomain], certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      } : {}),
    });
    const webOrigin = customDomains ? `https://${config.webDomain}` : `https://${distribution.distributionDomainName}`;
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
    const client = pool.addClient("Browser", {
      generateSecret: false, preventUserExistenceErrors: true,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [`${webOrigin}/auth/callback`],
        logoutUrls: [webOrigin],
      },
    });
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      logGroupName: `/rct/${config.prefix}/api`,
      retention: production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy,
    });
    const role = new iam.Role(this, "ApiRole", { assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com") });
    logGroup.grantWrite(role);
    const handler = new NodejsFunction(this, "ApiHandler", {
      entry: resolve(import.meta.dirname, "../../apps/api/src/handler.ts"),
      depsLockFilePath: resolve(import.meta.dirname, "../../package-lock.json"),
      runtime: lambda.Runtime.NODEJS_24_X, handler: "handler",
      memorySize: 256, timeout: Duration.seconds(10), logGroup, role,
      bundling: { minify: true, sourceMap: false },
    });
    const api = new apigateway.HttpApi(this, "Api", {
      apiName: `${config.prefix}-api`,
      corsPreflight: {
        allowOrigins: [webOrigin],
        allowMethods: [apigateway.CorsHttpMethod.GET],
        allowHeaders: ["authorization", "content-type"],
      },
    });
    const integration = new HttpLambdaIntegration("ApiIntegration", handler);
    api.addRoutes({ path: "/health", methods: [apigateway.HttpMethod.GET], integration });
    api.addRoutes({
      path: "/me", methods: [apigateway.HttpMethod.GET], integration,
      authorizer: new HttpJwtAuthorizer("Cognito", `https://${pool.userPoolProviderUrl}`, { jwtAudience: [client.userPoolClientId] }),
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
