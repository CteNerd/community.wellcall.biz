import { randomUUID } from "node:crypto";

export type AdultApplication = {
  applicationId: string;
  kind: "participant" | "mentor";
  status: "under_review" | "approved" | "rejected" | "withdrawn";
  adultEligibility: {
    status: "unverified" | "verified";
    verifiedBy?: string;
    verifiedAt?: string;
  };
  consentAcceptedAt?: string;
  consentPolicyVersion?: string;
  mentorScreening: "not_required" | "pending" | "passed" | "failed";
  reviewedBy?: string;
  reviewedAt?: string;
};

export type MentorApprovalEvent = {
  source: "rct.dotcom";
  "detail-type": "dotcom.mentor.approved.v1";
  detail: {
    eventId: string;
    schemaVersion: 1;
    occurredAt: string;
    correlationId: string;
    domain: "dotcom";
    data: { reportingMonth: string; mentorCount: 1 };
  };
};

export type ApplicationDecision = "approve" | "reject";

export class ApplicationReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationReviewError";
  }
}

export function decideAdultApplication(
  application: AdultApplication,
  decision: ApplicationDecision,
  reviewerId: string,
  consentPolicyVersion: string,
  now: Date,
): { application: AdultApplication; reportingEvent: MentorApprovalEvent | undefined } {
  if (application.status !== "under_review") {
    throw new ApplicationReviewError("Only applications under review can be decided");
  }
  if (!reviewerId.trim() || !Number.isFinite(now.getTime())) {
    throw new ApplicationReviewError("A valid reviewer and decision time are required");
  }
  if (decision === "reject") {
    return {
      application: { ...application, status: "rejected", reviewedBy: reviewerId, reviewedAt: now.toISOString() },
      reportingEvent: undefined,
    };
  }
  const eligibilityVerifiedAt = application.adultEligibility.verifiedAt;
  if (application.adultEligibility.status !== "verified"
    || !application.adultEligibility.verifiedBy?.trim()
    || !isTimestamp(eligibilityVerifiedAt)
    || Date.parse(eligibilityVerifiedAt) > now.getTime()) {
    throw new ApplicationReviewError("Verified adult eligibility is required");
  }
  const consentAcceptedAt = application.consentAcceptedAt;
  if (!consentPolicyVersion.trim() || application.consentPolicyVersion !== consentPolicyVersion
    || !isTimestamp(consentAcceptedAt)
    || Date.parse(consentAcceptedAt) > now.getTime()) {
    throw new ApplicationReviewError("Current program consent is required");
  }
  if (application.kind === "mentor" && application.mentorScreening !== "passed") {
    throw new ApplicationReviewError("Completed mentor screening is required");
  }

  const reviewedApplication: AdultApplication = {
    ...application,
    status: "approved",
    reviewedBy: reviewerId,
    reviewedAt: now.toISOString(),
  };
  if (application.kind !== "mentor") {
    return { application: reviewedApplication, reportingEvent: undefined };
  }

  const occurredAt = now.toISOString();
  return {
    application: reviewedApplication,
    reportingEvent: {
      source: "rct.dotcom",
      "detail-type": "dotcom.mentor.approved.v1",
      detail: {
        eventId: randomUUID(),
        schemaVersion: 1,
        occurredAt,
        correlationId: randomUUID(),
        domain: "dotcom",
        data: { reportingMonth: occurredAt.slice(0, 7), mentorCount: 1 },
      },
    },
  };
}

function isTimestamp(value: string | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  const canonical = value.includes(".") ? value : value.replace(/Z$/, ".000Z");
  return Number.isFinite(date.getTime()) && date.toISOString() === canonical;
}
