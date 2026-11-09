import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyCandidate } from "./web-candidate.ts";
import { releaseTarget, validateReleaseEnvironment, verifyPreviewHealth } from "./web-release.ts";

const [directory, manifestPath, expectedDigest, sourceSha] = process.argv.slice(2);
if (!directory || !manifestPath || !expectedDigest || !sourceSha) throw new Error("Verified candidate arguments required");
const manifest = verifyCandidate(directory, manifestPath, expectedDigest, sourceSha);
validateReleaseEnvironment(process.env);
const target = releaseTarget(process.env);
const { PREVIEW_WEB_URL: web, PREVIEW_API_URL: api } = process.env;
if (!web || !api) throw new Error("Validated destination required");

async function request(url: string) {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error", cache: "no-store" }); }
    catch (error) { last = error; }
  }
  throw last;
}
const health = await request(`${api}/health`);
if (!health.ok) throw new Error("API health failed");
verifyPreviewHealth(await health.json());
if ((await request(`${api}/me`)).status !== 401) throw new Error("Anonymous identity must be denied");
for (const file of manifest.files) {
  const response = await request(`${web}/${file.path === "index.html" ? "" : file.path}`);
  if (response.status !== 200 || !Buffer.from(await response.arrayBuffer()).equals(readFileSync(resolve(directory, file.path)))) {
    throw new Error(`Published bytes do not match: ${file.path}`);
  }
  const expectedType = file.path.endsWith(".js") ? /^(text|application)\/javascript(?:;|$)/
    : file.path.endsWith(".css") ? /^text\/css(?:;|$)/ : /^text\/html(?:;|$)/;
  if (!expectedType.test(response.headers.get("content-type") ?? "")) throw new Error(`Incorrect content type: ${file.path}`);
  if (target.environment === "development" && !response.headers.get("x-robots-tag")?.includes("noindex")) {
    throw new Error("Development staging must suppress indexing through response headers");
  }
  if (target.environment === "production" && response.headers.get("x-robots-tag")?.includes("noindex")) {
    throw new Error("Public production must not suppress indexing");
  }
}
for (const path of ["/internal", "/internal/"]) {
  const response = await request(`${web}${path}`);
  if (response.status !== 200 || !response.headers.get("x-robots-tag")?.includes("noindex")
    || !Buffer.from(await response.arrayBuffer()).equals(readFileSync(resolve(directory, "index.html")))) {
    throw new Error("Exact private internal deep link is not ready");
  }
}
for (const path of ["/assets/missing-release-probe.js", "/unknown-release-probe"]) {
  const response = await request(`${web}${path}`);
  if (![403, 404].includes(response.status)) throw new Error("Unknown paths/assets must retain origin errors");
}
console.info(`${target.environment}: health, anonymous 401, exact bytes, private deep links and missing assets verified`);
