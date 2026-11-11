import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";
import { createCandidate, digest } from "./web-candidate.ts";

test("live probes accept exact staged/promoted bytes and reject indexing, tampering and blanket fallbacks", async (t) => {
  const root = resolve(`.web-probe-test-${randomUUID()}`);
  const candidate = resolve(root, "candidate");
  mkdirSync(resolve(candidate, "assets"), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sha = "a".repeat(40);
  const html = '<title>CUT BLOCK</title><link rel="canonical" href="https://cutblock.org/">';
  const asset = "closed-public-brand";
  writeFileSync(resolve(candidate, "index.html"), html);
  writeFileSync(resolve(candidate, "assets/index-hash.js"), asset);
  const manifest = `${JSON.stringify(createCandidate(candidate, sha, "123-1"), null, 2)}\n`;
  const manifestPath = resolve(root, "manifest.json");
  writeFileSync(manifestPath, manifest);
  let environment = "development";
  let fault = "";
  const server = createServer((request, response) => {
    const path = request.url;
    if (path === "/health") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ok", application: "community" }));
    } else if (path === "/me") {
      response.writeHead(401).end();
    } else if (path === "/" || path === "/internal" || path === "/internal/"
      || path === "/pathways" || path === "/pathways/" || path === "/experience" || path === "/experience/"
      || path === "/assets/index-hash.js") {
      if ((environment === "development" && fault !== "missing-noindex") || path.startsWith("/internal") || fault === "production-noindex") {
        response.setHeader("x-robots-tag", "noindex, nofollow");
      }
      response.setHeader("content-type", path.endsWith(".js") ? "text/javascript" : "text/html");
      response.end(path.endsWith(".js") ? (fault === "tampered" ? "altered" : asset) : html);
    } else {
      response.writeHead(fault === "fallback" ? 200 : 404).end(fault === "fallback" ? html : "not found");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  async function run(target: string, mode = "") {
    environment = target;
    fault = mode;
    return await new Promise<{ code: number | null; error: string }>((done, reject) => {
      const child = spawn(process.execPath, [resolve(import.meta.dirname, "verify-web.ts"), candidate, manifestPath, digest(manifest), sha], {
        env: {
          ...process.env, RELEASE_ENVIRONMENT: target,
          GITHUB_REPOSITORY: "CteNerd/community.wellcall.biz", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch",
          AWS_ACCOUNT_ID: "425061472162",
          AWS_WEB_PUBLISH_ROLE_ARN: `arn:aws:iam::425061472162:role/rct/dotcom/${target}/rct-dotcom-${target}-web-publish`,
          PREVIEW_WEB_URL: origin, PREVIEW_API_URL: origin,
        },
        stdio: ["ignore", "ignore", "pipe"],
      });
      let error = "";
      child.stderr.on("data", (chunk: Buffer) => { error += chunk.toString(); });
      child.on("error", reject);
      child.on("close", (code) => done({ code, error }));
    });
  }
  for (const target of ["development", "production"]) {
    const result = await run(target);
    assert.equal(result.code, 0, result.error);
  }
  for (const [target, mode, message] of [
    ["development", "missing-noindex", /Development staging must suppress/],
    ["production", "production-noindex", /Public production must not suppress/],
    ["development", "tampered", /Published bytes do not match/],
    ["production", "fallback", /Unknown paths\/assets must retain/],
  ] as const) {
    const result = await run(target, mode);
    assert.notEqual(result.code, 0);
    assert.match(result.error, message);
  }
});
