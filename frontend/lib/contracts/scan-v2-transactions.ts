import { isAddress, loadPending, parseManifest, PENDING_KEY, STUDIO_NEXT_ID, type PendingScan } from "./scan-v2.ts";

type Provider = { request: (args: { method: string; params?: any[] }) => Promise<any> };
type Scope = { contract: string; account: string; manifestText: string; nonce: string; createdAt: number };

function requireFreshQuote(scope: Scope): void {
  if (!Number.isFinite(scope.createdAt) || scope.createdAt > Date.now() || Date.now() - scope.createdAt > 120000) throw new Error("Fee quote expired; estimate again");
}

function isRejected(error: any): boolean {
  for (let cause = error, depth = 0; cause && depth < 6; depth++, cause = cause.cause) if (cause.code === 4001) return true;
  return false;
}

export async function requireScanWallet(provider: Provider, account: string): Promise<void> {
  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }), provider.request({ method: "eth_chainId" }),
  ]);
  if (!Array.isArray(accounts) || String(accounts[0]).toLowerCase() !== account.toLowerCase() || Number(chainId) !== STUDIO_NEXT_ID) throw new Error("Restore the original wallet on Studio Next before signing");
}

export async function submitProtectedScan(
  scope: Scope,
  provider: Provider,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  changed: (record: PendingScan | null) => void,
  withLock: (action: () => Promise<void>) => Promise<void>,
  write: (guardedProvider: Provider) => Promise<unknown>,
): Promise<void> {
  await withLock(async () => {
    if (loadPending(storage)) throw new Error("Resolve the recorded transaction before another write");
    if (!isAddress(scope.account) || !isAddress(scope.contract) || !/^[0-9a-f]{32,64}$/.test(scope.nonce)) throw new Error("Invalid transaction scope");
    requireFreshQuote(scope);
    parseManifest(scope.manifestText);
    await requireScanWallet(provider, scope.account);
    requireFreshQuote(scope);
    if (loadPending(storage)) throw new Error("Another transaction was recorded");
    let record: PendingScan = {
      version: 2, chainId: 61997, contract: scope.contract, account: scope.account,
      manifestText: scope.manifestText, nonce: scope.nonce,
      startedAt: new Date().toISOString(), stage: "signing",
    };
    const save = () => { storage.setItem(PENDING_KEY, JSON.stringify(record)); changed(record); };
    save();
    let broadcastAttempted = false, broadcastUncertain = false, locallyBlocked = false;
    const guarded: Provider = {
      async request(args) {
        if (/^(eth_send|eth_sign|personal_sign|wallet_send)/.test(args.method)) {
          try { await requireScanWallet(provider, scope.account); requireFreshQuote(scope); }
          catch (error) { locallyBlocked = true; throw error; }
        }
        const broadcast = /^(eth_send|wallet_send)/.test(args.method);
        if (broadcast) {
          if (broadcastAttempted) throw new Error("Broadcast already attempted. Preserve the recorded transaction; do not retry.");
          broadcastAttempted = true; broadcastUncertain = true;
        }
        let result: any;
        try { result = await provider.request(args); }
        catch (error) { if (broadcast && isRejected(error)) broadcastUncertain = false; throw error; }
        if (args.method === "eth_sendTransaction" && typeof result === "string" && /^0x[0-9a-f]{64}$/i.test(result)) {
          record = { ...record, evmHash: result, stage: "submitted" }; save();
        }
        return result;
      },
    };
    try {
      const hash = await write(guarded);
      if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Submission returned no usable transaction hash. Preserve the recorded transaction.");
      record = { ...record, hash, stage: "submitted" }; save();
    } catch (error: any) {
      if ((locallyBlocked || isRejected(error)) && !broadcastUncertain && !record.evmHash) { storage.removeItem(PENDING_KEY); changed(null); }
      else { record = { ...record, stage: "unknown" }; save(); }
      throw error;
    }
  });
}
