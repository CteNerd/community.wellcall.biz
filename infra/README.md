# Community infrastructure foundation

This is reviewable source, not an executed deployment or enrollment launch.
Public brand publication is approved; the operator owns backend deployment,
bootstrap, change-set execution, environment protection and Founder access.
Intake/enrollment/Founder access remain closed pending real UAT.
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
  SPA fallback. Both environments rewrite only GET/HEAD `/internal` or
  `/internal/` to `/index.html`, preserving query; unknown/assets keep origin errors;
  both exact internal paths always return noindex response headers. Development
  adds noindex headers to all paths so production-candidate staging is safe.
  Public production paths use security headers without noindex. Legacy
  applications are not replaced.
- Invitation-only Cognito with required authenticator MFA and a public client.
  The `CommunityAdministrators` group is empty by default. No initial users
  or group memberships are provisioned. Both environments include
  a generated hosted-login domain (`rct-dotcom-development-<account>`) and an
  authorization-code public client with `openid` scope, `/internal` callback,
  and root logout URI (production uses `rct-dotcom-production-<account>`).
  `OAuthOrigin`, `AuthIssuer`, `AuthRedirectUri`, `AuthLogoutUri` and the existing
  client/pool outputs supply the future frontend configuration. Legacy
  `Development*` outputs are retained only in development. No users or client
  configuration are activated by web promotion.
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

Synthetic-account default synthesis creates no DNS records/certificates. `customDomains=true`
imports the existing `cutblock.org` zone, creates a DNS-validated `us-east-1`
web certificate and explicit aliases. Development API remains generated.
Production also configures `api.cutblock.org` and requires
`brandLaunchApproved=true`; the flag represents public brand/cutover approval,
not legal clearance or readiness to accept people.

**Real-account development updates preserve existing external resources.**
Account `425061472162` defaults to importing the existing ACM certificate
`arn:aws:acm:us-east-1:425061472162:certificate/9db61a17-da37-4d4a-a4a4-297344ef0d1f`
and retaining the `dev.cutblock.org` CloudFront alias even when
`customDomains=false`. The optional `existingDevelopmentCertificateArn`
context makes this import explicit and validates its account/region.
Neither mode creates/adopts Route 53 records or certificates for that existing
development alias. Existing DNS stays externally owned. Real-account preservation
assertions run offline in CI. Review live drift/change sets before UPDATE;
do not deploy the synthetic-account assembly.

Generated CloudFront URLs use the default CloudFront certificate/security
policy; custom certificates use TLS 1.2. The source publisher validator accepts
the generated CloudFront URL or exactly `https://dev.cutblock.org`; for the
custom URL it verifies the distribution alias and ACM/TLS configuration. This
change is source-only. The live dev alias was added separately; the reviewed
UPDATE retains its certificate/alias and changes outputs/callback/CORS to the
existing hostname without taking over its records. Publishing itself never
changes DNS.

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
or publish another environment. Production defines an equivalent independent
role/policy/boundary scoped to only its own stack/bucket/distribution and
`/rct/dotcom/production/` path. OIDC trust requires this exact repository, the respective
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
For preview-only rollback, merge a reviewed revert and run the development
publisher again. For production, follow immutable-candidate recovery below.
Neither path constitutes a verified operational/data recovery rehearsal.

## Protected production promotion

The manual `Promote reviewed production web` workflow is main-only and requires
the exact reviewed main SHA as `reviewed_sha`. One credential-free candidate job
installs modern workspaces on Node 24/npm 11.6.2, runs checks/lint/contracts/audit,
builds once with explicitly approved public production branding, checks fixture
exclusion, and uploads an immutable candidate plus SHA-256 manifest. The manifest
binds every allowed file, byte length, digest, source SHA and run/attempt.

The protected `development` job downloads that artifact by ID and verifies the
manifest against the candidate-job digest before obtaining environment-scoped
OIDC. It stages the production bytes, validates private-bucket/distribution
ownership, checks API health and anonymous `/me` 401, compares live HTML/assets
byte-for-byte, verifies noindex headers and both exact `/internal` routes, and
requires unknown/asset probes to remain origin 403/404. Only after success can
the protected `production` job download/verify/promote **the same bytes**, with
no rebuild or workspace install. Production public responses must not be
noindex. API readiness is required; backend deployment is separate.

Operator prerequisites (not configured by this change):

- Deploy reviewed development preservation/headers/routing and production
  backend/custom-domain/publisher source; no intake parameters may be opened.
- Existing GitHub OIDC provider, isolated release-asset buckets, approved
  current CLI credentials/explicit narrowly scoped execution roles and
  production portfolio bus SSM parameter
  `/rct/production/portfolio/event-bus-arn` must be available.
- Protect **both** GitHub environments with main-only deployment branches;
  production must require an authorized reviewer and prevent self-review.
  OIDC environment subjects do not themselves encode branch restrictions.
- Set each environment's `AWS_WEB_PUBLISH_ROLE_ARN` to its own deployed
  `WebPublishRoleArn`. Promotion fixes account `425061472162`/`us-east-1`;
  the legacy development workflow additionally uses `AWS_ACCOUNT_ID`.
- Keep internal UI/auth/intake/readiness build settings absent; do not create
  users, grant Founder access or enable application collection before real UAT.

No secrets, destructive S3 sync, infrastructure mutations or asset overwrites
are used. New assets use conditional create; existing keys must have identical
bytes. Old hashed assets remain. The entry point is uploaded last. The workflow
retains immutable candidates and per-environment provenance/previous entry
points for 90 days (subject to repository artifact-retention limits), including
failure status, previous index digest, source/artifact/manifest identity, run,
destination and invalidation. Download/archive approved artifacts before expiry.
Failures after index publication require operator inspection; there is no
automatic rollback, and a failed development job blocks production.

For web rollback, an operator downloads the prior approved candidate/manifest,
verifies its recorded digest and SHA, checks the destination with its own
environment role, restores missing matching assets without overwriting/deleting
others, then restores that candidate's index with no-cache and invalidates.
Alternatively restore the retained previous index only after confirming every
referenced hashed asset remains. Record a separate rollback provenance entry
and re-run the live health/401/asset/deep-link checks. The workflow itself accepts
only the reviewed current main SHA; it does not silently rebuild or substitute
historical artifacts. Backend rollback is a separate reviewed change set.

## Operator-only real-account change-set commands

These are handoff commands, **not executed by this source change**. From `infra/`,
with the parent's explicitly approved current CLI credentials. The
`CliCredentialsStackSynthesizer` does not assume deployment, publishing, lookup
or CloudFormation-execution roles and emits no CDK bootstrap SSM dependency.
Do not pass a shared CDKToolkit role or use `cdk deploy` as an execution shortcut.

```sh
npx cdk synth -c environment=development -c account=425061472162 -c customDomains=false -c existingDevelopmentCertificateArn=arn:aws:acm:us-east-1:425061472162:certificate/9db61a17-da37-4d4a-a4a4-297344ef0d1f --output cdk.out/review-development --quiet
npx cdk synth -c environment=production -c account=425061472162 -c customDomains=true -c brandLaunchApproved=true --output cdk.out/review-production --quiet

# AWS writes: parent only, after reviewing the isolated asset destinations.
npx cdk publish-assets --app cdk.out/review-development rct-dotcom-development-foundation
npx cdk publish-assets --app cdk.out/review-production rct-dotcom-production-foundation
```

Asset destinations are fixed by environment/account/region:

| Environment | Bucket | Object prefix |
| --- | --- | --- |
| development | `rct-dotcom-development-release-assets-425061472162-us-east-1` | `release/` |
| production | `rct-dotcom-production-release-assets-425061472162-us-east-1` | `release/` |

Development's existing release-asset bucket is reused, not created or adopted
by the application stack. **Do not recreate its bootstrap.** The application
web bucket remains a separate resource; the GitHub web publisher never receives
release-asset-bucket permissions. Assembly tests inspect actual emitted
manifest/asset/template files for the exact bucket/prefix and absence of shared
buckets, role-assumption/execution bindings and CDK bootstrap SSM references.
Each `.assets.json` identifies two zipped Lambda code assets and the template
file. There are no image assets or context lookups.

### Production-only asset bootstrap

`bootstrap/production-release-assets.template.json` contains exactly a private,
SSE-S3/AES256-encrypted, versioned bucket with retained deletion/replacement
policy, bucket-owner-enforced ownership, all four public-access blocks and a
TLS-only deny bucket policy. It creates no IAM roles, SSM parameters, ECR,
development resources or broad executor. Outputs:

- `ReleaseAssetBucketName` / `ReleaseAssetBucketArn`
- `ReleaseAssetObjectPrefix=release/`
- `ReleaseAssetObjectsArn=<bucket ARN>/release/*`

Only if that production bucket is absent, the parent can prepare a new
asset-only stack using explicitly approved current owner credentials:

```sh
aws cloudformation create-change-set \
  --region us-east-1 \
  --stack-name rct-dotcom-production-release-assets \
  --change-set-name community-production-release-assets \
  --change-set-type CREATE \
  --template-body file://bootstrap/production-release-assets.template.json
```

This new asset-only CREATE deliberately supplies no service role and inherits
no existing stack role. It requires no IAM capability. Inspect it, then execute
separately only with explicit owner approval. If the bucket already exists,
verify ownership/configuration instead; do not attempt to adopt/recreate it.
Do not run `cdk bootstrap`.

The approved CLI uploader needs only release-bucket discovery/listing and
GetObject/PutObject under `release/`; no asset deletion, IAM changes, STS
assumption or shared-bucket access is needed for publishing. Parent-approved
CloudFormation execution credentials need read access to reviewed Lambda ZIPs
in that environment's `release/` prefix, plus the separately reviewed stack
service permissions and portfolio-event-bus SSM access.

### Direct application change sets: no shared executor

After asset publishing, derive HTTPS template URLs from each assembly rather
than hardcoding a stale template hash:

```sh
DEVELOPMENT_TEMPLATE_URL=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; const m=JSON.parse(readFileSync("cdk.out/review-development/manifest.json")); const u=m.artifacts["rct-dotcom-development-foundation"].properties.stackTemplateAssetObjectUrl; console.log(u.replace(/^s3:\/\/([^/]+)\//, "https://$1.s3.us-east-1.amazonaws.com/"));')
PRODUCTION_TEMPLATE_URL=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; const m=JSON.parse(readFileSync("cdk.out/review-production/manifest.json")); const u=m.artifacts["rct-dotcom-production-foundation"].properties.stackTemplateAssetObjectUrl; console.log(u.replace(/^s3:\/\/([^/]+)\//, "https://$1.s3.us-east-1.amazonaws.com/"));')

# Parent verified the current development RoleARN is null. Recheck before use:
# this example uses approved current owner credentials, not a service role.
DEVELOPMENT_STORED_ROLE_ARN=$(aws cloudformation describe-stacks --region us-east-1 --stack-name rct-dotcom-development-foundation --query 'Stacks[0].RoleARN' --output text)
case "$DEVELOPMENT_STORED_ROLE_ARN" in
  None|null|"") ;;
  *) echo "Stored service role found; stop and inspect before choosing an executor." >&2; exit 1 ;;
esac
aws cloudformation create-change-set \
  --region us-east-1 \
  --stack-name rct-dotcom-development-foundation \
  --change-set-name community-development-launch \
  --change-set-type UPDATE \
  --template-url "$DEVELOPMENT_TEMPLATE_URL" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=ApplicationIntakeEnabled,ParameterValue=false ParameterKey=ApplicationConsentPolicyVersion,ParameterValue= ParameterKey=ApplicationRetentionDays,ParameterValue=0

# Initial production CREATE: explicitly owner-approved current credentials,
# no service role / assumed-role fallback / shared administrator executor.
aws cloudformation create-change-set \
  --region us-east-1 \
  --stack-name rct-dotcom-production-foundation \
  --change-set-name community-production-launch \
  --change-set-type CREATE \
  --template-url "$PRODUCTION_TEMPLATE_URL" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=ApplicationIntakeEnabled,ParameterValue=false ParameterKey=ApplicationConsentPolicyVersion,ParameterValue= ParameterKey=ApplicationRetentionDays,ParameterValue=0
```

The parent verified the current development foundation has `RoleARN=null`;
there is no existing shared service-role binding to replace. Its explicitly
owner-approved initial application IAM provisioning/migration can therefore
use the guarded UPDATE example without `--role-arn`. Do not invent a missing
ARN or create an executor solely for this null-role case.

If inspection instead finds a stored shared/broad service role, do not inherit
it or run the null-role example. Only after separate review, add
`--role-arn "$APPROVED_DEVELOPMENT_CFN_EXEC_ROLE_ARN"` to the development UPDATE,
with that variable set to an actual approved narrow replacement. A stored
narrow role also requires explicit inspection/approval before reuse; there is
no automatic role fallback.

If production already exists, stop and inspect its stored `RoleARN` and state
and prepare UPDATE rather than reusing initial CREATE. Apply the same
null-versus-stored-role decision: owner-approved current credentials for a null
role; never silently inherit a shared/broad role. Removing synthesizer bindings
does not clear a service role when one actually exists. Never create a broad
replacement executor or widen shared bootstrap roles. For explicitly
owner-approved initial IAM bootstrap, use direct inspected change sets; do not
substitute a shared CDK deployment path.

Creating change sets and publishing assets are AWS writes exclusively owned by
the parent/operator. Inspect complete change sets, certificate/DNS ownership,
retained resources, IAM boundary, SSM bus resolution and closed intake before
separately authorizing execution. No bootstrap, environment edits, DNS writes,
merge or deployment occurs in this PR.

Infrastructure alone disables `exactOptionalPropertyTypes` to accommodate CDK's
optional-interface declarations; strict TS and app/API/domain exact-optionals
remain enabled. Moderate upstream minimatch advisories are reported; CI fails
at high severity. The preserved CRA graph is not certified by these checks.
