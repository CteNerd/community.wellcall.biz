import { useEffect, useMemo, useState } from "react";
import { createApplicationApi } from "./api.ts";
import { PublicClientAuth, type AuthSession } from "./auth.ts";
import { readInternalConfig } from "./config.ts";
import { Workflow } from "./Workflow.tsx";
import "./internal.css";

export function InternalRoot() {
  const config = useMemo(() => readInternalConfig(import.meta.env, location.origin), []);
  const auth = useMemo(() => config ? new PublicClientAuth(config) : null, [config]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const api = useMemo(() => config && auth ? createApplicationApi(config.apiBase, auth.accessToken, (status) => {
    auth.clear(); setSession(null);
    setError(status === 401 ? "Session expired. Sign in again." : "Access denied. All workspace data has been cleared.");
  }) : null, [config, auth]);

  useEffect(() => {
    if (!auth) { setChecking(false); return; }
    let mounted = true;
    void auth.callback().then((value) => { if (mounted) setSession(value); })
      .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : "Sign-in failed."); })
      .finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; auth.clear(); };
  }, [auth]);
  useEffect(() => {
    if (!session || !auth) return;
    const timer = window.setTimeout(() => {
      auth.clear(); setSession(null); setError("Session expired. Workspace data has been cleared.");
    }, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session, auth]);

  if (session && api && config && auth) return <Workflow api={api} administrator={session.administrator} intake={config.intake}
    logout={() => { auth.clear(); setSession(null); auth.logout(); }} />;
  return <main className="internal-shell">
    <h1>Internal workspace {config ? "sign-in" : "closed"}</h1>
    <p>Public enrollment remains closed. No applicant or reviewer data is available without configured, authenticated access.</p>
    {error && <p role="alert">{error}</p>}
    {config && auth && <button disabled={checking} onClick={() => {
      setError("");
      void auth.login().catch(() => setError("Unable to start hosted sign-in. Check approved configuration."));
    }}>{checking ? "Checking sign-in…" : "Sign in with hosted login"}</button>}
    <a href="/">Return to public preview</a>
  </main>;
}
