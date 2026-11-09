import assert from "node:assert/strict";
import { test } from "node:test";
import type { DynamoDBStreamEvent } from "aws-lambda";
import type { AttributeValue } from "aws-lambda/trigger/dynamodb-stream";
import { createOutboxPublisher, isMentorApprovalEvent } from "./outbox-publisher.ts";
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
    async findPending() { return []; },
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
    async findPending() { return []; },
  });
  const result = await publish(streamEvent());
  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: "123" }] });

  const malformed = streamEvent({ private: true });
  const malformedResult = await publish(malformed);
  failures.push(...(malformedResult.batchItemFailures ?? []).map(({ itemIdentifier }) => itemIdentifier));
  assert.deepEqual(failures, ["123"]);
});
