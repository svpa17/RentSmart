// Analiza automată la navigare: detectare, deduplicare, cache, concurență, curse între anunțuri, limite AI.
// Folosește memoria reală a analizelor (storage/analysisCache.js) peste un chrome.storage simulat.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AI_PAUSE_KEY, RATE_LIMIT_PAUSE_MS, TAB_STATE_KEY, createAutoAnalyzer } from '../../extension/src/auto/analyzer.js';
import { AUTO_PERMISSIONS, isAutoListingUrl } from '../../extension/src/auto/sites.js';
import * as cache from '../../extension/src/storage/analysisCache.js';
import { createListingAnalysis } from '../../extension/src/shared/contracts/factories.js';

function fakeChromeStorage() {
  let data = {};
  return {
    storage: {
      local: {
        async get(keys) {
          const ks = keys == null ? Object.keys(data) : [].concat(keys);
          return Object.fromEntries(ks.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v);
        },
      },
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
}

const A = 'https://www.storia.ro/ro/oferta/apartament-2-camere-zorilor-IDabc';
const B = 'https://www.storia.ro/ro/oferta/garsoniera-marasti-IDdef';
const C = 'https://homezz.ro/apartament-2-camere-iris-4278459.html';
const SEARCH = 'https://www.storia.ro/ro/rezultate/inchiriere/apartament/cluj/cluj--napoca';

/** Un mediu de test complet: taburi, pagini, AI simulat, timere manuale. */
function setup({ settings = { analizaAutomata: true, modDemo: false, acordAI: true }, analyze } = {}) {
  let clock = Date.parse('2026-11-08T10:00:00.000Z');
  const tabs = new Map();
  const session = new Map();
  const timers = [];
  const calls = { read: 0, analyze: [] };
  let views = 0;
  const env = {
    tabs,
    calls,
    session,
    settings,
    advance: (ms) => (clock += ms),
    /** Rulează toate timerele de debounce programate. */
    async flush() {
      while (timers.length) await timers.shift().fn();
    },
    analyzer: null,
  };
  env.analyzer = createAutoAnalyzer({
    getSettings: async () => env.settings,
    getTab: async (id) => (tabs.has(id) ? { id, url: tabs.get(id) } : null),
    readTab: async (id) => {
      calls.read += 1;
      const url = tabs.get(id);
      views += 1; // pagina are un contor de vizualizări: textul diferă la fiecare citire
      const pareAnunt = !url.includes('nu-e-anunt');
      return { ok: true, data: { url, titlu: `Titlu ${url.slice(-6)}`, text: `Chirie 450 € pe lună. ${url}. Vizualizări: ${views}`, pareAnunt, imagine: null, metoda: 'storia' } };
    },
    analyze:
      analyze ??
      (async (input) => {
        calls.analyze.push(input.url);
        const analiza = createListingAnalysis({ id: `id-${calls.analyze.length}`, tip: 'pagina', url: input.url, analizatLa: new Date(clock).toISOString(), titlu: input.titlu });
        return { analiza, mod: 'ai', eroare: null, retrogradate: [], scurt: false, intrebari: [], mesaj: '', sursaMesaj: 'niciunul' };
      }),
    cache,
    session: { get: async (k) => session.get(k), set: async (k, v) => session.set(k, structuredClone(v)) },
    now: () => clock,
    setTimer: (fn, ms) => {
      const t = { fn, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      const i = timers.indexOf(t);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  env.state = (tabId) => session.get(TAB_STATE_KEY)?.[tabId] ?? null;
  env.go = async (tabId, url) => {
    tabs.set(tabId, url);
    env.analyzer.notify(tabId);
    await env.flush();
  };
  return env;
}

beforeEach(() => {
  globalThis.chrome = fakeChromeStorage();
});

test('primul anunț: detectat, citit și analizat o dată; rezultatul e în cache, legat de tab', async () => {
  const e = setup();
  await e.go(1, A);
  assert.deepEqual(e.calls.analyze, [A]);
  const s = e.state(1);
  assert.equal(s.stare, 'gata');
  assert.ok(s.cheie.startsWith('ai|'));
  assert.equal((await cache.findAnalysis(s.cheie)).analiza.sursa.url, A);
});

test('reîncărcare, evenimente duble și comutarea taburilor nu trimit o nouă cerere AI', async () => {
  const e = setup();
  await e.go(1, A);
  await e.go(1, A); // reîncărcare (alt contor de vizualizări în text)
  e.analyzer.notify(1); // tab activat din nou
  await e.flush();
  assert.equal(e.calls.analyze.length, 1);
  assert.equal(e.calls.read, 1);
  // Alt tab cu același anunț: cache pe URL, fără citire și fără AI.
  await e.go(2, A);
  assert.equal(e.calls.analyze.length, 1);
  assert.equal(e.state(2).stare, 'gata');
  assert.equal(e.state(2).cheie, e.state(1).cheie);
});

test('debounce: o rafală de evenimente de navigare = o singură procesare', async () => {
  const e = setup();
  e.tabs.set(1, A);
  for (let i = 0; i < 5; i += 1) e.analyzer.notify(1);
  await e.flush();
  assert.equal(e.calls.read, 1);
  assert.equal(e.calls.analyze.length, 1);
});

test('A → B → înapoi la A: B se analizează, A vine din cache (fără AI)', async () => {
  const e = setup();
  await e.go(1, A);
  await e.go(1, B);
  assert.deepEqual(e.calls.analyze, [A, B]);
  assert.equal(e.state(1).urlKey, B);
  await e.go(1, A);
  assert.deepEqual(e.calls.analyze, [A, B]);
  assert.equal(e.state(1).urlKey, A);
  assert.equal(e.state(1).stare, 'gata');
});

test('alt site acceptat (HomeZZ), pagini care nu sunt anunțuri și site-uri neacceptate', async () => {
  const e = setup();
  await e.go(1, C);
  assert.deepEqual(e.calls.analyze, [C]);
  await e.go(1, SEARCH); // pagină de căutare pe Storia: nu se citește, nu se analizează
  assert.equal(e.state(1).stare, 'ignorat');
  await e.go(1, 'https://www.storia.ro/ro/oferta/nu-e-anunt-IDx'); // URL de anunț, dar pagina nu e de închiriat
  assert.equal(e.state(1).stare, 'nu-e-anunt');
  await e.go(1, 'https://example.com/ceva'); // site neacceptat: nicio stare
  assert.equal(e.state(1), null);
  assert.equal(e.calls.analyze.length, 1);
});

test('cursă: utilizatorul pleacă de pe A înainte să fie gata → rezultatul A nu înlocuiește anunțul curent', async () => {
  let release;
  const slow = new Promise((r) => (release = r));
  const calls = [];
  const e = setup({
    analyze: async (input) => {
      calls.push(input.url);
      if (input.url === A) await slow;
      return { analiza: createListingAnalysis({ id: input.url, tip: 'pagina', url: input.url, analizatLa: '2026-11-08T10:00:00.000Z', titlu: input.titlu }), mod: 'ai', eroare: null, retrogradate: [], scurt: false, intrebari: [], mesaj: '', sursaMesaj: 'niciunul' };
    },
  });
  e.tabs.set(1, A);
  const pA = e.analyzer._process(1); // analiza A pornește și așteaptă AI-ul
  await new Promise((r) => setImmediate(r));
  e.tabs.set(1, B);
  const pB = e.analyzer._process(1); // B intră în coadă (o singură analiză AI odată)
  await new Promise((r) => setImmediate(r));
  assert.equal(e.state(1).urlKey, B);
  release();
  await Promise.all([pA, pB]);
  assert.deepEqual(calls, [A, B]); // în ordine, nu în paralel
  assert.equal(e.state(1).urlKey, B); // A nu a suprascris B
  assert.equal(e.state(1).stare, 'gata');
  assert.ok(await cache.findAnalysisByUrl(A, { now: Date.parse('2026-11-08T10:00:00.000Z') })); // A a rămas util în cache
});

test('același anunț în două taburi simultan → o singură cerere AI', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  let n = 0;
  const e = setup({
    analyze: async (input) => {
      n += 1;
      await gate;
      return { analiza: createListingAnalysis({ id: 'x', tip: 'pagina', url: input.url, analizatLa: '2026-11-08T10:00:00.000Z' }), mod: 'ai', eroare: null, retrogradate: [], scurt: false, intrebari: [], mesaj: '', sursaMesaj: 'niciunul' };
    },
  });
  e.tabs.set(1, A);
  e.tabs.set(2, A);
  const p1 = e.analyzer._process(1);
  const p2 = e.analyzer._process(2);
  await new Promise((r) => setImmediate(r));
  release();
  await Promise.all([p1, p2]);
  assert.equal(n, 1);
  assert.equal(e.state(1).stare, 'gata');
  assert.equal(e.state(2).stare, 'gata');
});

test('limita AI (429): pauză fără reîncercări automate; doar „Încearcă din nou” forțează', async () => {
  let n = 0;
  const e = setup({
    analyze: async (input) => {
      n += 1;
      const manual = n === 1;
      return {
        analiza: createListingAnalysis({ id: `m${n}`, tip: 'pagina', url: input.url, analizatLa: '2026-11-08T10:00:00.000Z' }),
        mod: manual ? 'manual' : 'ai',
        eroare: manual ? 'RATE_LIMITED' : null,
        retrogradate: [],
        scurt: false,
        intrebari: [],
        mesaj: '',
        sursaMesaj: 'sablon',
      };
    },
  });
  await e.go(1, A);
  assert.equal(n, 1);
  assert.equal(e.state(1).stare, 'gata'); // rezultatul manual (completare), cu motivul
  assert.equal(e.state(1).cod, 'RATE_LIMITED');
  assert.ok(e.session.get(AI_PAUSE_KEY) > Date.parse('2026-11-08T10:00:00.000Z'));
  assert.equal(await cache.findAnalysisByUrl(A), null); // eșecul nu intră în cache
  await e.go(1, A); // reîncărcare: nu reîncearcă
  await e.go(1, B); // alt anunț în pauză: nicio cerere
  assert.equal(n, 1);
  assert.equal(e.state(1).stare, 'amanat');
  await e.analyzer.analyzeNow(1); // „Încearcă din nou”
  assert.equal(n, 2);
  assert.equal(e.state(1).stare, 'gata');
  // După pauză, analiza automată reia singură.
  e.advance(RATE_LIMIT_PAUSE_MS + 1);
  await e.go(1, C);
  assert.equal(n, 3);
});

test('cache-ul pe URL expiră după 24 h (prețul se poate schimba); „Încearcă din nou” ignoră cache-ul', async () => {
  const e = setup();
  await e.go(1, A);
  await e.analyzer.analyzeNow(1);
  assert.equal(e.calls.analyze.length, 2);
  e.advance(25 * 60 * 60 * 1000);
  await e.go(2, A);
  assert.equal(e.calls.analyze.length, 3);
});

test('setarea oprită sau modul demonstrativ: nicio citire, nicio cerere AI', async () => {
  const off = setup({ settings: { analizaAutomata: false, modDemo: false } });
  await off.go(1, A);
  const demo = setup({ settings: { analizaAutomata: true, modDemo: true } });
  await demo.go(1, A);
  assert.equal(off.calls.read + demo.calls.read, 0);
  assert.equal(off.calls.analyze.length + demo.calls.analyze.length, 0);
});

test('o analiză „în curs” rămasă de la un service worker oprit se reia după 2 minute', async () => {
  const e = setup();
  e.tabs.set(1, A);
  e.session.set(TAB_STATE_KEY, { 1: { url: A, urlKey: A, stare: 'analiza', gen: 0, actualizatLa: '2026-11-08T09:50:00.000Z' } });
  e.analyzer.notify(1);
  await e.flush();
  assert.equal(e.calls.analyze.length, 1);
});

test('paginile de anunț pe site-urile acceptate (URL-uri reale), nu căutările; permisiuni doar pentru acestea', () => {
  for (const u of [
    'https://www.storia.ro/ro/oferta/1-camera-zorilor-IDJ9lY',
    'https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/apartamente-2-camere/anunt/apartament-2-camere-de-inchiriat-iulius-fsega-50-mp-loc-parcare/5809h8671d287edee704g988h52696d0.html',
    'https://homezz.ro/2-camere-46-mp-loc-parcare-balcon-aproape-de-centru-4278459.html',
    'https://www.olx.ro/d/oferta/apartament-2-camere-IDabc12.html',
    'https://www.imobiliare.ro/oferta/apartament-de-inchiriat-cluj-123',
  ])
    assert.equal(isAutoListingUrl(u), true, u);
  for (const u of [
    'https://www.storia.ro/ro/rezultate/inchiriere/apartament/cluj/cluj--napoca',
    'https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/cluj/',
    'https://homezz.ro/inchiriere-apartamente/cluj-napoca-cj',
    'https://www.olx.ro/imobiliare/apartamente-garsoniere-de-inchiriat/',
    'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/anunt/x/abc.html',
    'https://example.com/oferta/x',
    'chrome://extensions',
  ])
    assert.equal(isAutoListingUrl(u), false, u);
  assert.deepEqual(AUTO_PERMISSIONS, ['https://*.olx.ro/*', 'https://*.storia.ro/*', 'https://*.imobiliare.ro/*', 'https://*.publi24.ro/*', 'https://*.homezz.ro/*']);
});
