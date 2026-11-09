# Community infrastructure foundation

This is reviewable source, not a deployment authorization or enrollment launch.
Run from the repository root with Node 24 and npm 11.6.2:

```sh
npm ci --workspaces --include-workspace-root=false --no-audit --no-fund
npm run lint --workspace @rct/community-infra
npm run check:foundation
npm run cdk:synth:development
npm run cdk:synth:production
```

Synth explicitly uses the synthetic account `123456789012`, no AWS lookups,
and ignored environment-specific `infra/cdk.out/` directories. Never deploy this
assembly. A real deploy must explicitly select the verified account/environment
after IAM/bootstrap/change-set review. Invalid or missing targets fail.
Region is fixed to `us-east-1`.

## Template boundaries

- Independent `rct-dotcom-development` / `rct-dotcom-production` resources; the
  stable technical name does not change with the display brand.
- On-demand core table with an application-review index, a pending-outbox index,
  TTL and a new-image stream; production PITR, deletion protection and retention.
- Private S3, CloudFront OAC/HTTPS/security headers; no uploaded assets or broad
  SPA fallback. Development source rewrites only GET/HEAD `/internal` or
  `/internal/` to `/index.html`, preserving query; unknown/assets keep origin errors;
  production routing is unchanged. Legacy applications are not replaced.
- Invitation-only Cognito with required authenticator MFA and a public client.
  The `CommunityAdministrators` group is empty by default. No initial users
  or group memberships are provisioned. Development **source only** now includes
  a generated hosted-login domain (`rct-dotcom-development-<account>`) and an
  authorization-code public client with `openid` scope, `/internal` callback,
  and root logout URI. Production identity configuration is unchanged and has
  no hosted-login domain. None of these changes has been deployed or activated.
- Node 24 API and outbox-publisher Lambdas with scoped roles and 7/30-day
  dev/prod log retention.
- Public `GET /health`; JWT-protected `GET /me` and `POST /applications`;
  JWT-protected `GET /admin/applications` and
  `PATCH /admin/applications/{applicationId}`. Reviewer endpoints additionally
  require the exact `CommunityAdministrators` claim. No youth or participant
  assignment endpoints are exposed.
- Application intake has explicit CloudFormation gates: disabled by default,
  blank consent-policy version and zero retention. The API stores contact data
  only when all gates are deliberately approved; a client can send the
  displayed consent policy version only as an expected-value precondition and
  cannot choose the stored version, verified-adult result, screening result or
  application state.
- Submission records are TTL-bounded. Review updates require an expected
  version and an unexpired record; adult-eligibility and mentor-screening
  actions record the authenticated reviewer. Mentor approval atomically
  updates the application and writes a PII-free reporting outbox event. A
  durable applicant-scoped first-approval guard ensures separate mentor
  applications for the same applicant emit that initial event only once,
  including concurrent approvals.
  Submissions require a UUID idempotency key and atomically pair the application
  with a 24-hour receipt; retries return the original application only when
  applicant and submitted fields match. The browser CORS allow-list includes
  that request header.
- DynamoDB Streams retry outbox delivery with partial-batch handling and an
  SQS failure destination. A five-minute reconciliation schedule retries
  pending outbox entries in bounded pages of 100, continuing from a durable
  checkpoint for up to three pages per invocation. It advances the checkpoint
  after each page even when individual events fail, so an oldest poison record
  cannot block later entries; failures remain pending and are reported for
  retry. The publisher accepts only the strict aggregate
  `rct.dotcom` mentor-approval event and only sends that source/detail type to
  the discovered portfolio bus.
- No VPC, NAT, RDS, bus or changes to existing application ownership.

Mentor-policy tests require approved active memberships and matching active
mentor/participant/program assignments. These are not CRUD endpoints. Future
APIs must load trusted records server-side, not accept assignment/role claims
from clients. Youth/guardian consent, safeguarding and program permissions must
be reviewed before enabling minors. No application form is present in the
preview and no enrollment opens in this increment.

The development and production templates now include API routes, table
indexes/TTL/stream, and the outbox publisher, but these changes are source-only.
The development foundation already exists without these resources. Do not
deploy it or alter its live table before a reviewed `cdk diff`/change set and
explicit approval of consent, screening, retention, reviewer membership and
replay/rollback procedures. Application intake remains closed until those
approvals are recorded and the relevant gates are deliberately configured.

## DNS, delivery and rollback

Default synthesis creates no DNS records/certificates. `customDomains=true`
imports the existing `cutblock.org` zone, creates a DNS-validated `us-east-1`
web certificate and explicit aliases. Development API remains generated.
Production also configures `api.cutblock.org` and requires
`brandLaunchApproved=true`; the flag is not legal or deployment approval.

Generated CloudFront URLs use the default CloudFront certificate/security
policy; custom certificates use TLS 1.2. The source publisher validator accepts
the generated CloudFront URL or exactly `https://dev.cutblock.org`; for the
custom URL it verifies the distribution alias and ACM/TLS configuration. This
change is source-only until merged, so the current main workflow still uses the
generated URL. The live dev alias was added separately with AWS CLI; current
stack outputs remain generated URLs. Before moving the alias into CDK
management, review the complete change set. Publishing itself never changes
DNS. See the [development handoff](../../consulting.wellcall.biz/docs/development-handoff-2026-11-06.md).

## Manual development web releases

`Publish development web preview` is manual and main-only, using the existing
GitHub `development` environment. It publishes only the modern static preview;
it does not create stacks, deploy APIs, collect applications, modify DNS or
release production.

Before first use, an authorized operator must review and create
`rct-dotcom-development-foundation` with approved bootstrap/CloudFormation
execution permissions in the verified real account. Confirm budget/rollback
gates. The existing GitHub OIDC provider must include `sts.amazonaws.com`;
the stack imports it rather than recreating it. Do not deploy the synthetic CI
assembly or widen the shared bootstrap role. Infrastructure automation remains
outstanding.

Development source defines a web publisher with the same narrowly scoped managed
policy as both identity grant and permissions boundary. It can list/read the
own bucket location and public-access-block/policy status, GetObject/PutObject only `assets/*` and `index.html`,
invalidate/read its own CloudFront distribution and describe only its own stack.
It cannot delete objects, manage infrastructure/identities, touch business data
or publish production. OIDC trust requires this exact repository, `development`
environment and STS audience. Preserve the environment's single main-only branch
policy; the environment OIDC subject itself does not encode the branch.

Configure exactly these **development environment variables**, not secrets:

| Variable | Value |
| --- | --- |
| `AWS_ACCOUNT_ID` | Verified real 12-digit account; not the CI synthetic account. |
| `AWS_WEB_PUBLISH_ROLE_ARN` | The deployed stack's `WebPublishRoleArn` output. |

Region is fixed to `us-east-1`. Bucket/distribution/API URLs come from validated
stack outputs. No AWS keys or client secrets belong in GitHub secrets.

After merge and bootstrap, run the workflow manually on `main`. Modern checks,
the high-severity audit, destination ownership/private-origin validation and API
health/anonymous-identity denial must pass before upload. Bucket validation
requires all four public-access blocks and an explicitly non-public policy;
ownership and an OAC ID alone are not sufficient. Hashed assets upload
before the entry point, without deleting old files. It waits for invalidation
and compares the live HTML and every emitted asset byte-for-byte to the build before reporting a URL.
Application intake/enrollment remains closed; no Community sign-in or
application UI is introduced.
The publisher is implemented independently in each repository to preserve
separate ownership and release boundaries.

Rollback source with a reviewed revert PR, then inspect/redeploy the last
approved stack/artifacts with the correct environment role. Never delete
stacks, tables, identities or DNS as a shortcut. Rehearse data/auth recovery;
retained resources and PITR are safeguards, not proof of a working restore.
For web-only rollback, merge a reviewed revert and run the publisher again.
Old hashed assets are retained; this is not an artifact-history rollback system
or a verified recovery rehearsal.

Infrastructure alone disables `exactOptionalPropertyTypes` to accommodate CDK's
optional-interface declarations; strict TS and app/API/domain exact-optionals
remain enabled. Moderate upstream minimatch advisories are reported; CI fails
at high severity. The preserved CRA graph is not certified by these checks.
