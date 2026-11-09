import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

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
console.log("Production artifacts contain no synthetic fixtures or role bypass.");
