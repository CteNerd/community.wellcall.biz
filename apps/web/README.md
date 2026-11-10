# CUT BLOCK public website and default preview

This React/Vite site defaults to a **development preview**, not an
enrollment or application portal. Public production branding is approved.
The approved meaning is **“Come Up Through Building, Learning,
Opportunity & Competition”**; the public copy must not substitute a different
expansion.

The site describes the founder-led mission, a planned adult technology and
mentorship pathway, and performance/athletics/facility ideas as future
concepts only. It must not imply that any program, facility, application,
mentor matching, or participant intake is operating. Youth participation
remains out of scope until safeguarding and guardian workflows are reviewed.

Keep default preview builds `noindex, nofollow`; do not add unverified contact details,
testimonials, outcomes, legal-status claims, external enrollment links, or
collectable forms. The closed-state copy does not activate or replace the
backend's independently gated, source-only application functionality.

From the repository root, validate this site with:

```sh
npm run check --workspace @rct/community-web
npm run build --workspace @rct/community-web
```

Public production presentation is explicit, never inferred from Vite's `PROD`
(preview builds are also optimized production builds):

```sh
VITE_COMMUNITY_PRESENTATION=production VITE_COMMUNITY_BRAND_LAUNCH_APPROVED=true npm run build:web
```

Both settings are required. The approved production page uses a CUT BLOCK
heading, the exact approved meaning, public copy without preview/provisional
labels, and the fixed `https://cutblock.org/` canonical/OG URL. It has no public
noindex tag. This does not claim legal clearance, nonprofit status or operating
programs. Enrollment remains closed, youth/facilities remain future-only,
and `/internal` remains unconfigured/closed. The promotion workflow deliberately
does not inject auth, readiness or intake settings. The same candidate can be
staged on development only after its CloudFront noindex headers are deployed.
Both environments return noindex headers for the exact internal entry points.

Approved production presentation includes the business line, 281-692-7522, in
the footer; this does not open enrollment or applications. The initial HTML
includes Open Graph and Twitter large-image metadata using the generated
1200×630 `public/assets/cut-block-social-7286a063c885.jpg` card featuring CUT BLOCK's
name, Build. Learn. Grow. tagline, brand colors, and an aspirational illustration
of adult mentorship and hands-on learning (not a photo of an operating program).
It is distinct from Third Down Technologies' strategy artwork and is published
with the Vite web candidate as an
immutable, content-addressed asset. When replacing the artwork, update the
filename hash and metadata together. Default previews do
not publish the business line or production social metadata.

## Source-only internal workspace

`/internal` is closed by default, with no public navigation link or application
form. The default public `/` preview stays provisional and noindex; approved
production presentation is independent of internal configuration.
Authenticated status/withdrawal remain usable when new intake is closed.

All of these explicit **build-time public settings** are required to expose
hosted login; do not put secrets in Vite variables:

| Setting | Required value |
| --- | --- |
| `VITE_COMMUNITY_INTERNAL_ENABLED` | exactly `true` |
| `VITE_COMMUNITY_API_BASE` | approved HTTPS API base, no query or fragment |
| `VITE_COMMUNITY_AUTH_ISSUER` | exact Cognito pool issuer HTTPS URL |
| `VITE_COMMUNITY_OAUTH_ORIGIN` | approved hosted-login HTTPS origin |
| `VITE_COMMUNITY_CLIENT_ID` | public, secretless OAuth client ID |
| `VITE_COMMUNITY_REDIRECT_URI` | exact current-origin `/internal` callback |
| `VITE_COMMUNITY_LOGOUT_URI` | exact current-origin `/` logout URL |

Submission additionally requires **every** setting below; none is supplied by
default. These build assertions do not replace independently approved server
configuration or operational sign-off.

- `VITE_COMMUNITY_INTAKE_APPROVED=true`
- `VITE_COMMUNITY_READINESS_APPROVED=true`
- `VITE_COMMUNITY_SERVER_INTAKE_APPROVED=true`
- `VITE_COMMUNITY_CONSENT_POLICY_VERSION=<approved server policy version>`
- `VITE_COMMUNITY_CONSENT_POLICY_URL=<approved HTTPS policy URL>`
- `VITE_COMMUNITY_RETENTION_DAYS=<approved integer 1–3650 matching the server>`

OAuth uses authorization code + random S256 PKCE and a ten-minute,
single-use state/verifier transaction in session storage. Access tokens remain
memory-only; ID/refresh tokens are not retained, no token enters browser storage
or a URL, and expiry/logout/401/403 unmount all private workspace state.
Decoded groups only tailor navigation: API Gateway and exact server-side
`CommunityAdministrators` membership remain the authority. Authentication
errors, ownership 404, denied 403, version/prerequisite 409, closed-server 503,
and uncertain transport errors are explicit. No fixture fallback exists.

The applicant adapter allowlists receipt fields and sends no client identity,
eligibility, reviewer data, stored policy value, or retention override.
Submission sends the policy version displayed with the consent text only as an
`expectedConsentPolicyVersion` precondition. The API rejects a stale version
with 409 and stores its own configured policy version. Submission also uses a
UUID idempotency key retained only for unchanged-form retries during this
session. Save the receipt ID privately: there is no owner-list endpoint.
Withdrawal sends the retrieved `expectedVersion`. Reviewer inbox pages use the
existing opaque cursor (at most 25 records, navigation capped at ten pages);
select detail from the page, record completed adult/screening checks, then
approve/reject. Conflicts clear stale detail and require explicit refresh.
Approval alone does not start enrollment, matching, youth, or athletics.

Both infrastructure environments include a hosted-login domain, exact `/internal`
or `/internal/` GET/HEAD static route rewrite (query preserved, unknown/asset
paths untouched), and code-only client configuration. This has **not** been
deployed by this change. Real end-to-end integration still requires
reviewed stack migration, approved callback/CORS configuration, invitation-only
MFA users and authorized reviewer membership, current consent/retention and
eligibility/screening/escalation operating policies. Do not activate these gates
for this increment. No AWS deployment, DNS change, live user creation, or live
pilot is authorized.

## Explicit offline synthetic UAT

From this repository root:

```sh
npm run dev:uat --workspace @rct/community-web
```

Open **http://127.0.0.1:5185/internal**. The separate public preview remains at
its existing port (for example 5175), closed. The synthetic port also serves the
unchanged public preview at `/`. Stop the rehearsal server with Ctrl+C when done.

Rehearsal requires `import.meta.env.DEV`, the explicit startup flag
`VITE_COMMUNITY_SYNTHETIC_UAT=true`, and an exact loopback hostname. There is no
query-string activation, default fixture fallback, network call, Cognito login,
DynamoDB integration, persistent data, real credential, or outbox publication.
Its lazily imported fixtures/role bypass are eliminated from production builds;
every build checks production artifacts for their absence, even if the UAT flag
was mistakenly set for a production build.

**This is a stateful client-side simulation, not Cognito/DynamoDB integration.**
It uses the actual workspace, typed HTTP adapter, and domain prerequisite and
withdrawal helpers; any aggregate event descriptor is discarded, never emitted.
No real enrollment, consent, eligibility verification, or screening is claimed.
No matching, concerns, youth operations, or new event contracts are included.
Use only `Synthetic ...` names and `...@example.invalid` email addresses
(other values are rejected). There are no preloaded real-person records.
Reload or “Reset synthetic records” clears the in-memory synthetic server.

Rehearsal checklist (desktop and narrow mobile viewport):

1. Select participant; submit `Synthetic Participant` /
   `participant@example.invalid`, acknowledge the **synthetic** policy, save
   the receipt, refresh owner status, and withdraw. Sign out clears the UI.
2. Select mentor; submit `Synthetic Mentor` / `mentor@example.invalid`.
   A different role cannot retrieve this receipt. Select reviewer; refresh
   inbox and select the mentor. Approval before checks returns 409.
3. Refresh/select; record adult eligibility, record screening passed, approve.
   Sign back in as the mentor and retrieve owner-only approved status.
4. Submit a second mentor; record screening failed, verify adult eligibility,
   observe approval denied, refresh/select and reject.
5. Create at least three **pending** records to exercise two-record synthetic pagination
   (withdrawn/decided records leave the inbox, as in the real store).
   Select a record, “Simulate concurrent writer”, then attempt a change:
   409 must clear stale detail; refresh before retrying.
6. “Simulate next 401” / “Simulate next 403”, then make an API call: private
   applicant/reviewer state is cleared. “lookalike” never gets a reviewer tab.

Validation:

```sh
npm run check --workspace @rct/community-web
VITE_COMMUNITY_SYNTHETIC_UAT=true npm run build:web
npm run lint --workspace @rct/community-infra
npm run check:foundation
npm run cdk:synth:development
npm run cdk:synth:production
```
