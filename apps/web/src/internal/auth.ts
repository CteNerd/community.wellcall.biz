import type { InternalConfig } from "./config.ts";

export type AuthSession = { expiresAt: number; administrator: boolean };
const transactionKey = "community.pkce.transaction";
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function exactAdminGroup(value: unknown): boolean {
  return Array.isArray(value) && value.some((group) => group === "CommunityAdministrators");
}

export class PublicClientAuth {
  private token: string | null = null;
  private expiry = 0;
  constructor(private config: InternalConfig) {}

  accessToken = () => Date.now() < this.expiry ? this.token : null;

  clear() {
    this.token = null;
    this.expiry = 0;
    sessionStorage.removeItem(transactionKey);
  }

  async login() {
    this.clear();
    const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
    const state = encode(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    sessionStorage.setItem(transactionKey, JSON.stringify({ verifier, state, createdAt: Date.now() }));
    const url = new URL("/oauth2/authorize", this.config.oauthOrigin);
    url.search = new URLSearchParams({
      response_type: "code", client_id: this.config.clientId, redirect_uri: this.config.redirectUri,
      scope: "openid", state, code_challenge: challenge, code_challenge_method: "S256",
    }).toString();
    location.assign(url.href);
  }

  async callback(): Promise<AuthSession | null> {
    const params = new URLSearchParams(location.search);
    if (!params.has("code") && !params.has("error") && !params.has("state")) return null;
    const stored = sessionStorage.getItem(transactionKey);
    this.clear();
    history.replaceState(null, "", "/internal");
    try {
      const transaction: unknown = JSON.parse(stored ?? "null");
      if (typeof transaction !== "object" || transaction === null) throw new Error();
      const tx = transaction as Record<string, unknown>;
      if (params.has("error") || params.getAll("code").length !== 1 || params.getAll("state").length !== 1
        || typeof tx.state !== "string" || tx.state !== params.get("state")
        || typeof tx.verifier !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(tx.verifier)
        || typeof tx.createdAt !== "number" || Date.now() - tx.createdAt > 600_000 || tx.createdAt > Date.now()) throw new Error();
      const response = await fetch(new URL("/oauth2/token", this.config.oauthOrigin), {
        method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code", client_id: this.config.clientId,
          redirect_uri: this.config.redirectUri, code: params.get("code")!, code_verifier: tx.verifier,
        }),
      });
      if (!response.ok) throw new Error();
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null) throw new Error();
      const tokens = result as Record<string, unknown>;
      if (tokens.token_type !== "Bearer" || typeof tokens.access_token !== "string"
        || typeof tokens.expires_in !== "number" || tokens.expires_in <= 0) throw new Error();
      const payload = tokens.access_token.split(".")[1];
      if (!payload) throw new Error();
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
      if (claims.iss !== this.config.issuer || claims.client_id !== this.config.clientId
        || claims.token_use !== "access" || typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) throw new Error();
      this.expiry = Math.min(claims.exp * 1000, Date.now() + tokens.expires_in * 1000);
      this.token = tokens.access_token;
      // Claims only tailor navigation. API Gateway and the server authorize every operation.
      return { expiresAt: this.expiry, administrator: exactAdminGroup(claims["cognito:groups"]) };
    } catch {
      this.clear();
      throw new Error("Hosted sign-in failed or expired. Start a new sign-in.");
    }
  }

  logout() {
    this.clear();
    const url = new URL("/logout", this.config.oauthOrigin);
    url.search = new URLSearchParams({ client_id: this.config.clientId, logout_uri: this.config.logoutUri }).toString();
    location.assign(url.href);
  }
}
