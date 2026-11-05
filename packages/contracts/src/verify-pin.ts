import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

type ContractPin = {
  version: 1;
  authority: {
    repository: string;
    commit: string;
  };
  files: Record<string, string>;
};

function packageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    assert.ok(!entry.isSymbolicLink(), "Contract files must not be symbolic links");
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? packageFiles(path) : [path];
  });
}

export function verifyContractPin(repoRoot: string): void {
  const root = resolve(repoRoot);
  const pin: ContractPin = JSON.parse(readFileSync(resolve(root, "packages/contracts.lock.json"), "utf8"));
  assert.equal(pin.version, 1, "Unsupported contract pin format");
  assert.equal(pin.authority.repository, "CteNerd/roddy.tomlin.life", "Unexpected contract authority");
  assert.match(pin.authority.commit, /^[a-f0-9]{40}$/, "Contracts require an immutable authority commit");
  assert.ok(pin.files && typeof pin.files === "object" && !Array.isArray(pin.files), "Missing contract hashes");
  const expected = Object.keys(pin.files).sort();
  assert.ok(expected.length > 0, "Contract pin cannot be empty");
  for (const path of expected) {
    assert.match(path, /^packages\/contracts\/[A-Za-z0-9._/-]+$/, "Unsafe contract file path");
    assert.ok(!path.split("/").some((part) => part === ".." || part === "." || part === ""), "Unsafe path segment");
    assert.ok(!path.split("/").includes("node_modules"), "Dependencies cannot be pinned as source");
    assert.match(pin.files[path]!, /^[a-f0-9]{64}$/, "Invalid SHA-256 digest");
  }
  const actual = packageFiles(resolve(root, "packages/contracts"))
    .map((path) => relative(root, path).replaceAll("\\", "/")).sort();
  assert.deepEqual(actual, expected, "Pinned contract file inventory changed");
  for (const path of expected) {
    const digest = createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
    assert.equal(digest, pin.files[path], `Pinned contract changed: ${path}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyContractPin(process.cwd());
  console.log("Pinned contract inventory and SHA-256 digests verified.");
}
