import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Encode actual browser captures at their original elapsed times. No generated
// scenes, overlays, audio, or simulated wallet/transaction state are added.
const root = process.cwd();
const captureDir = resolve(root, 'artifacts/v2-screen-recording');
const capture = JSON.parse(await readFile(resolve(captureDir, 'capture.json'), 'utf8'));
const ffmpeg = resolve(root, 'artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const output = resolve(root, 'frontend/public/demo/quantumsafescan-v2-screen-recording.mp4');
const list = ['ffconcat version 1.0'];
for (let i = 0; i < capture.frames.length; i++) {
  const frame = capture.frames[i];
  if (!/^frame-\d{5}\.jpg$/.test(frame.file)) throw new Error('Unexpected capture filename');
  const next = capture.frames[i + 1]?.timeMs ?? capture.durationMs;
  list.push(`file '${frame.file}'`, `duration ${(next - frame.timeMs) / 1000}`);
}
list.push(`file '${capture.frames.at(-1).file}'`);
await writeFile(resolve(captureDir, 'frames.ffconcat'), list.join('\n'));
const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '1', '-i', resolve(captureDir, 'frames.ffconcat'), '-an', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], {stdio: 'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Encoding failed: ${result.status}`);
await copyFile(resolve(captureDir, capture.frames[0].file), resolve(root, 'frontend/public/demo/quantumsafescan-v2-recording-poster.jpg'));
// Preserve the old shared download URL while replacing its slide-style video.
await copyFile(output, resolve(root, 'frontend/public/demo/quantumsafescan-v2-demo.mp4'));
console.log(`Encoded ${capture.frames.length} real browser captures; ${capture.durationMs / 1000}s; no audio.`);
