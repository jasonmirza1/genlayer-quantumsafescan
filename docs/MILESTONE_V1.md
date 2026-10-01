# QuantumSafeScan milestone v1 — v2 deployed, Portal submission manual

Title: **QuantumSafeScan v2 — Commit-Pinned, Evidence-Verified Security Reviews**

Build and live-evidence dates: 2026-10-01–2026-10-02. Use the actual contribution date when submitting, not an
old date copied from a previous Portal screenshot.

The user authorized review, fixes and GitHub publication on 2026-10-01.
The user manually approved the fresh Studio Next deployment and scan. The
separate v2 scanner and silent demo are published on Vercel. The final Portal
submission remains the user's action. Completed local checks and recorded live
verification are in [V2_VERIFICATION.md](V2_VERIFICATION.md).

## Delta baseline

Original source: `e433d4b853f42d5acf8ce77e68b59930bd5846ff`.
Repository state before this milestone: `79fdd96` (2026-07-06 local date).
The original scanner contract was last changed on June 30. Existing Bradbury
deployment and demo evidence belong to the original project, not this milestone.

Reviewers should compare the new v2 contract, console, tests, manifest helper and
protocol documentation against the unchanged v1 implementation. Use the
[baseline-to-main source comparison](https://github.com/jasonmirza1/genlayer-quantumsafescan/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...main)
and the final public commit after publication. The v2 contract and accepted
finalized receipt below are separate from v1's Bradbury evidence.

## Changes & Improvements — ready to paste (936 characters)

Built QuantumSafeScan Lite v2 while preserving v1. It reviews 1–5 exact GitHub files at a full commit SHA, verifies complete-byte SHA-256 hashes and records file receipts with grounded line-citation hashes. Validators independently retrieve and review evidence; hashes and normalized decisions must agree. Missing, mismatched, oversized, thin or uncertain evidence and malformed AI output return INCONCLUSIVE without a score. Added caller-scoped replay protection, nonce lookup, regression/real-SDK tests and a Studio Next console with fee review, guarded manual wallet approval, transaction recovery and actual-receipt export. Deployed v2 on Studio Next; an Accepted finalized scan produced receipt #1, REVIEWED, 70/100 MEDIUM, with two verified files. Published the v2 app and a silent demo with downloadable receipt and explorer proof. Assessments cover selected files only—not repository-wide audits or quantum-safety certification.

## Reproduction workflow (deployment, scan and demo already completed)

Do not repeat the completed transactions merely to submit the milestone. Steps
1–6 and 8 below document reproduction; another live write incurs another fee.
Only the final Portal form and submit action remain for the user.

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

## Verified live evidence — recorded October 2, 2026

- Public milestone source comparison: [pre-milestone baseline → main](https://github.com/jasonmirza1/genlayer-quantumsafescan/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...main)
- [Live v2 scanner](https://genlayer-quantumsafescan-v2.vercel.app)
- [Silent demo and actual finalized receipt](https://genlayer-quantumsafescan-v2.vercel.app/demo)
- [Direct demo MP4](https://genlayer-quantumsafescan-v2.vercel.app/demo/quantumsafescan-v2-demo.mp4)
- [Actual exported receipt JSON](https://genlayer-quantumsafescan-v2.vercel.app/demo/quantumsafescan-v2-receipt-1.json)
- [New Studio Next v2 contract](https://explorer-studio-next.genlayer.com/address/0x5855993b828491297a5fED25cA7aa15EDb165845): `0x5855993b828491297a5fED25cA7aa15EDb165845`
- Deployment: the user's explorer capture shows FINALIZED, GenVM SUCCESS,
  consensus Accepted. The full deployment transaction hash has not been
  separately recorded; inspect the contract's deployment link in the explorer.
- [Accepted finalized scan transaction](https://explorer-studio-next.genlayer.com/tx/0x322e0b28721d5267e39b0b21617580fb2a441ef0d964c0aa33c15cb49ca43380)
- Finalized read: scan count **1**; receipt **#1, REVIEWED, 70/100, MEDIUM**;
  two files VERIFIED with matching expected and observed SHA-256 digests.
- Manifest SHA-256: `be753f001a982f8d4bdc5a98dc667213232730970ef1bf4f38c6288cb500bfae`.
- Demo: 1080p silent walkthrough of the already finalized scan, with real
  connected-wallet console captures, explorer evidence, English captions and a
  written notes. No audio track. This does not claim a second scan or a newly recorded signing.
- Portal submission: **NOT SUBMITTED**

## Portal handoff

Choose Builder → Milestones and the accepted QuantumSafeScan Lite project.
Paste the title and description above. Add the public source comparison, live
v2 scanner, demo page and accepted scan transaction as supporting links. The
demo page also exposes the original receipt JSON for independent review. Review
the form and perform the final Submit Contribution manually.
