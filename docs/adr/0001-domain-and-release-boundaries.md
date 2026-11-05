# ADR 0001: Community domain and release boundaries

Status: Accepted for foundation implementation, 2026-11-05.

- This repository owns Community programs, adult applications, mentor approval,
  relationship assignments, sessions/goals, hours, consent and concerns routing.
- The program roadmap includes technology, AI, mentorship, athletic training,
  fitness and future facility-based activities. Initially enable the approved
  adult tech/mentorship pilot only; youth participation requires reviewed safety
  and guardian-consent workflows. Do not advertise future activities as live.
- Approved mentors see only assigned relationships. A mentor has no implied
  Consulting membership, project access or finance rights.
- Founder reporting lives in `CteNerd/roddy.tomlin.life`, not a new repository.
  It receives only reviewed aggregate events, not participant data or notes.
- Domain writes and sanitized outbox records commit atomically. Stable event
  IDs, durable recovery and idempotent reporting are required.
- Pin authoritative schemas from the personal repository's `packages/contracts`
  to an immutable commit and file hashes. Preserve `rct.dotcom` source IDs.
- One existing AWS account in `us-east-1`, separate development/production resources
  and DynamoDB on-demand tables. All runtime/deploy/local roles are scoped.
- CUT BLOCK Development remains subject to legal clearance; its tagline is
  From the codebase to the field. `cutblock.org` is registered in Route 53 with
  auto-renew. Production web uses that apex, development uses `dev.cutblock.org`,
  and production API uses `api.cutblock.org`. Reuse its hosted zone and ACM in
  `us-east-1`; do not publish a rebrand, promise enrollment or change DNS here.
- The owner approved private visibility and default-branch migration from
  `master` to `main` after checking workflow and hosting dependencies.
- PR CI is credential-free. Future merges deploy `development`; `production`
  promotes a verified immutable release only after protected GitHub environment
  approval. Missing protection blocks production, not a manual-dispatch bypass.
  No foundation AWS deployment.
- Require PR/check protections where entitlement permits; no impossible
  second-person approval while the owner is the sole maintainer.
- Keep legacy WellCall references configurable until approved cutover. Preserve
  existing applications, unrelated Route 53 records and CloudFormation stacks;
  permanent redirects and deletions require explicit review.

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
