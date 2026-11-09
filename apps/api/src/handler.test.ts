import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createApiHandler, handler, type ApplicationIntakeConfig, type Request,
} from "./handler.ts";
import type {
  ApplicationPage, ApplicationReview, ApplicationStore, ApplicationWithdrawal, StoredAdultApplication,
} from "./applications.ts";
import { ApplicationConflictError, ApplicationNotFoundError } from "./applications.ts";

const approvedConfig: ApplicationIntakeConfig = {
  enabled: true, consentPolicyVersion: "adult-pilot-approved-v1", retentionDays: 180,
};

function request(path: string, method = "GET", body?: unknown): Request {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  return {
    version: "2.0", routeKey: `${method} ${path}`, rawPath: path,
    rawQueryString: "",         headers: {
      ...(serialized === undefined ? {} : { "content-type": "application/json" }),
      ...(method === "POST" && path === "/applications" ? { "idempotency-key": "b9de9897-5f48-4a63-a872-1d1b53bd64a5" } : {}),
    },
    ...(serialized === undefined ? {} : { body: serialized }),
    isBase64Encoded: false,
    requestContext: {
      accountId: "123456789012", apiId: "test", domainName: "api.example.invalid",
      domainPrefix: "api", requestId: "test", routeKey: `${method} ${path}`,
      stage: "$default", time: "2026-11-05T00:00:00Z", timeEpoch: 0,
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
    },
  };
}

function authenticate(event: Request, claims: Record<string, unknown> = { sub: "member-1" }): Request {
  event.requestContext.authorizer = { jwt: { claims } };
  return event;
}

function createStore(): ApplicationStore & {
  created: StoredAdultApplication[];
  reviews: ApplicationReview[];
  listCalls: (string | undefined)[];
} {
  const store = {
    created: [] as StoredAdultApplication[],
    reviews: [] as ApplicationReview[],
    listCalls: [] as (string | undefined)[],
    async create(application: StoredAdultApplication) {
      this.created.push(application);
      return { status: "created" as const, applicationId: application.applicationId };
    },
    async listLatest(nextToken?: string): Promise<ApplicationPage> {
      this.listCalls.push(nextToken);
      return { applications: [], nextToken: null };
    },
    async getOwned(applicationId: string, applicantSub: string) {
      return this.created.find((application) =>
        application.applicationId === applicationId && application.applicantSub === applicantSub);
    },
    async withdraw(update: ApplicationWithdrawal) {
      const current = await this.getOwned(update.applicationId, update.applicantSub);
      if (!current) throw new ApplicationNotFoundError();
      if (current.version !== update.expectedVersion) throw new ApplicationConflictError();
      return {
        ...current, status: "withdrawn" as const,
        withdrawnAt: update.now.toISOString(), version: current.version + 1,
      };
    },
    async review(update: ApplicationReview) {
      this.reviews.push(update);
      return {
        applicationId: update.applicationId,
        applicantSub: "member-1",
        contactName: "Applicant",
        contactEmail: "adult@example.com",
        kind: "mentor" as const,
        status: "under_review" as const,
        adultEligibility: { status: "unverified" as const },
        consentAcceptedAt: "2026-11-05T00:00:00.000Z",
        consentPolicyVersion: update.consentPolicyVersion,
        mentorScreening: "pending" as const,
        createdAt: "2026-11-05T00:00:00.000Z",
        expiresAt: 1_800_000_000,
        version: update.expectedVersion + 1,
      };
    },
  };
  return store;
}

test("health exposes only safe application readiness and identity requires Gateway JWT claims", async () => {
  const result = await handler(request("/health"));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body!), { status: "ok", application: "community" });
  assert.equal((await handler(request("/health", "POST"))).statusCode, 404);
  assert.equal((await handler(request("/me"))).statusCode, 401);
  assert.deepEqual(JSON.parse((await handler(authenticate(request("/me")))).body!), { userId: "member-1" });
  assert.equal((await handler(request("/participants/other"))).statusCode, 404);
});

test("applicants see only their own minimal status and can withdraw with the current version while intake is closed", async () => {
  const store = createStore();
  const api = createApiHandler({
    applicationStore: store, applicationIntake: approvedConfig,
    now: () => new Date("2026-11-05T12:00:00.000Z"),
  });
  const submitted = await api(authenticate(request("/applications", "POST", {
    kind: "mentor", contactName: "Applicant", contactEmail: "adult@example.com", consentAccepted: true,
  })));
  const path = `/applications/${JSON.parse(submitted.body!).applicationId}`;
  const closedApi = createApiHandler({
    applicationStore: store,
    applicationIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
  });
  assert.equal((await closedApi(request(path))).statusCode, 401);
  assert.equal((await closedApi(authenticate(request(path), { sub: "other-member" }))).statusCode, 404);
  assert.equal((await closedApi(authenticate(request(`${path}/withdraw`, "POST", {
    expectedVersion: 0,
  }), { sub: "other-member" }))).statusCode, 404);
  const result = await closedApi(authenticate(request(path)));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(Object.keys(JSON.parse(result.body!)).sort(), [
    "applicationId", "createdAt", "kind", "status", "version",
  ]);
  assert.doesNotMatch(result.body!, /adult@example|applicantSub|reviewedBy|screening|contactName/);
  assert.equal((await closedApi(authenticate(request(`${path}/withdraw`, "POST", {
    expectedVersion: 1,
  })))).statusCode, 409);
  assert.equal((await closedApi(authenticate(request(`${path}/withdraw`, "POST", {
    expectedVersion: 0, applicantSub: "other-member",
  })))).statusCode, 400);
  const withdrawn = await closedApi(authenticate(request(`${path}/withdraw`, "POST", { expectedVersion: 0 })));
  assert.equal(withdrawn.statusCode, 200);
  assert.equal(JSON.parse(withdrawn.body!).status, "withdrawn");
});

test("application submissions are closed unless approved consent and retention settings are present", async () => {
  const store = createStore();
  const api = createApiHandler({
    applicationStore: store,
    applicationIntake: { enabled: false, consentPolicyVersion: "", retentionDays: 0 },
  });
  const event = authenticate(request("/applications", "POST", {
    kind: "mentor", contactName: "Applicant", contactEmail: "adult@example.com", consentAccepted: true,
  }));
  assert.equal((await api(event)).statusCode, 503);
  assert.equal(store.created.length, 0);
});

test("adult application submission requires a signed-in applicant and captures server-owned policy data", async () => {
  const store = createStore();
  const api = createApiHandler({
    applicationStore: store,
    applicationIntake: approvedConfig,
    now: () => new Date("2026-11-05T12:00:00.000Z"),
  });
  const body = {
    kind: "mentor", contactName: "  Applicant Name ", contactEmail: "Adult@Example.com", consentAccepted: true,
  };
  assert.equal((await api(request("/applications", "POST", body))).statusCode, 401);
  const missingKey = authenticate(request("/applications", "POST", body));
  delete missingKey.headers["idempotency-key"];
  assert.equal((await api(missingKey)).statusCode, 400);
  const response = await api(authenticate(request("/applications", "POST", body)));
  assert.equal(response.statusCode, 201);
  assert.equal(store.created.length, 1);
  assert.deepEqual(store.created[0], {
    applicationId: JSON.parse(response.body!).applicationId,
    kind: "mentor",
    status: "under_review",
    applicantSub: "member-1",
    contactName: "Applicant Name",
    contactEmail: "adult@example.com",
    adultEligibility: { status: "unverified" },
    consentAcceptedAt: "2026-11-05T12:00:00.000Z",
    consentPolicyVersion: "adult-pilot-approved-v1",
    mentorScreening: "pending",
    createdAt: "2026-11-05T12:00:00.000Z",
    expiresAt: Math.floor(Date.parse("2026-11-05T12:00:00.000Z") / 1000) + 180 * 86400,
    version: 0,
  });
});

test("application submission rejects self-asserted approval, unknown fields and malformed contact data", async () => {
  const api = createApiHandler({ applicationStore: createStore(), applicationIntake: approvedConfig });
  const invalid = [
    { kind: "mentor", contactName: "Applicant", contactEmail: "adult@example.com", consentAccepted: true, status: "approved" },
    { kind: "mentor", contactName: "Applicant", contactEmail: "adult@example.com", consentAccepted: false },
    { kind: "youth", contactName: "Applicant", contactEmail: "adult@example.com", consentAccepted: true },
    { kind: "participant", contactName: "A", contactEmail: "bad", consentAccepted: true },
  ];
  for (const body of invalid) {
    assert.equal((await api(authenticate(request("/applications", "POST", body)))).statusCode, 400);
  }
});

test("application review endpoints require the explicit administrator group", async () => {
  const store = createStore();
  const api = createApiHandler({ applicationStore: store, applicationIntake: approvedConfig });
  const list = request("/admin/applications");
  assert.equal((await api(list)).statusCode, 401);
  assert.equal((await api(authenticate(request("/admin/applications")))).statusCode, 403);
  const reviewer = authenticate(request("/admin/applications"), {
    sub: "reviewer-1", "cognito:groups": "[\"CommunityAdministrators\"]",
  });
  reviewer.queryStringParameters = { nextToken: "ignored" };
  const listed = await api(reviewer);
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(store.listCalls, ["ignored"]);

  const applicationId = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
  const update = authenticate(request(`/admin/applications/${applicationId}`, "PATCH", {
    action: "verify_adult_eligibility", expectedVersion: 0,
  }), { sub: "reviewer-1", "cognito:groups": ["CommunityAdministrators"] });
  assert.equal((await api(update)).statusCode, 200);
  assert.ok(store.reviews[0]);
  assert.equal(store.reviews[0].reviewerId, "reviewer-1");
  assert.deepEqual(store.reviews[0].action, { type: "verify_adult_eligibility" });
});

test("application review rejects bad cursors, IDs and arbitrary state changes", async () => {
  const api = createApiHandler({ applicationStore: createStore(), applicationIntake: approvedConfig });
  const reviewerClaims = { sub: "reviewer-1", "cognito:groups": "CommunityAdministrators" };
  const invalidCursor = authenticate(request("/admin/applications"), reviewerClaims);
  invalidCursor.queryStringParameters = { nextToken: "x".repeat(2049) };
  assert.equal((await api(invalidCursor)).statusCode, 400);
  assert.equal((await api(authenticate(request("/admin/applications/not-an-id", "PATCH", {}), reviewerClaims))).statusCode, 400);
  const invalidUpdate = authenticate(request(
    "/admin/applications/b9de9897-5f48-4a63-a872-1d1b53bd64a5", "PATCH",
    { action: "decide", decision: "approve", expectedVersion: 0, reviewedBy: "spoofed" },
  ), reviewerClaims);
  assert.equal((await api(invalidUpdate)).statusCode, 400);
});
