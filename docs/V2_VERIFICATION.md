# V2 local verification — 2026-10-01

This records checks actually completed locally. It is not a deployment,
independent security audit, or proof of a live accepted consensus round.

- Python regression/unit tests: **113 passed**, including the unchanged v1
  scanner's 8 tests and v2's 105 tests.
- Official SDK/GenVM direct-harness tests: **13 passed**. HTTP and model
  responses are mocked; captured validator callbacks are executed.
- Frontend, transaction-guard, wallet-preference and manifest-helper Node tests:
  **59 passed**. Total across the three test suites: **185 passed**.
- GenVM lint and schema validation: **passed for both contracts**. The v1
  runner reports an informational newer-runner notice; v1 source was preserved.
- TypeScript: **passed**. Production builds: **passed in both v1 and v2 modes**.
- npm audit after compatible dependency fixes: **0 advisories** at check time.
  This is not a guarantee against unknown vulnerabilities.
- New v2 disconnected-wallet page inspected locally at a 323px viewport,
  with no horizontal page overflow. No wallet was connected or signed.
- Read-only Studio Next `eth_chainId`: **0xf22d (61997)**.
- The helper downloaded and SHA-256-hashed both complete public files in
  `examples/v2-public-manifest.json` at the full immutable commit shown there.
  This is a real input manifest, not a fabricated scan receipt. These files
  demonstrate provenance, not cryptographic safety; no score is promised.

The local Python packages were genlayer-test 0.30.0rc2 and genlayer-py 0.19.0rc2.
`requirements.txt` pins their exact tested Git commit IDs. CI includes both
frontend modes and a separate process for the real-SDK tests. These local results
do not imply remote CI has passed; check the repository's
[GitHub Actions results](https://github.com/jasonmirza1/genlayer-quantumsafescan/actions).

## Final review fixes

- Recovery no longer allows dismissal on a FINALIZED label when the consensus
  outcome or execution result is missing. Accepted writes still require a
  matching finalized wallet/nonce/manifest receipt before dismissal.
- Quotes are checked after asynchronous wallet reads and immediately before
  wallet dispatch. A locally blocked, never-broadcast request can be cleared;
  ambiguous broadcasts remain recorded and cannot be retried by the provider.
- Blocked preference storage cannot strand wallet initialization or prevent a
  disconnect. Critical transaction-record storage remains strict: no durable
  record means no signing. Unreadable disconnect preferences disable automatic
  reconnect, while explicit connection remains available.
- Finalized counts and latest-receipt owner/count consistency are validated.

The local frontend lock resolves Next.js 16.3.8 and viem 2.57.1. Unused Wagmi
packages were removed after confirming no frontend source imported them.

## Still pending

The user authorized review, fixes and GitHub publication on 2026-10-01. The
[source delta from the pre-milestone baseline](https://github.com/jasonmirza1/genlayer-quantumsafescan/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...main)
is separate from deployment evidence. No hosted frontend update, v2 deployment,
chain write or Portal submission is claimed in this report.

Before submitting a milestone, publish the actual reviewed source delta and
verify a manually approved fresh v2 deployment and a matching finalized scan
receipt. See `MILESTONE_V1.md`; do not reuse v1's video or address as v2 proof.
