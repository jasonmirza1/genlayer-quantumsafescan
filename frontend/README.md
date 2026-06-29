# QuantumSafeScan Lite Frontend

Next.js frontend for the QuantumSafeScan Lite GenLayer project.

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create the frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

Configure:

- `NEXT_PUBLIC_CONTRACT_ADDRESS` - deployed `QuantumSafeScan` contract address
- `NEXT_PUBLIC_GENLAYER_RPC_URL` - GenLayer RPC URL, default `https://studio.genlayer.com/api`
- `NEXT_PUBLIC_GENLAYER_CHAIN_ID` - default `61999`

## Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Main Files

- `app/page.tsx`
- `components/QuantumSafeScanner.tsx`
- `lib/contracts/QuantumSafeScan.ts`
- `lib/hooks/useQuantumSafeScan.ts`
- `lib/genlayer/client.ts`

## Features

- MetaMask wallet connection
- GitHub repository URL submission
- GenLayer transaction submission through `genlayer-js`
- Latest scan result display
- Score, risk level, verdict, recommended fixes, contract address, and transaction hash
