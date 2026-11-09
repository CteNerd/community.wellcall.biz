import assert from "node:assert/strict";
import { test } from "node:test";
import type { DynamoDBStreamEvent, ScheduledEvent } from "aws-lambda";
import type { AttributeValue } from "aws-lambda/trigger/dynamodb-stream";
import {
  createOutboxPublisher, isMentorApprovalEvent, maxReconciliationPages, reconciliationPageSize,
} from "./outbox-publisher.ts";
import type { MentorApprovalEvent } from "../../../packages/domain/src/adult-application.ts";

const event: MentorApprovalEvent = {
  source: "rct.dotcom",
  "detail-type": "dotcom.mentor.approved.v1",
  detail: {
    eventId: "b9de9897-5f48-4a63-a872-1d1b53bd64a5",
    schemaVersion: 1,
    occurredAt: "2026-11-05T12:00:00.000Z",
    correlationId: "d3f43a76-f08b-484a-8c0c-08a1a1ee0737",
    domain: "dotcom",
    data: { reportingMonth: "2026-11", mentorCount: 1 },
  },
};
const poisonId = "b9de9897-5f48-4a63-a872-1d1b53bd64a5";
const laterId = "d3f43a76-f08b-484a-8c0c-08a1a1ee0737";
const scheduled = {} as ScheduledEvent;
const pendingItem = (eventId: string): {
  PK: string; SK: string; event: MentorApprovalEvent; status: string;
} => ({
  PK: `OUTBOX#${eventId}`, SK: "EVENT", event: { ...event, detail: { ...event.detail, eventId } }, status: "PENDING",
});
const cursor = (number: number) => `cursor-${number}`;

function streamEvent(value: Record<string, unknown> = event): DynamoDBStreamEvent {
  return {
    Records: [{
      eventID: "test",
      eventName: "INSERT",
      eventVersion: "1.1",
      eventSource: "aws:dynamodb",
      awsRegion: "us-east-1",
      dynamodb: {
        ApproximateCreationDateTime: 0,
        Keys: { PK: { S: `OUTBOX#${event.detail.eventId}` }, SK: { S: "EVENT" } },
        NewImage: {
          PK: { S: `OUTBOX#${event.detail.eventId}` },
          SK: { S: "EVENT" },
          recordType: { S: "OUTBOX" },
          status: { S: "PENDING" },
          event: { M: toAttributeMap(value) },
        },
        SequenceNumber: "123",
        SizeBytes: 1,
        StreamViewType: "NEW_IMAGE",
      },
      eventSourceARN: "arn:aws:dynamodb:us-east-1:123456789012:table/core/stream/test",
    }],
  };
}

function toAttributeMap(value: Record<string, unknown>): Record<string, AttributeValue> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    attributeValue(item),
  ]));
}

function attributeValue(value: unknown): AttributeValue {
  if (typeof value === "string") return { S: value };
  if (typeof value === "number") return { N: String(value) };
  if (typeof value === "object" && value !== null) {
    return { M: toAttributeMap(value as Record<string, unknown>) };
  }
  return { S: String(value) };
}

test("Community mentor reporting accepts only strict aggregate-only approval events", () => {
  assert.equal(isMentorApprovalEvent(event), true);
  assert.equal(isMentorApprovalEvent({
    ...event,
    detail: { ...event.detail, data: { ...event.detail.data, applicantEmail: "private@example.com" } },
  }), false);
  assert.equal(isMentorApprovalEvent({
    ...event,
    detail: { ...event.detail, data: { ...event.detail.data, mentorCount: 2 } },
  }), false);
});

test("stream delivery publishes only validated events and acknowledges successful records", async () => {
  const published: MentorApprovalEvent[] = [];
  const delivered: string[] = [];
  const publish = createOutboxPublisher({
    async publish(value) { published.push(value); },
    async markDelivered(item) { delivered.push(item.PK); },
    async getCheckpoint() { return null; },
    async findPending() { return { items: [], nextCursor: null }; },
    async saveCheckpoint() {},
  });
  const result = await publish(streamEvent());
  assert.deepEqual(result, { batchItemFailures: [] });
  assert.equal(published.length, 1);
  assert.deepEqual(delivered, [`OUTBOX#${event.detail.eventId}`]);
});

test("malformed stream records are retried and failed EventBridge delivery is not acknowledged", async () => {
  const failures: string[] = [];
  const publish = createOutboxPublisher({
    async publish() { throw new Error("transport failure"); },
    async markDelivered() { assert.fail("failed events must remain pending"); },
    async getCheckpoint() { return null; },
    async findPending() { return { items: [], nextCursor: null }; },
    async saveCheckpoint() {},
  });
  const result = await publish(streamEvent());
  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: "123" }] });

  const malformed = streamEvent({ private: true });
  const malformedResult = await publish(malformed);
  failures.push(...(malformedResult.batchItemFailures ?? []).map(({ itemIdentifier }) => itemIdentifier));
  assert.deepEqual(failures, ["123"]);
});

test("reconciliation advances past a failed oldest page, continues later pages, and reports failures", async () => {
  const saves: [string | null, string | null][] = [];
  let checkpoint: string | null = null;
  const published: string[] = [];
  const delivered: string[] = [];
  const publish = createOutboxPublisher({
    async publish(value) {
      published.push(value.detail.eventId);
      if (value.detail.eventId === poisonId) throw new Error("persistent delivery failure");
    },
    async markDelivered(item) { delivered.push(item.PK); },
    async getCheckpoint() { return checkpoint; },
    async findPending(value) {
      if (value === null) return { items: [pendingItem(poisonId)], nextCursor: cursor(1) };
      assert.equal(value, cursor(1));
      return { items: [pendingItem(laterId)], nextCursor: null };
    },
    async saveCheckpoint(expected, next) {
      assert.equal(checkpoint, expected);
      saves.push([expected, next]);
      checkpoint = next;
    },
  });

  await assert.rejects(publish(scheduled), /Failed to deliver 1 pending event/);
  assert.deepEqual(published, [poisonId, laterId]);
  assert.deepEqual(delivered, [`OUTBOX#${laterId}`]);
  assert.deepEqual(saves, [[null, cursor(1)], [cursor(1), null]]);
  assert.equal(checkpoint, null);
});

test("scheduled reconciliation processes a bounded number of paginated records per invocation", async () => {
  let checkpoint: string | null = null;
  let queries = 0;
  const pageEventIds = [poisonId, laterId, "f3a5dc82-7f6d-4c52-85ed-75e69eb27e10"];
  let published = 0;
  const publish = createOutboxPublisher({
    async publish() { published += 1; },
    async markDelivered() {},
    async getCheckpoint() { return checkpoint; },
    async findPending(value) {
      queries += 1;
      assert.equal(value, checkpoint);
      return {
        items: [pendingItem(pageEventIds[queries - 1]!)],
        nextCursor: cursor(queries),
      };
    },
    async saveCheckpoint(expected, next) {
      assert.equal(expected, checkpoint);
      checkpoint = next;
    },
  });
  const result = await publish(scheduled) as { delivered: number; pages: number; nextCursor: string | null };
  assert.equal(queries, maxReconciliationPages);
  assert.equal(result.pages, maxReconciliationPages);
  assert.equal(published, maxReconciliationPages);
  assert.equal(result.delivered, maxReconciliationPages);
  assert.equal(result.nextCursor, cursor(maxReconciliationPages));
  assert.equal(checkpoint, cursor(maxReconciliationPages));
  assert.equal(reconciliationPageSize, 100);
});

test("checkpoint persistence failures are surfaced to the scheduled retry path", async () => {
  const publish = createOutboxPublisher({
    async publish() {},
    async markDelivered() {},
    async getCheckpoint() { return null; },
    async findPending() { return { items: [], nextCursor: cursor(1) }; },
    async saveCheckpoint() { throw new Error("checkpoint write failed"); },
  });
  await assert.rejects(publish(scheduled), /checkpoint write failed/);
});
