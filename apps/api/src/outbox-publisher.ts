import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBStreamEvent, ScheduledEvent } from "aws-lambda";
import type { MentorApprovalEvent } from "../../../packages/domain/src/adult-application.ts";

type OutboxItem = {
  PK: string;
  SK: string;
  event: MentorApprovalEvent;
  status: string;
};

type PendingPage = {
  items: OutboxItem[];
  nextCursor: string | null;
};

type PublisherDependencies = {
  publish(event: MentorApprovalEvent): Promise<void>;
  markDelivered(item: OutboxItem): Promise<void>;
  getCheckpoint(): Promise<string | null>;
  findPending(cursor: string | null): Promise<PendingPage>;
  saveCheckpoint(expected: string | null, next: string | null): Promise<void>;
};

export const maxReconciliationPages = 3;
export const reconciliationPageSize = 100;

export function createOutboxPublisher(dependencies: PublisherDependencies) {
  return async (input: DynamoDBStreamEvent | ScheduledEvent) => {
    if ("Records" in input) {
      const batchItemFailures: { itemIdentifier: string }[] = [];
      for (const record of input.Records) {
        if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) continue;
        const image = record.dynamodb.NewImage;
        if (image.recordType?.S !== "OUTBOX") continue;
        const eventValue = image.event?.M ? decodeMap(image.event.M) : undefined;
        if (!image.PK?.S || !image.SK?.S || !isMentorApprovalEvent(eventValue)) {
          if (!record.dynamodb.SequenceNumber) throw new Error("Outbox stream record has no sequence number");
          batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
          continue;
        }
        try {
          await deliver({
            PK: image.PK.S,
            SK: image.SK.S,
            event: eventValue,
            status: image.status?.S ?? "UNKNOWN",
          }, dependencies);
        } catch {
          if (!record.dynamodb.SequenceNumber) throw new Error("Outbox stream record has no sequence number");
          batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
        }
      }
      return { batchItemFailures };
    }

    let cursor = await dependencies.getCheckpoint();
    let pages = 0;
    let delivered = 0;
    let failures = 0;
    while (pages < maxReconciliationPages) {
      const previous = cursor;
      const page = await dependencies.findPending(previous);
      pages += 1;
      for (const item of page.items) {
        try {
          await deliver(item, dependencies);
          delivered += 1;
        } catch {
          failures += 1;
        }
      }
      cursor = page.nextCursor;
      if (cursor !== previous) await dependencies.saveCheckpoint(previous, cursor);
      if (cursor === null) break;
    }
    if (failures > 0) throw new Error(`Failed to deliver ${failures} pending event(s)`);
    return { delivered, pages, nextCursor: cursor };
  };
}

async function deliver(item: OutboxItem, dependencies: PublisherDependencies): Promise<void> {
  if (!isMentorApprovalEvent(item.event)) throw new Error("Outbox event violates the reporting schema");
  await dependencies.publish(item.event);
  await dependencies.markDelivered(item);
}

export function isMentorApprovalEvent(value: unknown): value is MentorApprovalEvent {
  if (!isRecord(value) || !isRecord(value.detail)) return false;
  const detail = value.detail;
  if (!isRecord(detail.data)) return false;
  return value.source === "rct.dotcom"
    && value["detail-type"] === "dotcom.mentor.approved.v1"
    && Object.keys(value).sort().join(",") === "detail,detail-type,source"
    && Object.keys(detail).sort().join(",") === "correlationId,data,domain,eventId,occurredAt,schemaVersion"
    && Object.keys(detail.data).sort().join(",") === "mentorCount,reportingMonth"
    && detail.schemaVersion === 1
    && detail.domain === "dotcom"
    && isUuid(detail.eventId)
    && isUuid(detail.correlationId)
    && isTimestamp(detail.occurredAt)
    && detail.data.reportingMonth === detail.occurredAt.slice(0, 7)
    && detail.data.mentorCount === 1;
}

const tableName = process.env.CORE_TABLE_NAME ?? "";
const busArn = process.env.EVENT_BUS_ARN ?? "";
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridge = new EventBridgeClient({});
const checkpointKey = { PK: "OUTBOX#RECONCILIATION", SK: "CHECKPOINT" };

type StreamAttribute = NonNullable<DynamoDBStreamEvent["Records"][number]["dynamodb"]>["NewImage"];

function decodeMap(value: NonNullable<StreamAttribute>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, attribute]) => [key, decodeValue(attribute)]));
}

function decodeValue(value: NonNullable<StreamAttribute>[string]): unknown {
  if (value.S !== undefined) return value.S;
  if (value.N !== undefined) return Number(value.N);
  if (value.BOOL !== undefined) return value.BOOL;
  if (value.NULL) return null;
  if (value.M) return decodeMap(value.M);
  if (value.L) return value.L.map(decodeValue);
  throw new Error("Unsupported DynamoDB outbox attribute");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export const handler = createOutboxPublisher({
  async publish(event) {
    const result = await eventBridge.send(new PutEventsCommand({
      Entries: [{
        EventBusName: busArn,
        Source: event.source,
        DetailType: event["detail-type"],
        Detail: JSON.stringify(event.detail),
      }],
    }));
    const entry = result.Entries?.[0];
    if (result.FailedEntryCount !== 0 || !entry?.EventId || entry.ErrorCode) {
      throw new Error("EventBridge did not accept the mentor approval event");
    }
  },
  async markDelivered(item) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: "SET #status = :delivered REMOVE GSI2PK, GSI2SK",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":delivered": "DELIVERED", ":pending": "PENDING" },
        ConditionExpression: "#status = :pending",
      }));
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
    }
  },
  async getCheckpoint() {
    const result = await documentClient.send(new GetCommand({
      TableName: tableName, Key: checkpointKey, ConsistentRead: true,
    }));
    if (result.Item === undefined) return null;
    if (!isOutboxCursor(result.Item.cursor)) {
      throw new Error("Outbox reconciliation checkpoint is invalid");
    }
    return result.Item.cursor;
  },
  async findPending(cursor) {
    const result = await documentClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: "OutboxPendingIndex",
      KeyConditionExpression: cursor === null
        ? "GSI2PK = :pending"
        : "GSI2PK = :pending AND GSI2SK > :cursor",
      ExpressionAttributeValues: {
        ":pending": "OUTBOX#PENDING",
        ...(cursor === null ? {} : { ":cursor": cursor }),
      },
      Limit: reconciliationPageSize,
    }));
    return {
      items: (result.Items ?? []) as OutboxItem[],
      nextCursor: result.LastEvaluatedKey === undefined ? null : encodeCursor(result.LastEvaluatedKey),
    };
  },
  async saveCheckpoint(expected, next) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: checkpointKey,
        UpdateExpression: next === null ? "REMOVE #cursor" : "SET #cursor = :next",
        ConditionExpression: expected === null ? "attribute_not_exists(#cursor)" : "#cursor = :expected",
        ExpressionAttributeNames: { "#cursor": "cursor" },
        ExpressionAttributeValues: {
          ...(expected === null ? {} : { ":expected": expected }),
          ...(next === null ? {} : { ":next": next }),
        },
      }));
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new Error("Outbox reconciliation checkpoint changed; retry recovery");
      }
      throw error;
    }
  },
});

function encodeCursor(value: Record<string, unknown>): string {
  if (!isOutboxCursor(value.GSI2SK)) throw new Error("Unable to create outbox reconciliation cursor");
  return value.GSI2SK;
}

function isOutboxCursor(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 128) return false;
  const delimiter = value.indexOf("#");
  return delimiter > 0 && value.indexOf("#", delimiter + 1) === -1
    && isTimestamp(value.slice(0, delimiter))
    && isUuid(value.slice(delimiter + 1));
}
