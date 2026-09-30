import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { prepareManifest } from "../../scripts/prepare-v2-manifest.mjs";

const repository = "https://github.com/example/repo", sha = "a".repeat(40);
test("helper hashes complete exact bytes including CRLF and creates a nonce", async () => {
  const text = "# Evidence\r\nNo certification.\r\n";
  const result = await prepareManifest(repository, sha, ["README.md"], async (url, options) => {
    assert.equal(url, `https://raw.githubusercontent.com/example/repo/${sha}/README.md`);
    assert.equal(options.redirect, "error");
    return new Response(text);
  });
  assert.equal(result.manifest.files[0].sha256, createHash("sha256").update(Buffer.from(text)).digest("hex"));
  assert.match(result.nonce, /^[0-9a-f]{32}$/);
  assert.deepEqual(JSON.parse(result.manifest_json), result.manifest);
});
for (const [name, body, status] of [["missing", "missing", 404], ["empty", "", 200], ["large", "x".repeat(8001), 200], ["binary", "hello\x00world", 200], ["invalid UTF8", new Uint8Array([255, 255]), 200]]) test(`helper rejects ${name} files instead of making a fake manifest`, async () => {
  await assert.rejects(prepareManifest(repository, sha, ["README.md"], async () => new Response(body, { status })));
});
test("helper checks manifest and aggregate byte limits", async () => {
  let calls = 0;
  await assert.rejects(prepareManifest(repository, "main", ["a.md"], async () => { calls++; return new Response("valid"); }));
  assert.equal(calls, 0);
  await assert.rejects(prepareManifest(repository, sha, ["a.md", "b.md", "c.md", "d.md"], async () => new Response("x".repeat(7000))), /Selected files exceed/);
});
