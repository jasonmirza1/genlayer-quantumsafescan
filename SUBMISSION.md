# GenLayer Portal Submission

## Ready-To-Copy Portal Text

Contribution Type:
Builder → Projects

Title:
QuantumSafeScan Lite — AI Security & Quantum Readiness Scanner on GenLayer

Description under 1000 characters:
QuantumSafeScan Lite is a GenLayer-powered AI security and quantum-readiness scanner for public GitHub repositories. Users connect a wallet, submit a GitHub repo URL, and the app calls a GenLayer Intelligent Contract to evaluate public repository overview and security-policy evidence for weak crypto references like MD5/SHA1/RSA-1024, possible secret-related patterns, and post-quantum signals like PQC, ML-KEM, Kyber, or Dilithium. GenLayer is central because validators semantically verify the AI evidence judgment instead of trusting a centralized backend. The contract stores a structured result with score, risk level, verdict, evidence summary, and recommended fixes.

Evidence:

- GitHub repo URL: https://github.com/jasonmirza1/genlayer-quantumsafescan
- Demo video URL: TODO
- Contract address: `0x3D94a8437F37f6cd49086CA1c44c4202Ff979436`
- Transaction link: TODO - configured explorer is currently unavailable
- Deployment transaction hash: `0x18597d54c6fe2952054e40ade9248f14d7ad8cb505477271531a41fe7f479545`
- Verified scan transaction hash: `0xba2f0c71321a6e1a4cfc45a2f10b318ac3b23131eff64ad73a172ae411d52804`
- Screenshot folder: `screenshots/`

## Deployment

- Network alias: `studionet`
- Network name: Genlayer Studio Network
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Contract address: `0x3D94a8437F37f6cd49086CA1c44c4202Ff979436`
- Deployment transaction hash: `0x18597d54c6fe2952054e40ade9248f14d7ad8cb505477271531a41fe7f479545`
- Verified scan transaction hash: `0xba2f0c71321a6e1a4cfc45a2f10b318ac3b23131eff64ad73a172ae411d52804`
- Deployment execution: `SUCCESS`
- Scan consensus: `MAJORITY_AGREE`
- Verified on-chain scan count: `1`
- Explorer link: TODO - `https://genlayer-explorer.vercel.app` returned `DEPLOYMENT_PAUSED`

## Problem

Public repository security posture is difficult to judge with a simple deterministic script. Evidence can be ambiguous, incomplete, or spread across README files, security policy pages, and project text.

## Solution

QuantumSafeScan Lite lets a wallet-connected user submit a public GitHub repository URL. A GenLayer Intelligent Contract renders public evidence, uses an LLM to normalize security signals, calculates a score and risk level, stores the latest scan for the caller, and exposes the structured result to the frontend.

## How GenLayer Is Used

- Python Intelligent Contract: `contracts/quantum_safe_scan.py`
- Public write method: `submit_scan(target_url)`
- Public view methods: `get_latest_scan(user_address)`, `get_scan(scan_id)`, `get_scan_count()`
- Persistent contract storage with `TreeMap`
- Public web rendering through `gl.nondet.web.render`
- LLM evidence normalization through `gl.nondet.exec_prompt`
- Semantic validator agreement through `gl.eq_principle.prompt_comparative`
- Frontend transaction flow with `genlayer-js`

## Manual Links Still Required

- Live demo URL
- Demo video URL
- Transaction/explorer URL when the explorer is available
- Final screenshot filenames

## Safety Note

No token, airdrop, reward, or guaranteed points claims are made by this project. No private key, seed phrase, API key, or wallet secret is committed to the repository.
