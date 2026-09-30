export const MAX_MANIFEST_BYTES = 4000;
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8000;
export const MAX_TOTAL_BYTES = 24000;
export const MAX_SCANS = 10000;
export const STUDIO_NEXT_ID = 61997;
export const STUDIO_NEXT_RPC = "https://studio-dev.genlayer.com/api";
export const STUDIO_NEXT_EXPLORER = "https://explorer-studio-dev.genlayer.com";
export const PENDING_KEY = "quantumsafescan.pending.v2";
const FILE_STATUSES = new Set(["VERIFIED", "HTTP_ERROR", "FETCH_ERROR", "EMPTY", "TOO_LARGE", "HASH_MISMATCH", "INVALID_TEXT", "TOTAL_LIMIT"]);
const REASONS = new Set(["NONE", "EVIDENCE_UNAVAILABLE", "EVIDENCE_TOO_THIN", "ANALYSIS_UNAVAILABLE", "ANALYSIS_INVALID", "ANALYSIS_UNCERTAIN"]);
const CATEGORIES: Record<string, readonly string[]> = {
  LEGACY_CRYPTO: ["MD5", "SHA1", "RSA-1024", "DES", "3DES"],
  SECRET_EXPOSURE: ["CREDENTIAL"],
  PQC_IMPLEMENTATION: ["ML-KEM", "ML-DSA", "KYBER", "DILITHIUM"],
  PQC_MIGRATION: ["MIGRATION_PLAN"],
  SECURITY_POLICY: ["DISCLOSURE_POLICY"],
};

export type Manifest = {
  repository: string;
  commit: string;
  files: { path: string; sha256: string }[];
};
export type EvidenceFile = {
  path: string; url: string; expected_sha256: string; observed_sha256: string;
  byte_length: number; status: string;
};
export type Finding = {
  category: string; subject: string; path: string;
  start_line: number; end_line: number; quote_sha256: string;
};
export type ScanV2 = {
  version: 2; id: string; submitted_by: string; target_url: string; commit: string;
  manifest: Manifest; manifest_sha256: string; nonce: string; scope: "SELECTED_FILES_ONLY";
  status: "REVIEWED" | "INCONCLUSIVE"; reason: string; evidence_verified: boolean;
  score: number | null; risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNASSESSED";
  verdict: string; recommended_fixes: string[]; files: EvidenceFile[]; findings: Finding[];
};
export type PendingScan = {
  version: 2; chainId: 61997; contract: string; account: string;
  manifestText: string; nonce: string; startedAt: string;
  stage: "signing" | "submitted" | "unknown";
  hash?: string; evmHash?: string;
};
export type Outcome = { settled: boolean; applied: boolean; description: string };

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
}
export function plain(value: unknown): any {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [String(k), plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

// JSON.parse discards duplicate keys. Detect them before any canonicalization or signing.
export function parseUniqueJson(text: string): any {
  const parsed = JSON.parse(text);
  let index = 0;
  const space = () => { while (/\s/.test(text[index] ?? "!") && index < text.length) index++; };
  const string = () => {
    const begin = index++;
    while (index < text.length) {
      if (text[index] === "\\") { index += 2; continue; }
      if (text[index++] === '"') return JSON.parse(text.slice(begin, index));
    }
    throw new Error("Invalid JSON string");
  };
  const walk = (depth: number) => {
    if (depth > 8) throw new Error("JSON nesting is too deep");
    space();
    if (text[index] === "{") {
      index++; space(); const seen = new Set<string>();
      while (text[index] !== "}") {
        const key = string();
        if (seen.has(key)) throw new Error(`Duplicate JSON key: ${key}`);
        seen.add(key); space(); index++; walk(depth + 1); space();
        if (text[index] !== ",") break;
        index++; space();
      }
      index++;
    } else if (text[index] === "[") {
      index++; space();
      while (text[index] !== "]") {
        walk(depth + 1); space();
        if (text[index] !== ",") break;
        index++;
      }
      index++;
    } else if (text[index] === '"') string();
    else { while (index < text.length && !/[\s,\]}]/.test(text[index])) index++; }
  };
  walk(0);
  return parsed;
}

export function parseManifest(text: string): Manifest {
  if (new TextEncoder().encode(text).length > MAX_MANIFEST_BYTES) throw new Error("Manifest exceeds 4000 bytes");
  const value = parseUniqueJson(text);
  if (!value || Array.isArray(value) || Object.keys(value).sort().join() !== "commit,files,repository") throw new Error("Use repository, commit and files only");
  if (typeof value.repository !== "string" || !/^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value.repository) || [".", ".."].includes(value.repository.split("/").at(-1))) throw new Error("Use an exact HTTPS GitHub owner/repository URL");
  if (typeof value.commit !== "string" || !/^[0-9a-f]{40}$/.test(value.commit)) throw new Error("Use a full lowercase 40-character commit SHA");
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > MAX_FILES) throw new Error("Select one to five text files");
  const seen = new Set<string>();
  for (const row of value.files) {
    if (!row || Array.isArray(row) || Object.keys(row).sort().join() !== "path,sha256") throw new Error("Each file needs path and sha256 only");
    if (typeof row.path !== "string" || row.path.length > 180 || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(row.path) || row.path.split("/").some((part: string) => part === "." || part === "..")) throw new Error("Invalid repository-relative file path");
    if (seen.has(row.path)) throw new Error("Duplicate file path");
    seen.add(row.path);
    if (typeof row.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.sha256)) throw new Error("Use exact-byte lowercase SHA-256 digests");
  }
  return { ...value, files: [...value.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}

export function parseScan(raw: unknown): ScanV2 | null {
  const value = plain(raw);
  if (!value || Object.keys(value).length === 0) return null;
  if (Array.isArray(value) || value.version !== 2 || value.scope !== "SELECTED_FILES_ONLY" || !["REVIEWED", "INCONCLUSIVE"].includes(value.status)) throw new Error("Not a supported v2 receipt");
  if (!isAddress(value.submitted_by) || typeof value.id !== "string" || !/^[1-9][0-9]{0,4}$/.test(value.id) || Number(value.id) > MAX_SCANS || typeof value.nonce !== "string" || !/^[0-9a-f]{32,64}$/.test(value.nonce) || typeof value.manifest_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.manifest_sha256)) throw new Error("Malformed v2 receipt identity");
  const manifest = parseManifest(JSON.stringify(value.manifest));
  if (value.target_url !== manifest.repository || value.commit !== manifest.commit || typeof value.evidence_verified !== "boolean" || !Array.isArray(value.files) || value.files.length !== manifest.files.length) throw new Error("Malformed v2 receipt evidence");
  const files: EvidenceFile[] = value.files;
  for (const [index, row] of files.entries()) {
    const expected = manifest.files[index];
    const expectedUrl = `https://raw.githubusercontent.com/${manifest.repository.slice("https://github.com/".length)}/${manifest.commit}/${expected.path}`;
    if (!row || typeof row !== "object" || Object.keys(row).sort().join() !== "byte_length,expected_sha256,observed_sha256,path,status,url" || row.path !== expected.path || row.url !== expectedUrl || row.expected_sha256 !== expected.sha256 || !FILE_STATUSES.has(row.status) || !Number.isSafeInteger(row.byte_length) || row.byte_length < 0 || typeof row.observed_sha256 !== "string" || !/^(?:[0-9a-f]{64})?$/.test(row.observed_sha256)) throw new Error("Malformed file receipt");
    if (row.status === "VERIFIED" && (row.observed_sha256 !== expected.sha256 || row.byte_length < 1 || row.byte_length > MAX_FILE_BYTES)) throw new Error("Invalid verified file receipt");
  }
  const verified = files.every(row => row.status === "VERIFIED");
  if (verified !== value.evidence_verified || !REASONS.has(value.reason) || !Array.isArray(value.findings) || value.findings.length > 12 || !Array.isArray(value.recommended_fixes) || value.recommended_fixes.some((item: unknown) => typeof item !== "string") || typeof value.verdict !== "string") throw new Error("Malformed review receipt");
  let previousKey = "";
  for (const finding of value.findings) {
    if (!finding || typeof finding !== "object" || Object.keys(finding).sort().join() !== "category,end_line,path,quote_sha256,start_line,subject" || typeof finding.category !== "string" || !Object.hasOwn(CATEGORIES, finding.category) || !CATEGORIES[finding.category].includes(finding.subject) || !manifest.files.some(row => row.path === finding.path) || !Number.isSafeInteger(finding.start_line) || !Number.isSafeInteger(finding.end_line) || finding.start_line < 1 || finding.end_line < finding.start_line || finding.end_line >= finding.start_line + 6 || typeof finding.quote_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(finding.quote_sha256)) throw new Error("Malformed grounded finding");
    const key = [finding.category, finding.subject, finding.path].join("\0");
    if (key <= previousKey) throw new Error("Duplicate or noncanonical findings");
    previousKey = key;
  }
  if (value.status === "INCONCLUSIVE") {
    if (value.score !== null || value.risk_level !== "UNASSESSED" || value.findings.length !== 0 || value.reason === "NONE") throw new Error("An inconclusive review cannot have a score");
  } else if (!verified || value.reason !== "NONE" || !Number.isInteger(value.score) || value.score < 0 || value.score > 100 || !["LOW", "MEDIUM", "HIGH"].includes(value.risk_level) || files.reduce((sum, row) => sum + row.byte_length, 0) > MAX_TOTAL_BYTES) throw new Error("An assessment requires verified evidence");
  if (value.status === "REVIEWED" && value.risk_level !== (value.score >= 75 ? "LOW" : value.score >= 45 ? "MEDIUM" : "HIGH")) throw new Error("Risk label does not match the score");
  return value as ScanV2;
}

export function sameManifest(left: Manifest, right: Manifest): boolean {
  const key = (manifest: Manifest) => JSON.stringify({ repository: manifest.repository, commit: manifest.commit, files: manifest.files });
  return key(left) === key(right);
}

export function parseScanState(rawCount: unknown, rawScan: unknown, account?: string | null): { count: number; scan: ScanV2 | null } {
  const count = plain(rawCount);
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_SCANS) throw new Error("Invalid finalized scan count");
  const scan = parseScan(rawScan);
  if (scan && (!isAddress(account) || scan.submitted_by.toLowerCase() !== account.toLowerCase() || Number(scan.id) > count)) throw new Error("Latest receipt does not match the requested wallet or finalized count");
  return { count, scan };
}

export function outcomeOf(tx: any): Outcome {
  const state = tx?.lifecycle?.state;
  const outcome = tx?.lifecycle?.outcome;
  const status = tx?.statusName ?? tx?.status_name;
  const finalized = state === "finalized" || (!state && status === "FINALIZED");
  const canceled = state === "canceled" || (!state && status === "CANCELED");
  const applied = finalized && outcome === "accepted" && tx?.txExecutionResultName === "FINISHED_WITH_RETURN";
  const rejected = finalized && ["undetermined", "leader-timeout", "validators-timeout"].includes(outcome);
  const reverted = finalized && outcome === "accepted" && tx?.txExecutionResultName === "FINISHED_WITH_ERROR";
  // A terminal label without a known outcome cannot authorize clearing the recovery lock.
  const settled = applied || rejected || reverted || (canceled && outcome !== "accepted");
  return {
    settled, applied,
    description: applied ? "Consensus accepted the round and finalized the write." : canceled && settled ? "Transaction canceled; no write was applied." : reverted ? "The finalized execution reverted; no write was applied." : rejected ? "Finalized without an accepted round; nothing was written." : finalized ? "Finalized, but the outcome or execution result is not verified. Keep the record and check again; do not resubmit." : "Waiting for finalization. Do not submit again.",
  };
}

export function loadPending(storage: Pick<Storage, "getItem">): PendingScan | null {
  const text = storage.getItem(PENDING_KEY);
  if (!text) return null;
  const value = parseUniqueJson(text);
  if (value.version !== 2 || value.chainId !== STUDIO_NEXT_ID || !isAddress(value.contract) || !isAddress(value.account) || !/^[0-9a-f]{32,64}$/.test(value.nonce) || !["signing", "submitted", "unknown"].includes(value.stage) || typeof value.startedAt !== "string") throw new Error("Recorded transaction is malformed. Preserve it and check the explorer before another write.");
  parseManifest(value.manifestText);
  for (const key of ["hash", "evmHash"]) if (value[key] !== undefined && !/^0x[0-9a-f]{64}$/i.test(value[key])) throw new Error("Malformed recorded transaction hash");
  return value;
}
