import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  CreateTableCommand, DeleteTableCommand, DynamoDBClient, waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DynamoApplicationStore } from "./applications.ts";
import { createApiHandler } from "./handler.ts";

const endpoint = process.env.DYNAMODB_ENDPOINT;
if (!endpoint) throw new Error("DYNAMODB_ENDPOINT is required for the real DynamoDB Local integration check");
const target = new URL(endpoint);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname)
  || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("Integration checks require a plain loopback DynamoDB Local endpoint");
}

function request(
  path: string, method = "GET", body?: Record<string, unknown>, subject = "synthetic-applicant",
  idempotencyKey = randomUUID(),
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: "2.0", routeKey: `${method} ${path}`, rawPath: path, rawQueryString: "",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    isBase64Encoded: false,
    ...(body ? { body: JSON.stringify(body) } : {}),
    requestContext: {
      accountId: "local", apiId: "local", domainName: "localhost", domainPrefix: "localhost",
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "local-integration" },
      requestId: randomUUID(), routeKey: `${method} ${path}`, stage: "local",
      time: "09/Nov/2026:12:00:00 +0000", timeEpoch: 1794225600000,
      authorizer: { jwt: { claims: { sub: subject }, scopes: [] } },
    },
  };
}

function applicationId(body: string | undefined) {
  const value: unknown = JSON.parse(body ?? "null");
  if (typeof value !== "object" || value === null || !("applicationId" in value)
    || typeof value.applicationId !== "string") throw new Error("Application response has no ID");
  return value.applicationId;
}

test("real DynamoDB transactions preserve applicant ownership, idempotency, withdrawal and expiry", async (t) => {
  const client = new DynamoDBClient({
    endpoint, region: "us-east-1", credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  const document = DynamoDBDocumentClient.from(client);
  const tableName = `community-local-integration-${randomUUID()}`;
  const now = new Date("2026-11-09T12:00:00.000Z");
  let created = false;
  try {
    await client.send(new CreateTableCommand({
      TableName: tableName, BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: ["PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK"]
        .map((AttributeName) => ({ AttributeName, AttributeType: "S" })),
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }, { AttributeName: "SK", KeyType: "RANGE" }],
      GlobalSecondaryIndexes: [1, 2].map((index) => ({
        IndexName: index === 1 ? "ApplicationReviewIndex" : "OutboxPendingIndex",
        KeySchema: [
          { AttributeName: `GSI${index}PK`, KeyType: "HASH" },
          { AttributeName: `GSI${index}SK`, KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      })),
    }));
    created = true;
    await waitUntilTableExists({ client, maxWaitTime: 20 }, { TableName: tableName });
    const api = createApiHandler({
      applicationStore: new DynamoApplicationStore(document, tableName),
      applicationIntake: { enabled: true, consentPolicyVersion: "synthetic-local-v1", retentionDays: 30 },
      now: () => now,
    });
    const body = {
      kind: "participant", contactName: "Synthetic Applicant",
      contactEmail: "applicant@example.invalid", consentAccepted: true,
    };
    const key = randomUUID();
    const submission = await api(request("/applications", "POST", body, "synthetic-applicant", key));
    assert.equal(submission.statusCode, 201);
    const id = applicationId(submission.body);
    const path = `/applications/${id}`;

    await t.test("a retry recovers the same record and cross-applicant reads reveal nothing", async () => {
      const duplicate = await api(request("/applications", "POST", body, "synthetic-applicant", key));
      assert.equal(applicationId(duplicate.body), id);
      assert.equal((await api(request(path, "GET", undefined, "another-synthetic-applicant"))).statusCode, 404);
      const own = await api(request(path));
      assert.equal(own.statusCode, 200);
      assert.doesNotMatch(own.body ?? "", /example\.invalid|contactName|contactEmail|applicantSub|screeningBy/);
    });

    await t.test("concurrent withdrawals allow exactly one version transition", async () => {
      const results = await Promise.all([
        api(request(`${path}/withdraw`, "POST", { expectedVersion: 0 })),
        api(request(`${path}/withdraw`, "POST", { expectedVersion: 0 })),
      ]);
      assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
      const record = await document.send(new GetCommand({
        TableName: tableName, Key: { PK: `APPLICATION#${id}`, SK: "METADATA" }, ConsistentRead: true,
      }));
      assert.equal(record.Item?.status, "withdrawn");
      assert.equal(record.Item?.version, 1);
      assert.equal(record.Item?.GSI1PK, undefined);
      assert.equal(record.Item?.GSI1SK, undefined);
      const outbox = await document.send(new QueryCommand({
        TableName: tableName, IndexName: "OutboxPendingIndex",
        KeyConditionExpression: "GSI2PK = :pending",
        ExpressionAttributeValues: { ":pending": "OUTBOX#PENDING" },
      }));
      assert.equal(outbox.Items?.length, 0);
    });

    await t.test("retention is enforced before asynchronous TTL deletion", async () => {
      const submitted = await api(request("/applications", "POST", body));
      const expiredId = applicationId(submitted.body);
      await document.send(new UpdateCommand({
        TableName: tableName, Key: { PK: `APPLICATION#${expiredId}`, SK: "METADATA" },
        UpdateExpression: "SET expiresAt = :expired", ExpressionAttributeValues: { ":expired": 0 },
      }));
      assert.equal((await api(request(`/applications/${expiredId}`))).statusCode, 404);
      assert.equal((await api(request(`/applications/${expiredId}/withdraw`, "POST", {
        expectedVersion: 0,
      }))).statusCode, 404);
    });
  } finally {
    try {
      if (created) await client.send(new DeleteTableCommand({ TableName: tableName }));
    } finally {
      client.destroy();
    }
  }
});
