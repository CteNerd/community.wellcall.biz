import assert from "node:assert/strict";
import { test } from "node:test";
import { ApplicationReviewError, decideAdultApplication, type AdultApplication } from "./adult-application.ts";

const now = new Date("2026-11-05T16:00:00.000Z");
const consentVersion = "adult-pilot-2026-01";

function application(overrides: Partial<AdultApplication> = {}): AdultApplication {
  return {
    applicationId: "application-1",
    kind: "mentor",
    status: "under_review",
    adultEligibility: {
      status: "verified",
      verifiedBy: "reviewer-1",
      verifiedAt: "2026-11-04T16:00:00.000Z",
    },
    consentAcceptedAt: "2026-11-04T16:00:00.000Z",
    consentPolicyVersion: consentVersion,
    mentorScreening: "passed",
    ...overrides,
  };
}

test("mentor approval requires verified adult eligibility, current consent and completed screening", () => {
  assert.throws(() => decideAdultApplication(
    application({ adultEligibility: { status: "unverified" } }),
    "approve", "reviewer-2", consentVersion, now,
  ), ApplicationReviewError);
  assert.throws(() => decideAdultApplication(
    application({ consentPolicyVersion: "outdated" }),
    "approve", "reviewer-2", consentVersion, now,
  ), /Current program consent/);
  assert.throws(() => decideAdultApplication(
    application({ consentAcceptedAt: "" }),
    "approve", "reviewer-2", consentVersion, now,
  ), /Current program consent/);
  assert.throws(() => decideAdultApplication(
    application({ mentorScreening: "pending" }),
    "approve", "reviewer-2", consentVersion, now,
  ), /Completed mentor screening/);
});

test("approved adult mentor produces only an aggregate reporting event", () => {
  const result = decideAdultApplication(application(), "approve", "reviewer-2", consentVersion, now);
  assert.equal(result.application.status, "approved");
  assert.equal(result.application.reviewedBy, "reviewer-2");
  assert.equal(result.reportingEvent?.source, "rct.dotcom");
  assert.equal(result.reportingEvent?.["detail-type"], "dotcom.mentor.approved.v1");
  assert.equal(result.reportingEvent?.detail.data.reportingMonth, "2026-11");
  assert.equal(result.reportingEvent?.detail.data.mentorCount, 1);
  assert.deepEqual(Object.keys(result.reportingEvent!.detail.data).sort(), ["mentorCount", "reportingMonth"]);
});

test("participant approval does not emit a mentor-count event", () => {
  const result = decideAdultApplication(
    application({ kind: "participant", mentorScreening: "not_required" }),
    "approve", "reviewer-2", consentVersion, now,
  );
  assert.equal(result.application.status, "approved");
  assert.equal(result.reportingEvent, undefined);
});

test("rejection is reviewable without approval prerequisites, while terminal decisions cannot repeat", () => {
  const rejected = decideAdultApplication(
    application({ adultEligibility: { status: "unverified" }, consentPolicyVersion: "outdated" }),
    "reject", "reviewer-2", consentVersion, now,
  );
  assert.equal(rejected.application.status, "rejected");
  assert.equal(rejected.reportingEvent, undefined);
  assert.throws(() => decideAdultApplication(
    rejected.application, "approve", "reviewer-2", consentVersion, now,
  ), /under review/);
});
