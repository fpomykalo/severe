// Frame-accurate render harness.
//
// Steps the scene one frame at a time and pipes each canvas straight into
// ffmpeg. Nothing here depends on playback speed: the page renders frame n on
// demand, so a slow frame costs time but never drops.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/home/user/severe';
const FFMPEG = '/tmp/claude-0/-home-user-severe/286acaf4-b0a5-534d-869d-c8cd43c7fcd3/scratchpad/node_modules/ffmpeg-static/ffmpeg';
const URL_ = process.env.SCENE_URL || 'http://localhost:8321/video/scene/index.html';

const outName = process.argv[2] || 'severe';
const firstArg = process.argv[3] ? Number(process.argv[3]) : null;
const lastArg  = process.argv[4] ? Number(process.argv[4]) : null;

const outDir = path.join(ROOT, 'video/out');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--force-color-profile=srgb', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1440 },
                                     deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); });

await page.goto(URL_, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });

const meta = await page.evaluate(() => window.__meta);
const first = firstArg ?? 0;
const last  = lastArg  ?? meta.frames - 1;
console.log(`scene: ${meta.W}x${meta.H} @${meta.FPS}fps, ${meta.duration}s ` +
            `(${meta.frames} frames); rendering ${first}..${last}`);

const mp4 = path.join(outDir, `${outName}.mp4`);
const ff = spawn(FFMPEG, [
  '-y', '-f', 'image2pipe', '-c:v', 'png', '-r', String(meta.FPS), '-i', 'pipe:0',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
], { stdio: ['pipe', 'ignore', 'pipe'] });
let ffErr = '';
ff.stderr.on('data', (d) => { ffErr += d.toString(); });

const write = (buf) => new Promise((res) => {
  if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res);
});

const t0 = Date.now();
for (let n = first; n <= last; n++) {
  await page.evaluate((i) => window.__render(i), n);
  const dataUrl = await page.evaluate(() =>
    document.getElementById('out').toDataURL('image/png'));
  await write(Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'));
  if ((n - first) % 24 === 0) {
    const done = n - first + 1, total = last - first + 1;
    const rate = done / ((Date.now() - t0) / 1000);
    process.stdout.write(`\r  frame ${n}/${last}  ${rate.toFixed(1)} fps  ` +
                         `eta ${Math.round((total - done) / rate)}s   `);
  }
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', (c) =>
  c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}\n${ffErr.slice(-2000)}`))));
await browser.close();
console.log(`\ndone -> ${mp4}`);
