import type { Metadata } from "next";
import evidence from "../../public/demo/quantumsafescan-v2-receipt-1.json";

export const metadata: Metadata = {
  title: "QuantumSafeScan Lite v2 — Submission Evidence",
  description: "Separate evidence links: actual finalized receipt, accepted scan transaction, deployed v2 contract and public source delta.",
};

const transaction = "0x322e0b28721d5267e39b0b21617580fb2a441ef0d964c0aa33c15cb49ca43380";
const explorer = "https://explorer-studio-next.genlayer.com";
const repository = "https://github.com/jasonmirza1/genlayer-quantumsafescan";
const receipt = evidence.receipt;

export default function SubmissionEvidence() {
  return <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-8">
    <a href="/" className="text-accent underline">← Open the v2 scanner</a>
    <header className="space-y-3">
      <h1 className="text-3xl font-bold md:text-4xl">Separate submission evidence</h1>
      <p className="text-muted-foreground">Add the items below as individual evidence links in the Portal. The demo is a separate video, not a replacement for on-chain or source evidence.</p>
    </header>
    <ol className="list-decimal space-y-4 pl-6 text-accent underline">
      <li><a href="/demo">Silent browser recording</a></li>
      <li><a href="/demo/quantumsafescan-v2-receipt-1.json" download>Actual finalized receipt JSON</a></li>
      <li><a href={`${explorer}/tx/${transaction}`} target="_blank" rel="noopener noreferrer">Accepted scan transaction ↗</a></li>
      <li><a href={`${explorer}/address/${evidence.contract}`} target="_blank" rel="noopener noreferrer">Deployed v2 contract ↗</a></li>
      <li><a href={`${repository}/compare/79fdd96dc399dd8fd03d556a97f3ca7ba7e243ad...main`} target="_blank" rel="noopener noreferrer">Milestone source delta ↗</a></li>
      <li><a href={`${repository}/blob/main/docs/V2_VERIFICATION.md`} target="_blank" rel="noopener noreferrer">Test and verification report ↗</a></li>
    </ol>
    <section className="brand-card space-y-5 p-6" aria-label="Recorded receipt evidence">
      <h2 className="text-2xl font-bold">Receipt #{receipt.id} · {receipt.status}</h2>
      <p className="text-3xl font-bold">{receipt.score}/100 · {receipt.risk_level}</p>
      <p>{receipt.verdict}</p>
      <p className="break-all text-sm">Contract: {evidence.contract}<br />Commit: {receipt.commit}<br />Manifest SHA-256: {receipt.manifest_sha256}</p>
      {receipt.files.map(file => <div key={file.path} className="rounded-lg border border-white/15 p-4">
        <a className="text-accent underline" href={file.url} target="_blank" rel="noopener noreferrer">{file.path} ↗</a>
        <p className="mt-2 text-sm">{file.status} · {file.byte_length} bytes</p>
        <p className="mt-2 break-all font-mono text-xs">Expected SHA-256: {file.expected_sha256}<br />Observed SHA-256: {file.observed_sha256}</p>
      </div>)}
      <p className="text-sm text-muted-foreground">Original export from finalized state, recorded October 2, 2026. A selected-file heuristic assessment—not a whole-repository audit or proof of quantum safety.</p>
    </section>
  </main>;
}
