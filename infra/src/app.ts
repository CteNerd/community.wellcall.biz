import { App } from "aws-cdk-lib";
import { configuration } from "./config.ts";
import { ApplicationStack } from "./stack.ts";

const app = new App();
const config = configuration(app.node.tryGetContext("environment"), app.node.tryGetContext("account"));
const flag = (name: string) => {
  const value: unknown = app.node.tryGetContext(name);
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`${name} must be true or false`);
};
new ApplicationStack(app, config, flag("customDomains"), flag("brandLaunchApproved"));
