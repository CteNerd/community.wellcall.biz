import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { configuration, developmentCertificateArn } from "./config.ts";
import { ApplicationStack } from "./stack.ts";

const assertionDirectory = resolve(`cdk.out/assertions-${randomUUID()}`);
after(() => rmSync(assertionDirectory, { recursive: true, force: true }));
const app = () => new App({ outdir: assertionDirectory });

test("development foundation has private hosting, no DNS writes, and protected identity routing", () => {
  const template = Template.fromStack(new ApplicationStack(app(), configuration("development", "123456789012")));
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "rct-dotcom-development-core",
    BillingMode: "PAY_PER_REQUEST",
    TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    StreamSpecification: { StreamViewType: "NEW_IMAGE" },
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({ IndexName: "CommunityApplicationsIndex" }),
      Match.objectLike({ IndexName: "OutboxPendingIndex" }),
    ]),
  });
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
    },
  });
  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
  template.resourceCountIs("AWS::Route53::RecordSet", 0);
  for (const type of ["AWS::EC2::VPC", "AWS::EC2::NatGateway", "AWS::RDS::DBCluster", "AWS::Events::EventBus"]) {
    template.resourceCountIs(type, 0);
  }
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /me", AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
  });
  for (const key of [
    "POST /applications",
    "GET /applications/{applicationId}",
    "POST /applications/{applicationId}/withdraw",
    "GET /admin/applications",
    "PATCH /admin/applications/{applicationId}",
  ]) {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: key, AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
    });
  }
  const [poolId] = Object.keys(template.findResources("AWS::Cognito::UserPool"));
  const [clientId] = Object.keys(template.findResources("AWS::Cognito::UserPoolClient"));
  assert.ok(poolId);
  assert.ok(clientId);
  template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
    AuthorizerType: "JWT",
    JwtConfiguration: {
      Issuer: { "Fn::GetAtt": [poolId, "ProviderURL"] },
      Audience: [{ Ref: clientId }],
    },
  });
  template.resourceCountIs("AWS::ApiGatewayV2::Route", 7);
  template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
    CorsConfiguration: Match.objectLike({
      AllowMethods: Match.arrayWith(["GET", "POST", "PATCH"]),
      AllowHeaders: Match.arrayWith(["idempotency-key"]),
    }),
  });
  template.resourceCountIs("AWS::Lambda::EventSourceMapping", 1);
  template.resourceCountIs("AWS::SQS::Queue", 1);
  template.resourceCountIs("AWS::Events::Rule", 1);
  template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
    FunctionResponseTypes: ["ReportBatchItemFailures"],
    StartingPosition: "LATEST",
    DestinationConfig: { OnFailure: { Destination: Match.anyValue() } },
  });
  template.hasResourceProperties("AWS::Cognito::UserPool", {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: true }, MfaConfiguration: "ON",
  });
  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    GenerateSecret: false, AllowedOAuthFlows: ["code"], AllowedOAuthScopes: ["openid"],
    CallbackURLs: Match.arrayWith([Match.objectLike({ "Fn::Join": Match.anyValue() })]),
  });
  template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
    Domain: "rct-dotcom-development-123456789012",
  });
  template.resourceCountIs("AWS::Cognito::UserPoolUser", 0);
  template.resourceCountIs("AWS::Cognito::UserPoolUserToGroupAttachment", 0);
  template.resourceCountIs("AWS::CloudFront::Function", 1);
  const distribution = JSON.stringify(template.findResources("AWS::CloudFront::Distribution"));
  assert.match(distribution, /viewer-request/);
  assert.match(JSON.stringify(template.findResources("AWS::Cognito::UserPoolClient")), /\/internal/);
  const rewriteCode = Object.values(template.findResources("AWS::CloudFront::Function"))[0]?.Properties.FunctionCode;
  assert.equal(typeof rewriteCode, "string");
  const rewrite = runInNewContext(`${rewriteCode}; handler`) as (event: { request: object }) => { uri: string; querystring: object };
  for (const [method, uri, expected] of [
    ["GET", "/internal", "/index.html"], ["HEAD", "/internal/", "/index.html"],
    ["POST", "/internal", "/internal"], ["GET", "/unknown", "/unknown"],
    ["GET", "/assets/missing.js", "/assets/missing.js"],
  ]) {
    const querystring = { state: { value: "unchanged" } };
    const result = rewrite({ request: { method, uri, querystring } });
    assert.equal(result.uri, expected);
    assert.equal(result.querystring, querystring);
  }
  template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
    GroupName: "CommunityAdministrators", UserPoolId: { Ref: poolId },
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
    IntegrationType: "AWS_PROXY",
  });
  for (const [name, defaultValue] of [
    ["ApplicationIntakeEnabled", "false"],
    ["ApplicationConsentPolicyVersion", ""],
    ["ApplicationRetentionDays", 0],
  ] as const) {
    template.hasParameter(name, { Default: defaultValue });
  }
  const policies = JSON.stringify(template.findResources("AWS::IAM::Policy"));
  assert.match(policies, /dynamodb:PutItem/);
  assert.match(policies, /dynamodb:EnclosingOperation/);
  assert.match(policies, /APPLICATION#\*/);
  assert.match(policies, /MENTOR_APPROVAL#\*/);
  assert.match(policies, /OUTBOX#\?/);
  assert.match(policies, /OUTBOX#RECONCILIATION/);
  assert.match(policies, /events:PutEvents/);
  assert.match(policies, /events:source/);
  assert.match(policies, /dotcom\.mentor\.approved\.v1/);
  assert.doesNotMatch(policies, /events:(Create|Delete|PutRule|PutTargets)|sts:AssumeRole/);
  for (const policy of Object.values(template.findResources("AWS::IAM::Policy"))) {
    for (const statement of policy.Properties.PolicyDocument.Statement) {
      if (statement.Resource === "*") assert.equal(statement.Action, "dynamodb:ListStreams");
    }
  }
});

test("production records and identities are retained with PITR and deletion protection", () => {
  const template = Template.fromStack(new ApplicationStack(app(), configuration("production", "123456789012")));
  template.hasResource("AWS::DynamoDB::Table", {
    DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain",
    Properties: Match.objectLike({
      TableName: "rct-dotcom-production-core", DeletionProtectionEnabled: true,
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    }),
  });
  template.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
  template.resourceCountIs("AWS::IAM::ManagedPolicy", 1);
  template.resourceCountIs("AWS::Cognito::UserPoolDomain", 1);
  template.resourceCountIs("AWS::CloudFront::Function", 1);
  assert.match(JSON.stringify(template.findResources("AWS::Cognito::UserPoolClient")), /\/internal/);
});

test("development web publisher has exact OIDC trust and a matching artifact-only permissions boundary", () => {
  const template = Template.fromStack(new ApplicationStack(app(), configuration("development", "123456789012")));
  template.resourceCountIs("AWS::IAM::OIDCProvider", 0);
  const publisher = Object.values(template.findResources("AWS::IAM::Role")).find((role) =>
    role.Properties.RoleName === "rct-dotcom-development-web-publish");
  assert.ok(publisher);
  assert.deepEqual(publisher.Properties.PermissionsBoundary, publisher.Properties.ManagedPolicyArns[0]);
  assert.deepEqual(publisher.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals, {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:CteNerd/community.wellcall.biz:environment:development",
  });
  const policies = JSON.stringify(template.findResources("AWS::IAM::ManagedPolicy"));
  const [bucketId] = Object.keys(template.findResources("AWS::S3::Bucket"));
  assert.ok(bucketId);
  template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
    PolicyDocument: {
      Statement: Match.arrayWith([Match.objectLike({
        Action: ["s3:GetBucketLocation", "s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus", "s3:ListBucket"],
        Resource: { "Fn::GetAtt": [bucketId, "Arn"] },
      })]),
    },
  });
  assert.match(policies, /s3:PutObject/);
  assert.match(policies, /assets\/\*|index\.html/);
  assert.match(policies, /cloudfront:CreateInvalidation/);
  assert.match(policies, /cloudformation:DescribeStacks/);
  assert.doesNotMatch(policies, /DeleteObject|PutBucket|UpdateDistribution|CreateStack|ExecuteChangeSet|iam:|dynamodb:|"Resource":"\*"/);
});

test("custom domains import the approved zone and cannot bypass production clearance", () => {
  const config = configuration("production", "123456789012");
  assert.throws(() => new ApplicationStack(app(), config, true), /approval/);
  const template = Template.fromStack(new ApplicationStack(app(), config, true, true));
  template.resourceCountIs("AWS::Route53::HostedZone", 0);
  template.hasResourceProperties("AWS::CertificateManager::Certificate", {
    DomainName: "cutblock.org", SubjectAlternativeNames: ["api.cutblock.org"],
    DomainValidationOptions: Match.arrayWith([Match.objectLike({ HostedZoneId: config.hostedZoneId })]),
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "api.cutblock.org" });
  template.resourceCountIs("AWS::Route53::RecordSet", 3);
});

test("invalid target configuration fails rather than selecting a default", () => {
  assert.throws(() => configuration("staging", "123456789012"), /environment/);
  assert.throws(() => configuration("development", "invalid"), /account/);
});

test("real account development updates preserve the external alias/certificate without adopting DNS", () => {
  for (const customDomains of [false, true]) {
    const config = configuration("development", "425061472162");
    const template = Template.fromStack(new ApplicationStack(app(), config, customDomains));
    template.resourceCountIs("AWS::Route53::RecordSet", 0);
    template.resourceCountIs("AWS::Route53::HostedZone", 0);
    template.resourceCountIs("AWS::CertificateManager::Certificate", 0);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["dev.cutblock.org"],
        ViewerCertificate: {
          AcmCertificateArn: developmentCertificateArn,
          MinimumProtocolVersion: "TLSv1.2_2021", SslSupportMethod: "sni-only",
        },
      }),
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      CallbackURLs: ["https://dev.cutblock.org/internal"], LogoutURLs: ["https://dev.cutblock.org/"],
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ["https://dev.cutblock.org"] }),
    });
  }
  assert.throws(() => configuration("development", "111122223333", developmentCertificateArn), /certificate/);
  assert.throws(() => configuration("production", "425061472162", developmentCertificateArn), /certificate/);
});

test("approved production identity, private deep links, public headers and publisher stay coherent and closed", () => {
  const template = Template.fromStack(new ApplicationStack(app(), configuration("production", "425061472162"), true, true));
  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    CallbackURLs: ["https://cutblock.org/internal"], LogoutURLs: ["https://cutblock.org/"],
    AllowedOAuthScopes: ["openid"],
  });
  template.hasResourceProperties("AWS::Cognito::UserPoolDomain", { Domain: "rct-dotcom-production-425061472162" });
  template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
    CorsConfiguration: Match.objectLike({ AllowOrigins: ["https://cutblock.org"] }),
  });
  const distribution = Object.values(template.findResources("AWS::CloudFront::Distribution"))[0]!.Properties.DistributionConfig;
  assert.equal(distribution.CustomErrorResponses, undefined);
  assert.deepEqual(distribution.CacheBehaviors.map((b: { PathPattern: string }) => b.PathPattern), ["/internal", "/internal/"]);
  for (const behavior of distribution.CacheBehaviors) {
    assert.notDeepEqual(behavior.ResponseHeadersPolicyId, distribution.DefaultCacheBehavior.ResponseHeadersPolicyId);
  }
  template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
    ResponseHeadersPolicyConfig: Match.objectLike({
      CustomHeadersConfig: { Items: [{ Header: "X-Robots-Tag", Value: "noindex, nofollow", Override: true }] },
    }),
  });
  const role = Object.values(template.findResources("AWS::IAM::Role")).find((r) =>
    r.Properties.RoleName === "rct-dotcom-production-web-publish")!;
  assert.deepEqual(role.Properties.PermissionsBoundary, role.Properties.ManagedPolicyArns[0]);
  assert.equal(role.Properties.Path, "/rct/dotcom/production/");
  assert.deepEqual(role.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals, {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:CteNerd/community.wellcall.biz:environment:production",
  });
  const policies = JSON.stringify(template.findResources("AWS::IAM::ManagedPolicy"));
  assert.doesNotMatch(policies, /DeleteObject|PutBucket|UpdateDistribution|CreateStack|ExecuteChangeSet|iam:|dynamodb:|"Resource":"\*"/);
  template.resourceCountIs("AWS::Cognito::UserPoolUser", 0);
  template.resourceCountIs("AWS::Cognito::UserPoolUserToGroupAttachment", 0);
  template.hasParameter("ApplicationIntakeEnabled", { Default: "false" });
  template.hasParameter("ApplicationConsentPolicyVersion", { Default: "" });
  template.hasParameter("ApplicationRetentionDays", { Default: 0 });
});

test("runtime IAM allows first-approval guard transactions and durable cursor only on required table keys", () => {
  const template = Template.fromStack(new ApplicationStack(app(), configuration("production", "425061472162")));
  const [tableId] = Object.keys(template.findResources("AWS::DynamoDB::Table"));
  const policies = Object.values(template.findResources("AWS::IAM::Policy"));
  const apiPolicy = policies.find((p) => JSON.stringify(p.Properties.Roles).includes("ApiRole"))!;
  const publisherPolicy = policies.find((p) => JSON.stringify(p.Properties.Roles).includes("OutboxPublisherRole"))!;
  const statements = apiPolicy.Properties.PolicyDocument.Statement;
  for (const action of ["dynamodb:GetItem", "dynamodb:PutItem"]) {
    const statement = statements.find((s: { Action: string }) => s.Action === action);
    assert.deepEqual(statement.Resource, { "Fn::GetAtt": [tableId, "Arn"] });
    assert.ok(statement.Condition["ForAllValues:StringLike"]["dynamodb:LeadingKeys"].includes("MENTOR_APPROVAL#*"));
    assert.equal(statement.Condition.Null["dynamodb:LeadingKeys"], "false");
    if (action === "dynamodb:PutItem") {
      assert.deepEqual(statement.Condition["ForAnyValue:StringEquals"]["dynamodb:EnclosingOperation"], ["TransactWriteItems"]);
    }
  }
  for (const action of ["dynamodb:GetItem", "dynamodb:UpdateItem"]) {
    const statement = publisherPolicy.Properties.PolicyDocument.Statement.find((s: { Action: string; Condition?: Record<string, unknown> }) =>
      s.Action === action && s.Condition?.["ForAllValues:StringEquals"]);
    assert.deepEqual(statement.Resource, { "Fn::GetAtt": [tableId, "Arn"] });
    assert.deepEqual(statement.Condition["ForAllValues:StringEquals"]["dynamodb:LeadingKeys"], ["OUTBOX#RECONCILIATION"]);
    assert.equal(statement.Condition.Null["dynamodb:LeadingKeys"], "false");
  }
  const scoped = JSON.stringify([apiPolicy, publisherPolicy]);
  assert.doesNotMatch(scoped, /dynamodb:(Scan|BatchGetItem|BatchWriteItem|DeleteItem)|OUTBOX#\*/);
});

test("actual assemblies use isolated release assets and current credentials without shared roles or bootstrap SSM", () => {
  for (const environment of ["development", "production"] as const) {
    const application = app();
    const stack = new ApplicationStack(application, configuration(environment, "425061472162"),
      environment === "production", environment === "production");
    const assembly = application.synth();
    const manifest = JSON.parse(readFileSync(resolve(assembly.directory, "manifest.json"), "utf8"));
    const artifact = assembly.getStackArtifact(stack.artifactId);
    const template = JSON.parse(readFileSync(resolve(assembly.directory, artifact.templateFile), "utf8"));
    const assets = JSON.parse(readFileSync(resolve(assembly.directory, `${stack.artifactId}.assets.json`), "utf8"));
    const bucket = `rct-dotcom-${environment}-release-assets-425061472162-us-east-1`;
    assert.equal(Object.keys(assets.files).length, 3);
    assert.equal(Object.keys(assets.dockerImages ?? {}).length, 0);
    for (const file of Object.values(assets.files) as Array<{ destinations: Record<string, { bucketName: string; objectKey: string }> }>) {
      for (const destination of Object.values(file.destinations)) {
        assert.equal(destination.bucketName, bucket);
        assert.match(destination.objectKey, /^release\/[a-f0-9]{64}\.(zip|json)$/);
      }
    }
    const properties = manifest.artifacts[stack.artifactId].properties;
    assert.ok(properties.stackTemplateAssetObjectUrl.startsWith(`s3://${bucket}/release/`));
    assert.doesNotMatch(JSON.stringify({ manifest, assets, template }),
      /hnb659fds|CDKToolkit|cdk-bootstrap|assumeRoleArn|cloudFormationExecutionRoleArn|lookupRole|BootstrapVersion/);
    const lambdaFunctions = Object.values(template.Resources).filter((resource) =>
      (resource as { Type: string }).Type === "AWS::Lambda::Function") as Array<{ Properties: { Code: { S3Bucket: string; S3Key: string } } }>;
    assert.equal(lambdaFunctions.length, 2);
    for (const fn of lambdaFunctions) {
      assert.equal(fn.Properties.Code.S3Bucket, bucket);
      assert.match(fn.Properties.Code.S3Key, /^release\/[a-f0-9]{64}\.zip$/);
    }
  }
});

test("production asset bootstrap is retained, versioned, encrypted, private and TLS-only without identity resources", () => {
  const template = JSON.parse(readFileSync(new URL("../bootstrap/production-release-assets.template.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.values(template.Resources).map((resource) => (resource as { Type: string }).Type).sort(),
    ["AWS::S3::Bucket", "AWS::S3::BucketPolicy"]);
  const bucket = template.Resources.ReleaseAssets;
  assert.equal(bucket.DeletionPolicy, "Retain");
  assert.equal(bucket.UpdateReplacePolicy, "Retain");
  assert.equal(bucket.Properties.BucketName["Fn::Sub"], "rct-dotcom-production-release-assets-${AWS::AccountId}-${AWS::Region}");
  assert.deepEqual(bucket.Properties.VersioningConfiguration, { Status: "Enabled" });
  assert.equal(bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.SSEAlgorithm, "AES256");
  assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  });
  assert.deepEqual(bucket.Properties.OwnershipControls, { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] });
  assert.equal(template.Resources.ReleaseAssetsPolicy.DeletionPolicy, "Retain");
  assert.equal(template.Resources.ReleaseAssetsPolicy.UpdateReplacePolicy, "Retain");
  const statements = template.Resources.ReleaseAssetsPolicy.Properties.PolicyDocument.Statement;
  assert.equal(statements.length, 1);
  assert.deepEqual(statements[0], {
    Effect: "Deny", Principal: "*", Action: "s3:*",
    Resource: [{ "Fn::GetAtt": ["ReleaseAssets", "Arn"] }, { "Fn::Sub": "${ReleaseAssets.Arn}/*" }],
    Condition: { Bool: { "aws:SecureTransport": "false" } },
  });
  assert.doesNotMatch(JSON.stringify(template), /rct-dotcom-development|hnb659fds|CDKToolkit|AWS::IAM::|AWS::SSM::/);
});
