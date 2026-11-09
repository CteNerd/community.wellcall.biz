export type InternalConfig = {
  apiBase: string;
  issuer: string;
  oauthOrigin: string;
  clientId: string;
  redirectUri: string;
  logoutUri: string;
  intake: { policyVersion: string; policyUrl: string; retentionDays: number } | null;
};

type Environment = Record<string, unknown>;
const text = (env: Environment, key: string) =>
  typeof env[key] === "string" ? (env[key] as string).trim() : "";

function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash ? url : null;
  } catch { return null; }
}

/** Missing or malformed explicit settings close the internal UI, never the public preview. */
export function readInternalConfig(env: Environment, origin: string): InternalConfig | null {
  if (env.VITE_COMMUNITY_INTERNAL_ENABLED !== "true") return null;
  const api = httpsUrl(text(env, "VITE_COMMUNITY_API_BASE"));
  const issuer = httpsUrl(text(env, "VITE_COMMUNITY_AUTH_ISSUER"));
  const oauth = httpsUrl(text(env, "VITE_COMMUNITY_OAUTH_ORIGIN"));
  const clientId = text(env, "VITE_COMMUNITY_CLIENT_ID");
  const redirectUri = text(env, "VITE_COMMUNITY_REDIRECT_URI");
  const logoutUri = text(env, "VITE_COMMUNITY_LOGOUT_URI");
  try {
    const redirect = new URL(redirectUri);
    const logout = new URL(logoutUri);
    if (!api || !issuer || !oauth || oauth.pathname !== "/" || !/^[a-zA-Z0-9]+$/.test(clientId)
      || redirect.origin !== origin || redirect.pathname !== "/internal" || redirect.search || redirect.hash
      || logout.origin !== origin || logout.pathname !== "/" || logout.search || logout.hash
      || !["https:", "http:"].includes(redirect.protocol)
      || (redirect.protocol === "http:" && !isLoopback(redirect.hostname))) return null;
    const policyVersion = text(env, "VITE_COMMUNITY_CONSENT_POLICY_VERSION");
    const policy = httpsUrl(text(env, "VITE_COMMUNITY_CONSENT_POLICY_URL"));
    const retentionDays = Number(env.VITE_COMMUNITY_RETENTION_DAYS);
    const intake = env.VITE_COMMUNITY_INTAKE_APPROVED === "true"
      && env.VITE_COMMUNITY_READINESS_APPROVED === "true"
      && env.VITE_COMMUNITY_SERVER_INTAKE_APPROVED === "true"
      && policyVersion && policy && Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 3650
      ? { policyVersion, policyUrl: policy.href, retentionDays } : null;
    return {
      apiBase: api.href.replace(/\/$/, ""), issuer: issuer.href.replace(/\/$/, ""),
      oauthOrigin: oauth.origin, clientId, redirectUri, logoutUri, intake,
    };
  } catch { return null; }
}

export function isLoopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

export function syntheticAllowed(dev: boolean, flag: unknown, hostname: string): boolean {
  return dev && flag === "true" && isLoopback(hostname);
}
