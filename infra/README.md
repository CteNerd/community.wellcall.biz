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
- On-demand core table; production PITR, deletion protection and retention.
- Private S3, CloudFront OAC/HTTPS/security headers; no uploaded assets or broad
  SPA fallback. Legacy applications are not replaced.
- Invitation-only Cognito with required authenticator MFA and a public client.
  No signup/login UI, hosted login domain or initial users are provisioned.
- Node 24 API Lambda, scoped logs-only role and 7/30-day dev/prod log retention.
- Public `GET /health`, JWT-protected `GET /me`, exact web-origin CORS.
  No participant, program, consent or business database access yet.
- No VPC, NAT, RDS, bus or changes to existing application ownership.

Mentor-policy tests require approved active memberships and matching active
mentor/participant/program assignments. These are not CRUD endpoints. Future
APIs must load trusted records server-side, not accept assignment/role claims
from clients. Youth/guardian consent, safeguarding and program permissions must
be reviewed before enabling minors. No enrollment opens in this increment.

## DNS, delivery and rollback

Default synthesis creates no DNS records/certificates. `customDomains=true`
imports the existing `cutblock.org` zone, creates a DNS-validated `us-east-1`
web certificate and explicit aliases. Development API remains generated.
Production also configures `api.cutblock.org` and requires
`brandLaunchApproved=true`; the flag is not legal or deployment approval.

Generated CloudFront URLs use the default CloudFront certificate/security
policy; custom certificates use TLS 1.2. The development publisher supports only
generated CloudFront/API URLs with no DNS changes. Custom-domain publishing
needs a separately reviewed validator extension. Verify delegation, certificate
issuance and change sets; never replace unrelated Route 53 records.

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
own bucket location, GetObject/PutObject only `assets/*` and `index.html`,
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
health/anonymous-identity denial must pass before upload. Hashed assets upload
before the entry point, without deleting old files. It waits for invalidation
and compares the live HTML and every emitted asset byte-for-byte to the build before reporting a URL.
Enrollment remains closed; no Community sign-in/application UI is introduced.
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
