import { createClient } from "genlayer-js-next";
import { studioDevnet } from "genlayer-js-next/chains";
import { TransactionHashVariant, transactionLifecycleFromStoredStatus, type Hash, type TransactionFeeEstimate } from "genlayer-js-next/types";
import type { EthereumProvider } from "../genlayer/client";
import { requireScanWallet, submitProtectedScan } from "./scan-v2-transactions";
import {
  isAddress, outcomeOf, parseManifest, parseScan, parseScanState, plain, sameManifest,
  STUDIO_NEXT_ID, STUDIO_NEXT_RPC, STUDIO_NEXT_EXPLORER,
  type PendingScan, type ScanV2,
} from "./scan-v2";

const chain = {
  ...studioDevnet, id: STUDIO_NEXT_ID, name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [STUDIO_NEXT_RPC] } },
  blockExplorers: { default: { name: "Studio Next Explorer", url: STUDIO_NEXT_EXPLORER } },
};
const client = (account?: string, provider?: EthereumProvider) => createClient({
  chain, ...(account ? { account: account as `0x${string}`, provider } : {}),
});
const read = async (contract: string, functionName: string, args: string[] = []) => plain(await client().readContract({
  address: contract as `0x${string}`, functionName, args,
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
}));

export type ScanQuote = {
  contract: string; account: string; manifestText: string; nonce: string;
  createdAt: number; estimate: TransactionFeeEstimate;
};

export async function readV2State(contract: string, account?: string | null) {
  if (!isAddress(contract)) throw new Error("Use a nonzero contract address");
  const config = await read(contract, "get_config");
  if (config.version !== 2 || config.scope !== "SELECTED_FILES_ONLY") throw new Error("This is not the evidence-verified v2 contract on Studio Next");
  const [count, scan] = await Promise.all([
    read(contract, "get_scan_count"),
    account ? read(contract, "get_latest_scan", [account]) : Promise.resolve(null),
  ]);
  return parseScanState(count, scan, account);
}

export async function quoteScan(contract: string, account: string, provider: EthereumProvider, manifestText: string, nonce: string): Promise<ScanQuote> {
  parseManifest(manifestText);
  if (!/^[0-9a-f]{32,64}$/.test(nonce)) throw new Error("Use a fresh lowercase hexadecimal nonce");
  await requireScanWallet(provider, account);
  await readV2State(contract);
  const estimate = await client(account).estimateTransactionFeesForWrite({
    address: contract as `0x${string}`, functionName: "submit_scan", args: [manifestText, nonce], value: 0n,
  });
  return { contract, account, manifestText, nonce, createdAt: Date.now(), estimate };
}

export async function submitQuotedScan(quote: ScanQuote, provider: EthereumProvider, storage: Storage, changed: (record: PendingScan | null) => void): Promise<void> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate writes across tabs. Use current Chrome or Edge.");
  await submitProtectedScan(quote, provider, storage, changed, async (action) => {
    await navigator.locks.request("quantumsafescan-v2-submit", { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error("Another tab is submitting a scan");
      await action();
    });
  }, async (guarded) => client(quote.account, guarded).writeContract({
      address: quote.contract as `0x${string}`, functionName: "submit_scan", args: [quote.manifestText, quote.nonce], value: 0n,
      fees: { distribution: quote.estimate.distribution, messageAllocations: quote.estimate.messageAllocations, feeValue: quote.estimate.feeValue },
    }));
}

export async function checkPendingScan(record: PendingScan): Promise<{ settled: boolean; applied: boolean; description: string; scan: ScanV2 | null }> {
  const scan = parseScan(await read(record.contract, "get_scan_for_nonce", [record.account, record.nonce]));
  if (scan && scan.submitted_by.toLowerCase() === record.account.toLowerCase() && scan.nonce === record.nonce && sameManifest(parseManifest(JSON.stringify(scan.manifest)), parseManifest(record.manifestText))) {
    return { settled: true, applied: true, description: "Verified the matching receipt in finalized contract state.", scan };
  }
  if (!record.hash) return { settled: false, applied: false, description: "Submission outcome is unknown. Check the explorer; no matching finalized receipt exists yet. Do not resubmit.", scan: null };
  const tx = await client().getTransaction({ hash: record.hash as Hash });
  const status = tx.statusName ?? tx.status;
  const lifecycle = tx.lifecycle ?? (status === undefined ? undefined : transactionLifecycleFromStoredStatus(status, tx.result));
  const outcome = outcomeOf({ ...tx, lifecycle });
  return { ...outcome, applied: false, description: outcome.applied ? "Accepted round, but the matching finalized scan receipt is not readable yet. Keep this record and check again." : outcome.description, settled: outcome.settled && !outcome.applied, scan: null };
}
