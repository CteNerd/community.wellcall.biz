# ADR 0001: Community domain and release boundaries

Status: Accepted for foundation implementation, 2026-11-05.

- This repository owns Community programs, adult applications, mentor approval,
  relationship assignments, sessions/goals, hours, consent and concerns routing.
- The initial pilot is adults-only tech/mentorship. Minors, guardian workflows,
  athletics, a physical facility and payment processing are deferred.
- Approved mentors see only assigned relationships. A mentor has no implied
  Consulting membership, project access or finance rights.
- Founder reporting lives in `CteNerd/roddy.tomlin.life`, not a new repository.
  It receives only reviewed aggregate events, not participant data or notes.
- Domain writes and sanitized outbox records commit atomically. Stable event
  IDs, durable recovery and idempotent reporting are required.
- Pin authoritative schemas from the personal repository's `packages/contracts`
  to an immutable commit and file hashes. Preserve `rct.dotcom` source IDs.
- One existing AWS account in `us-east-1`, separate staging/production resources
  and DynamoDB on-demand tables. All runtime/deploy/local roles are scoped.
- CUT BLOCK Development is provisional. Domain choice is deferred; do not
  publish a rebrand, promise enrollment, buy domains, or change DNS here.
- The owner approved private visibility and default-branch migration from
  `master` to `main` after checking workflow and hosting dependencies.
- PR CI is credential-free. Future merges deploy staging; production explicitly
  promotes a verified immutable release. No foundation AWS deployment.
- Require PR/check protections where entitlement permits; no impossible
  second-person approval while the owner is the sole maintainer.

## Legacy migration inventory

| Existing route | Disposition before replacement |
| --- | --- |
| `/` and `/about` | Preserve source; review mission and old giveaway promises. |
| `/communities` | Replace with approved adult program information later. |
| `/recharge` | Archive or retire only after owner review; no automatic annual giveaway promise. |
| `/recharged` | Review historical winners/content; no invented program outcomes. |
| Footer contact and external social link | Preserve until ownership and messaging approval. |

Keep old URLs for a reviewed redirect map, not blanket redirects. The legacy CRA
app is unchanged. Contract CI does not certify the old app or safeguarding flows.
