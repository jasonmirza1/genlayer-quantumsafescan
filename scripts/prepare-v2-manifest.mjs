import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES, parseManifest } from "../frontend/lib/contracts/scan-v2.ts";

export async function prepareManifest(repository, commit, paths, fetcher = fetch) {
  const selected = parseManifest(JSON.stringify({ repository, commit, files: paths.map(path => ({ path, sha256: "0".repeat(64) })) }));
  const files = [];
  let total = 0;
  for (const { path } of selected.files) {
    const url = `https://raw.githubusercontent.com/${repository.slice("https://github.com/".length)}/${commit}/${path}`;
    const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
    if (response.status !== 200 || !response.body) throw new Error(`${path}: public file unavailable (HTTP ${response.status})`);
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_FILE_BYTES) throw new Error(`${path}: exceeds ${MAX_FILE_BYTES} bytes; select a smaller complete file`);
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    if (!size) throw new Error(`${path}: file is empty`);
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error(`Selected files exceed ${MAX_TOTAL_BYTES} bytes`);
    const bytes = Buffer.concat(chunks), text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error(`${path}: binary/control bytes are not reviewable`);
    files.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const manifest = parseManifest(JSON.stringify({ repository, commit, files }));
  return { manifest, manifest_json: JSON.stringify(manifest), nonce: randomBytes(16).toString("hex") };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repository, commit, ...paths] = process.argv.slice(2);
  if (!repository || !commit || !paths.length) {
    process.stderr.write("Usage: node --experimental-strip-types scripts/prepare-v2-manifest.mjs HTTPS_GITHUB_REPOSITORY FULL_COMMIT_SHA FILE_PATH [FILE_PATH ...]\n");
    process.exitCode = 1;
  } else {
    try { process.stdout.write(JSON.stringify(await prepareManifest(repository, commit, paths), null, 2) + "\n"); }
    catch (error) { process.stderr.write(`Manifest not prepared: ${error.message}\n`); process.exitCode = 1; }
  }
}
