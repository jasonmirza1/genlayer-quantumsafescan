# QuantumSafeScan v2: selected-file evidence receipts

V2 is a separate contract, not an in-place upgrade of the accepted Bradbury
deployment. The original `contracts/quantum_safe_scan.py` and v1 frontend mode
remain available. Deploy `contracts/quantum_safe_scan_v2.py` fresh on Studio Next.

## What changed

| Accepted v1 | New v2 |
| --- | --- |
| Mutable rendered repository and policy pages | Selected UTF-8 files at one full commit SHA |
| No exact-byte evidence provenance | Caller-declared and independently fetched SHA-256 digests |
| Weak evidence can still get a numerical risk score | Explicit INCONCLUSIVE, null score, UNASSESSED risk |
| Prompt-based material equivalence of loosely typed signals | Exact file receipt and normalized decision agreement, grounded line citations |
| Latest scan result only in the UI | File digests, finding citations and downloadable actual receipt |
| Existing Bradbury deployment | Separate Studio Next build mode and transaction recovery |

These are additions beyond the original contract, not a rename or a cosmetic UI
refresh. No v2 deployment or live transaction is claimed by this document.

## Request and storage

`submit_scan(manifest_json: str, nonce: str)` accepts a JSON string with exactly
`repository`, `commit`, and `files`. Repository must be an exact
`https://github.com/owner/repository` URL. Commit is 40 lowercase hex characters.
Each file has exactly `path` and `sha256`; SHA-256 means the entire original byte
sequence, including line endings. Paths are restricted ASCII repository-relative
segments; traversal, percent encoding, queries and fragments are rejected.

Select 1–5 files, each at most **8000 bytes**, with at most **24000 bytes** total.
Manifest maximum is 4000 UTF-8 bytes. Input is never silently truncated. Every
selected file is required: an unavailable or mismatched file makes the whole
selection unassessed. The selected text must contain at least 100 non-trimmed
characters in aggregate after stripping each file's surrounding whitespace.
Files with invalid UTF-8 or binary/control bytes are not assessed.

Caller-scoped nonces are 32–64 lowercase hex characters. A recorded nonce cannot
be reused by that caller, including after an INCONCLUSIVE review. A rejected
consensus round does not record a receipt or consume its nonce. One caller cannot
consume another caller's nonce. Storage is bounded at 10000 receipts.

Views: `get_config`, `get_scan_count`, `get_scan`, `get_latest_scan`, and
`get_scan_for_nonce`. The last method supports recovery of a particular request
without confusing it with an older successful scan.

## Consensus and grounding

Each node fetches raw file bytes from a constructed, commit-pinned GitHub raw URL,
checks HTTP status, size, UTF-8 and SHA-256, then reviews only the verified text.
No credentials or arbitrary-host URLs are accepted.

The leader uses the SDK's JSON response mode. Findings must have a known category
and subject plus a selected path and 1–6 existing line numbers. Deterministic
checks require the cited lines to contain supporting signal vocabulary. Examples,
scanner rules, historical discussions and placeholders are excluded by the
contextual review instruction. Quote hashes preserve original CRLF/LF endings.

Validators fetch the bytes independently and independently perform the contextual
review. They require exact agreement on status, reason, verification flag, every
file receipt, and the set of category/subject/path decisions. Different supporting
line spans can agree only if each leader span is valid and its quote digest
matches the validator's independently fetched text. Missing findings or changed
PQC/legacy/secret decisions do not pass a generic semantic-comparison prompt.

Both nodes may agree on the same no-assessment failure. A failed local review
cannot endorse a successful leader review. This is deliberately stricter than
v1: different models may fail to agree, in which case no write is applied.

Malformed model output, unavailable analysis, uncertainty, invalid citations,
thin text, missing files and digest mismatches fail closed. The transaction
outcome and the application assessment are different: an accepted transaction
can correctly record an INCONCLUSIVE application result.

## Interpretation and limits

This is **not** a whole-repository audit, cryptographic certification, proof of
PQC correctness, dependency vulnerability scanner, or proof that secrets are
absent. Callers choose the files and can omit vulnerable code. The hashes prove
which observed bytes were reviewed, not that the caller selected representative
evidence or that GitHub's source identity has been independently authenticated.
Public repository prompt injection remains an adversarial model input; explicit
untrusted-text separation, grounding and independent decisions reduce risk but
do not eliminate it. Consensus can still share the same model error.

Risk scoring is a documented, deterministic **selected-file heuristic**: base 70;
README filename +10; usable disclosure policy +10; concrete PQC implementation
+10 or a migration plan alone +5; active legacy crypto -20; apparent concrete
credential exposure -35. Clamp to 0–100; LOW ≥75, MEDIUM ≥45, HIGH <45. No score
exists for INCONCLUSIVE. A plan never earns the implementation bonus. A LOW
score category is not a safety guarantee.

Receipt findings store only controlled labels, path, line span and SHA-256 of
the cited text, not raw credential values, free-form model text or exception
messages. Public source links still lead to the selected public evidence.

## Frontend migration and safety

Default `NEXT_PUBLIC_SCAN_VERSION=1` keeps the accepted Bradbury UI working.
Set it to `2` to use the v2 console. V2 uses chain 61997, the SDK's Studio Devnet
definition with the Studio Next display name, RPC
`https://studio-dev.genlayer.com/api`, and explorer
`https://explorer-studio-dev.genlayer.com`. The older Bradbury address is never
silently used in v2 mode. Set `NEXT_PUBLIC_V2_CONTRACT_ADDRESS` or enter the new
address at runtime. A finalized `get_config` read must identify version 2.

Fee estimation simulates the request but submits no transaction. The quote binds
the wallet, target, manifest and nonce and expires after two minutes. Submission
requires the user to review and approve the wallet prompt. A browser Web Lock
coordinates concurrent tabs; a persistent transaction record is saved before
any signing request. Every signing/broadcast request rechecks account, chain and
quote expiry after the wallet read. Only one broadcast attempt is allowed per
submission, even if its response is lost.

The record survives reloads and ambiguous errors. Automatic checking performs
only reads; it never resubmits, funds, appeals or finalizes a transaction. A matching
finalized receipt for that wallet/nonce/manifest proves application state was
written. FINALIZED alone is insufficient: a rejected/undetermined round can also
finalize. Missing consensus or execution details also remain unresolved.
Explicit wallet rejection or a locally blocked request before any possible
broadcast clears the unsigned record; unknown submission stays blocked. A record without an identified GenLayer
hash and without a matching finalized receipt must be investigated manually in
the explorer, not silently discarded. Completed records require explicit dismissal.
Optional wallet preferences use best-effort storage, but transaction recovery
storage is mandatory; storage failures cannot enable a write.

## Reproduce local checks

Use Python 3.12 or newer, the pinned packages in `requirements.txt`, and Node
22.18 or newer. See [the completed local verification record](V2_VERIFICATION.md).

```powershell
python -m pytest tests/direct/test_quantum_safe_scan.py tests/direct/test_quantum_safe_scan_v2.py -q
python -m pytest tests/sdk/test_quantum_safe_scan_v2_sdk.py -q
genvm-lint check contracts/quantum_safe_scan_v2.py --json
npm run test:frontend
npm run lint
npm run build
```

For the separate v2 build, set `$env:NEXT_PUBLIC_SCAN_VERSION = '2'` before
`npm run build`. The default build is still v1. `npm ci --ignore-scripts` at the
repository root reproduces the checked-in workspace lock without dependency
installation scripts.

The direct unit tests substitute the SDK. The separate SDK tests actually deploy
and execute in the official GenVM direct harness with mocked HTTP/model responses
and run its captured validators. Neither constitutes a live-chain deployment.
