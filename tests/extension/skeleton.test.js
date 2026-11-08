import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildManifest } from '../../vite.config.js';
import { isInjectable } from '../../extension/src/content/inject.js';
import { checkHealth, NOT_CONFIGURED } from '../../extension/src/ai/client.js';
import { errorMessage, MANUAL_FALLBACK, NOT_CONFIGURED_MESSAGE } from '../../extension/src/ai/errors.js';
import { demoListingTextA, demoListingTextB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

test('manifest MV3: doar permisiunile minime; host_permissions doar pentru cursul BNR și backend', () => {
  const m = buildManifest('');
  const BNR = 'https://www.cursbnr.ro/*';
  assert.equal(m.manifest_version, 3);
  assert.deepEqual([...m.permissions].sort(), ['activeTab', 'scripting', 'sidePanel', 'storage']);
  assert.deepEqual(m.host_permissions, [BNR]);
  assert.equal(m.content_scripts, undefined); // injectare doar la cerere (activeTab) sau înregistrare dinamică
  // Analiza automată: permisiuni OPȚIONALE, doar pentru site-urile de anunțuri (cerute la activarea setării).
  assert.deepEqual(m.optional_host_permissions, ['https://*.olx.ro/*', 'https://*.storia.ro/*', 'https://*.imobiliare.ro/*', 'https://*.publi24.ro/*', 'https://*.homezz.ro/*']);
  assert.deepEqual(buildManifest('https://rascruce.vercel.app/').host_permissions, [BNR, 'https://rascruce.vercel.app/*']);
  assert.deepEqual(buildManifest('http://localhost:3000').host_permissions, [BNR, 'http://localhost:3000/*']);
  // Fișierele referite există în sursă.
  assert.ok(existsSync(path.join(root, 'extension', m.side_panel.default_path)));
  assert.equal(m.background.service_worker, 'background.js');
  // Iconițele referite există (PNG valid: semnătura \x89PNG).
  for (const p of [...Object.values(m.icons), ...Object.values(m.action.default_icon)]) {
    const file = readFileSync(path.join(root, 'extension', p));
    assert.equal(file.subarray(1, 4).toString(), 'PNG', p);
  }
  assert.equal(m.background.type, 'module');
});

test('cheia API nu apare niciodată în codul extensiei', () => {
  for (const f of ['extension/src/config.js', 'extension/src/ai/client.js']) {
    assert.ok(!/AI_API_KEY|sk-ant-/.test(read(f)), f);
  }
});

test('paginile unde injectarea nu e permisă sunt recunoscute', () => {
  assert.equal(isInjectable('https://www.olx.ro/d/oferta/garsoniera-IDabc.html'), true);
  assert.equal(isInjectable('https://www.storia.ro/ro/oferta/apartament-ID123'), true);
  assert.equal(isInjectable('http://localhost:5174/anunt-a.html'), true);
  assert.equal(isInjectable('chrome://extensions'), false);
  assert.equal(isInjectable('https://chromewebstore.google.com/detail/x'), false);
  assert.equal(isInjectable('https://exemplu.ro/contract.pdf'), false);
  assert.equal(isInjectable('file:///C:/anunt.html'), false);
  assert.equal(isInjectable(undefined), true);
});

test('checkHealth: neconfigurat, disponibil, eroare tipizată, fără rețea — nu aruncă niciodată', async () => {
  assert.deepEqual(await checkHealth({ baseUrl: '' }), { ok: false, code: NOT_CONFIGURED });
  const reply = (status, body) => async () => new Response(JSON.stringify(body), { status });
  assert.deepEqual(await checkHealth({ baseUrl: 'http://x', fetchImpl: reply(200, { ok: true, model: 'm' }) }), { ok: true, model: 'm' });
  assert.deepEqual(
    await checkHealth({ baseUrl: 'http://x', fetchImpl: reply(503, { ok: false, error: { code: 'MODEL_UNAVAILABLE' } }) }),
    { ok: false, code: 'MODEL_UNAVAILABLE' },
  );
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await checkHealth({ baseUrl: 'http://x', fetchImpl: offline }), { ok: false, code: 'AI_UNAVAILABLE' });
  const slow = async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); };
  assert.deepEqual(await checkHealth({ baseUrl: 'http://x', fetchImpl: slow }), { ok: false, code: 'TIMEOUT' });
});

test('mesajele de eroare: neconfigurat → „Analiza AI nu este configurată”, altfel modul manual', () => {
  assert.equal(errorMessage(NOT_CONFIGURED), NOT_CONFIGURED_MESSAGE);
  assert.equal(errorMessage('MODEL_UNAVAILABLE'), NOT_CONFIGURED_MESSAGE);
  assert.equal(errorMessage('AUTH_ERROR'), NOT_CONFIGURED_MESSAGE);
  assert.equal(errorMessage('INVALID_RESPONSE'), MANUAL_FALLBACK);
});

test('demo-site: anunțurile conțin exact textele scenariului demo și sunt marcate demonstrative', () => {
  const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const [file, text] of [['demo-site/anunt-a.html', demoListingTextA], ['demo-site/anunt-b.html', demoListingTextB]]) {
    const html = read(file);
    for (const line of text.split('\n')) assert.ok(plain(html).includes(line.trim()), `${file}: ${line}`);
    assert.ok(html.includes('DATE DEMONSTRATIVE'));
    assert.ok(!/olx|storia/i.test(html), `${file} nu imită alte site-uri`);
  }
  assert.match(read('package.json'), /"demo-site": "vite demo-site --port 5174 --strictPort"/);
});
