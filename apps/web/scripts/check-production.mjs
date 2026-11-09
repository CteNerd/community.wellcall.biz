import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { readPresentation } from "../src/presentation.ts";

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
} else if (!html.includes('<meta name="robots" content="noindex, nofollow" />') || html.includes('rel="canonical"')) {
  throw new Error("Default preview metadata must remain noindex without a production canonical URL");
}
console.log("Production artifacts contain no synthetic fixtures or role bypass.");
