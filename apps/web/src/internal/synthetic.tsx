import { useMemo, useState } from "react";
import {
  ApplicationReviewError, reviewAdultApplication, withdrawAdultApplication, type AdultApplication,
  type ApplicationReviewAction,
} from "../../../../packages/domain/src/adult-application.ts";
import { createApplicationApi, type ApplicationApi, type Submission } from "./api.ts";
import { syntheticAllowed } from "./config.ts";
import { Workflow } from "./Workflow.tsx";

export const SYNTHETIC_BUILD_MARKER = "COMMUNITY_LOOPBACK_SYNTHETIC_ROLE_BYPASS_ONLY";
type Role = "participant" | "mentor" | "reviewer" | "lookalike";
type SyntheticRecord = AdultApplication & {
  version: number; createdAt: string; contactName: string; contactEmail: string; owner: Role;
};
const policy = "SYNTHETIC-NOT-CONSENT-v1";
const response = (status: number, value: object) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const summary = (item: SyntheticRecord) => ({
  applicationId: item.applicationId, kind: item.kind, status: item.status,
  version: item.version, createdAt: item.createdAt,
  ...(item.withdrawnAt ? { withdrawnAt: item.withdrawnAt } : {}),
});
function reviewerRecord(item: SyntheticRecord) {
  const result: Partial<SyntheticRecord> = { ...item };
  delete result.owner;
  return result;
}

/** Offline only: no AWS, network, credentials, publication, or persistent data. */
export function createSyntheticHarness(onDenied: (status: number) => void) {
  let role: Role | null = null;
  let denial: number | null = null;
  const records = new Map<string, SyntheticRecord>();
  const keys = new Map<string, { signature: string; id: string }>();
  const transport: typeof fetch = async (input, init) => {
    if (denial) { const status = denial; denial = null; return response(status, {}); }
    if (!role) return response(401, {});
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const isAdmin = url.pathname.startsWith("/admin/");
    if (isAdmin && role !== "reviewer") return response(403, {});
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.pathname === "/applications" && method === "POST") {
      if ((body.kind !== "participant" && body.kind !== "mentor") || body.consentAccepted !== true
        || body.expectedConsentPolicyVersion !== policy
        || typeof body.contactName !== "string" || !/^Synthetic [A-Za-z -]{2,80}$/.test(body.contactName)
        || typeof body.contactEmail !== "string" || !/^[a-z0-9.-]+@example\.invalid$/.test(body.contactEmail)) return response(400, {});
      const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
      const signature = JSON.stringify(body);
      const previous = keys.get(`${role}:${key}`);
      if (previous) {
        return previous.signature === signature
          ? response(200, { applicationId: previous.id, status: "under_review" }) : response(409, {});
      }
      const applicationId = crypto.randomUUID();
      const now = new Date().toISOString();
      records.set(applicationId, {
        applicationId, kind: body.kind, status: "under_review", version: 0, createdAt: now,
        adultEligibility: { status: "unverified" }, consentAcceptedAt: now, consentPolicyVersion: policy,
        mentorScreening: body.kind === "mentor" ? "pending" : "not_required",
        contactName: body.contactName, contactEmail: body.contactEmail, owner: role,
      });
      keys.set(`${role}:${key}`, { signature, id: applicationId });
      return response(201, { applicationId, status: "under_review" });
    }
    if (url.pathname === "/admin/applications" && method === "GET") {
      const cursor = url.searchParams.get("nextToken");
      const all = [...records.values()].reverse();
      const position = cursor ? all.findIndex((item) => item.applicationId === cursor) : -1;
      if (cursor && position === -1) return response(400, {});
      const pending = all.slice(position + 1).filter((item) => item.status === "under_review");
      // Two per page makes pagination observable with only synthetic fixtures.
      const applications = pending.slice(0, 2).map(reviewerRecord);
      return response(200, { applications, nextToken: pending.length > 2 ? applications.at(-1)?.applicationId : null });
    }
    const applicationId = url.pathname.split("/")[isAdmin ? 3 : 2] ?? "";
    const current = records.get(applicationId);
    if (!current || (!isAdmin && current.owner !== role)) return response(404, {});
    if (!isAdmin && method === "GET") return response(200, summary(current));
    if (body.expectedVersion !== current.version) return response(409, {});
    try {
      let updated: AdultApplication;
      if (!isAdmin && method === "POST" && url.pathname.endsWith("/withdraw")) {
        updated = withdrawAdultApplication(current, new Date());
      } else if (isAdmin && method === "PATCH") {
        const action = body.action === "verify_adult_eligibility" ? { type: body.action } as const
          : body.action === "record_mentor_screening" ? { type: body.action, result: body.result }
          : { type: "decide", decision: body.decision };
        // Reuse the domain's prerequisite checks; its aggregate descriptor is discarded, never emitted.
        updated = reviewAdultApplication(current, action as ApplicationReviewAction, "synthetic-reviewer", policy, new Date()).application;
      } else return response(404, {});
      const saved = { ...current, ...updated, version: current.version + 1 };
      records.set(applicationId, saved);
      return response(200, isAdmin ? reviewerRecord(saved) : summary(saved));
    } catch (error) {
      if (error instanceof ApplicationReviewError) return response(409, {});
      return response(500, {});
    }
  };
  const api: ApplicationApi = createApplicationApi("https://offline.invalid", () => role ? "offline-placeholder-not-a-token" : null,
    (status) => { role = null; onDenied(status); }, transport);
  return {
    api,
    setRole(value: Role | null) { role = value; },
    advanceVersions() { for (const [id, item] of records) records.set(id, { ...item, version: item.version + 1 }); },
    denyNext(status: 401 | 403) { denial = status; },
    reset() { records.clear(); keys.clear(); role = null; denial = null; },
  };
}

export function SyntheticRoot() {
  const [role, setRole] = useState<Role | null>(null);
  const [generation, setGeneration] = useState(0);
  const [message, setMessage] = useState("");
  const harness = useMemo(() => createSyntheticHarness((status) => {
    setRole(null); setGeneration((value) => value + 1);
    setMessage(`Synthetic ${status} denial: workspace cleared. No live authentication occurred.`);
  }), []);
  if (!syntheticAllowed(import.meta.env.DEV, import.meta.env.VITE_COMMUNITY_SYNTHETIC_UAT, location.hostname)) {
    return <main><h1>Offline rehearsal unavailable</h1></main>;
  }
  const signOut = () => {
    harness.setRole(null); setRole(null); setGeneration((value) => value + 1);
  };
  const notice = <aside className="internal-notice" aria-label="Synthetic rehearsal warning">
    <h2>SYNTHETIC · LOOPBACK DEV ONLY</h2>
    <p>No enrollment, actual consent, adult verification, or screening occurs here.
      This is a stateful client-side simulation, NOT Cognito/DynamoDB integration.
      No AWS calls, live tokens, outbox publication, or persistent records.</p>
    <p>Use names beginning “Synthetic ” and emails ending “@example.invalid” only.
      Example: Synthetic Participant / participant@example.invalid. Do not enter real personal data.</p>
    <p>All check and decision buttons rehearse synthetic transitions only. Reload clears all records.</p>
    <button onClick={() => { harness.advanceVersions(); setMessage("Synthetic concurrent writer advanced all versions. The next stale change must be denied."); }}>Simulate concurrent writer</button>
    <button onClick={() => { harness.denyNext(401); setMessage("Next API call will rehearse expired authentication."); }}>Simulate next 401</button>
    <button onClick={() => { harness.denyNext(403); setMessage("Next API call will rehearse forbidden access."); }}>Simulate next 403</button>
    <p role="alert">{message}</p>
  </aside>;
  if (!role) return <main className="internal-shell">
    <h1>Synthetic UAT sign-in</h1>{notice}
    <p>Role selection is an offline-only bypass. It does not sign in, create users, or grant live access.</p>
    {(["participant", "mentor", "reviewer", "lookalike"] as const).map((value) => <button key={value} onClick={() => {
      harness.setRole(value); setRole(value); setMessage(""); setGeneration((current) => current + 1);
    }}>Rehearse as {value}</button>)}
    <button onClick={() => { harness.reset(); setMessage("All synthetic records reset."); }}>Reset synthetic records</button>
    <a href="/">Return to closed public preview</a>
  </main>;
  return <Workflow key={generation} api={harness.api} administrator={role === "reviewer"}
    intake={{ policyVersion: policy, policyUrl: "#synthetic-policy-not-consent", retentionDays: 1 }}
    logout={signOut} notice={notice} />;
}

export const syntheticSubmission = (kind: Submission["kind"]): Submission => ({
  kind, contactName: `Synthetic ${kind}`, contactEmail: `${kind}@example.invalid`, consentAccepted: true,
  expectedConsentPolicyVersion: policy,
});
