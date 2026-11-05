import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import schema from "../schemas/reporting-event.v1.schema.json" with { type: "json" };

type Detail<Domain, Data> = {
  eventId: string;
  schemaVersion: 1;
  occurredAt: string;
  correlationId: string;
  domain: Domain;
  data: Data & { reportingMonth: string };
};

type Adjustment = {
  countDelta: number;
  reasonCode: "duplicate" | "voided" | "data_correction" | "backfill";
};

export type ReportingEvent =
  | {
      source: "rct.consulting";
      "detail-type": "consulting.lead.created.v1";
      detail: Detail<"consulting", { leadCount: 1 }>;
    }
  | {
      source: "rct.consulting";
      "detail-type": "consulting.lead.count.adjusted.v1";
      detail: Detail<"consulting", Adjustment>;
    }
  | {
      source: "rct.dotcom";
      "detail-type": "dotcom.mentor.approved.v1";
      detail: Detail<"dotcom", { mentorCount: 1 }>;
    }
  | {
      source: "rct.dotcom";
      "detail-type": "dotcom.mentor.approval.count.adjusted.v1";
      detail: Detail<"dotcom", Adjustment>;
    };

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile<ReportingEvent>(schema);

export class InvalidReportingEventError extends Error {
  constructor() {
    super("Reporting event rejected: invalid envelope, source/type, version, or payload");
    this.name = "InvalidReportingEventError";
  }
}

export function parseReportingEvent(input: unknown): ReportingEvent {
  if (!validate(input)) throw new InvalidReportingEventError();
  return structuredClone(input);
}

export function toPutEventsEntry(input: unknown, eventBusArn: string) {
  if (!/^arn:aws:events:us-east-1:[0-9]{12}:event-bus\/[A-Za-z0-9._-]+$/.test(eventBusArn)) {
    throw new Error("An explicit us-east-1 EventBridge bus ARN is required");
  }
  const event = parseReportingEvent(input);
  return {
    EventBusName: eventBusArn,
    Source: event.source,
    DetailType: event["detail-type"],
    Detail: JSON.stringify(event.detail),
  };
}
