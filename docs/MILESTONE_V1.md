# QuantumSafeScan milestone v1 — preparation, not yet submitted

Title: **QuantumSafeScan v2 — Commit-Pinned, Evidence-Verified Security Reviews**

Build date: 2026-10-01. Use the actual contribution date when submitting, not an
old date copied from a previous Portal screenshot.

The user authorized review, fixes and GitHub publication on 2026-10-01.
Deployment and the Portal submission remain manual and pending. Completed local
checks are in [V2_VERIFICATION.md](V2_VERIFICATION.md).

## Delta baseline

Original source: `e433d4b853f42d5acf8ce77e68b59930bd5846ff`.
Repository state before this milestone: `79fdd96` (2026-07-06 local date).
The original scanner contract was last changed on June 30. Existing Bradbury
deployment and demo evidence belong to the original project, not this milestone.

Reviewers should compare the new v2 contract, console, tests, manifest helper and
protocol documentation against the unchanged v1 implementation. Use the
[baseline-to-main source comparison](https://github.com/jasonmirza1/genlayer-quantumsafescan/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...main)
and the final public commit after publication. Do not claim this work was deployed
until the manual Studio Next transaction and finalized reads are verified.

## Draft Changes & Improvements (under 1000 characters)

Built a separate QuantumSafeScan v2 evidence-review contract while preserving the accepted v1 deployment. V2 reviews 1–5 exact GitHub files at a full commit SHA, verifies complete-byte SHA-256 digests, and records file receipts and grounded line-citation hashes. Missing, mismatched, oversized, invalid or thin evidence, malformed AI output and uncertainty produce INCONCLUSIVE with no risk score. Validators independently fetch and review the files; evidence hashes and normalized decisions must agree, and citations must match actual source lines. PQC migration plans are distinguished from implementation signals. Added caller-scoped replay protection, nonce-based receipt lookup, regression and real-SDK tests, and a Studio Next console with fee review, guarded wallet submission, persistent transaction recovery and actual-receipt export. Assessments explicitly cover selected files only, not repository-wide or quantum-safety certification.

This draft describes implemented source, not a live v2 deployment. Add a short
verified deployment sentence only after it actually happened; keep the Portal
description below its 1000-character limit.

## Must complete before Portal submission

1. Publish the reviewed delta to the linked GitHub repository.
2. In Studio Next, deploy `contracts/quantum_safe_scan_v2.py` fresh, with no
   constructor arguments. The user reviews and approves the wallet transaction.
3. Check the deployment round is **Accepted** and GenVM **SUCCESS**, then verify
   `get_config` returns version 2. Save the new address and deploy transaction.
4. Launch the frontend in v2 mode or publish a v2 preview; enter the new contract.
5. Generate a manifest from actual public files and a full SHA using the helper.
   Example: the repository's `frontend/package.json` and
   `frontend/lib/contracts/types.ts` are small selected files suitable for a
   provenance demonstration, not evidence of cryptographic safety.
   `examples/v2-public-manifest.json` contains a real, read-only verified input
   at the original public commit; use a newly generated nonce. It is not a
   receipt or evidence that a scan transaction already succeeded.
6. Submit one scan manually. Check the accepted round AND a matching finalized
   receipt, `get_scan_count >= 1`, and correct manifest/file hashes. Record the
   actual assessment; do not promise a fixed score or fabricate a passed review.
7. Demonstrate one wrong digest with a fresh nonce only if desired: it should
   record INCONCLUSIVE/no score. A second live transaction incurs another fee.
   Offline tests already cover this path.
8. Record updated demo/evidence showing the wallet/network, verified v2 contract,
   request, accepted round, actual finalized receipt and evidence export.
9. Fill Builder → Milestones, link the accepted QuantumSafeScan project, and
   attach the public compare/commit, protocol/test docs, new explorer address and
   updated demo. The user performs the final Portal submit.

## Manual manifest preparation (no signing)

```powershell
node --experimental-strip-types scripts/prepare-v2-manifest.mjs https://github.com/jasonmirza1/genlayer-quantumsafescan FULL_PUBLIC_COMMIT_SHA frontend/package.json frontend/lib/contracts/types.ts
```

Paste `manifest_json` and `nonce` from the output into the console or Studio Next
`submit_scan` arguments. Do not paste the entire outer helper output as a manifest.

## Open the local v2 console

From the repository root, without editing your accepted v1 environment file:

```powershell
$env:NEXT_PUBLIC_SCAN_VERSION = '2'
npm run dev --workspace frontend -- --port 3300
```

Open `http://localhost:3300`. Enter the newly deployed v2 contract address and
click **Load finalized state**. Connect your wallet yourself and confirm Studio
Next. Paste the manifest, click **Generate** for a fresh nonce, then **Estimate
fee (no transaction)**. Only after reviewing it, click **Review and approve in
wallet** and complete the wallet prompt manually. Do not clear an unresolved
recovery record or send the same request again.

## Live evidence — intentionally pending

- Public milestone source comparison: [pre-milestone baseline → main](https://github.com/jasonmirza1/genlayer-quantumsafescan/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...main)
- New Studio Next v2 contract: **PENDING USER DEPLOYMENT**
- Deployment transaction: **PENDING**
- Verified scan transaction/receipt: **PENDING**
- Updated live demo/video: **PENDING**
- Portal submission: **NOT SUBMITTED**
