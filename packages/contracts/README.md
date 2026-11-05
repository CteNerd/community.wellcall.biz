# Portfolio reporting contracts v1

Authoritative source: `CteNerd/roddy.tomlin.life`, `packages/contracts`.
Private, server-side workspace; not imported by the public profile.

## Initial metrics

| Source | Detail type | Effect in `data.reportingMonth` |
| --- | --- | --- |
| `rct.consulting` | `consulting.lead.created.v1` | +1 inbound lead |
| `rct.consulting` | `consulting.lead.count.adjusted.v1` | Signed `countDelta` |
| `rct.dotcom` | `dotcom.mentor.approved.v1` | +1 first mentor approval |
| `rct.dotcom` | `dotcom.mentor.approval.count.adjusted.v1` | Signed `countDelta` |

These are historical monthly counts, not qualified leads or currently active
mentors. One domain command emits the initial approval only once per mentor;
revocation does not erase the fact that approval occurred. Corrections rectify
invalid/duplicate historical facts; backfills use stable event IDs. Current-state
gauges, money, projects, time and session metrics require later reviewed schemas.

Months use the business fact's effective UTC reporting period, not delivery time.
A correction targets the original reporting month even if delivered later.
Correction reasons are codes, never free text or identity fields. Signed deltas
may temporarily produce negative totals if corrections arrive before the facts;
do not clamp them or infer active-state counts.

## Validation and publishing

`parseReportingEvent(unknown)` validates the draft-07 JSON Schema with strict
Ajv and format checks. It throws a payload-free error on rejection and returns a
detached copy. The schema allows only explicitly listed AWS delivery metadata;
transport IDs are not business IDs. No coercion, defaulting, field removal or
unknown-field acceptance is enabled.

`toPutEventsEntry(event, busArn)` validates before serialization and separates
AWS `Source`/`DetailType` from JSON `Detail`. It does not publish or select an
environment. IAM must restrict the caller to its exact environment bus and
approved source/detail types; an ARN format check is not authorization.

Event IDs and payloads are immutable across retries. `correlationId` must be a
random trace ID, not an email, user ID or client identifier. Counts and enums
prevent arbitrary content in `data`; schema validation cannot establish that
every syntactically valid UUID was generated without encoding identity.

## Compatibility, pinning and updates

Unknown fields fail v1 validation. An additive change is not automatically
compatible: update readers first through coordinated reviewed PRs or use v2.
Source/type/domain/version combinations are validated together.

After committing authority changes, from the personal repo:

```sh
node scripts/sync-portfolio-contracts.mjs <full-40-character-commit> ../consulting.wellcall.biz
node scripts/sync-portfolio-contracts.mjs <full-40-character-commit> ../community.wellcall.biz
```

Producer `packages/contracts.lock.json` records that immutable revision and a
SHA-256 inventory. Credential-free CI rejects changed, extra or missing pinned
files. A pin update is an explicit reviewed dependency change, not automatic
tracking of the authority branch. Hash verification establishes local integrity,
not independent proof of GitHub commit ownership; review the sync-generated pin.
No cross-private-repository token is needed in PR CI.

## Reliability is a subsequent implementation

This package does not create an outbox, send events or provision AWS. Source
state and outbox must commit atomically; publishers must inspect partial
`PutEvents` failures and recover pending items beyond stream retention.

The reporting workspace is a deterministic reference reducer, not a durable
consumer. A future worker must atomically condition on an event ID and apply its
projection transaction, detect conflicting ID reuse, configure delivery and
processing DLQs, and retain dedupe records longer than the replay horizon.
Rebuild into a new projection version for replays beyond that horizon.
Reconciliation snapshots must specify revision/cutoff and replacement semantics
before adding them; they cannot simply be summed with existing deltas.
