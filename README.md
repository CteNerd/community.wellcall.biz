# Community portfolio foundation

This private repository is moving toward CUT BLOCK Development (provisional
display brand), initially an adults-only tech/mentorship pilot. See the
[domain and release ADR](docs/adr/0001-domain-and-release-boundaries.md).
The approved default-branch migration is `master` to `main`.

The foundation adds pinned reporting contracts, a typed React preview, API and
mentor-assignment policy tests, and offline CDK stacks. The legacy site remains;
no participant collection or AWS deployment is enabled.

```sh
nvm use
npm ci --workspaces --include-workspace-root=false --no-audit --no-fund
npm run check:foundation
npm run test:contracts
npm run build:web
npm run dev:web
```

[Contract documentation](packages/contracts/README.md) describes pin updates and
historical approval-count semantics. Approval counts are not current active
mentors. CI checks modern workspaces, lint, dependency advisories, pins, preview
build and both environment synths, not the legacy frontend or operational
safeguarding. Node 24 is for the new foundation, not a claim of CRA compatibility.
The preview opens no enrollment and collects no data; the roadmap is not an
operating program or legal-status claim. The domain now includes a tested
adult-application review transition that blocks approval without verified adult
eligibility, current consent and (for mentors) completed screening. This is not
an application endpoint or a verified screening process; policy and operational
gates remain unresolved, and youth participation remains gated. See the
[infrastructure/release runbook](infra/README.md).

A manual development web-publishing workflow is prepared for `main` after a
reviewed foundation bootstrap. Configure `AWS_ACCOUNT_ID` and
`AWS_WEB_PUBLISH_ROLE_ARN` as development environment variables; no AWS keys are
needed. It publishes only the modern preview to the stack's generated CloudFront
URL, without deploying infrastructure or opening enrollment. See the runbook
for activation and remaining live checks.

CRA is patched from 4.0.1 to 4.0.3 to accommodate this repo's existing TypeScript
4.1 dependency under npm peer validation. No force/legacy-peer bypass is used.
The single lockfile is updated to npm's current format; frontend migration is
still pending.
Compatible ESLint 7 minimatch/semver overrides and scoped lockfile patches
address peers pulled into modern tooling. Moderate minimatch advisories remain
in current CDK/ESLint tooling; CI reports them and fails at high severity.

Confirmed hosts are `cutblock.org`, `dev.cutblock.org` and `api.cutblock.org`.
Reuse the registered Route 53 zone. The roadmap includes technology, AI,
mentorship, athletic training, fitness and future facilities; only the approved
adult pilot is initially enabled. Brand clearance, certificates, cutover and
protected production approval remain gates; no automatic production scaffolding
deployment is permitted.

## Legacy development commands (historical)

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
