import {
  ConditionalCheckFailedException, TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  reviewAdultApplication, withdrawAdultApplication, type AdultApplication, type ApplicationReviewAction, type MentorApprovalEvent,
} from "../../../packages/domain/src/adult-application.ts";

export type StoredAdultApplication = AdultApplication & {
  applicantSub: string;
  contactName: string;
  contactEmail: string;
  createdAt: string;
  expiresAt: number;
  version: number;
};

export type ApplicationPage = {
  applications: StoredAdultApplication[];
  nextToken: string | null;
};
export type ApplicationCreateResult = {
  status: "created" | "duplicate";
  applicationId: string;
};

export class ApplicationConflictError extends Error {
  constructor() {
    super("Application changed or is no longer available");
    this.name = "ApplicationConflictError";
  }
}

export class ApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
}

export class ApplicationIdempotencyConflictError extends Error {
  constructor() {
    super("Application request key was already used for a different submission");
    this.name = "ApplicationIdempotencyConflictError";
  }
}

export class InvalidApplicationCursorError extends Error {
  constructor() {
    super("Invalid application page cursor");
    this.name = "InvalidApplicationCursorError";
  }
}

export type ApplicationSubmission = {
  kind: "participant" | "mentor";
  contactName: string;
  contactEmail: string;
  applicantSub: string;
  consentPolicyVersion: string;
  retentionDays: number;
  now: Date;
};

export type ApplicationReview = {
  applicationId: string;
  action: ApplicationReviewAction;
  reviewerId: string;
  consentPolicyVersion: string;
  expectedVersion: number;
  now: Date;
};

export type ApplicationWithdrawal = {
  applicationId: string;
  applicantSub: string;
  expectedVersion: number;
  now: Date;
};

export interface ApplicationStore {
  create(application: StoredAdultApplication, idempotencyKey: string): Promise<ApplicationCreateResult>;
  listLatest(nextToken?: string): Promise<ApplicationPage>;
  review(update: ApplicationReview): Promise<StoredAdultApplication>;
  getOwned(applicationId: string, applicantSub: string, now: Date): Promise<StoredAdultApplication | undefined>;
  withdraw(update: ApplicationWithdrawal): Promise<StoredAdultApplication>;
}

type ApplicationCursor = {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
};
type ApplicationItem = Record<string, unknown> & { application: AdultApplication };

export class DynamoApplicationStore implements ApplicationStore {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async getOwned(applicationId: string, applicantSub: string, now: Date): Promise<StoredAdultApplication | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `APPLICATION#${applicationId}`, SK: "METADATA" },
      ConsistentRead: true,
    }));
    if (!result.Item || result.Item.applicantSub !== applicantSub) return undefined;
    const application = toApplication(result.Item);
    return application.expiresAt > Math.floor(now.getTime() / 1000) ? application : undefined;
  }

  async withdraw(update: ApplicationWithdrawal): Promise<StoredAdultApplication> {
    const application = await this.getOwned(update.applicationId, update.applicantSub, update.now);
    if (!application) throw new ApplicationNotFoundError();
    if (application.version !== update.expectedVersion
      || application.version >= Number.MAX_SAFE_INTEGER) throw new ApplicationConflictError();
    const withdrawn = withdrawAdultApplication(domainApplication(application), update.now);
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [{
          Update: {
            TableName: this.tableName,
            Key: { PK: `APPLICATION#${update.applicationId}`, SK: "METADATA" },
            UpdateExpression: "SET #application = :application, #status = :withdrawn, #version = :nextVersion, "
              + "withdrawnAt = :withdrawnAt, updatedAt = :withdrawnAt REMOVE GSI1PK, GSI1SK",
            ConditionExpression: "applicantSub = :applicantSub AND #status = :underReview "
              + "AND #version = :expectedVersion AND expiresAt > :now",
            ExpressionAttributeNames: { "#application": "application", "#status": "status", "#version": "version" },
            ExpressionAttributeValues: {
              ":application": withdrawn,
              ":withdrawn": "withdrawn",
              ":underReview": "under_review",
              ":applicantSub": update.applicantSub,
              ":expectedVersion": update.expectedVersion,
              ":nextVersion": application.version + 1,
              ":withdrawnAt": update.now.toISOString(),
              ":now": Math.floor(update.now.getTime() / 1000),
            },
          },
        }],
      }));
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException
        || (error instanceof TransactionCanceledException
          && error.CancellationReasons?.some((reason) => reason.Code === "ConditionalCheckFailed"))) {
        throw new ApplicationConflictError();
      }
      throw error;
    }
    return { ...application, ...withdrawn, version: application.version + 1 };
  }

  async create(application: StoredAdultApplication, idempotencyKey: string): Promise<ApplicationCreateResult> {
    const now = Math.floor(Date.parse(application.createdAt) / 1000);
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [{
          Put: {
            TableName: this.tableName,
            Item: {
              PK: `APPLICATION#${application.applicationId}`,
              SK: "METADATA",
              recordType: "APPLICATION",
              ...application,
              application: domainApplication(application),
              GSI1PK: "APPLICATION#UNDER_REVIEW",
              GSI1SK: `${application.createdAt}#${application.applicationId}`,
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        }, {
          Put: {
            TableName: this.tableName,
            Item: {
              PK: `IDEMPOTENCY#${idempotencyKey}`,
              SK: "APPLICATION",
              applicationId: application.applicationId,
              applicantSub: application.applicantSub,
              expiresAt: now + 86400,
            },
            ConditionExpression: "attribute_not_exists(PK) OR expiresAt <= :now",
            ExpressionAttributeValues: { ":now": now },
          },
        }],
      }));
      return { status: "created", applicationId: application.applicationId };
    } catch (error) {
      if (!(error instanceof TransactionCanceledException)) throw error;
      const receipt = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: { PK: `IDEMPOTENCY#${idempotencyKey}`, SK: "APPLICATION" },
        ConsistentRead: true,
      }));
      if (!receipt.Item || typeof receipt.Item.applicationId !== "string"
        || typeof receipt.Item.expiresAt !== "number" || receipt.Item.expiresAt <= now
        || receipt.Item.applicantSub !== application.applicantSub) throw error;
      const existing = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: { PK: `APPLICATION#${receipt.Item.applicationId}`, SK: "METADATA" },
        ConsistentRead: true,
      }));
      if (!existing.Item || !isApplication(existing.Item)) throw error;
      if (!sameSubmission(toApplication(existing.Item), application)) {
        throw new ApplicationIdempotencyConflictError();
      }
      return { status: "duplicate", applicationId: receipt.Item.applicationId };
    }
  }

  async listLatest(nextToken?: string): Promise<ApplicationPage> {
    const cursor = nextToken === undefined ? undefined : decodeCursor(nextToken);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "CommunityApplicationsIndex",
      KeyConditionExpression: "GSI1PK = :underReview",
      FilterExpression: "expiresAt > :now",
      ExpressionAttributeValues: {
        ":underReview": "APPLICATION#UNDER_REVIEW",
        ":now": Math.floor(Date.now() / 1000),
      },
      ScanIndexForward: false,
      Limit: 25,
      ...(cursor === undefined ? {} : { ExclusiveStartKey: cursor }),
    }));
    return {
      applications: (result.Items ?? []).map(toApplication),
      nextToken: result.LastEvaluatedKey === undefined ? null : encodeCursor(result.LastEvaluatedKey),
    };
  }

  async review(update: ApplicationReview): Promise<StoredAdultApplication> {
    const key = { PK: `APPLICATION#${update.applicationId}`, SK: "METADATA" };
    const current = await this.client.send(new GetCommand({
      TableName: this.tableName, Key: key, ConsistentRead: true,
    }));
    if (!current.Item || current.Item.recordType !== "APPLICATION") throw new ApplicationConflictError();

    const application = toApplication(current.Item);
    if (application.version !== update.expectedVersion
      || application.version >= Number.MAX_SAFE_INTEGER) throw new ApplicationConflictError();
    const reviewed = reviewAdultApplication(
      domainApplication(application), update.action, update.reviewerId, update.consentPolicyVersion, update.now,
    );
    const nextVersion = application.version + 1;
    const terminal = reviewed.application.status !== "under_review";
    const transactionItems: NonNullable<TransactWriteCommandInput["TransactItems"]> = [{
      Update: {
        TableName: this.tableName,
        Key: key,
        UpdateExpression: `SET #application = :application, #status = :status, #adultEligibility = :eligibility, `
          + `#mentorScreening = :screening, #screeningBy = :screeningBy, #screeningAt = :screeningAt, `
          + `#reviewedBy = :reviewedBy, #reviewedAt = :reviewedAt, #version = :nextVersion, `
          + `#updatedAt = :updatedAt${terminal ? " REMOVE GSI1PK, GSI1SK" : ""}`,
        ConditionExpression: "#status = :underReview AND #version = :expectedVersion AND expiresAt > :now",
        ExpressionAttributeNames: {
          "#application": "application", "#adultEligibility": "adultEligibility",
          "#mentorScreening": "mentorScreening", "#screeningBy": "screeningBy",
          "#screeningAt": "screeningAt", "#reviewedBy": "reviewedBy",
          "#reviewedAt": "reviewedAt", "#version": "version",
          "#updatedAt": "updatedAt", "#status": "status",
        },
        ExpressionAttributeValues: {
          ":application": reviewed.application,
          ":status": reviewed.application.status,
          ":eligibility": reviewed.application.adultEligibility,
          ":screening": reviewed.application.mentorScreening,
          ":screeningBy": reviewed.application.screeningBy ?? null,
          ":screeningAt": reviewed.application.screeningAt ?? null,
          ":reviewedBy": reviewed.application.reviewedBy ?? null,
          ":reviewedAt": reviewed.application.reviewedAt ?? null,
          ":nextVersion": nextVersion,
          ":updatedAt": update.now.toISOString(),
          ":underReview": "under_review",
          ":expectedVersion": update.expectedVersion,
          ":now": Math.floor(update.now.getTime() / 1000),
        },
      },
    }];
    const event = reviewed.reportingEvent;
    if (event) transactionItems.push(buildOutboxPut(this.tableName, event));

    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: transactionItems }));
    } catch (error) {
      if (error instanceof TransactionCanceledException || error instanceof ConditionalCheckFailedException) {
        throw new ApplicationConflictError();
      }
      throw error;
    }

    return { ...application, ...reviewed.application, version: nextVersion };
  }
}

function buildOutboxPut(tableName: string, event: MentorApprovalEvent) {
  return {
    Put: {
      TableName: tableName,
      Item: {
        PK: `OUTBOX#${event.detail.eventId}`, SK: "EVENT", recordType: "OUTBOX",
        event, status: "PENDING", GSI2PK: "OUTBOX#PENDING",
        GSI2SK: `${event.detail.occurredAt}#${event.detail.eventId}`,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    },
  };
}

function toApplication(item: Record<string, unknown>): StoredAdultApplication {
  if (!isApplication(item)) {
    throw new Error("Stored Community application is invalid");
  }
  const application = item.application;
  return {
    ...application,
    applicantSub: stringField(item, "applicantSub"),
    contactName: stringField(item, "contactName"),
    contactEmail: stringField(item, "contactEmail"),
    createdAt: stringField(item, "createdAt"),
    expiresAt: numberField(item, "expiresAt"),
    version: numberField(item, "version"),
  };
}

function isApplication(item: Record<string, unknown>): item is ApplicationItem {
  const value = item.application;
  if (item.recordType !== "APPLICATION" || !isRecord(value) || !isAdultApplication(value)) return false;
  return typeof item.PK === "string"
    && item.PK.startsWith("APPLICATION#")
    && value.applicationId === item.PK.slice("APPLICATION#".length)
    && value.status === item.status
    && typeof item.applicantSub === "string"
    && typeof item.contactName === "string"
    && typeof item.contactEmail === "string"
    && typeof item.createdAt === "string"
    && isTimestamp(item.createdAt)
    && typeof item.expiresAt === "number"
    && Number.isSafeInteger(item.expiresAt)
    && typeof item.version === "number"
    && Number.isSafeInteger(item.version)
    && item.version >= 0;
}

function isAdultApplication(value: Record<string, unknown>): value is AdultApplication {
  return typeof value.applicationId === "string"
    && (value.kind === "mentor" || value.kind === "participant")
    && ["under_review", "approved", "rejected", "withdrawn"].includes(String(value.status))
    && isRecord(value.adultEligibility)
    && (value.adultEligibility.status === "unverified" || value.adultEligibility.status === "verified")
    && ["not_required", "pending", "passed", "failed"].includes(String(value.mentorScreening));
}

function domainApplication(application: AdultApplication): AdultApplication {
  return {
    applicationId: application.applicationId,
    kind: application.kind,
    status: application.status,
    adultEligibility: application.adultEligibility,
    mentorScreening: application.mentorScreening,
    ...(application.consentAcceptedAt === undefined ? {} : { consentAcceptedAt: application.consentAcceptedAt }),
    ...(application.consentPolicyVersion === undefined ? {} : { consentPolicyVersion: application.consentPolicyVersion }),
    ...(application.screeningBy === undefined ? {} : { screeningBy: application.screeningBy }),
    ...(application.screeningAt === undefined ? {} : { screeningAt: application.screeningAt }),
    ...(application.reviewedBy === undefined ? {} : { reviewedBy: application.reviewedBy }),
    ...(application.reviewedAt === undefined ? {} : { reviewedAt: application.reviewedAt }),
    ...(application.withdrawnAt === undefined ? {} : { withdrawnAt: application.withdrawnAt }),
  };
}

function stringField(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  if (typeof value !== "string") throw new Error("Stored Community application is invalid");
  return value;
}

function numberField(item: Record<string, unknown>, key: string): number {
  const value = item[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("Stored Community application is invalid");
  }
  return value;
}

function encodeCursor(value: Record<string, unknown>): string {
  const cursor = {
    PK: value.PK, SK: value.SK, GSI1PK: value.GSI1PK, GSI1SK: value.GSI1SK,
  };
  if (!isCursor(cursor)) throw new Error("Unable to create application page cursor");
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): ApplicationCursor {
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new InvalidApplicationCursorError();
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!isCursor(parsed)) throw new InvalidApplicationCursorError();
    return parsed;
  } catch (error) {
    if (error instanceof InvalidApplicationCursorError) throw error;
    throw new InvalidApplicationCursorError();
  }
}

function isCursor(value: unknown): value is ApplicationCursor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  return Object.keys(cursor).sort().join(",") === "GSI1PK,GSI1SK,PK,SK"
    && cursor.SK === "METADATA"
    && cursor.GSI1PK === "APPLICATION#UNDER_REVIEW"
    && typeof cursor.PK === "string"
    && /^APPLICATION#[0-9a-f-]{36}$/i.test(cursor.PK)
    && typeof cursor.GSI1SK === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function sameSubmission(existing: StoredAdultApplication, submitted: StoredAdultApplication): boolean {
  return existing.applicantSub === submitted.applicantSub
    && existing.kind === submitted.kind
    && existing.contactName === submitted.contactName
    && existing.contactEmail === submitted.contactEmail
    && existing.consentPolicyVersion === submitted.consentPolicyVersion;
}

export function createApplication(
  submission: Omit<ApplicationSubmission, "now">,
  now: Date,
  applicationId: string,
): StoredAdultApplication {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(submission.retentionDays)
    || submission.retentionDays < 1 || submission.retentionDays > 3650) {
    throw new Error("Application intake configuration is invalid");
  }
  return {
    applicationId,
    kind: submission.kind,
    status: "under_review",
    applicantSub: submission.applicantSub,
    contactName: submission.contactName,
    contactEmail: submission.contactEmail,
    adultEligibility: { status: "unverified" },
    consentAcceptedAt: now.toISOString(),
    consentPolicyVersion: submission.consentPolicyVersion,
    mentorScreening: submission.kind === "mentor" ? "pending" : "not_required",
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + submission.retentionDays * 86400,
    version: 0,
  };
}
