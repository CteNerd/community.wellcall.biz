import assert from "node:assert/strict";
import { test } from "node:test";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  ApplicationConflictError, ApplicationNotFoundError, createApplication, DynamoApplicationStore,
} from "./applications.ts";

const now = new Date("2026-11-05T12:00:00.000Z");
const applicationId = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";

function application() {
  const record = createApplication({
    kind: "mentor",
    contactName: "Applicant",
    contactEmail: "adult@example.com",
    applicantSub: "applicant-sub",
    consentPolicyVersion: "approved-v1",
    retentionDays: 180,
  }, now, applicationId);
  return {
    ...record,
    adultEligibility: {
      status: "verified" as const,
      verifiedBy: "reviewer-1",
      verifiedAt: now.toISOString(),
    },
    mentorScreening: "passed" as const,
    screeningBy: "reviewer-1",
    screeningAt: now.toISOString(),
  };
}

function storedItem() {
  const value = application();
  const {
    applicantSub, contactName, contactEmail, createdAt, expiresAt, version,
    ...domainApplication
  } = value;
  return {
    PK: `APPLICATION#${applicationId}`,
    SK: "METADATA",
    recordType: "APPLICATION",
    status: domainApplication.status,
    application: domainApplication,
    applicantSub,
    contactName,
    contactEmail,
    createdAt,
    expiresAt,
    version,
    GSI1PK: "APPLICATION#UNDER_REVIEW",
    GSI1SK: `${createdAt}#${applicationId}`,
  };
}

test("owned application reads hide other applicants and expired records before withdrawal", async () => {
  const commands: unknown[] = [];
  let item = storedItem();
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetCommand) return { Item: item };
      throw new Error("Unexpected write");
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  assert.equal(await store.getOwned(applicationId, "another-applicant", now), undefined);
  await assert.rejects(store.withdraw({
    applicationId, applicantSub: "another-applicant", expectedVersion: 0, now,
  }), ApplicationNotFoundError);
  item = { ...item, expiresAt: Math.floor(now.getTime() / 1000) };
  assert.equal(await store.getOwned(applicationId, "applicant-sub", now), undefined);
  assert.ok(commands.every((command) => command instanceof GetCommand));
});

test("withdrawal conditionally removes pending review listing without emitting mentor counts", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetCommand) return { Item: storedItem() };
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  const result = await store.withdraw({
    applicationId, applicantSub: "applicant-sub", expectedVersion: 0, now,
  });
  assert.equal(result.status, "withdrawn");
  assert.equal(result.version, 1);
  const write = commands.find((command) => command instanceof TransactWriteCommand);
  assert.ok(write instanceof TransactWriteCommand);
  assert.equal(write.input.TransactItems?.length, 1);
  const update = write.input.TransactItems?.[0]?.Update;
  assert.match(update?.ConditionExpression ?? "", /applicantSub = :applicantSub.*#status = :underReview.*#version = :expectedVersion.*expiresAt > :now/);
  assert.match(update?.UpdateExpression ?? "", /REMOVE GSI1PK, GSI1SK/);
  assert.equal(update?.ExpressionAttributeValues?.[":applicantSub"], "applicant-sub");
  assert.equal(update?.ExpressionAttributeValues?.[":application"].withdrawnAt, now.toISOString());
  assert.doesNotMatch(JSON.stringify(write.input), /OUTBOX|mentorCount/);
});

test("concurrent review or stale withdrawal cannot overwrite a decision", async () => {
  const client = {
    async send(command: unknown) {
      if (command instanceof GetCommand) return { Item: storedItem() };
      throw new TransactionCanceledException({
        message: "Version changed", $metadata: {},
        CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
      });
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  for (const expectedVersion of [0, 1]) {
    await assert.rejects(store.withdraw({
      applicationId, applicantSub: "applicant-sub", expectedVersion, now,
    }), ApplicationConflictError);
  }
});

test("withdrawal preserves terminal decisions and surfaces non-conflict storage failures", async () => {
  let application = storedItem().application;
  const failure = new TransactionCanceledException({
    message: "Storage failure", $metadata: {},
    CancellationReasons: [{ Code: "ProvisionedThroughputExceeded" }],
  });
  let writes = 0;
  const client = {
    async send(command: unknown) {
      if (command instanceof GetCommand) return { Item: { ...storedItem(), status: application.status, application } };
      writes += 1;
      throw failure;
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  for (const status of ["approved", "rejected", "withdrawn"] as const) {
    application = { ...application, status };
    await assert.rejects(store.withdraw({
      applicationId, applicantSub: "applicant-sub", expectedVersion: 0, now,
    }), /under review/);
  }
  assert.equal(writes, 0);
  application = { ...application, status: "under_review" };
  await assert.rejects(store.withdraw({
    applicationId, applicantSub: "applicant-sub", expectedVersion: 0, now,
  }), (error: unknown) => error === failure);
});

test("lost application acknowledgements recover only a matching unexpired receipt", async () => {
  const commands: unknown[] = [];
  let receiptRead = false;
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof TransactWriteCommand) {
        throw new TransactionCanceledException({
          message: "Conditional transaction conflict",
          $metadata: { httpStatusCode: 400 },
        });
      }
      if (command instanceof GetCommand) {
        if (!receiptRead) {
          receiptRead = true;
          return {
            Item: {
              applicationId,
              applicantSub: "applicant-sub",
              expiresAt: Math.floor(now.getTime() / 1000) + 3600,
            },
          };
        }
        return { Item: storedItem() };
      }
      throw new Error("Unexpected DynamoDB command");
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  const retry = { ...application(), applicationId: "c8f1b3d2-6295-4f66-87d1-fc45a6ca3e1a" };

  assert.deepEqual(await store.create(retry, "d3f43a76-f08b-484a-8c0c-08a1a1ee0737"), {
    status: "duplicate",
    applicationId,
  });
  assert.equal(commands.length, 3);
  assert.ok(commands[0] instanceof TransactWriteCommand);
  assert.ok(commands[1] instanceof GetCommand);
  assert.ok(commands[2] instanceof GetCommand);
});

test("mentor approval and aggregate outbox insert use one conditional transaction", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetCommand) {
        return command.input.Key?.PK === `APPLICATION#${applicationId}` ? { Item: storedItem() } : {};
      }
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  const result = await store.review({
    applicationId,
    action: { type: "decide", decision: "approve" },
    reviewerId: "reviewer-2",
    consentPolicyVersion: "approved-v1",
    expectedVersion: 0,
    now,
  });

  assert.equal(result.status, "approved");
  assert.equal(result.version, 1);
  assert.ok(commands[0] instanceof GetCommand);
  assert.ok(commands[1] instanceof GetCommand);
  assert.ok(commands[2] instanceof TransactWriteCommand);
  const transaction = (commands[2] as TransactWriteCommand).input.TransactItems;
  assert.equal(transaction?.length, 3);
  const update = transaction?.[0]?.Update;
  const guard = transaction?.[1]?.Put;
  const outbox = transaction?.[2]?.Put;
  assert.match(update?.ConditionExpression ?? "", /#version = :expectedVersion AND expiresAt > :now/);
  assert.equal(guard?.Item?.PK, "MENTOR_APPROVAL#applicant-sub");
  assert.equal(guard?.Item?.SK, "FIRST");
  assert.equal(guard?.ConditionExpression, "attribute_not_exists(PK)");
  assert.equal(outbox?.Item?.status, "PENDING");
  assert.equal(outbox?.Item?.GSI2PK, "OUTBOX#PENDING");
  assert.deepEqual(outbox?.Item?.event.detail.data, { reportingMonth: "2026-11", mentorCount: 1 });
  assert.doesNotMatch(JSON.stringify(outbox?.Item?.event), /Applicant|adult@example\.com|applicant-sub/);
});

test("existing applicant first-approval guard suppresses later application outbox events", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetCommand) {
        return command.input.Key?.PK === `APPLICATION#${applicationId}`
          ? { Item: storedItem() }
          : { Item: { PK: "MENTOR_APPROVAL#applicant-sub", SK: "FIRST" } };
      }
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  const result = await store.review({
    applicationId, action: { type: "decide", decision: "approve" },
    reviewerId: "reviewer-2", consentPolicyVersion: "approved-v1", expectedVersion: 0, now,
  });
  assert.equal(result.status, "approved");
  const transaction = commands.find((command) => command instanceof TransactWriteCommand) as TransactWriteCommand;
  assert.equal(transaction.input.TransactItems?.length, 1);
  assert.ok(transaction.input.TransactItems?.[0]?.Update);
});

test("approval race observes the durable winner and retries the other application without another event", async () => {
  const commands: unknown[] = [];
  let markerWritten = false;
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetCommand) {
        return command.input.Key?.PK === `APPLICATION#${applicationId}`
          ? { Item: storedItem() }
          : markerWritten ? { Item: { PK: "MENTOR_APPROVAL#applicant-sub", SK: "FIRST" } } : {};
      }
      if (command instanceof TransactWriteCommand && !markerWritten) {
        markerWritten = true;
        throw new TransactionCanceledException({
          message: "Another application won the first-approval guard", $metadata: {},
          CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
        });
      }
      markerWritten = true;
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  const result = await store.review({
    applicationId, action: { type: "decide", decision: "approve" },
    reviewerId: "reviewer-2", consentPolicyVersion: "approved-v1", expectedVersion: 0, now,
  });
  assert.equal(result.status, "approved");
  const transactions = commands.filter((command) => command instanceof TransactWriteCommand) as TransactWriteCommand[];
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0]?.input.TransactItems?.length, 3);
  assert.equal(transactions[1]?.input.TransactItems?.length, 1);
});

test("application and short-lived idempotency receipt are created atomically without contact data in the receipt", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) {
      commands.push(command);
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const store = new DynamoApplicationStore(client, "community-core");
  const result = await store.create(application(), "d3f43a76-f08b-484a-8c0c-08a1a1ee0737");

  assert.deepEqual(result, { status: "created", applicationId });
  assert.ok(commands[0] instanceof TransactWriteCommand);
  const transaction = (commands[0] as TransactWriteCommand).input.TransactItems;
  assert.equal(transaction?.length, 2);
  const applicationPut = transaction?.[0]?.Put;
  const receiptPut = transaction?.[1]?.Put;
  assert.equal(applicationPut?.Item?.recordType, "APPLICATION");
  assert.equal(receiptPut?.Item?.PK, "IDEMPOTENCY#d3f43a76-f08b-484a-8c0c-08a1a1ee0737");
  assert.equal(receiptPut?.Item?.expiresAt, Math.floor(now.getTime() / 1000) + 86400);
  assert.doesNotMatch(JSON.stringify(receiptPut?.Item), /Applicant|adult@example\.com/);
});
