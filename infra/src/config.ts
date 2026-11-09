export const developmentCertificateArn = "arn:aws:acm:us-east-1:425061472162:certificate/9db61a17-da37-4d4a-a4a4-297344ef0d1f";

export function configuration(environment: unknown, account: unknown, existingDevelopmentCertificateArn?: unknown) {
  if (environment !== "development" && environment !== "production") {
    throw new Error("Explicit development or production environment is required");
  }
  if (typeof account !== "string" || !/^[0-9]{12}$/.test(account)) {
    throw new Error("Explicit 12-digit AWS account is required");
  }
  const importedCertificateArn = existingDevelopmentCertificateArn
    ?? (environment === "development" && account === "425061472162" ? developmentCertificateArn : undefined);
  if (importedCertificateArn !== undefined && (environment !== "development"
    || typeof importedCertificateArn !== "string"
    || !new RegExp(`^arn:aws:acm:us-east-1:${account}:certificate/[0-9a-f-]{36}$`).test(importedCertificateArn))) {
    throw new Error("Existing development certificate must belong to this account in us-east-1");
  }
  return {
    environment,
    account,
    region: "us-east-1",
    prefix: `rct-dotcom-${environment}`,
    webDomain: environment === "production" ? "cutblock.org" : "dev.cutblock.org",
    apiDomain: environment === "production" ? "api.cutblock.org" : undefined,
    hostedZoneName: "cutblock.org",
    hostedZoneId: "Z0137664LLACF7ULDODA",
    importedCertificateArn,
  } as const;
}

export type Configuration = ReturnType<typeof configuration>;
