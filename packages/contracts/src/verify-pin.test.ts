import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verifyContractPin } from "./verify-pin.ts";

test("pin validation rejects edited, extra, missing and unsafe source files", () => {
  const root = mkdtempSync(join(tmpdir(), "portfolio-contract-pin-"));
  try {
    mkdirSync(join(root, "packages/contracts"), { recursive: true });
    const path = "packages/contracts/schema.json";
    const content = '{"type":"object"}\n';
    const digest = createHash("sha256").update(content).digest("hex");
    const pin = {
      version: 1,
      authority: { repository: "CteNerd/roddy.tomlin.life", commit: "a".repeat(40) },
      files: { [path]: digest },
    };
    const savePin = (value: unknown) => writeFileSync(join(root, "packages/contracts.lock.json"), JSON.stringify(value));
    savePin(pin);
    writeFileSync(join(root, path), content);
    verifyContractPin(root);
    writeFileSync(join(root, path), "{}");
    assert.throws(() => verifyContractPin(root), /Pinned contract changed/);
    writeFileSync(join(root, path), content);
    writeFileSync(join(root, "packages/contracts/extra.json"), "{}");
    assert.throws(() => verifyContractPin(root), /inventory changed/);
    rmSync(join(root, "packages/contracts/extra.json"));
    savePin({ ...pin, files: { "packages/contracts/../../outside": digest } });
    assert.throws(() => verifyContractPin(root), /Unsafe path/);
    savePin(pin);
    rmSync(join(root, path));
    assert.throws(() => verifyContractPin(root), /inventory changed/);
  } finally {
    rmSync(root, { recursive: true });
  }
});
