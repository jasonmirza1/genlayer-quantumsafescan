import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const root = process.cwd();
const work = path.join(root, "artifacts/v2-demo");
const published = path.join(root, "frontend/public/demo");
const scenes = [
  { id: "01", title: "QuantumSafeScan Lite v2", caption: "A real Studio Next scan, from pinned inputs to finalized evidence.", narration: "Quantum Safe Scan Lite version two reviews selected public files on GenLayer. This demo follows a real Studio Next scan, from its pinned evidence to the accepted transaction and finalized receipt." },
  { id: "02", title: "Connected wallet and deployed v2 contract", shot: "01-wallet.jpg", label: "Actual connected console · finalized state", caption: "OKX wallet connected · Studio Next · 1 finalized scan", narration: "The actual operator wallet is connected to Studio Next. The console is loaded with the deployed version two contract, and the finalized scan count is one. The operator approved the scan manually in OKX." },
  { id: "03", title: "A commit-pinned evidence request", shot: "02-manifest-receipt.jpg", label: "Actual console · pinned request and receipt", caption: "Full commit SHA + exact file digests make the inputs reproducible.", narration: "The request pins a full GitHub commit and exact byte hashes for two files. Validators independently retrieve the same files, check their digests, and review only that selected evidence." },
  { id: "04", title: "Receipt #1: REVIEWED", shot: "02-manifest-receipt.jpg", label: "Actual console · finalized receipt #1", caption: "70/100 · MEDIUM observed-file risk · selected files only", narration: "Finalized receipt one is reviewed. Its recorded heuristic assessment is seventy out of one hundred, with medium observed file risk. This is a selected file review, not a repository wide audit or quantum safety certification." },
  { id: "05", title: "Verified file bytes and exportable evidence", shot: "03-files-export.jpg", label: "Actual console · matching file digests", caption: "Both expected and observed SHA-256 hashes match the complete files.", narration: "Both file receipts are verified. Expected and observed SHA two hundred and fifty six digests match, with nine hundred fifty five bytes and twelve hundred six bytes recorded. The JSON export preserves the manifest, nonce, findings and assessment." },
  { id: "06", title: "Accepted consensus on Studio Next", shot: "04-transaction.png", label: "Public explorer capture at finalization", caption: "FINALIZED + Accepted · transaction 0x322e0b28…49ca43380", narration: "The public GenLayer explorer shows the submitted contract call as finalized, with an accepted consensus result. Its destination matches the deployed contract, and the same request nonce is associated with receipt one." },
  { id: "07", title: "Ready for independent review", caption: "Open the hosted scanner · Watch the demo · Download the actual receipt", narration: "The hosted version two scanner and public demo page make the result easy to inspect. Reviewers can watch this walkthrough, download the actual receipt, and follow the source delta and explorer links. New scans require manual wallet approval." },
];

await fs.mkdir(work, { recursive: true });
await fs.mkdir(published, { recursive: true });

function timestamp(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

function movieDuration(bytes) {
  function find(start, end) {
    for (let offset = start; offset + 8 <= end;) {
      const size = bytes.readUInt32BE(offset);
      const kind = bytes.toString("ascii", offset + 4, offset + 8);
      if (size < 8 || offset + size > end) throw new Error("Invalid demo MP4 box");
      const body = offset + 8;
      if (kind === "mvhd") {
        const version = bytes[body];
        const scale = bytes.readUInt32BE(body + (version === 1 ? 20 : 12));
        const ticks = version === 1 ? Number(bytes.readBigUInt64BE(body + 24)) : bytes.readUInt32BE(body + 16);
        if (!scale || !ticks) throw new Error("Invalid demo duration");
        return ticks / scale;
      }
      if (kind === "moov") return find(body, offset + size);
      offset += size;
    }
    throw new Error("Demo MP4 has no movie duration");
  }
  return find(0, bytes.length);
}

if (process.argv[2] === "package") {
  let time = 0;
  let vtt = "WEBVTT\n\n";
  for (const scene of scenes) {
    // Encoders can add padded frames: synchronize captions to encoded clips,
    // not an estimate from narration length.
    const duration = movieDuration(await fs.readFile(path.join(work, `${scene.id}.mp4`)));
    // Use short captions for readability; the full spoken narration is in the transcript.
    vtt += `${scene.id}\n${timestamp(time)} --> ${timestamp(time + duration)}\n${scene.title}\n${scene.caption}\n\n`;
    time += duration;
  }
  await fs.writeFile(path.join(published, "quantumsafescan-v2-captions.vtt"), vtt);
  await fs.writeFile(path.join(published, "quantumsafescan-v2-transcript.txt"), scenes.map(s => `${s.title}\n${s.narration}`).join("\n\n") + "\n");
  await fs.writeFile(path.join(work, "concat.txt"), scenes.map(s => `file '${s.id}.mp4'`).join("\n") + "\n");
  console.log(JSON.stringify({ scenes: scenes.length, seconds: time, captions: true }));
} else {
  const require = createRequire(import.meta.url);
  const modules = process.env.DEMO_NODE_MODULES || path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules");
  const { createCanvas, loadImage } = require(path.join(modules, "@napi-rs/canvas"));
  const { receipt, contract } = JSON.parse(await fs.readFile(path.join(published, "quantumsafescan-v2-receipt-1.json"), "utf8"));
  if (receipt.id !== "1" || receipt.status !== "REVIEWED" || receipt.score !== 70 || receipt.files.some(f => f.status !== "VERIFIED" || f.expected_sha256 !== f.observed_sha256)) throw new Error("The exported evidence does not match the verified demo");
  const width = 1920, height = 1080;
  const font = "Segoe UI";
  function wrapped(ctx, text, x, y, maxWidth, lineHeight) {
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, y); y += lineHeight; line = word;
      } else line = next;
    }
    if (line) ctx.fillText(line, x, y);
  }
  for (const scene of scenes) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#070b18"); gradient.addColorStop(1, "#191139");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#b994ff"; ctx.font = `600 26px ${font}`;
    ctx.fillText("QUANTUMSAFESCAN LITE v2  /  STUDIO NEXT", 64, 47);
    ctx.fillStyle = "#f5f3ff"; ctx.font = `700 42px ${font}`;
    ctx.fillText(scene.title, 64, 104);
    if (scene.shot) {
      const image = await loadImage(path.join(work, "screens", scene.shot));
      const fit = Math.min(1792 / image.width, 750 / image.height);
      const w = Math.round(image.width * fit), h = Math.round(image.height * fit);
      const x = Math.round((width - w) / 2), y = 139 + Math.round((750 - h) / 2);
      ctx.drawImage(image, x, y, w, h);
      ctx.strokeStyle = "#655585"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#bab2d0"; ctx.font = `22px ${font}`;
      ctx.fillText(scene.label, 64, 915);
    } else {
      ctx.fillStyle = "#b994ff"; ctx.font = `700 62px ${font}`;
      wrapped(ctx, scene.id === "01" ? "Commit-pinned. Evidence-verified.\nRecorded on-chain.".replace("\n", " ") : "One accepted scan.\nA receipt reviewers can verify.".replace("\n", " "), 120, 320, 1600, 83);
      const items = [["RECEIPT", "#1 · REVIEWED"], ["ASSESSMENT", "70/100 · MEDIUM"], ["EVIDENCE", "2 verified files"]];
      items.forEach(([label, value], index) => {
        const x = 120 + index * 575;
        ctx.fillStyle = "#111b35"; ctx.beginPath(); ctx.roundRect(x, 505, 535, 170, 20); ctx.fill();
        ctx.fillStyle = "#b9a9d0"; ctx.font = `24px ${font}`; ctx.fillText(label, x + 28, 551);
        ctx.fillStyle = "#ffffff"; ctx.font = `700 36px ${font}`; ctx.fillText(value, x + 28, 617);
      });
      ctx.fillStyle = "#d3cce3"; ctx.font = `26px ${font}`;
      ctx.fillText("Contract: " + contract, 120, 769);
      ctx.fillText("Assessment scope: selected files only", 120, 818);
      ctx.fillText("Walkthrough of a manually approved, finalized scan", 120, 867);
    }
    ctx.fillStyle = "#070b16"; ctx.fillRect(0, 945, width, 135);
    ctx.fillStyle = "#f7f4ff"; ctx.font = `500 34px ${font}`;
    wrapped(ctx, scene.caption, 64, 997, 1740, 44);
    const frame = canvas.toBuffer("image/png");
    await fs.writeFile(path.join(work, `${scene.id}.png`), frame);
    if (scene.id === "01") await fs.writeFile(path.join(published, "quantumsafescan-v2-poster.png"), frame);
  }
  await fs.writeFile(path.join(work, "scenes.json"), JSON.stringify(scenes, null, 2));
  console.log(`Prepared ${scenes.length} narrated scenes from actual receipt evidence`);
}
