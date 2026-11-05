export function configuration(environment: unknown, account: unknown) {
  if (environment !== "development" && environment !== "production") {
    throw new Error("Explicit development or production environment is required");
  }
  if (typeof account !== "string" || !/^[0-9]{12}$/.test(account)) {
    throw new Error("Explicit 12-digit AWS account is required");
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
  } as const;
}

export type Configuration = ReturnType<typeof configuration>;
