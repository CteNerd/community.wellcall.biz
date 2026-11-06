import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { configuration } from "./config.ts";
import { ApplicationStack } from "./stack.ts";

test("development foundation has private hosting, no DNS writes, and protected identity routing", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("development", "123456789012")));
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "rct-dotcom-development-core", BillingMode: "PAY_PER_REQUEST",
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
  template.resourceCountIs("AWS::ApiGatewayV2::Route", 2);
  template.hasResourceProperties("AWS::Cognito::UserPool", {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: true }, MfaConfiguration: "ON",
  });
  const policies = JSON.stringify(template.findResources("AWS::IAM::Policy"));
  assert.doesNotMatch(policies, /dynamodb:|events:|sts:AssumeRole|"Resource":"\*"/);
});

test("production records and identities are retained with PITR and deletion protection", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("production", "123456789012")));
  template.hasResource("AWS::DynamoDB::Table", {
    DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain",
    Properties: Match.objectLike({
      TableName: "rct-dotcom-production-core", DeletionProtectionEnabled: true,
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    }),
  });
  template.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
  template.resourceCountIs("AWS::IAM::ManagedPolicy", 0);
});

test("development web publisher has exact OIDC trust and a matching artifact-only permissions boundary", () => {
  const template = Template.fromStack(new ApplicationStack(new App(), configuration("development", "123456789012")));
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
  assert.throws(() => new ApplicationStack(new App(), config, true), /approval/);
  const template = Template.fromStack(new ApplicationStack(new App(), config, true, true));
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
