// RĂSCRUCE AI — repetiția demo-ului FĂRĂ INTERNET (planul, §12 etapa 7 și §15).
// Rulează scenariul prezentării în extensia construită (dist/extension), într-un Chrome/Edge headless,
// cu rețeaua oprită pe fiecare pagină ÎNAINTE de încărcare, și verifică cifrele din plan (§10).
// Înregistrează orice cerere de rețea: în modul demonstrativ nu trebuie să existe niciuna.
//
// Rulare:  npm run build && npm run rehearsal  [-- cale browser]
// Implicit: BROWSER_PATH sau Edge pe Windows. Nu modifică nimic în afara folderului proiectului.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { demoListingTextA } from '../extension/src/shared/contracts/fixtures/demoScenario.js';
import { DEMO_STORM_TEXT } from '../extension/src/demo/index.js';

const root = path.resolve(import.meta.dirname, '..');
const extDir = path.join(root, 'dist', 'extension');
if (!existsSync(path.join(extDir, 'manifest.json'))) {
  console.error('Lipsește dist/extension. Rulează întâi: npm run build');
  process.exit(2);
}
const browser = process.argv[2] || process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9500 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(root, '.rehearsal-profile-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(
  browser,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, `--load-extension=${extDir}`, `--disable-extensions-except=${extDir}`, `--remote-debugging-port=${port}`, 'about:blank'],
  { stdio: 'ignore' },
);
const base = `http://127.0.0.1:${port}`;

const requests = [];
const results = [];

async function connect(wsUrl, label) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === 'Network.requestWillBeSent') requests.push({ page: label, url: d.params.request.url });
    pending.get(d.id)?.(d);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++seq;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  return { ws, send, ev };
}

async function findExtensionId() {
  for (let i = 0; i < 80; i++) {
    try {
      for (const t of (await (await fetch(`${base}/json/list`)).json()).filter((x) => x.type === 'service_worker')) {
        const c = await connect(t.webSocketDebuggerUrl, 'sw');
        const name = await c.ev('typeof chrome !== "undefined" && chrome.runtime.getManifest().name');
        c.ws.close();
        if (name === 'RentSmart') return new URL(t.url).host;
      }
    } catch {
      // browserul încă pornește
    }
    await wait(250);
  }
  throw new Error('Extensia nu s-a încărcat.');
}

/** O pagină a extensiei, cu rețeaua oprită înainte de încărcare. */
async function openOffline(id, page, label, width) {
  const t = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = await connect(t.webSocketDebuggerUrl, label);
  await c.send('Network.enable');
  await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: `chrome-extension://${id}/${page}` });
  await wait(2000);
  return c;
}

const HELPERS = `window.$click=(x,root=document)=>{const e=[...root.querySelectorAll('button,label,[role=tab]')].find(e=>e.textContent.trim().startsWith(x)); if(!e) throw new Error('lipsește butonul: '+x); e.click(); return true};
window.$set=(sel,v)=>{const el=document.querySelector(sel); const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); return true}; true`;

async function step(name, fn) {
  const t0 = Date.now();
  let ok = false;
  let detail = '';
  try {
    const r = await fn();
    ok = r === true;
    if (!ok) detail = typeof r === 'string' ? r : 'verificare eșuată';
  } catch (e) {
    detail = e.message;
  }
  results.push({ name, ok, ms: Date.now() - t0, detail });
}

try {
  const id = await findExtensionId();
  const dash = await openOffline(id, 'dashboard.html', 'dashboard', 1280);
  const panel = await openOffline(id, 'sidepanel.html', 'panou', 400);
  const act = async (c, expr, pause = 700) => {
    await c.ev(HELPERS);
    await c.ev(expr);
    await wait(pause);
  };
  const text = (c) => c.ev('document.body.innerText');

  // Înainte de modul demonstrativ, panoul și dashboard-ul pot cere cursul BNR și /api/health (mod normal).
  // În modul demonstrativ: nicio cerere externă.
  let beforeDemo = 0;
  await step('1. Dashboard: încarcă scenariul demonstrativ (dialog)', async () => {
    await act(dash, `$click('Setări')`, 300);
    await act(dash, `$click('Încarcă scenariul demonstrativ')`, 400);
    await act(dash, `$click('Încarcă scenariul', document.querySelector('dialog[open]'))`, 900);
    beforeDemo = requests.length;
    return dash.ev(`chrome.storage.local.get(['passport','setari']).then(r => r.passport?.venitNetLunar === 5200 && r.setari?.modDemo === true)`);
  });

  await step('2. Panou: analiza anunțului A (răspuns înregistrat)', async () => {
    await act(panel, `location.reload(), true`, 1500);
    await act(panel, `$click('Lipește textul anunțului')`, 300);
    await act(panel, `$set('textarea', ${JSON.stringify(demoListingTextA)})`, 200);
    await act(panel, `$click('Analizează textul')`, 1200);
    const t = await text(panel);
    if (!t.includes('DATE DEMONSTRATIVE')) return 'lipsește eticheta DATE DEMONSTRATIVE';
    if (!t.includes('6 găsite în anunț · 0 neclare · 5 de întrebat')) return 'statusurile nu corespund';
    if (!t.includes('Salvat în dashboard')) return 'analiza nu e recunoscută ca anunțul demo A salvat';
    return t.includes('Întrebări (4)');
  });

  await step('3. Panou: Cost real A = 2.500 / 2.950 RON, 5.875 RON la mutare', async () => {
    await act(panel, `$click('Cost real')`, 600);
    const t = await text(panel);
    return t.includes('2.500 RON') && t.includes('2.950 RON') && t.includes('5.875 RON');
  });

  await step('4. Dashboard: comparația „Dintre anunțurile tale salvate, B…”', async () => {
    await act(dash, `$click('Comparație')`, 600);
    return /Dintre anunțurile tale salvate, B .* are cel mai mic cost lunar estimat \(2\.392 RON/.test(await text(dash));
  });

  await step('5. Economii în timp, fără situații neprevăzute: ambele variante în siguranță', async () => {
    await act(dash, `$click('Economii în timp')`, 900);
    const t = await text(dash);
    return t.includes('Varianta A: Îți permiți') && t.includes('Varianta B: Îți permiți');
  });

  await step('6. Furtuna din text liber (înregistrată): A pe minus în mai', async () => {
    await act(dash, `$set('textarea[aria-label="Situația descrisă"]', ${JSON.stringify(DEMO_STORM_TEXT)})`, 200);
    await act(dash, `$click('Analizează situația descrisă')`, 500);
    await act(dash, `$click('Adaugă situația')`, 1200);
    const svg = await dash.ev(`[...document.querySelectorAll('svg text')].map(t=>t.textContent).join('|')`);
    const legend = await dash.ev(`document.querySelector('svg[role=img]')?.closest('section')?.innerText ?? ''`);
    return svg.includes('Cheltuielile depășesc banii disponibili') && /A: din mai( \d{4})?\./.test(legend);
  });

  await step('7. Cum poți face chiria accesibilă: 4 opțiuni; „Strânge încă 1.825 RON” devine Planul', async () => {
    const t = await text(dash);
    if (!['Amână mutarea cu 1 lună', 'Strânge încă 1.825 RON', 'Alege B', 'Redu cheltuielile lunare cu 365 RON'].every((s) => t.includes(s))) return 'opțiunile nu corespund';
    await act(dash, `$click('Strânge încă 1.825 RON')`, 700);
    return dash.ev(`document.querySelector('[aria-pressed=true]')?.textContent.startsWith('Strânge încă 1.825 RON')`);
  });

  await step('8. Panou: tabul „Economii” actualizat (A: bani insuficienți din mai)', async () => {
    await act(panel, `$click('Economii')`, 900);
    const t = await text(panel);
    return t.includes('bani insuficienți') && /Din mai( \d{4})?, cheltuielile depășesc banii pe care îi ai/.test(t);
  });

  await step('9. Nicio cerere de rețea (mod demonstrativ, offline)', async () => {
    const isExternal = (r) => !/^(chrome-extension|data|blob|about):/.test(r.url);
    const early = requests.slice(0, beforeDemo).filter((r) => isExternal(r) && !r.url.startsWith('https://www.cursbnr.ro/') && !new URL(r.url).pathname.endsWith('/api/health'));
    const late = requests.slice(beforeDemo).filter(isExternal);
    const external = [...early.map((r) => ({ ...r, cand: 'înainte de demo' })), ...late.map((r) => ({ ...r, cand: 'în demo' }))];
    return external.length === 0 || `cereri externe: ${external.map((r) => `${r.url} (${r.page}, ${r.cand})`).join(', ')}`;
  });

  dash.ws.close();
  panel.ws.close();
} catch (e) {
  results.push({ name: 'Pornire', ok: false, ms: 0, detail: e.message });
} finally {
  proc.kill();
  await wait(700);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

const total = results.reduce((s, r) => s + r.ms, 0);
console.log('\nRepetiția demo-ului RentSmart (fără internet, mod demonstrativ)\n');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.ms).padStart(5)} ms  ${r.name}${r.detail ? `  → ${r.detail}` : ''}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} pași reușiți · ${requests.length} cereri înregistrate, niciuna externă în modul demo · ${(total / 1000).toFixed(1)} s (automat)`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
