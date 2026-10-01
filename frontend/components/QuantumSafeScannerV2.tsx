"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, ShieldCheck } from "lucide-react";
import { formatEther } from "viem";
import { useWallet } from "@/lib/genlayer/wallet";
import { getContractAddress, getEthereumProvider } from "@/lib/genlayer/client";
import { checkPendingScan, quoteScan, readV2State, submitQuotedScan, type ScanQuote } from "@/lib/contracts/QuantumSafeScanV2";
import { isAddress, loadPending, parseManifest, PENDING_KEY, STUDIO_NEXT_EXPLORER, type PendingScan, type ScanV2 } from "@/lib/contracts/scan-v2";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export function QuantumSafeScannerV2() {
  const { address, isConnected, isOnCorrectNetwork } = useWallet();
  const [contractInput, setContractInput] = useState(getContractAddress());
  const [loaded, setLoaded] = useState("");
  const [manifestText, setManifestText] = useState("");
  const [nonce, setNonce] = useState("");
  const [scan, setScan] = useState<ScanV2 | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [quote, setQuote] = useState<ScanQuote | null>(null);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [outcome, setOutcome] = useState<Awaited<ReturnType<typeof checkPendingScan>> | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Account events can arrive while an RPC read is in flight. Never restore stale wallet state.
  const owner = useRef(address);
  owner.current = address;

  useEffect(() => {
    const restore = () => {
      try { setPending(loadPending(localStorage)); setStorageError(""); }
      catch (err: any) { setStorageError(err.message); }
      setOutcome(null); setQuote(null); setStorageReady(true);
    };
    restore();
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, []);

  useEffect(() => { setQuote(null); setScan(null); setCount(null); setLoaded(""); }, [address]);

  useEffect(() => {
    if (!pending) return;
    let stopped = false, running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const result = await checkPendingScan(pending);
        if (!stopped) setOutcome(result);
      } catch (err: any) {
        if (!stopped) setOutcome({ settled: false, applied: false, scan: null, description: `Read failed: ${err.message}. The transaction record is preserved; do not resubmit.` });
      } finally { running = false; }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 10000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [pending]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (err: any) { setError(err.message || "Operation failed. Check the recorded state before another transaction."); }
    finally { setBusy(false); }
  }

  async function load() {
    const target = contractInput.trim();
    const account = address;
    const state = await readV2State(target, account);
    if (owner.current !== account) throw new Error("Wallet changed while reading; load finalized state again");
    setLoaded(target); setCount(state.count); setScan(state.scan); setQuote(null);
  }

  async function estimate() {
    const provider = getEthereumProvider();
    if (!address || !provider || !loaded) throw new Error("Connect the wallet and load a v2 contract first");
    if (loadPending(localStorage)) throw new Error("Resolve the recorded transaction first");
    parseManifest(manifestText);
    const result = await quoteScan(loaded, address, provider, manifestText, nonce);
    if (owner.current !== result.account) throw new Error("Wallet changed while estimating; estimate again");
    setQuote(result);
  }

  async function submit() {
    const provider = getEthereumProvider();
    if (!quote || !provider || !address || quote.account.toLowerCase() !== address.toLowerCase() || quote.contract !== loaded || quote.manifestText !== manifestText || quote.nonce !== nonce) throw new Error("Inputs or wallet changed; estimate again");
    await submitQuotedScan(quote, provider, localStorage, setPending);
    setQuote(null); setOutcome(null);
  }

  async function dismiss() {
    const saved = loadPending(localStorage);
    if (!saved || !pending || JSON.stringify(saved) !== JSON.stringify(pending)) throw new Error("Transaction record changed; reload before proceeding");
    const result = await checkPendingScan(saved);
    if (!result.settled) throw new Error("The transaction is unresolved; keep this record");
    // An old asynchronous read must never erase a newer record from another tab.
    if (JSON.stringify(loadPending(localStorage)) !== JSON.stringify(saved)) throw new Error("Transaction record changed");
    localStorage.removeItem(PENDING_KEY); setPending(null); setOutcome(null); setQuote(null); setNonce("");
    if (loaded === saved.contract && address?.toLowerCase() === saved.account.toLowerCase()) await load();
  }

  const newNonce = () => { setNonce(Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("")); setQuote(null); };
  const disabled = busy || !!pending || !storageReady || !!storageError;
  const canEstimate = !disabled && isConnected && isOnCorrectNetwork && !!loaded && !!manifestText && /^[0-9a-f]{32,64}$/.test(nonce);
  const download = () => {
    if (!scan) return;
    const blob = new Blob([JSON.stringify({ network: "Studio Next", chain_id: 61997, contract: loaded, receipt: scan }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = `quantumsafescan-v2-receipt-${scan.id}.json`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <div className="space-y-6">
    <section className="brand-card p-5 md:p-7 space-y-4">
      <div className="flex items-center gap-2 text-accent"><ShieldCheck className="h-5 w-5" /><span>Evidence-verified · v2 · Studio Next</span></div>
      <h1 className="text-2xl sm:text-3xl font-bold break-words">QuantumSafeScan Lite v2</h1>
      <p className="text-muted-foreground">Review exact public files at a GitHub commit. Missing evidence means INCONCLUSIVE, not a reassuring risk score.</p>
      <p className="text-sm text-muted-foreground">This is a selected-file heuristic review—not a whole-repository audit or proof of quantum safety. You approve every transaction in your wallet.</p>
        <div className="flex flex-wrap gap-5 text-sm text-accent underline"><a href="/demo">Watch the silent demo ↗</a><a href="/evidence">Separate submission evidence ↗</a></div>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="break-all">{isConnected ? `Wallet connected: ${address}` : "Wallet not connected"}</span>
        <span>{isOnCorrectNetwork ? "Studio Next connected" : "Connect / switch your wallet to Studio Next"}</span>
        <span>Finalized scans: {count ?? "Not loaded"}</span>
      </div>
      <label htmlFor="v2-contract" className="block text-sm">Studio Next v2 contract address</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input id="v2-contract" className="min-w-0 border-white/20 bg-black/30" value={contractInput} placeholder="Paste your NEW v2 contract address" disabled={busy || !!pending} onChange={event => { setContractInput(event.target.value); setLoaded(""); setScan(null); setCount(null); setQuote(null); }} />
        <Button type="button" variant="outline" disabled={busy || !isAddress(contractInput.trim())} onClick={() => run(load)}>Load finalized state</Button>
      </div>
      {loaded && <a href={`${STUDIO_NEXT_EXPLORER}/address/${loaded}`} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open verified v2 contract ↗</a>}
    </section>

    {(error || storageError) && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Action required</AlertTitle><AlertDescription>{storageError || error}</AlertDescription></Alert>}

    {pending && <section className="brand-card p-5 space-y-3" aria-label="Transaction recovery">
      <h2 className="text-xl font-bold">Transaction recovery</h2>
      <p className="text-sm">{outcome?.description ?? "Checking the recorded transaction. Do not submit again."}</p>
      <p className="text-xs break-all">Wallet: {pending.account} · Contract: {pending.contract} · Nonce: {pending.nonce}</p>
      {pending.hash ? <a className="text-accent underline break-all text-sm" href={`${STUDIO_NEXT_EXPLORER}/tx/${pending.hash}`} target="_blank" rel="noopener noreferrer">Open recorded transaction ↗</a> : <p className="text-xs break-all">Underlying chain hash: {pending.evmHash ?? "Unknown; preserve this record."}</p>}
      {outcome?.scan && <p>Finalized receipt #{outcome.scan.id}: {outcome.scan.status}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(async () => setOutcome(await checkPendingScan(pending)))}>Check recorded transaction</Button>
        <Button variant="outline" disabled={busy || !outcome?.settled} onClick={() => run(dismiss)}>Dismiss completed transaction</Button>
      </div>
      <p className="text-xs text-muted-foreground">Reloading never resubmits. FINALIZED alone does not prove acceptance; we verify the round outcome and matching finalized receipt.</p>
    </section>}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="brand-card p-5 md:p-7 space-y-4">
        <h2 className="text-2xl font-bold">Prepare a pinned scan</h2>
        <p className="text-sm text-muted-foreground">Generate the manifest with scripts/prepare-v2-manifest.mjs. Select 1–5 UTF-8 files, at most 8 KB each and 24 KB total. No branch names, truncated files, or invented hashes.</p>
        <label htmlFor="v2-manifest" className="block text-sm">Evidence manifest JSON</label>
        <textarea id="v2-manifest" rows={11} value={manifestText} disabled={disabled} onChange={event => { setManifestText(event.target.value); setQuote(null); }} className="w-full rounded-md border border-white/20 bg-black/30 p-3 font-mono text-xs" placeholder={'{"repository":"https://github.com/owner/repo","commit":"FULL_COMMIT_SHA","files":[{"path":"README.md","sha256":"EXACT_BYTE_SHA256"}]}'} />
        <label htmlFor="v2-nonce" className="block text-sm">Fresh request nonce</label>
        <div className="flex gap-2"><Input id="v2-nonce" className="min-w-0 border-white/20 bg-black/30" value={nonce} placeholder="Generate a nonce" disabled={disabled} onChange={event => { setNonce(event.target.value); setQuote(null); }} /><Button type="button" variant="outline" disabled={disabled} onClick={newNonce}>Generate</Button></div>
        <Button disabled={!canEstimate} onClick={() => run(estimate)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Estimate fee (no transaction)</Button>
        {quote && <div className="rounded-md border border-white/20 p-4 space-y-3">
          <p className="text-sm">Estimated maximum fee: {formatEther(quote.estimate.feeValue)} GEN</p>
          <p className="text-xs text-muted-foreground">Bound to this wallet, contract, manifest and nonce. Quote expires after two minutes. The wallet shows the final transaction for your approval.</p>
          <Button disabled={disabled || !isOnCorrectNetwork} onClick={() => run(submit)}>Review and approve in wallet</Button>
        </div>}
      </section>

      <section className="brand-card p-5 md:p-7 space-y-4">
        <h2 className="text-2xl font-bold">Latest finalized receipt</h2>
        {!scan ? <p className="text-muted-foreground">Load a deployed v2 contract and connect the receipt owner&apos;s wallet. No demo receipt is fabricated here.</p> : <>
          <div className="flex justify-between gap-3"><strong>#{scan.id} · {scan.status}</strong><span>{scan.risk_level}</span></div>
          <p className="text-4xl font-bold">{scan.score === null ? "No score" : `${scan.score}/100`}</p>
          <p className="text-sm">{scan.verdict}</p>
          {scan.status === "INCONCLUSIVE" && <p className="text-sm text-amber-300">Reason: {scan.reason}. Do not interpret this receipt as a passed audit.</p>}
          <p className="text-xs break-all">Commit: {scan.commit}<br />Manifest SHA-256: {scan.manifest_sha256}</p>
          <h3 className="font-semibold">Exact file evidence</h3>
          {scan.files.map(file => <div key={file.path} className="rounded-md border border-white/10 p-3 space-y-1 text-xs break-all">
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{file.path} ↗</a> · {file.status} · {file.byte_length} bytes
            <p>Expected: {file.expected_sha256}</p><p>Observed: {file.observed_sha256 || "Not available"}</p>
          </div>)}
          <h3 className="font-semibold">Grounded findings</h3>
          {scan.findings.length === 0 && <p className="text-sm text-muted-foreground">No accepted findings in the selected files. This does not prove the repository has no vulnerabilities.</p>}
          {scan.findings.map(finding => <div key={`${finding.category}:${finding.subject}:${finding.path}`} className="rounded-md border border-white/10 p-3 text-sm space-y-1">
            <p>{finding.category} · {finding.subject}</p>
            <a className="text-accent underline" href={`${scan.target_url}/blob/${scan.commit}/${finding.path}#L${finding.start_line}-L${finding.end_line}`} target="_blank" rel="noopener noreferrer">{finding.path} · lines {finding.start_line}–{finding.end_line} ↗</a>
            <p className="text-xs break-all">Quote SHA-256: {finding.quote_sha256}</p>
          </div>)}
          {scan.recommended_fixes.map(fix => <p key={fix} className="text-sm">{fix}</p>)}
          <Button variant="outline" onClick={download}><Download className="h-4 w-4" />Download actual receipt</Button>
        </>}
      </section>
    </div>
  </div>;
}
