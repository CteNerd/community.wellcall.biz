const repository = "CteNerd/community.wellcall.biz";
const prefix = "rct-dotcom-development";
const rolePath = "/rct/dotcom/development/";

export type PreviewRelease = {
  bucket: string;
  distributionId: string;
  webUrl: string;
  apiUrl: string;
};

export function validateReleaseEnvironment(env: NodeJS.ProcessEnv): { account: string; roleArn: string } {
  if (env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== "refs/heads/main"
    || env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new Error("Development publishing requires a manual run on this repository's main branch");
  }
  const account = env.AWS_ACCOUNT_ID;
  if (!account || !/^\d{12}$/.test(account) || account === "123456789012") {
    throw new Error("Set development variable AWS_ACCOUNT_ID to the verified real account");
  }
  const roleArn = `arn:aws:iam::${account}:role${rolePath}${prefix}-web-publish`;
  if (env.AWS_WEB_PUBLISH_ROLE_ARN !== roleArn) {
    throw new Error("Set AWS_WEB_PUBLISH_ROLE_ARN to this development stack's WebPublishRoleArn output");
  }
  return { account, roleArn };
}

export function parsePreviewStack(value: unknown, env: NodeJS.ProcessEnv): PreviewRelease {
  const { account, roleArn } = validateReleaseEnvironment(env);
  if (!isRecord(value) || !Array.isArray(value.Stacks) || value.Stacks.length !== 1) {
    throw new Error("Expected exactly one deployed preview stack");
  }
  const stack: unknown = value.Stacks[0];
  const stackName = `${prefix}-foundation`;
  if (!isRecord(stack) || stack.StackName !== stackName
    || typeof stack.StackId !== "string"
    || !stack.StackId.startsWith(`arn:aws:cloudformation:us-east-1:${account}:stack/${stackName}/`)
    || !["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"].includes(String(stack.StackStatus))) {
    throw new Error("Preview stack is missing, belongs to another target, or is not ready");
  }
  const outputs = readOutputs(stack.Outputs);
  if (outputs.WebPublishRoleArn !== roleArn) throw new Error("Publisher role does not match the deployed stack");
  const bucket = requiredOutput(outputs, "WebBucket", /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);
  const distributionId = requiredOutput(outputs, "DistributionId", /^[A-Z0-9]{8,32}$/);
  const webUrl = requiredOutput(outputs, "WebUrl", /^https:\/\/[a-z0-9]+\.cloudfront\.net$/);
  const apiUrl = requiredOutput(outputs, "ApiUrl", /^https:\/\/[a-z0-9]+\.execute-api\.us-east-1\.amazonaws\.com$/);
  return { bucket, distributionId, webUrl, apiUrl };
}

export function verifyPreviewDistribution(value: unknown, release: Pick<PreviewRelease, "bucket" | "distributionId" | "webUrl">): void {
  const distribution = isRecord(value) ? value.Distribution : undefined;
  if (!isRecord(distribution) || distribution.Id !== release.distributionId
    || `https://${String(distribution.DomainName)}` !== release.webUrl || distribution.Status !== "Deployed") {
    throw new Error("Distribution does not match the ready preview destination");
  }
  const config = distribution.DistributionConfig;
  const origins = isRecord(config) && isRecord(config.Origins) ? config.Origins.Items : undefined;
  if (!isRecord(config) || config.Enabled !== true || !Array.isArray(origins) || origins.length !== 1
    || !isRecord(origins[0])
    || origins[0].DomainName !== `${release.bucket}.s3.us-east-1.amazonaws.com`
    || typeof origins[0].OriginAccessControlId !== "string" || !origins[0].OriginAccessControlId) {
    throw new Error("Preview distribution must serve only the stack's private S3 bucket through OAC");
  }
}

export function verifyPreviewHealth(value: unknown): void {
  if (!isRecord(value) || value.status !== "ok" || value.application !== "community") {
    throw new Error("Development API health did not identify the expected application");
  }
}

function readOutputs(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) throw new Error("Deployed stack outputs are missing");
  const outputs: Record<string, string> = {};
  for (const output of value) {
    if (!isRecord(output) || typeof output.OutputKey !== "string" || typeof output.OutputValue !== "string"
      || Object.hasOwn(outputs, output.OutputKey)) throw new Error("Invalid or duplicate deployed stack output");
    Object.defineProperty(outputs, output.OutputKey, { value: output.OutputValue, enumerable: true });
  }
  return outputs;
}

function requiredOutput(outputs: Record<string, string>, key: string, pattern: RegExp): string {
  const value = outputs[key];
  if (!value || !pattern.test(value)) throw new Error(`Invalid or missing ${key} output`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
