# QuantumSafeScan Lite

AI Security & Quantum Readiness Scanner on GenLayer.

QuantumSafeScan Lite is a GenLayer Builder project that scans public GitHub repository evidence and stores a validator-verifiable security verdict in a GenLayer Intelligent Contract. It is intentionally small, but it is not a hello-world: the useful work happens inside the contract through public web evidence, LLM judgment, equivalence checking, and persistent state.

## What It Does

1. A user connects a wallet in the frontend.
2. The user enters a public GitHub repository URL.
3. The frontend submits the URL to the `QuantumSafeScan` Intelligent Contract.
4. The contract renders public GitHub evidence, asks an LLM to normalize security signals, and requires semantic validator agreement through `gl.eq_principle.prompt_comparative`.
5. The contract stores the latest scan for the caller with:
   - `target_url`
   - `score` from 0 to 100
   - `risk_level`: `LOW`, `MEDIUM`, or `HIGH`
   - `verdict`
   - `recommended_fixes`
   - `block_info` scan index
6. The frontend displays the latest stored scan, contract address, and transaction hash when available.

## Why GenLayer

Repository security posture is not a simple deterministic calculation. Public evidence can be missing, ambiguous, or spread across README, security policy pages, and project text. GenLayer is useful here because validators can independently render web evidence, use AI to judge the evidence, and agree on a normalized result before it becomes contract state.

The MVP uses GenLayer for:

- Python Intelligent Contract logic
- Public write method: `submit_scan(target_url)`
- Public view methods: `get_latest_scan(user_address)`, `get_scan(scan_id)`, `get_scan_count()`
- Persistent `TreeMap` storage
- Public web rendering via `gl.nondet.web.render`
- LLM extraction via `gl.nondet.exec_prompt`
- Validator equivalence with `gl.eq_principle.prompt_comparative`

## Contract

The contract lives at:

```text
contracts/quantum_safe_scan.py
```

The contract accepts only HTTPS GitHub repository URLs. It normalizes URLs to `https://github.com/{owner}/{repo}` before scanning.

Signals checked by the LLM prompt:

- README or useful public repository overview
- SECURITY.md, security policy, or responsible disclosure evidence
- Risky old crypto terms: `MD5`, `SHA1`, `RSA-1024`, `DES`, `3DES`
- Modern/post-quantum terms: `Kyber`, `Dilithium`, `ML-KEM`, `ML-DSA`, `post-quantum`, `PQC`
- Secret-like public indicators: `api_key`, `private_key`, `secret`, `token`
- Whether public evidence is strong enough for a useful verdict

## Scoring

The score starts at 70.

Add:

- `+10` README or useful public evidence
- `+10` security policy evidence
- `+10` post-quantum readiness terms

Subtract:

- `-15` risky old crypto terms
- `-15` secret-like indicators
- `-10` weak or unavailable evidence

The score is clamped between 0 and 100.

Risk levels:

- `LOW`: score >= 75
- `MEDIUM`: score >= 45 and < 75
- `HIGH`: score < 45

## Run Locally

Requirements:

- Python 3.12+
- Node.js and npm
- GenLayer CLI: `npm install -g genlayer`
- GenLayer Studio local or hosted

Install dependencies:

```shell
npm install
pip install -r requirements.txt
```

Run the frontend:

```shell
npm run dev
```

The app runs at:

```text
http://localhost:3000
```

## Test

Run the focused contract logic tests:

```shell
pytest tests/direct/test_quantum_safe_scan.py -v
```

Run the frontend type/build check:

```shell
npm run build
```

Optional contract lint:

```shell
genvm-lint check contracts/quantum_safe_scan.py
```

## Deploy To GenLayer Studio

The deployment script now points at `contracts/quantum_safe_scan.py`.

Latest deployment:

- Network: Genlayer Studio Network (`studionet`)
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Contract address: `0x3D94a8437F37f6cd49086CA1c44c4202Ff979436`
- Deployment transaction hash: `0x18597d54c6fe2952054e40ade9248f14d7ad8cb505477271531a41fe7f479545`
- Verified scan transaction hash: `0xba2f0c71321a6e1a4cfc45a2f10b318ac3b23131eff64ad73a172ae411d52804`
- Verification: deployment execution `SUCCESS`; scan consensus `MAJORITY_AGREE`; on-chain scan count `1`
- Explorer link: TODO - the configured explorer endpoint returned `DEPLOYMENT_PAUSED` during verification

1. Select the target network:

```shell
genlayer network
```

2. Deploy:

```shell
npm run deploy
```

3. Copy the deployed contract address into:

```text
frontend/.env
```

using:

```text
NEXT_PUBLIC_CONTRACT_ADDRESS=0x3D94a8437F37f6cd49086CA1c44c4202Ff979436
```

4. Restart the frontend.

For Bradbury or another supported GenLayer network, use the network options exposed by your installed GenLayer CLI and then run the same deploy script.

## Frontend

The frontend lives in `frontend/` and uses the boilerplate stack:

- Next.js
- TypeScript
- TanStack Query
- MetaMask wallet connection
- `genlayer-js`

Main scanner files:

- `frontend/components/QuantumSafeScanner.tsx`
- `frontend/lib/contracts/QuantumSafeScan.ts`
- `frontend/lib/hooks/useQuantumSafeScan.ts`

## Screenshots

Add screenshots under:

```text
screenshots/
```

Suggested screenshots:

- Wallet connected with the scanner form visible
- Scan transaction pending or accepted
- Latest result showing score, risk level, verdict, fixes, contract address, and transaction hash

## Demo Video

TODO: Add demo video link after deployment.

## Submission

See `SUBMISSION.md` for a GenLayer Portal submission draft.

## Safety Note

This project does not claim tokens, airdrops, rewards, or guaranteed portal points. It does not require private keys in code. Do not commit `.env`, wallet secrets, API keys, seed phrases, or private deployment credentials.

## Research Links

- GenLayer docs: https://docs.genlayer.com/
- GenLayer project boilerplate: https://github.com/genlayerlabs/genlayer-project-boilerplate
- GenLayer Portal: https://portal.genlayer.foundation/
