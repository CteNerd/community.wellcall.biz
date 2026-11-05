# Community portfolio foundation

This private repository is moving toward CUT BLOCK Development (provisional
display brand), initially an adults-only tech/mentorship pilot. See the
[domain and release ADR](docs/adr/0001-domain-and-release-boundaries.md).
The approved default-branch migration is `master` to `main`.

The initial foundation adds strict, pinned reporting contracts without changing
the legacy site, collecting participant data, or deploying AWS resources.

```sh
nvm use
npm ci --workspace @rct/portfolio-contracts --include-workspace-root=false --ignore-scripts --no-audit --no-fund
npm run test:contracts
```

[Contract documentation](packages/contracts/README.md) describes pin updates and
historical approval-count semantics. Approval counts are not current active
mentors. CI validates only the new contract workspace and pinned-file integrity,
not the legacy frontend or operational safeguarding. Frontend/API/auth/CDK
foundation and staging releases follow separately. Node 24 is for the new
foundation, not a claim of CRA compatibility.

CRA is patched from 4.0.1 to 4.0.3 to accommodate this repo's existing TypeScript
4.1 dependency under npm peer validation. No force/legacy-peer bypass is used.
The single lockfile is updated to npm's current format; frontend migration is
still pending.

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
