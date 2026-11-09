import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parsePreviewStack, validateReleaseEnvironment, verifyPreviewBucket, verifyPreviewDistribution, verifyPreviewHealth } from "./web-release.ts";
import { handler, type Request } from "../../apps/api/src/handler.ts";

const account = "111122223333";
const roleArn = `arn:aws:iam::${account}:role/rct/dotcom/development/rct-dotcom-development-web-publish`;
const env = {
  GITHUB_REPOSITORY: "CteNerd/community.wellcall.biz", GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch", AWS_ACCOUNT_ID: account, AWS_WEB_PUBLISH_ROLE_ARN: roleArn,
};

function stackMetadata(overrides: Record<string, string> = {}) {
  return { Stacks: [{
    StackName: "rct-dotcom-development-foundation",
    StackId: `arn:aws:cloudformation:us-east-1:${account}:stack/rct-dotcom-development-foundation/test`,
    StackStatus: "CREATE_COMPLETE",
    Outputs: Object.entries({
      WebBucket: "community-development-web-test", DistributionId: "E123456789TEST",
      WebUrl: "https://previewtest.cloudfront.net", ApiUrl: "https://apitest.execute-api.us-east-1.amazonaws.com",
      WebPublishRoleArn: roleArn, ...overrides,
    }).map(([OutputKey, OutputValue]) => ({ OutputKey, OutputValue })),
  }] };
}

test("publishing rejects missing variables, other branches, automatic events and production roles", () => {
  for (const override of [
    { AWS_ACCOUNT_ID: "" }, { AWS_ACCOUNT_ID: "123456789012" },
    { GITHUB_REF: "refs/heads/feature" }, { GITHUB_EVENT_NAME: "push" },
    { GITHUB_REPOSITORY: "other/repo" }, { AWS_WEB_PUBLISH_ROLE_ARN: roleArn.replaceAll("development", "production") },
  ]) assert.throws(() => validateReleaseEnvironment({ ...env, ...override }));
});

test("explicit production release never accepts development roles, hosts, stacks or synthetic accounts", () => {
  const productionAccount = "425061472162";
  const productionRole = `arn:aws:iam::${productionAccount}:role/rct/dotcom/production/rct-dotcom-production-web-publish`;
  const productionEnv = { ...env, RELEASE_ENVIRONMENT: "production", AWS_ACCOUNT_ID: productionAccount, AWS_WEB_PUBLISH_ROLE_ARN: productionRole };
  const value = stackMetadata({
    WebUrl: "https://cutblock.org", WebPublishRoleArn: productionRole,
  });
  value.Stacks[0]!.StackName = "rct-dotcom-production-foundation";
  value.Stacks[0]!.StackId = `arn:aws:cloudformation:us-east-1:${productionAccount}:stack/rct-dotcom-production-foundation/test`;
  assert.equal(parsePreviewStack(value, productionEnv).webUrl, "https://cutblock.org");
  assert.throws(() => parsePreviewStack(value, env));
  assert.throws(() => parsePreviewStack(stackMetadata(), productionEnv));
  for (const override of [
    { AWS_WEB_PUBLISH_ROLE_ARN: roleArn }, { AWS_ACCOUNT_ID: account },
    { RELEASE_ENVIRONMENT: "other" },
  ]) assert.throws(() => validateReleaseEnvironment({ ...productionEnv, ...override }));
  for (const output of value.Stacks[0]!.Outputs) {
    if (output.OutputKey === "WebUrl") output.OutputValue = "https://dev.cutblock.org";
  }
  assert.throws(() => parsePreviewStack(value, productionEnv));
});

test("preview metadata fails closed on unsafe destinations, role drift and unfinished stacks", () => {
  assert.equal(parsePreviewStack(stackMetadata(), env).webUrl, "https://previewtest.cloudfront.net");
  assert.equal(parsePreviewStack(stackMetadata({ WebUrl: "https://dev.cutblock.org" }), env).webUrl,
    "https://dev.cutblock.org");
  const unsafeOutputs: Array<Record<string, string>> = [
    { WebUrl: "https://production.example" }, { WebUrl: "https://cutblock.org" },
    { WebBucket: "bucket\nOTHER=value" },
    { ApiUrl: "http://api.example" }, { WebPublishRoleArn: `${roleArn}-other` },
  ];
  for (const override of unsafeOutputs) assert.throws(() => parsePreviewStack(stackMetadata(override), env));
  const changing = stackMetadata();
  changing.Stacks[0]!.StackStatus = "UPDATE_IN_PROGRESS";
  assert.throws(() => parsePreviewStack(changing, env), /not ready/);
  const duplicate = stackMetadata();
  duplicate.Stacks[0]!.Outputs.push({ OutputKey: "WebUrl", OutputValue: "https://previewtest.cloudfront.net" });
  assert.throws(() => parsePreviewStack(duplicate, env), /duplicate/);
});

test("distribution verification rejects a different origin or disabled distribution and verifies API identity", async () => {
  const release = parsePreviewStack(stackMetadata(), env);
  const distribution = { Distribution: {
    Id: release.distributionId, DomainName: "previewtest.cloudfront.net", Status: "Deployed",
    DistributionConfig: { Enabled: true, Origins: { Items: [{
      DomainName: `${release.bucket}.s3.us-east-1.amazonaws.com`, OriginAccessControlId: "OAC-test",
    }] } },
  } };
  verifyPreviewDistribution(distribution, release);
  const customRelease = parsePreviewStack(stackMetadata({ WebUrl: "https://dev.cutblock.org" }), env);
  const customDistribution = { Distribution: {
    Id: customRelease.distributionId, DomainName: "previewtest.cloudfront.net", Status: "Deployed",
    DistributionConfig: {
      Enabled: true,
      Aliases: { Quantity: 1, Items: ["dev.cutblock.org"] },
      ViewerCertificate: {
        ACMCertificateArn: `arn:aws:acm:us-east-1:${account}:certificate/12345678-1234-4234-8234-123456789abc`,
        SSLSupportMethod: "sni-only",
        MinimumProtocolVersion: "TLSv1.2_2021",
      },
      Origins: { Items: [{
        DomainName: `${customRelease.bucket}.s3.us-east-1.amazonaws.com`, OriginAccessControlId: "OAC-test",
      }] },
    },
  } };
  verifyPreviewDistribution(customDistribution, customRelease);
  customDistribution.Distribution.DistributionConfig.Aliases.Items[0] = "cutblock.org";
  assert.throws(() => verifyPreviewDistribution(customDistribution, customRelease), /Custom preview hostname/);
  customDistribution.Distribution.DistributionConfig.Aliases.Items[0] = "dev.cutblock.org";
  customDistribution.Distribution.DistributionConfig.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2019";
  assert.throws(() => verifyPreviewDistribution(customDistribution, customRelease), /Custom preview hostname/);
  distribution.Distribution.DistributionConfig.Origins.Items[0]!.DomainName = "unrelated.s3.us-east-1.amazonaws.com";
  assert.throws(() => verifyPreviewDistribution(distribution, release), /private S3 bucket/);
  distribution.Distribution.DistributionConfig.Enabled = false;
  assert.throws(() => verifyPreviewDistribution(distribution, release));
  const healthRequest: Request = {
    version: "2.0", routeKey: "GET /health", rawPath: "/health", rawQueryString: "",
    headers: {}, isBase64Encoded: false,
    requestContext: {
      accountId: account, apiId: "test", domainName: "api.example.invalid", domainPrefix: "api",
      requestId: "test", routeKey: "GET /health", stage: "$default", time: "test", timeEpoch: 0,
      http: { method: "GET", path: "/health", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
    },
  };
  const response = await handler(healthRequest);
  assert.equal(response.statusCode, 200);
  verifyPreviewHealth(JSON.parse(response.body!));
  assert.throws(() => verifyPreviewHealth({ status: "ok", application: "consulting" }));
});

test("bucket verification requires every public-access block and an explicitly non-public policy", () => {
  const config = {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  };
  const policy = { PolicyStatus: { IsPublic: false } };
  verifyPreviewBucket({ PublicAccessBlockConfiguration: config }, policy);
  for (const key of Object.keys(config)) {
    assert.throws(() => verifyPreviewBucket({ PublicAccessBlockConfiguration: { ...config, [key]: false } }, policy),
      /public-access blocks/);
  }
  assert.throws(() => verifyPreviewBucket({}, policy), /public-access blocks/);
  for (const unsafePolicy of [undefined, {}, { PolicyStatus: {} }, { PolicyStatus: { IsPublic: true } },
    { PolicyStatus: { IsPublic: "false" } }]) {
    assert.throws(() => verifyPreviewBucket({ PublicAccessBlockConfiguration: config }, unsafePolicy), /non-public/);
  }
});

test("release CLI emits only validated destinations and exits unsuccessfully when configuration is absent", (t) => {
  const directory = join(process.cwd(), `.community-release-test-${randomUUID()}`);
  mkdirSync(directory);
  t.after(() => rmSync(directory, { recursive: true }));
  const metadataPath = join(directory, "stack.json");
  const environmentPath = join(directory, "github-env");
  writeFileSync(metadataPath, JSON.stringify(stackMetadata()));
  const script = fileURLToPath(new URL("./check-web-release.ts", import.meta.url));
  const success = spawnSync(process.execPath, [script, "stack", metadataPath], {
    env: { ...process.env, ...env, GITHUB_ENV: environmentPath }, encoding: "utf8",
  });
  assert.equal(success.status, 0, success.stderr);
  const output = readFileSync(environmentPath, "utf8");
  assert.match(output, /PREVIEW_API_URL=https:\/\/apitest\.execute-api\.us-east-1\.amazonaws\.com\n/);
  assert.equal(output.trim().split("\n").length, 4);
  const accessBlockPath = join(directory, "access-block.json");
  const policyPath = join(directory, "policy-status.json");
  writeFileSync(accessBlockPath, JSON.stringify({ PublicAccessBlockConfiguration: {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  } }));
  writeFileSync(policyPath, JSON.stringify({ PolicyStatus: { IsPublic: false } }));
  const privateBucket = spawnSync(process.execPath, [script, "bucket", accessBlockPath, policyPath], {
    env: { ...process.env, ...env }, encoding: "utf8",
  });
  assert.equal(privateBucket.status, 0, privateBucket.stderr);
  writeFileSync(policyPath, JSON.stringify({ PolicyStatus: { IsPublic: true } }));
  const publicBucket = spawnSync(process.execPath, [script, "bucket", accessBlockPath, policyPath], {
    env: { ...process.env, ...env }, encoding: "utf8",
  });
  assert.notEqual(publicBucket.status, 0);
  assert.match(publicBucket.stderr, /non-public/);
  const missing = spawnSync(process.execPath, [script, "environment"], {
    env: { ...process.env, ...env, AWS_ACCOUNT_ID: "" }, encoding: "utf8",
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /AWS_ACCOUNT_ID/);
});
