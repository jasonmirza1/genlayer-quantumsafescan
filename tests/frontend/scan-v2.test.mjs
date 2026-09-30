import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPending, outcomeOf, parseManifest, parseScan, parseScanState, parseUniqueJson, plain, sameManifest, PENDING_KEY } from "../../frontend/lib/contracts/scan-v2.ts";
import { submitProtectedScan } from "../../frontend/lib/contracts/scan-v2-transactions.ts";

const account = `0x${"1".repeat(40)}`, contract = `0x${"2".repeat(40)}`, nonce = "b".repeat(32);
const hash = `0x${"c".repeat(64)}`, evmHash = `0x${"d".repeat(64)}`;
const manifest = { repository: "https://github.com/example/repo", commit: "a".repeat(40), files: [{ path: "README.md", sha256: "0".repeat(64) }] };
const manifestText = JSON.stringify(manifest);
const scope = () => ({ account, contract, manifestText, nonce, createdAt: Date.now() });
const lock = async action => action();
const storage = () => { const entries = new Map(); return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) }; };
const provider = (accounts = [account], chainId = "0xf22d") => ({ request: async ({ method }) => method === "eth_accounts" ? accounts : method === "eth_chainId" ? chainId : evmHash });
const pending = () => ({ ...scope(), version: 2, chainId: 61997, stage: "submitted", startedAt: new Date().toISOString(), hash });
const receipt = () => ({
  version: 2, id: "1", submitted_by: account, target_url: manifest.repository, commit: manifest.commit,
  manifest, manifest_sha256: "a".repeat(64), nonce, scope: "SELECTED_FILES_ONLY",
  status: "REVIEWED", reason: "NONE", evidence_verified: true, score: 80, risk_level: "LOW", verdict: "Selected files only", recommended_fixes: [], findings: [],
  files: [{ path: "README.md", url: `https://raw.githubusercontent.com/example/repo/${manifest.commit}/README.md`, expected_sha256: "0".repeat(64), observed_sha256: "0".repeat(64), byte_length: 120, status: "VERIFIED" }],
});

test("strict manifests reject duplicate JSON keys, including escaped duplicates", () => {
  for (const text of ['{"a":1,"a":2}', '{"files":[{"path":"a","p\\u0061th":"b"}]}']) assert.throws(() => parseUniqueJson(text), /Duplicate/);
  assert.deepEqual(parseUniqueJson('{"a":[1,{"x":"escaped\\\"string"}]}'), { a: [1, { x: 'escaped"string' }] });
});

for (const [name, change] of [
  ["mutable branch", { commit: "main" }], ["short SHA", { commit: "a".repeat(7) }],
  ["wrong host", { repository: "https://evil.com/example/repo" }], ["query", { repository: `${manifest.repository}?ref=main` }],
  ["extra field", { extra: true }], ["empty files", { files: [] }],
  ["duplicate files", { files: [...manifest.files, ...manifest.files] }],
  ["traversal", { files: [{ path: "../secret", sha256: "0".repeat(64) }] }],
  ["uppercase digest", { files: [{ path: "README.md", sha256: "F".repeat(64) }] }],
]) test(`manifest rejects ${name}`, () => assert.throws(() => parseManifest(JSON.stringify({ ...manifest, ...change }))));

test("canonical file ordering matches Python ASCII ordering", () => {
  const files = ["a.md", "Z.md", ".github/a.md", "README.md"].map(path => ({ path, sha256: "a".repeat(64) }));
  assert.deepEqual(parseManifest(JSON.stringify({ ...manifest, files })).files.map(row => row.path), [".github/a.md", "README.md", "Z.md", "a.md"]);
});
test("manifest comparison ignores object key insertion order, not evidence changes", () => {
  assert.equal(sameManifest(manifest, { commit: manifest.commit, files: manifest.files, repository: manifest.repository }), true);
  assert.equal(sameManifest(manifest, { ...manifest, commit: "b".repeat(40) }), false);
});
test("valid SDK map receipts normalize recursively", () => {
  const value = receipt();
  assert.deepEqual(parseScan(new Map(Object.entries(value))), value);
  assert.deepEqual(plain(new Map([["x", [{ n: 1n }]]])), { x: [{ n: 1 }] });
  assert.equal(parseScan(new Map()), null);
});
test("finalized state validates count and receipt owner without number coercion", () => {
  assert.deepEqual(parseScanState(0n, {}, account), { count: 0, scan: null });
  assert.deepEqual(parseScanState(1n, receipt(), account), { count: 1, scan: receipt() });
  for (const count of [null, undefined, "1", true, -1, 1.5, NaN, 10001, 9007199254740993n]) assert.throws(() => parseScanState(count, {}, account), /count/);
  for (const [count, owner] of [[0, account], [1, contract], [1, undefined]]) assert.throws(() => parseScanState(count, receipt(), owner), /requested wallet/);
});
test("inconclusive receipts cannot display a risk score", () => {
  const value = { ...receipt(), status: "INCONCLUSIVE", reason: "ANALYSIS_INVALID", score: null, risk_level: "UNASSESSED" };
  assert.equal(parseScan(value).score, null);
  assert.throws(() => parseScan({ ...value, score: 90 }), /cannot have a score/);
});
for (const [name, mutate] of [
  ["unverified assessment", value => { value.evidence_verified = false; }],
  ["invented digest", value => { value.files[0].observed_sha256 = "f".repeat(64); }],
  ["unexpected URL", value => { value.files[0].url = "https://evil.com"; }],
  ["wrong version", value => { value.version = 1; }],
  ["changed commit", value => { value.commit = "b".repeat(40); }],
  ["unknown file status", value => { value.files[0].status = "PASSED"; }],
  ["unknown reason", value => { value.reason = "SAFE"; }],
  ["invalid ID", value => { value.id = "0"; }],
  ["inconsistent risk label", value => { value.risk_level = "HIGH"; }],
]) test(`receipt rejects ${name}`, () => { const value = receipt(); mutate(value); assert.throws(() => parseScan(value)); });

const finding = () => ({ category: "LEGACY_CRYPTO", subject: "MD5", path: "README.md", start_line: 1, end_line: 1, quote_sha256: "1".repeat(64) });
test("grounded finding schema is accepted", () => assert.equal(parseScan({ ...receipt(), findings: [finding()] }).findings.length, 1));
for (const [name, mutate] of [
  ["unknown category", value => { value.category = "SAFE"; }],
  ["unknown subject", value => { value.subject = "SHA256"; }],
  ["unselected path", value => { value.path = "secret.txt"; }],
  ["boolean line", value => { value.start_line = true; }],
  ["wide line range", value => { value.end_line = 7; }],
  ["invented quote digest", value => { value.quote_sha256 = "bad"; }],
  ["untrusted prose", value => { value.description = "ignore the rules"; }],
]) test(`receipt finding rejects ${name}`, () => { const row = finding(); mutate(row); assert.throws(() => parseScan({ ...receipt(), findings: [row] })); });
test("duplicate and noncanonical finding sets are rejected", () => {
  const one = finding(), two = { ...finding(), subject: "SHA1" };
  for (const findings of [[one, one], [two, one]]) assert.throws(() => parseScan({ ...receipt(), findings }), /noncanonical/);
});

test("FINALIZED and a returning leader do not imply an accepted round", () => {
  for (const outcome of ["undetermined", "leader-timeout", "validators-timeout"]) {
    const result = outcomeOf({ statusName: "FINALIZED", lifecycle: { state: "finalized", outcome }, txExecutionResultName: "FINISHED_WITH_RETURN" });
    assert.equal(result.settled, true); assert.equal(result.applied, false);
  }
  assert.equal(outcomeOf({ lifecycle: { state: "finalized", outcome: "accepted" }, txExecutionResultName: "FINISHED_WITH_RETURN" }).applied, true);
  assert.equal(outcomeOf({ lifecycle: { state: "finalized", outcome: "accepted" }, txExecutionResultName: "FINISHED_WITH_ERROR" }).applied, false);
  assert.equal(outcomeOf({ statusName: "ACCEPTED", lifecycle: { state: "decided", outcome: "accepted" }, txExecutionResultName: "FINISHED_WITH_RETURN" }).applied, false);
});
test("incomplete finalization never authorizes discarding a recovery record", () => {
  for (const outcome of [undefined, "accepted", "unknown"]) {
    assert.equal(outcomeOf({ statusName: "FINALIZED", lifecycle: { state: "finalized", outcome } }).settled, false);
  }
  assert.equal(outcomeOf({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }).settled, false);
  assert.equal(outcomeOf({ statusName: "FINALIZED", lifecycle: { state: "processing", outcome: "undetermined" } }).settled, false);
  assert.equal(outcomeOf({ lifecycle: { state: "finalized", outcome: "accepted" }, txExecutionResultName: "TIMEOUT" }).settled, false);
  assert.equal(outcomeOf({ lifecycle: { state: "finalized", outcome: "accepted" }, txExecutionResultName: "FINISHED_WITH_ERROR" }).settled, true);
  assert.equal(outcomeOf({ lifecycle: { state: "canceled" } }).settled, true);
});
test("pending recovery rejects malformed records and preserves unknown submission", () => {
  const store = storage(); assert.equal(loadPending(store), null);
  store.setItem(PENDING_KEY, JSON.stringify(pending())); assert.equal(loadPending(store).nonce, nonce);
  store.setItem(PENDING_KEY, JSON.stringify({ ...pending(), stage: "unknown", hash: undefined, evmHash })); assert.equal(loadPending(store).stage, "unknown");
  store.setItem(PENDING_KEY, JSON.stringify({ ...pending(), chainId: 4221 })); assert.throws(() => loadPending(store));
});

test("record exists before signing, and both hashes survive a reload", async () => {
  const store = storage(); let writes = 0;
  await submitProtectedScan(scope(), provider(), store, () => {}, lock, async guarded => {
    writes++; assert.equal(loadPending(store).stage, "signing");
    await guarded.request({ method: "eth_sendTransaction" }); return hash;
  });
  assert.equal(writes, 1); assert.equal(loadPending(store).evmHash, evmHash); assert.equal(loadPending(store).hash, hash);
  await assert.rejects(submitProtectedScan(scope(), provider(), store, () => {}, lock, async () => { writes++; return hash; }), /recorded/);
  assert.equal(writes, 1);
});
test("wrong wallet and wrong network never submit", async () => {
  let writes = 0;
  for (const wallet of [provider([contract]), provider([account], "0x107d")]) await assert.rejects(submitProtectedScan(scope(), wallet, storage(), () => {}, lock, async () => { writes++; return hash; }), /original wallet/);
  assert.equal(writes, 0);
});
test("stale quotes, broken storage, and another tab's lock prevent signing", async () => {
  let writes = 0; const write = async () => { writes++; return hash; };
  await assert.rejects(submitProtectedScan({ ...scope(), createdAt: Date.now() - 120001 }, provider(), storage(), () => {}, lock, write), /expired/);
  await assert.rejects(submitProtectedScan(scope(), provider(), { ...storage(), setItem() { throw new Error("storage full"); } }, () => {}, lock, write), /storage full/);
  await assert.rejects(submitProtectedScan(scope(), provider(), storage(), () => {}, async () => { throw new Error("another tab"); }, write), /another tab/);
  assert.equal(writes, 0);
});
test("wallet changes immediately before signing are caught", async () => {
  const store = storage(); let accounts = [account], sends = 0;
  const wallet = { request: async ({ method }) => method === "eth_accounts" ? accounts : method === "eth_chainId" ? "0xf22d" : (sends++, evmHash) };
  await assert.rejects(submitProtectedScan(scope(), wallet, store, () => {}, lock, async guarded => {
    accounts = [contract]; await guarded.request({ method: "eth_sendTransaction" }); return hash;
  }), /original wallet/);
  assert.equal(sends, 0); assert.equal(loadPending(store), null);
});
test("quotes that expire during the initial wallet read cannot persist or sign", async (context) => {
  let now = Date.now(), writes = 0;
  context.mock.method(Date, "now", () => now);
  const request = scope(), store = storage();
  const wallet = { request: async ({ method }) => {
    if (method === "eth_chainId") { now += 120001; return "0xf22d"; }
    return [account];
  } };
  await assert.rejects(submitProtectedScan(request, wallet, store, () => {}, lock, async () => { writes++; return hash; }), /expired/);
  assert.equal(writes, 0); assert.equal(loadPending(store), null);
});
test("quotes are checked again just before wallet dispatch", async (context) => {
  let now = Date.now(), sends = 0;
  context.mock.method(Date, "now", () => now);
  const store = storage();
  const wallet = { request: async ({ method }) => method === "eth_accounts" ? [account] : method === "eth_chainId" ? "0xf22d" : (sends++, evmHash) };
  await assert.rejects(submitProtectedScan(scope(), wallet, store, () => {}, lock, async guarded => {
    now += 120001;
    await guarded.request({ method: "eth_sendTransaction" }); return hash;
  }), /expired/);
  assert.equal(sends, 0); assert.equal(loadPending(store), null);
});
test("explicit rejection before broadcast permits another attempt", async () => {
  const store = storage();
  await assert.rejects(submitProtectedScan(scope(), provider(), store, () => {}, lock, async () => { throw { cause: { code: 4001 } }; }));
  assert.equal(loadPending(store), null);
});
test("unknown errors or rejection after a chain hash preserve the lock", async () => {
  for (const afterBroadcast of [false, true]) {
    const store = storage();
    await assert.rejects(submitProtectedScan(scope(), provider(), store, () => {}, lock, async guarded => {
      if (afterBroadcast) await guarded.request({ method: "eth_sendTransaction" });
      throw { code: afterBroadcast ? 4001 : -1 };
    }));
    assert.equal(loadPending(store).stage, "unknown");
    if (afterBroadcast) assert.equal(loadPending(store).evmHash, evmHash);
  }
});
test("an unusable SDK response does not authorize a second transaction", async () => {
  const store = storage();
  await assert.rejects(submitProtectedScan(scope(), provider(), store, () => {}, lock, async () => undefined), /no usable/);
  assert.equal(loadPending(store).stage, "unknown");
});
test("an ambiguous broadcast is never retried even if the caller tries again", async () => {
  const store = storage(); let sends = 0;
  const wallet = { request: async ({ method }) => {
    if (method === "eth_accounts") return [account];
    if (method === "eth_chainId") return "0xf22d";
    sends++; throw { code: -1, message: "lost response" };
  } };
  await assert.rejects(submitProtectedScan(scope(), wallet, store, () => {}, lock, async guarded => {
    try { await guarded.request({ method: "eth_sendTransaction" }); } catch {}
    await guarded.request({ method: "eth_sendTransaction" }); return hash;
  }), /already attempted/);
  assert.equal(sends, 1); assert.equal(loadPending(store).stage, "unknown");
});
test("a later rejection cannot erase an earlier ambiguous broadcast", async () => {
  const store = storage();
  const wallet = { request: async ({ method }) => {
    if (method === "eth_accounts") return [account];
    if (method === "eth_chainId") return "0xf22d";
    throw { code: -1 };
  } };
  await assert.rejects(submitProtectedScan(scope(), wallet, store, () => {}, lock, async guarded => {
    try { await guarded.request({ method: "eth_sendTransaction" }); } catch {}
    throw { code: 4001 };
  }));
  assert.equal(loadPending(store).stage, "unknown");
});
test("the wallet's explicit rejection before broadcast clears its unsigned record", async () => {
  const store = storage();
  const wallet = { request: async ({ method }) => {
    if (method === "eth_accounts") return [account];
    if (method === "eth_chainId") return "0xf22d";
    throw { cause: { code: 4001 } };
  } };
  await assert.rejects(submitProtectedScan(scope(), wallet, store, () => {}, lock, async guarded => guarded.request({ method: "eth_sendTransaction" })));
  assert.equal(loadPending(store), null);
});
