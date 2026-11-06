import { appendFileSync, readFileSync } from "node:fs";
import { parsePreviewStack, validateReleaseEnvironment, verifyPreviewDistribution, verifyPreviewHealth } from "./web-release.ts";

const [operation, file] = process.argv.slice(2);
validateReleaseEnvironment(process.env);
if (operation === "environment") {
  console.info("Development publishing environment validated");
} else {
  if (!file) throw new Error("A metadata JSON file is required");
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (operation === "stack") {
    const release = parsePreviewStack(value, process.env);
    if (!process.env.GITHUB_ENV) throw new Error("GITHUB_ENV is required");
    appendFileSync(process.env.GITHUB_ENV, [
      `PREVIEW_BUCKET=${release.bucket}`,
      `PREVIEW_DISTRIBUTION_ID=${release.distributionId}`,
      `PREVIEW_WEB_URL=${release.webUrl}`,
      `PREVIEW_API_URL=${release.apiUrl}`,
      "",
    ].join("\n"));
    console.info("Deployed development stack outputs validated");
  } else if (operation === "distribution") {
    const { PREVIEW_BUCKET, PREVIEW_DISTRIBUTION_ID, PREVIEW_WEB_URL } = process.env;
    if (!PREVIEW_BUCKET || !PREVIEW_DISTRIBUTION_ID || !PREVIEW_WEB_URL) {
      throw new Error("Validated preview destination is required");
    }
    verifyPreviewDistribution(value, {
      bucket: PREVIEW_BUCKET, distributionId: PREVIEW_DISTRIBUTION_ID, webUrl: PREVIEW_WEB_URL,
    });
    console.info("Private development distribution validated");
  } else if (operation === "health") {
    verifyPreviewHealth(value);
    console.info("Development API health verified");
  } else {
    throw new Error("Expected environment, stack, distribution or health operation");
  }
}
