import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  ApplicationConflictError, ApplicationIdempotencyConflictError, ApplicationNotFoundError,
  createApplication, DynamoApplicationStore,
  InvalidApplicationCursorError, type ApplicationStore, type StoredAdultApplication,
} from "./applications.ts";
import {
  ApplicationReviewError, type ApplicationReviewAction,
} from "../../../packages/domain/src/adult-application.ts";

export type Request = APIGatewayProxyEventV2 & {
  requestContext: {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

export type ApplicationIntakeConfig = {
  enabled: boolean;
  consentPolicyVersion: string;
  retentionDays: number;
};

type HandlerDependencies = {
  applicationStore: ApplicationStore;
  applicationIntake: ApplicationIntakeConfig;
  now?: () => Date;
};

const maxBodyBytes = 8192;
const adminGroup = "CommunityAdministrators";

function response(statusCode: number, body: object): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

export function createApiHandler(dependencies: HandlerDependencies) {
  return async (event: Request): Promise<APIGatewayProxyStructuredResultV2> => {
    const method = event.requestContext.http.method;
    if (method === "GET" && event.rawPath === "/health") {
      return response(200, { status: "ok", application: "community" });
    }
    if (method === "GET" && event.rawPath === "/me") {
      const subject = authenticatedSubject(event);
      if (!subject) return response(401, { error: "Authentication required" });
      return response(200, { userId: subject });
    }
    if (method === "POST" && event.rawPath === "/applications") {
      return submitApplication(event, dependencies);
    }
    if ((method === "GET" && /^\/applications\/[^/]+$/.test(event.rawPath))
      || (method === "POST" && /^\/applications\/[^/]+\/withdraw$/.test(event.rawPath))) {
      return applicantApplication(event, dependencies);
    }
    if (method === "GET" && event.rawPath === "/admin/applications") {
      return listApplications(event, dependencies.applicationStore);
    }
    if (method === "PATCH" && /^\/admin\/applications\/[^/]+$/.test(event.rawPath)) {
      return reviewApplication(event, dependencies);
    }
    return response(404, { error: "Not found" });
  };
}

async function applicantApplication(
  event: Request, dependencies: HandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const applicantSub = authenticatedSubject(event);
  if (!applicantSub) return response(401, { error: "Authentication required" });
  const applicationId = event.rawPath.split("/")[2] ?? "";
  if (!uuidPattern.test(applicationId)) return response(400, { error: "Invalid application ID" });
  const now = (dependencies.now ?? (() => new Date()))();
  try {
    if (event.requestContext.http.method === "GET") {
      const application = await dependencies.applicationStore.getOwned(applicationId, applicantSub, now);
      if (!application) return response(404, { error: "Application not found" });
      return response(200, applicantSummary(application));
    }
    const body = parseJsonBody(event, 1024);
    if (!body.ok) return body.response;
    if (!isRecord(body.value) || Object.keys(body.value).length !== 1
      || !Object.hasOwn(body.value, "expectedVersion")
      || !Number.isSafeInteger(body.value.expectedVersion)
      || Number(body.value.expectedVersion) < 0
      || Number(body.value.expectedVersion) >= Number.MAX_SAFE_INTEGER) {
      return response(400, { error: "A valid application version is required" });
    }
    const application = await dependencies.applicationStore.withdraw({
      applicationId, applicantSub, expectedVersion: Number(body.value.expectedVersion), now,
    });
    console.info(JSON.stringify({
      event: "community_application_withdrawn",
      actorSub: applicantSub, requestId: event.requestContext.requestId,
      applicationId, version: application.version,
    }));
    return response(200, applicantSummary(application));
  } catch (error) {
    if (error instanceof ApplicationNotFoundError) return response(404, { error: "Application not found" });
    if (error instanceof ApplicationConflictError || error instanceof ApplicationReviewError) {
      return response(409, { error: "Application changed or cannot be withdrawn. Refresh before trying again." });
    }
    console.error("Community applicant request failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to access application" });
  }
}

function applicantSummary(application: StoredAdultApplication) {
  return {
    applicationId: application.applicationId, kind: application.kind, status: application.status,
    version: application.version, createdAt: application.createdAt,
    ...(application.withdrawnAt ? { withdrawnAt: application.withdrawnAt } : {}),
  };
}

async function submitApplication(
  event: Request, dependencies: HandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const applicantSub = authenticatedSubject(event);
  if (!applicantSub) return response(401, { error: "Authentication required" });
  const idempotencyKey = event.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string" || !uuidPattern.test(idempotencyKey)) {
    return response(400, { error: "A valid idempotency key is required" });
  }
  const { applicationIntake } = dependencies;
  if (!applicationIntake.enabled || !applicationIntake.consentPolicyVersion
    || !Number.isInteger(applicationIntake.retentionDays)
    || applicationIntake.retentionDays < 1 || applicationIntake.retentionDays > 3650) {
    return response(503, { error: "Adult applications are not available" });
  }
  const body = parseJsonBody(event, maxBodyBytes);
  if (!body.ok) return body.response;
  const submission = parseApplicationSubmission(body.value);
  if (!submission) return response(400, { error: "Invalid application" });
  const now = (dependencies.now ?? (() => new Date()))();
  const application = createApplication({
    ...submission,
    applicantSub,
    consentPolicyVersion: applicationIntake.consentPolicyVersion,
    retentionDays: applicationIntake.retentionDays,
  }, now, randomUUID());
  try {
    const result = await dependencies.applicationStore.create(application, idempotencyKey);
    console.info(JSON.stringify({
      event: "community_application_submitted",
      actorSub: applicantSub,
      requestId: event.requestContext.requestId,
      applicationId: result.applicationId,
      duplicate: result.status === "duplicate",
    }));
    return response(result.status === "created" ? 201 : 200, {
      applicationId: result.applicationId, status: "under_review",
    });
  } catch (error) {
    if (error instanceof ApplicationIdempotencyConflictError) {
      return response(409, { error: "Application request key was already used for a different submission" });
    }
    console.error("Community application submission failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to submit application" });
  }
}

async function listApplications(
  event: Request, store: ApplicationStore,
): Promise<APIGatewayProxyStructuredResultV2> {
  const subject = administratorSubject(event);
  if (typeof subject !== "string") return subject;
  const nextToken = event.queryStringParameters?.nextToken;
  if (nextToken !== undefined && nextToken.length > 2048) return response(400, { error: "Invalid page token" });
  try {
    const page = await store.listLatest(nextToken);
    console.info(JSON.stringify({
      event: "community_application_list_access",
      actorSub: subject,
      requestId: event.requestContext.requestId,
      resultCount: page.applications.length,
    }));
    return response(200, page);
  } catch (error) {
    if (error instanceof InvalidApplicationCursorError) return response(400, { error: "Invalid page token" });
    console.error("Community application read failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to load applications" });
  }
}

async function reviewApplication(
  event: Request, dependencies: HandlerDependencies,
): Promise<APIGatewayProxyStructuredResultV2> {
  const reviewerId = administratorSubject(event);
  if (typeof reviewerId !== "string") return reviewerId;
  const applicationId = event.rawPath.slice("/admin/applications/".length);
  if (!uuidPattern.test(applicationId)) return response(400, { error: "Invalid application ID" });
  const body = parseJsonBody(event, 1024);
  if (!body.ok) return body.response;
  const update = parseApplicationReview(body.value);
  if (!update) return response(400, { error: "Invalid application review" });
  try {
    const application = await dependencies.applicationStore.review({
      applicationId,
      action: update.action,
      expectedVersion: update.expectedVersion,
      reviewerId,
      consentPolicyVersion: dependencies.applicationIntake.consentPolicyVersion,
      now: (dependencies.now ?? (() => new Date()))(),
    });
    console.info(JSON.stringify({
      event: "community_application_reviewed",
      actorSub: reviewerId,
      requestId: event.requestContext.requestId,
      applicationId,
      action: update.action.type,
      status: application.status,
      version: application.version,
    }));
    return response(200, application);
  } catch (error) {
    if (error instanceof ApplicationConflictError) {
      return response(409, { error: "Application changed or is no longer available. Refresh before trying again." });
    }
    if (error instanceof ApplicationReviewError) return response(409, { error: error.message });
    console.error("Community application review failed", error instanceof Error ? error.name : "UnknownError");
    return response(500, { error: "Unable to review application" });
  }
}

function administratorSubject(event: Request): string | APIGatewayProxyStructuredResultV2 {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const subject = claims?.sub;
  if (typeof subject !== "string" || subject.length === 0) {
    return response(401, { error: "Authentication required" });
  }
  if (!hasAdminGroup(claims?.["cognito:groups"])) {
    return response(403, { error: "Administrator access required" });
  }
  return subject;
}

function authenticatedSubject(event: Request): string | undefined {
  const subject = event.requestContext.authorizer?.jwt?.claims?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : undefined;
}

function hasAdminGroup(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((group) => group === adminGroup);
  if (typeof value !== "string") return false;
  if (value === adminGroup) return true;
  try {
    const groups: unknown = JSON.parse(value);
    return Array.isArray(groups) && groups.some((group) => group === adminGroup);
  } catch {
    return false;
  }
}

function parseJsonBody(
  event: Request, maxBytes: number,
): { ok: true; value: unknown } | { ok: false; response: APIGatewayProxyStructuredResultV2 } {
  if (event.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return { ok: false, response: response(415, { error: "JSON content type required" }) };
  }
  if (event.body === undefined || event.body.length > Math.ceil(maxBytes * 4 / 3) + 4) {
    return { ok: false, response: response(event.body === undefined ? 400 : 413, { error: "Invalid request body" }) };
  }
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
    if (raw.byteLength > maxBytes) {
      return { ok: false, response: response(413, { error: "Request body is too large" }) };
    }
    return { ok: true, value: JSON.parse(raw.toString("utf8")) };
  } catch {
    return { ok: false, response: response(400, { error: "Invalid request body" }) };
  }
}

function parseApplicationSubmission(value: unknown): {
  kind: "participant" | "mentor";
  contactName: string;
  contactEmail: string;
} | undefined {
  if (!isRecord(value)
    || Object.keys(value).sort().join(",") !== "consentAccepted,contactEmail,contactName,kind"
    || value.consentAccepted !== true
    || (value.kind !== "participant" && value.kind !== "mentor")
    || typeof value.contactName !== "string"
    || typeof value.contactEmail !== "string") return undefined;
  const contactName = value.contactName.trim();
  const contactEmail = value.contactEmail.trim().toLowerCase();
  if (contactName.length < 2 || contactName.length > 100 || /[\u0000-\u001f\u007f]/.test(contactName)
    || contactEmail.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return undefined;
  return { kind: value.kind, contactName, contactEmail };
}

function parseApplicationReview(value: unknown): {
  expectedVersion: number;
  action: ApplicationReviewAction;
} | undefined {
  if (!isRecord(value) || !Number.isSafeInteger(value.expectedVersion)
    || Number(value.expectedVersion) < 0 || Number(value.expectedVersion) >= Number.MAX_SAFE_INTEGER) {
    return undefined;
  }
  if (value.action === "verify_adult_eligibility"
    && Object.keys(value).sort().join(",") === "action,expectedVersion") {
    return { expectedVersion: Number(value.expectedVersion), action: { type: "verify_adult_eligibility" } };
  }
  if (value.action === "record_mentor_screening"
    && Object.keys(value).sort().join(",") === "action,expectedVersion,result"
    && (value.result === "passed" || value.result === "failed")) {
    return {
      expectedVersion: Number(value.expectedVersion),
      action: { type: "record_mentor_screening", result: value.result },
    };
  }
  if (value.action === "decide"
    && Object.keys(value).sort().join(",") === "action,decision,expectedVersion"
    && (value.decision === "approve" || value.decision === "reject")) {
    return {
      expectedVersion: Number(value.expectedVersion),
      action: { type: "decide", decision: value.decision },
    };
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const configuredRetentionDays = Number(process.env.APPLICATION_RETENTION_DAYS);
const configuredConsentVersion = process.env.APPLICATION_CONSENT_POLICY_VERSION?.trim() ?? "";

export const handler = createApiHandler({
  applicationStore: new DynamoApplicationStore(client, process.env.CORE_TABLE_NAME ?? ""),
  applicationIntake: {
    enabled: process.env.APPLICATION_INTAKE_ENABLED === "true",
    consentPolicyVersion: configuredConsentVersion,
    retentionDays: configuredRetentionDays,
  },
});
