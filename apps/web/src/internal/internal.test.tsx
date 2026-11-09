import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readInternalConfig, syntheticAllowed } from "./config.ts";
import { exactAdminGroup, PublicClientAuth } from "./auth.ts";
import { applicantReceipt, createApplicationApi } from "./api.ts";
import { InternalRoot } from "./InternalRoot.tsx";
import { createSyntheticHarness, SyntheticRoot, syntheticSubmission } from "./synthetic.tsx";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); sessionStorage.clear(); history.replaceState(null, "", "/"); });
const settings = {
  VITE_COMMUNITY_INTERNAL_ENABLED: "true", VITE_COMMUNITY_API_BASE: "https://api.example.invalid",
  VITE_COMMUNITY_AUTH_ISSUER: "https://cognito-idp.us-east-1.amazonaws.com/test",
  VITE_COMMUNITY_OAUTH_ORIGIN: "https://hosted.example.invalid",
  VITE_COMMUNITY_CLIENT_ID: "client123", VITE_COMMUNITY_REDIRECT_URI: `${location.origin}/internal`,
  VITE_COMMUNITY_LOGOUT_URI: `${location.origin}/`,
};

test("internal settings fail closed and submission requires every separate approval", () => {
  expect(readInternalConfig({}, location.origin)).toBeNull();
  expect(readInternalConfig(settings, location.origin)?.intake).toBeNull();
  expect(readInternalConfig({ ...settings, VITE_COMMUNITY_REDIRECT_URI: "https://evil.invalid/internal" }, location.origin)).toBeNull();
  expect(readInternalConfig({ ...settings, VITE_COMMUNITY_OAUTH_ORIGIN: "http://hosted.invalid" }, location.origin)).toBeNull();
  const intake = {
    ...settings, VITE_COMMUNITY_INTAKE_APPROVED: "true", VITE_COMMUNITY_READINESS_APPROVED: "true",
    VITE_COMMUNITY_SERVER_INTAKE_APPROVED: "true", VITE_COMMUNITY_CONSENT_POLICY_VERSION: "approved-v1",
    VITE_COMMUNITY_CONSENT_POLICY_URL: "https://policy.example.invalid/consent", VITE_COMMUNITY_RETENTION_DAYS: "30",
  };
  expect(readInternalConfig(intake, location.origin)?.intake?.retentionDays).toBe(30);
  for (const key of ["VITE_COMMUNITY_INTAKE_APPROVED", "VITE_COMMUNITY_READINESS_APPROVED", "VITE_COMMUNITY_SERVER_INTAKE_APPROVED",
    "VITE_COMMUNITY_CONSENT_POLICY_VERSION", "VITE_COMMUNITY_CONSENT_POLICY_URL", "VITE_COMMUNITY_RETENTION_DAYS"]) {
    expect(readInternalConfig({ ...intake, [key]: "" }, location.origin)?.intake).toBeNull();
  }
});

test("synthetic opt-in needs DEV, explicit flag, and exact loopback hostname", () => {
  expect(syntheticAllowed(true, "true", "127.0.0.1")).toBe(true);
  for (const host of ["community.wellcall.biz", "127.0.0.1.evil.invalid", "0.0.0.0"]) expect(syntheticAllowed(true, "true", host)).toBe(false);
  expect(syntheticAllowed(false, "true", "localhost")).toBe(false);
  expect(syntheticAllowed(true, undefined, "localhost")).toBe(false);
});

test("default internal preview exposes no forms or role bypass", async () => {
  render(<InternalRoot />);
  expect(screen.getByRole("heading", { name: "Internal workspace closed" })).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
  expect(document.body.textContent).not.toContain("Rehearse as");
});

test("reviewer group is an exact array membership check, not a prefix or self assertion", () => {
  expect(exactAdminGroup(["CommunityAdministrators"])).toBe(true);
  for (const value of [["CommunityAdministratorsExtra"], ["Administrators"], "CommunityAdministrators", null]) {
    expect(exactAdminGroup(value)).toBe(false);
  }
});

test("callback rejects stale or mismatched PKCE state and removes callback secrets", async () => {
  const config = readInternalConfig(settings, location.origin)!;
  const auth = new PublicClientAuth(config);
  sessionStorage.setItem("community.pkce.transaction", JSON.stringify({ state: "expected", verifier: "v".repeat(43), createdAt: Date.now() }));
  history.replaceState(null, "", "/internal?code=secret&state=wrong");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(auth.callback()).rejects.toThrow("Hosted sign-in failed");
  expect(fetcher).not.toHaveBeenCalled();
  expect(location.search).toBe("");
  expect(sessionStorage.length).toBe(0);
  expect(auth.accessToken()).toBeNull();
});

test("successful PKCE exchange retains only a memory access token and expires/clears it", async () => {
  const config = readInternalConfig(settings, location.origin)!;
  const auth = new PublicClientAuth(config);
  sessionStorage.setItem("community.pkce.transaction", JSON.stringify({ state: "expected", verifier: "v".repeat(43), createdAt: Date.now() }));
  history.replaceState(null, "", "/internal?code=offline-code&state=expected");
  const claims = { iss: config.issuer, client_id: config.clientId, token_use: "access",
    exp: Math.floor(Date.now() / 1000) + 600, "cognito:groups": ["CommunityAdministrators"] };
  const token = `header.${btoa(JSON.stringify(claims))}.offline-signature`;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    access_token: token, token_type: "Bearer", expires_in: 300, refresh_token: "must-not-persist",
  })));
  vi.stubGlobal("fetch", fetcher);
  expect((await auth.callback())?.administrator).toBe(true);
  expect(auth.accessToken()).toBe(token);
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
  expect(String(fetcher.mock.calls[0]?.[1].body)).toContain("code_verifier=");
  auth.clear();
  expect(auth.accessToken()).toBeNull();
});

test("owner adapter allowlists receipt privacy and sends exact authenticated versioned contracts", async () => {
  const id = crypto.randomUUID();
  const value = { applicationId: id, kind: "mentor", status: "under_review", version: 2, createdAt: new Date().toISOString(),
    contactEmail: "private@example.invalid", screeningBy: "private-reviewer", applicantSub: "private-owner" };
  expect(applicantReceipt(value)).not.toHaveProperty("screeningBy");
  expect(applicantReceipt(value)).not.toHaveProperty("contactEmail");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(value)));
  const api = createApplicationApi("https://api.example.invalid", () => "memory-only", vi.fn(), fetcher);
  await api.withdraw(id, 2);
  expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.example.invalid/applications/${id}/withdraw`);
  expect(fetcher.mock.calls[0]?.[1].body).toBe('{"expectedVersion":2}');
  expect(fetcher.mock.calls[0]?.[1].credentials).toBe("omit");
});

test("adapter handles 401/403/409/503/network failures without silently using fixtures", async () => {
  const onDenied = vi.fn();
  for (const status of [401, 403, 409, 503]) {
    const api = createApplicationApi("https://api.example.invalid", () => "memory-only", onDenied,
      vi.fn().mockResolvedValue(new Response("{}", { status })));
    await expect(api.list()).rejects.toMatchObject({ status });
  }
  expect(onDenied.mock.calls.map(([status]) => status)).toEqual([401, 403]);
  const api = createApplicationApi("https://api.example.invalid", () => "memory-only", onDenied, vi.fn().mockRejectedValue(new Error("offline")));
  await expect(api.list()).rejects.toMatchObject({ status: 0 });
});

test("offline adapter rehearses ownership, mentor prerequisites, screening failure, approval, rejection, withdrawal and conflicts", async () => {
  const denied = vi.fn();
  const harness = createSyntheticHarness(denied);
  harness.setRole("participant");
  const participant = await harness.api.submit(syntheticSubmission("participant"), crypto.randomUUID());
  harness.setRole("mentor");
  await expect(harness.api.owned(participant.applicationId)).rejects.toMatchObject({ status: 404 });
  const mentor = await harness.api.submit(syntheticSubmission("mentor"), crypto.randomUUID());
  harness.setRole("lookalike");
  await expect(harness.api.list()).rejects.toMatchObject({ status: 403 });
  harness.setRole("reviewer");
  await expect(harness.api.review(mentor.applicationId, 0, { type: "decide", decision: "approve" })).rejects.toMatchObject({ status: 409 });
  await harness.api.review(mentor.applicationId, 0, { type: "verify_adult_eligibility" });
  await expect(harness.api.review(mentor.applicationId, 1, { type: "decide", decision: "approve" })).rejects.toMatchObject({ status: 409 });
  await harness.api.review(mentor.applicationId, 1, { type: "record_mentor_screening", result: "passed" });
  expect((await harness.api.review(mentor.applicationId, 2, { type: "decide", decision: "approve" })).status).toBe("approved");
  harness.advanceVersions();
  await expect(harness.api.review(participant.applicationId, 0, { type: "verify_adult_eligibility" })).rejects.toMatchObject({ status: 409 });
  harness.setRole("participant");
  const version = (await harness.api.owned(participant.applicationId)).version;
  expect((await harness.api.withdraw(participant.applicationId, version)).status).toBe("withdrawn");
  harness.setRole("mentor");
  const failed = await harness.api.submit(syntheticSubmission("mentor"), crypto.randomUUID());
  harness.setRole("reviewer");
  await harness.api.review(failed.applicationId, 0, { type: "verify_adult_eligibility" });
  await harness.api.review(failed.applicationId, 1, { type: "record_mentor_screening", result: "failed" });
  await expect(harness.api.review(failed.applicationId, 2, { type: "decide", decision: "approve" })).rejects.toMatchObject({ status: 409 });
  expect((await harness.api.review(failed.applicationId, 2, { type: "decide", decision: "reject" })).status).toBe("rejected");
});

test("synthetic inbox pagination is pending-only and preserves a cursor when earlier records are decided", async () => {
  const harness = createSyntheticHarness(vi.fn());
  harness.setRole("participant");
  for (let count = 0; count < 3; count++) await harness.api.submit(syntheticSubmission("participant"), crypto.randomUUID());
  harness.setRole("reviewer");
  const first = await harness.api.list();
  expect(first.applications).toHaveLength(2);
  const target = first.applications[0]!;
  await harness.api.review(target.applicationId, target.version, { type: "decide", decision: "reject" });
  const second = await harness.api.list(first.nextToken!);
  expect(second.applications).toHaveLength(1);
  expect(second.applications[0]?.status).toBe("under_review");
  expect((await harness.api.list()).applications).toHaveLength(2);
});

test("synthetic idempotent retries do not create duplicates and reject changed payloads", async () => {
  const harness = createSyntheticHarness(vi.fn());
  harness.setRole("participant");
  const key = crypto.randomUUID();
  const first = await harness.api.submit(syntheticSubmission("participant"), key);
  expect(await harness.api.submit(syntheticSubmission("participant"), key)).toEqual(first);
  await expect(harness.api.submit(syntheticSubmission("mentor"), key)).rejects.toMatchObject({ status: 409 });
  harness.advanceVersions();
  await expect(harness.api.withdraw(first.applicationId, 0)).rejects.toMatchObject({ status: 409 });
  expect((await harness.api.owned(first.applicationId)).status).toBe("under_review");
});

async function submitUi(kind: "participant" | "mentor") {
  fireEvent.change(screen.getByLabelText("Application kind"), { target: { value: kind } });
  fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: `Synthetic ${kind}` } });
  fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: `${kind}@example.invalid` } });
  fireEvent.click(screen.getByLabelText("I accept the configured policy for this application review."));
  fireEvent.click(screen.getByRole("button", { name: "Submit adult application for review" }));
  await screen.findByRole("article", { name: "My application receipt" });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Application received"));
}

test("actual synthetic UI clears stale conflict/detail and all records on logout or denied authentication", async () => {
  vi.stubEnv("VITE_COMMUNITY_SYNTHETIC_UAT", "true");
  render(<SyntheticRoot />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse as mentor" }));
  await submitUi("mentor");
  const receiptId = (screen.getByLabelText("Application receipt ID") as HTMLInputElement).value;
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(document.body.textContent).not.toContain(receiptId);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse as reviewer" }));
  fireEvent.click(screen.getByRole("button", { name: "Review inbox" }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh inbox from first page" }));
  fireEvent.click(await screen.findByRole("button", { name: /Synthetic mentor · mentor/ }));
  fireEvent.click(screen.getByRole("button", { name: "Simulate concurrent writer" }));
  fireEvent.click(screen.getByRole("button", { name: "Record verified adult eligibility" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Application changed"));
  expect(screen.queryByRole("article", { name: "Application review detail" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh current page" }));
  fireEvent.click(await screen.findByRole("button", { name: /Synthetic mentor · mentor/ }));
  fireEvent.click(screen.getByRole("button", { name: "Simulate next 403" }));
  fireEvent.click(screen.getByRole("button", { name: "Record verified adult eligibility" }));
  await screen.findByRole("heading", { name: "Synthetic UAT sign-in" });
  expect(screen.queryByRole("article", { name: "Application review detail" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Rehearse as mentor" }));
  fireEvent.change(screen.getByLabelText("Application receipt ID"), { target: { value: receiptId } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh my status" }));
  await screen.findByRole("article", { name: "My application receipt" });
  fireEvent.click(screen.getByRole("button", { name: "Simulate next 401" }));
  fireEvent.click(screen.getByRole("button", { name: "Withdraw my application" }));
  await screen.findByRole("heading", { name: "Synthetic UAT sign-in" });
  expect(screen.queryByRole("article", { name: "My application receipt" })).toBeNull();
});

test("synthetic UI rehearses participant submission and withdrawal with owner-only receipt fields", async () => {
  vi.stubEnv("VITE_COMMUNITY_SYNTHETIC_UAT", "true");
  render(<SyntheticRoot />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse as participant" }));
  await submitUi("participant");
  const receipt = screen.getByRole("article", { name: "My application receipt" });
  expect(receipt.textContent).not.toContain("screeningBy");
  fireEvent.click(screen.getByRole("button", { name: "Withdraw my application" }));
  await waitFor(() => expect(within(receipt).getByText("withdrawn")).toBeDefined());
});

test("the application UI never fabricates an unchecked policy acknowledgment", () => {
  vi.stubEnv("VITE_COMMUNITY_SYNTHETIC_UAT", "true");
  render(<SyntheticRoot />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse as participant" }));
  const button = screen.getByRole("button", { name: "Submit adult application for review" });
  fireEvent.submit(button.closest("form")!);
  expect(screen.getByRole("status").textContent).toContain("Explicit policy acknowledgment is required");
  expect(screen.queryByRole("article", { name: "My application receipt" })).toBeNull();
});
