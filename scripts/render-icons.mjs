// RĂSCRUCE AI — generează iconițele PNG (16/32/48/128) din extension/icons/icon.svg.
// Unealtă de dezvoltare: folosește un browser Chromium local (Chrome/Edge) în modul headless, prin DevTools.
// Rulare:  node scripts/render-icons.mjs  [cale browser]   (implicit: BROWSER_PATH sau Edge pe Windows)
// PNG-urile rezultate sunt incluse în proiect, deci build-ul nu are nevoie de browser.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const iconsDir = path.join(root, 'extension', 'icons');
const browser =
  process.argv[2] || process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SIZES = [16, 32, 48, 128];
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(root, '.icon-profile-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], {
  stdio: 'ignore',
});

try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    } catch {
      await wait(250);
    }
  }
  if (!target) throw new Error('Browserul nu a pornit.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending.get(d.id)?.(d);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++seq;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  const svg = readFileSync(path.join(iconsDir, 'icon.svg'), 'utf8');
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const size of SIZES) {
    await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    const html = `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
    await send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` });
    await wait(400);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    writeFileSync(path.join(iconsDir, `icon-${size}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log(`icon-${size}.png`);
  }
  ws.close();
} finally {
  proc.kill();
  await wait(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
