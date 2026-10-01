import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QuantumSafeScan Lite v2 — Silent Screen Recording",
  description: "A silent browser walkthrough of the actual wallet-connected scanner and its existing finalized receipt. Supporting evidence is provided separately.",
};

export default function DemoVideo() {
  return <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 md:px-8">
    <a href="/" className="text-accent underline">← Open the v2 scanner</a>
    <h1 className="text-3xl font-bold md:text-4xl">QuantumSafeScan Lite v2 demo</h1>
    <p className="text-muted-foreground">Silent browser walkthrough of the real connected console and existing finalized receipt. No voice, music, title cards or staged transaction. Recorded October 2, 2026.</p>
    <video className="aspect-video w-full rounded-lg bg-black" controls playsInline preload="metadata" poster="/demo/quantumsafescan-v2-recording-poster.jpg">
      <source src="/demo/quantumsafescan-v2-screen-recording.mp4" type="video/mp4" />
      Your browser can <a href="/demo/quantumsafescan-v2-screen-recording.mp4">download the recording</a>.
    </video>
    <div className="flex flex-wrap gap-6 text-accent underline">
      <a href="/demo/quantumsafescan-v2-screen-recording.mp4" download>Download silent recording</a>
      <a href="/evidence">Separate submission evidence ↗</a>
    </div>
  </main>;
}
