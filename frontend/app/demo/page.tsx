import type { Metadata } from "next";
import evidence from "../../public/demo/quantumsafescan-v2-receipt-1.json";

export const metadata: Metadata = {
  title: "QuantumSafeScan Lite v2 — Finalized Demo",
  description: "A silent walkthrough of an accepted Studio Next scan, with its original finalized receipt and public transaction evidence.",
};

const transaction = "0x322e0b28721d5267e39b0b21617580fb2a441ef0d964c0aa33c15cb49ca43380";
const explorer = "https://explorer-studio-next.genlayer.com";
const repository = "https://github.com/jasonmirza1/genlayer-quantumsafescan";
const receipt = evidence.receipt;

export default function FinalizedDemo() {
  return <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 md:px-8">
    <a href="/" className="text-accent underline">← Open the v2 scanner</a>
    <header className="space-y-4">
      <p className="text-sm text-accent">QuantumSafeScan Lite v2 · Studio Next · Recorded October 2, 2026</p>
      <h1 className="text-3xl font-bold md:text-5xl">A finalized scan, with verifiable evidence</h1>
      <p className="max-w-3xl text-muted-foreground">This silent walkthrough shows the connected wallet, pinned file inputs and the actual result of a scan approved manually in OKX. The public explorer records an Accepted consensus result. No voice, music or audio track.</p>
    </header>
    <section className="brand-card overflow-hidden p-3 md:p-5" aria-label="Silent demo video">
      <video className="aspect-video w-full rounded-lg bg-black" controls playsInline preload="metadata" poster="/demo/quantumsafescan-v2-poster.png">
        <source src="/demo/quantumsafescan-v2-demo.mp4?silent=1" type="video/mp4" />
        <track kind="captions" src="/demo/quantumsafescan-v2-captions.vtt" srcLang="en" label="English" />
        Your browser can <a href="/demo/quantumsafescan-v2-demo.mp4">download the demo MP4</a>.
      </video>
      <div className="mt-4 flex flex-wrap gap-5 text-sm">
        <a className="text-accent underline" href="/demo/quantumsafescan-v2-demo.mp4?silent=1" download>Download silent video</a>
        <a className="text-accent underline" href="/demo/quantumsafescan-v2-receipt-1.json" download>Download actual receipt JSON</a>
        <a className="text-accent underline" href="/demo/quantumsafescan-v2-transcript.txt">Read the walkthrough notes</a>
      </div>
    </section>
    <section className="brand-card space-y-5 p-6" aria-label="Recorded receipt evidence">
      <h2 className="text-2xl font-bold">Recorded receipt #{receipt.id} · {receipt.status}</h2>
      <div className="flex flex-wrap gap-8">
        <div><p className="text-sm text-muted-foreground">Selected-file assessment</p><p className="text-3xl font-bold">{receipt.score}/100 · {receipt.risk_level}</p></div>
        <div><p className="text-sm text-muted-foreground">Exact-byte evidence</p><p className="text-3xl font-bold">{receipt.files.length} verified files</p></div>
      </div>
      <p className="text-sm">{receipt.verdict}</p>
      <p className="break-all text-sm">Contract: {evidence.contract}<br />Commit: {receipt.commit}<br />Manifest SHA-256: {receipt.manifest_sha256}</p>
      {receipt.files.map(file => <div key={file.path} className="rounded-lg border border-white/15 p-4">
        <a className="text-accent underline" href={file.url} target="_blank" rel="noopener noreferrer">{file.path} ↗</a>
        <p className="mt-2 text-sm">{file.status} · {file.byte_length} bytes</p>
        <p className="mt-2 break-all font-mono text-xs">Expected SHA-256: {file.expected_sha256}<br />Observed SHA-256: {file.observed_sha256}</p>
      </div>)}
      <p className="text-sm text-muted-foreground">The JSON is the exported receipt from finalized contract state, recorded on October 2. Open the explorer to inspect the public transaction and deployment.</p>
    </section>
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Review the source and on-chain proof</h2>
      <div className="flex flex-wrap gap-5 text-accent underline">
        <a href={`${explorer}/tx/${transaction}`} target="_blank" rel="noopener noreferrer">Accepted scan transaction ↗</a>
        <a href={`${explorer}/address/${evidence.contract}`} target="_blank" rel="noopener noreferrer">Deployed v2 contract ↗</a>
        <a href={`${repository}/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...9de1e93d47eb7f554d1ca5d81c373f019522b2f0`} target="_blank" rel="noopener noreferrer">Milestone source delta ↗</a>
        <a href={`${repository}/blob/main/docs/V2_PROTOCOL.md`} target="_blank" rel="noopener noreferrer">Contract protocol ↗</a>
      </div>
    </section>
  </main>;
}
