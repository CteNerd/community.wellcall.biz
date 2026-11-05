# Community infrastructure foundation

This is reviewed source, not a deployment authorization or enrollment launch.
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
policy; custom certificates use TLS 1.2. Enable the approved development custom
domain before a shared preview release. Verify delegation, certificate issuance
and change sets; never replace unrelated Route 53 records.

Deployment workflows are not enabled. First review environment-scoped OIDC
trust, restricted CloudFormation execution/pass-role, development smoke tests,
budget receipt and mandatory protected production approval. Expected future
environment inputs: `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`,
and validated output-based smoke URLs. No AWS keys in GitHub secrets.

Rollback source with a reviewed revert PR, then inspect/redeploy the last
approved stack/artifacts with the correct environment role. Never delete
stacks, tables, identities or DNS as a shortcut. Rehearse data/auth recovery;
retained resources and PITR are safeguards, not proof of a working restore.

Infrastructure alone disables `exactOptionalPropertyTypes` to accommodate CDK's
optional-interface declarations; strict TS and app/API/domain exact-optionals
remain enabled. Moderate upstream minimatch advisories are reported; CI fails
at high severity. The preserved CRA graph is not certified by these checks.
