import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { readPresentation } from "../src/presentation.ts";
import assert from "node:assert/strict";

const directory = resolve("dist");
const forbidden = [
  "COMMUNITY_LOOPBACK_SYNTHETIC_ROLE_BYPASS_ONLY", "synthetic-reviewer",
  "offline-placeholder-not-a-token", "Rehearse as", "SYNTHETIC-NOT-CONSENT-v1",
  "Simulate concurrent writer", "participant@example.invalid",
];
async function check(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await check(file);
    else {
      const source = await readFile(file, "utf8");
      if (forbidden.some((text) => source.includes(text))) throw new Error(`Synthetic rehearsal leaked into production: ${entry.name}`);
    }
  }
}
await check(directory);
const presentation = readPresentation({ ...loadEnv("production", process.cwd(), "VITE_"), ...process.env });
const html = await readFile(resolve(directory, "index.html"), "utf8");
if (presentation.production) {
  if (/noindex|preview|provisional/i.test(html) || !html.includes(`href="${presentation.origin}/"`)) {
    throw new Error("Approved production metadata must be public and use the exact production canonical origin");
  }
  for (const tag of [
    `<meta property="og:image" content="${presentation.origin}/assets/cut-block-social-7286a063c885.jpg" />`,
    `<meta name="twitter:image" content="${presentation.origin}/assets/cut-block-social-7286a063c885.jpg" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
  ]) assert.ok(html.includes(tag), `Production social metadata missing: ${tag}`);
  const image = await readFile(resolve(directory, "assets/cut-block-social-7286a063c885.jpg"));
  assert.equal(image.readUInt16BE(0), 0xffd8, "Social preview must be a published JPEG");
} else if (!html.includes('<meta name="robots" content="noindex, nofollow" />') || html.includes('rel="canonical"')) {
  throw new Error("Default preview metadata must remain noindex without a production canonical URL");
} else {
  assert.ok(!html.includes("og:image") && !html.includes("twitter:image"), "Preview must not publish production social metadata");
}
console.log("Production artifacts contain no synthetic fixtures or role bypass.");
