import { useState } from "react";
import type { ReactNode } from "react";
import type { ApplicationReviewAction } from "../../../../packages/domain/src/adult-application.ts";
import {
  ApiError, validApplicationId, type ApplicantReceipt, type ApplicationApi, type ReviewApplication,
  type ReviewPage, type Submission,
} from "./api.ts";
import type { InternalConfig } from "./config.ts";
import "./internal.css";

export function Workflow({
  api, administrator, intake, logout, notice,
}: {
  api: ApplicationApi;
  administrator: boolean;
  intake: InternalConfig["intake"];
  logout: () => void;
  notice?: ReactNode;
}) {
  const [tab, setTab] = useState<"applicant" | "review">("applicant");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<ApplicantReceipt | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [submission, setSubmission] = useState<{ input: Submission; key: string } | null>(null);
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [cursors, setCursors] = useState<string[]>([""]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<ReviewApplication | null>(null);
  const [reviewStale, setReviewStale] = useState(false);
  const [ownerStale, setOwnerStale] = useState(false);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await work(); } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setReceipt(null); setPage(null); setSelected(null); setSubmission(null); setApplicationId("");
      }
      setMessage(error instanceof Error ? error.message : "Request failed. Refresh before trying again.");
    } finally { setBusy(false); }
  }

  async function loadOwned(id: string) {
    setReceipt(null);
    const value = await api.owned(id);
    setReceipt(value);
    setOwnerStale(false);
  }

  async function loadPage(cursor: string, index: number) {
    setPage(null); setSelected(null); setReviewStale(true);
    const result = await api.list(cursor || undefined);
    setPage(result); setPageIndex(index); setReviewStale(false);
  }

  function review(action: ApplicationReviewAction) {
    if (!selected || reviewStale) return;
    const target = selected;
    void run(async () => {
      try {
        const updated = await api.review(target.applicationId, target.version, action);
        setSelected(updated);
        setPage((current) => current && {
          ...current, applications: current.applications.map((item) => item.applicationId === updated.applicationId ? updated : item)
            .filter((item) => item.status === "under_review"),
        });
        setMessage("Review change recorded by the server.");
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setReviewStale(true); setSelected(null); setPage(null);
        }
        throw error;
      }
    });
  }

  return <main className="internal-shell">
    <header>
      <p className="internal-kicker">CUT BLOCK · Provisional · Internal workflow</p>
      <h1>Adult application workspace</h1>
      <p>Not public enrollment. Backend authorization and approved operating readiness remain required.
        No youth intake, matching, or athletics services.</p>
      <button onClick={logout}>Sign out</button>
      <a href="/">Return to public preview</a>
    </header>
    {notice}
    <nav aria-label="Internal workflow">
      <button disabled={busy} aria-pressed={tab === "applicant"} onClick={() => setTab("applicant")}>My application</button>
      {administrator && <button disabled={busy} aria-pressed={tab === "review"} onClick={() => setTab("review")}>Review inbox</button>}
    </nav>
    <p role="status" aria-live="polite">{busy ? "Working…" : message}</p>
    {tab === "applicant" ? <section aria-label="Applicant workspace">
      <h2>My receipt and status</h2>
      <p>Use the receipt ID saved at submission. Only the signed-in owner may retrieve it.
        IDs and application records are not saved in this browser.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        setOwnerStale(true);
        void run(() => loadOwned(applicationId.trim()));
      }}>
        <label>Application receipt ID
          <input value={applicationId} onChange={(event) => {
            setApplicationId(event.target.value); setReceipt(null); setOwnerStale(true);
          }} required autoComplete="off" />
        </label>
        <button disabled={busy || !validApplicationId(applicationId.trim())}>Refresh my status</button>
      </form>
      {receipt && <article aria-label="My application receipt">
        <h3>{receipt.kind} application</h3>
        <dl><dt>Receipt ID</dt><dd>{receipt.applicationId}</dd><dt>Status</dt><dd>{receipt.status}</dd>
          <dt>Version</dt><dd>{receipt.version}</dd><dt>Submitted</dt><dd>{receipt.createdAt}</dd></dl>
        <p>Save your receipt ID privately. Approval does not activate participation or matching.</p>
        {receipt.status === "under_review" && <button disabled={busy || ownerStale} onClick={() => {
          void run(async () => {
            try {
              setReceipt(await api.withdraw(receipt.applicationId, receipt.version));
              setMessage("Withdrawal recorded.");
            } catch (error) {
              if (error instanceof ApiError && error.status === 409) { setReceipt(null); setOwnerStale(true); }
              throw error;
            }
          });
        }}>Withdraw my application</button>}
      </article>}
      <h2>Adult application submission</h2>
      {!intake ? <p>Submission is closed. Approved consent, retention, readiness, and independently enabled server intake are required.</p>
        : <form onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          if (fields.get("consentAccepted") !== "on") {
            setMessage("Explicit policy acknowledgment is required.");
            return;
          }
          const input: Submission = {
            kind: fields.get("kind") === "mentor" ? "mentor" : "participant",
            contactName: String(fields.get("contactName")).trim(),
            contactEmail: String(fields.get("contactEmail")).trim().toLowerCase(), consentAccepted: true,
            expectedConsentPolicyVersion: intake.policyVersion,
          };
          const pending = submission && JSON.stringify(submission.input) === JSON.stringify(input)
            ? submission : { input, key: crypto.randomUUID() };
          setSubmission(pending);
          void run(async () => {
            const created = await api.submit(input, pending.key);
            setApplicationId(created.applicationId);
            setReceipt(null);
            setMessage(`Receipt: ${created.applicationId}. Refresh status if retrieval fails; do not resubmit.`);
            setSubmission(null);
            form.reset();
            await loadOwned(created.applicationId);
            setMessage("Application received for review. Save the receipt ID; this is not enrollment.");
          });
        }}>
          <p>Adult-focused review only. Eligibility is independently verified by a reviewer—not by this form.</p>
          <label>Application kind<select name="kind"><option value="participant">Participant</option><option value="mentor">Mentor</option></select></label>
          <label>Contact name<input name="contactName" required minLength={2} maxLength={100} autoComplete="off" /></label>
          <label>Contact email<input name="contactEmail" type="email" required maxLength={254} autoComplete="off" /></label>
          <p>Policy version: {intake.policyVersion}. Configured retention: {intake.retentionDays} days.
            The server applies its own approved policy and retention configuration.</p>
          <a href={intake.policyUrl} target="_blank" rel="noopener noreferrer">Read the configured consent policy</a>
          <label className="internal-check"><input type="checkbox" name="consentAccepted" required />
            I accept the configured policy for this application review.</label>
          <button disabled={busy}>Submit adult application for review</button>
          <p>For an uncertain network result, retry the unchanged form with the same request key.
            Changing fields starts a new request.</p>
        </form>}
    </section> : <section aria-label="Administrator workspace">
      <h2>Review inbox</h2>
      <p>Exact CommunityAdministrators membership is required by the API. Review is not program activation.
        Record only independently completed eligibility and screening checks.</p>
      <button disabled={busy} onClick={() => {
        setCursors([""]); void run(() => loadPage("", 0));
      }}>Refresh inbox from first page</button>
      <button disabled={busy} onClick={() => void run(() => loadPage(cursors[pageIndex] ?? "", pageIndex))}>Refresh current page</button>
      {page && <>
        <p>Page {pageIndex + 1} · {page.applications.length} records · at most 25 records per page, 10 pages per navigation session.</p>
        {!page.applications.length && <p>No applications on this page.</p>}
        <ul className="internal-queue">{page.applications.map((item) => <li key={item.applicationId}>
          <button disabled={busy || reviewStale} onClick={() => setSelected(item)}>
            {item.contactName} · {item.kind} · {item.status} · version {item.version}
          </button>
        </li>)}</ul>
        <div>
          <button disabled={busy || pageIndex === 0} onClick={() => void run(() => loadPage(cursors[pageIndex - 1] ?? "", pageIndex - 1))}>Previous page</button>
          <button disabled={busy || !page.nextToken || pageIndex >= 9} onClick={() => {
            if (!page.nextToken) return;
            const cursor = page.nextToken;
            setCursors([...cursors.slice(0, pageIndex + 1), cursor]);
            void run(() => loadPage(cursor, pageIndex + 1));
          }}>Next page</button>
        </div>
      </>}
      {selected && <article aria-label="Application review detail">
        <h3>{selected.contactName}</h3>
        <dl><dt>Receipt ID</dt><dd>{selected.applicationId}</dd><dt>Contact email</dt><dd>{selected.contactEmail}</dd>
          <dt>Kind</dt><dd>{selected.kind}</dd><dt>Status</dt><dd>{selected.status}</dd>
          <dt>Version</dt><dd>{selected.version}</dd><dt>Adult eligibility</dt><dd>{selected.adultEligibility.status}</dd>
          <dt>Mentor screening</dt><dd>{selected.mentorScreening}</dd>
          <dt>Consent policy</dt><dd>{selected.consentPolicyVersion ?? "Not recorded"}</dd></dl>
        {selected.status === "under_review" && <fieldset disabled={busy || reviewStale}>
          <legend>Record completed checks / decision</legend>
          <button disabled={selected.adultEligibility.status !== "unverified"} onClick={() => review({ type: "verify_adult_eligibility" })}>Record verified adult eligibility</button>
          {selected.kind === "mentor" && <>
            <button disabled={selected.mentorScreening !== "pending"} onClick={() => review({ type: "record_mentor_screening", result: "passed" })}>Record screening passed</button>
            <button disabled={selected.mentorScreening !== "pending"} onClick={() => review({ type: "record_mentor_screening", result: "failed" })}>Record screening failed</button>
          </>}
          <button onClick={() => review({ type: "decide", decision: "approve" })}>Approve application</button>
          <button onClick={() => review({ type: "decide", decision: "reject" })}>Reject application</button>
        </fieldset>}
        <p>Each change sends this record's expectedVersion. A conflict clears stale detail and requires refresh; no automatic retry.</p>
      </article>}
    </section>}
  </main>;
}
