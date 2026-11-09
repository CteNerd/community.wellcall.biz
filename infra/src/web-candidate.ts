import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Candidate = {
  schema: 1;
  sourceSha: string;
  buildRunId: string;
  presentation: "production";
  files: Array<{ path: string; sha256: string; bytes: number }>;
};

export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const validPath = (path: string) => path === "index.html" || /^assets\/[A-Za-z0-9_-]+\.[A-Za-z0-9.]+$/.test(path);

function files(directory: string, prefix = ""): string[] {
  return readdirSync(resolve(directory, prefix)).flatMap((entry) => {
    const path = `${prefix}${entry}`;
    const stat = lstatSync(resolve(directory, path));
    if (stat.isSymbolicLink()) throw new Error("Candidate symlinks are forbidden");
    if (stat.isDirectory() && path === "assets") return files(directory, `${path}/`);
    if (!stat.isFile() || !validPath(path)) throw new Error(`Unexpected candidate file: ${path}`);
    return [path];
  }).sort();
}

export function createCandidate(directory: string, sourceSha: string, buildRunId: string): Candidate {
  if (!/^[a-f0-9]{40}$/.test(sourceSha) || !/^\d+-\d+$/.test(buildRunId)) throw new Error("Invalid candidate provenance");
  const paths = files(directory);
  if (!paths.includes("index.html") || !paths.some((path) => path.startsWith("assets/"))) throw new Error("Incomplete candidate");
  const html = readFileSync(resolve(directory, "index.html"), "utf8");
  if (/noindex|provisional|preview/i.test(html) || !html.includes('href="https://cutblock.org/"')) {
    throw new Error("Candidate must have explicitly approved public production metadata");
  }
  return {
    schema: 1, sourceSha, buildRunId, presentation: "production",
    files: paths.map((path) => {
      const bytes = readFileSync(resolve(directory, path));
      return { path, sha256: digest(bytes), bytes: bytes.length };
    }),
  };
}

export function verifyCandidate(directory: string, manifestPath: string, expectedDigest: string, expectedSha: string): Candidate {
  const serialized = readFileSync(manifestPath);
  if (!/^[a-f0-9]{64}$/.test(expectedDigest) || digest(serialized) !== expectedDigest) throw new Error("Manifest digest mismatch");
  const value = JSON.parse(serialized.toString()) as Candidate;
  if (value.schema !== 1 || value.presentation !== "production" || value.sourceSha !== expectedSha) throw new Error("Candidate provenance mismatch");
  const actual = createCandidate(directory, expectedSha, value.buildRunId);
  if (JSON.stringify(value) !== JSON.stringify(actual)) throw new Error("Candidate file digest or inventory mismatch");
  return actual;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [operation, directory, manifestPath, expectedDigest, sourceSha] = process.argv.slice(2);
  if (!directory || !manifestPath) throw new Error("Candidate directory and manifest path required");
  if (operation === "create") {
    const value = createCandidate(directory, process.env.GITHUB_SHA ?? "", `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`);
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(manifestPath, serialized, { flag: "wx" });
    console.info(digest(serialized));
  } else if (operation === "verify" && expectedDigest && sourceSha) {
    verifyCandidate(directory, manifestPath, expectedDigest, sourceSha);
    console.info(`Verified immutable production candidate ${sourceSha}`);
  } else throw new Error("Expected create or verify operation");
}
