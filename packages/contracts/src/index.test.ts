import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { InvalidReportingEventError, parseReportingEvent, toPutEventsEntry } from "./index.ts";

const fixtures: unknown[] = JSON.parse(
  readFileSync(new URL("../fixtures/events.json", import.meta.url), "utf8"),
);
const lead = parseReportingEvent(fixtures[0]);
const adjustment = parseReportingEvent(fixtures[2]);

test("validates every initial event and constructs the AWS publishing envelope", () => {
  for (const fixture of fixtures) {
    const event = parseReportingEvent(fixture);
    const entry = toPutEventsEntry(event, "arn:aws:events:us-east-1:123456789012:event-bus/rct-portfolio-staging");
    assert.equal(entry.Source, event.source);
    assert.equal(entry.DetailType, event["detail-type"]);
    assert.deepEqual(JSON.parse(entry.Detail), event.detail);
    assert.equal("eventId" in entry, false);
  }
  assert.throws(() => toPutEventsEntry(lead, "rct-portfolio-production"), /explicit/);
});

test("accepts AWS delivery metadata but preserves the immutable domain ID", () => {
  const event = parseReportingEvent({
    ...lead,
    version: "0",
    id: "00000000-0000-4000-8000-000000000099",
    account: "123456789012",
    time: "2026-11-05T16:05:00Z",
    region: "us-east-1",
    resources: [],
  });
  assert.deepEqual(event.detail, lead.detail);
  assert.equal(event.source, lead.source);
});

test("rejects leap seconds at validation and publishing boundaries while accepting normal offsets", () => {
  const bus = "arn:aws:events:us-east-1:123456789012:event-bus/rct-portfolio-staging";
  for (const timestamp of ["2016-12-31T23:59:60Z", "2017-01-01T00:59:60+01:00"]) {
    for (const input of [
      { ...lead, detail: { ...lead.detail, occurredAt: timestamp } },
      { ...lead, time: timestamp },
    ]) {
      assert.throws(() => parseReportingEvent(input), InvalidReportingEventError);
      assert.throws(() => toPutEventsEntry(input, bus), InvalidReportingEventError);
    }
  }
  for (const occurredAt of [
    "2016-12-31T23:59:59Z",
    "2017-01-01T00:00:00.123Z",
    "2017-01-01T01:00:00+01:00",
  ]) {
    const event = parseReportingEvent({ ...lead, detail: { ...lead.detail, occurredAt } });
    assert.equal(event.detail.occurredAt, occurredAt);
  }
});

test("rejects spoofed sources, unknown versions and identity-bearing payloads", () => {
  const invalid = [
    null,
    [],
    { ...lead, source: "rct.dotcom" },
    { ...lead, "detail-type": "consulting.lead.created.v2" },
    { ...lead, privateNotes: "not allowed" },
    { ...lead, detail: { ...lead.detail, domain: "dotcom" } },
    { ...lead, detail: { ...lead.detail, schemaVersion: 2 } },
    { ...lead, detail: { ...lead.detail, eventId: "not-a-uuid" } },
    { ...lead, detail: { ...lead.detail, occurredAt: "2026-02-30T00:00:00Z" } },
    { ...lead, detail: { ...lead.detail, email: "synthetic@example.invalid" } },
    { ...lead, detail: { ...lead.detail, data: { reportingMonth: "2026-13", leadCount: 1 } } },
    { ...lead, detail: { ...lead.detail, data: { reportingMonth: "2026-11", leadCount: 2 } } },
    { ...lead, detail: { ...lead.detail, data: { reportingMonth: "2026-11", leadCount: 1, participantId: "synthetic" } } },
    { ...lead, detail: { ...lead.detail, data: { reportingMonth: "2026-11" } } },
  ];
  for (const input of invalid) {
    assert.throws(() => parseReportingEvent(input), InvalidReportingEventError);
  }
});

test("corrections require bounded signed integers and enumerated non-identifying reasons", () => {
  for (const countDelta of [0, 0.5, 1000001, -1000001, "1"]) {
    assert.throws(() => parseReportingEvent({
      ...adjustment,
      detail: { ...adjustment.detail, data: { reportingMonth: "2026-11", countDelta, reasonCode: "duplicate" } },
    }), InvalidReportingEventError);
  }
  assert.throws(() => parseReportingEvent({
    ...adjustment,
    detail: { ...adjustment.detail, data: { reportingMonth: "2026-11", countDelta: -1, reasonCode: "free-text" } },
  }), InvalidReportingEventError);
});
