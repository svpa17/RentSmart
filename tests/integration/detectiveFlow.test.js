// Integrare: clientul extensiei ↔ handler-ul real al backend-ului (în proces), cu un furnizor AI simulat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createAnalyzeHandler } from '../../api/_lib/handlers.js';
import { createMemoryStore } from '../../api/_lib/rateLimit.js';
import { composeLandlordMessage, extractListing } from '../../extension/src/ai/client.js';
import { buildQuestions, runDetective } from '../../extension/src/ai/detective.js';
import { readPage } from '../../extension/src/content/readPage.js';
import { validateListingAnalysis } from '../../extension/src/shared/contracts/schemas.js';

const root = path.resolve(import.meta.dirname, '..', '..');
const INSTALL = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const ENV = { AI_API_KEY: 'k', AI_MODEL: 'm', ALLOWED_ORIGINS: 'http://localhost:5174' };

/** Furnizor simulat: „citește” anunțul B ca un model bun, plus o dovadă inventată. */
function provider() {
  const seen = [];
  return {
    seen,
    async generateJson({ user, schemaName }) {
      seen.push({ user, schemaName });
      if (schemaName === 'landlord_message') return { mesaj: 'Bună ziua! Utilitățile sunt incluse în chirie?' };
      const f = (status, valoare, dovada, extra = {}) => ({ status, valoare, dovada, ...extra });
      return {
        titlu: 'Apartament 2 camere Gheorgheni',
        campuri: {
          chirie: f('gasit', 1950, 'Chirie 1.950 lei/lună', { moneda: 'RON' }),
          intretinereVara: f('gasit', 250, 'aproximativ 250 lei vara', { moneda: 'RON' }),
          intretinereIarna: f('gasit', 350, '350 lei iarna', { moneda: 'RON' }),
          utilitatiIncluse: f('lipsa', null, ''),
          garantie: f('gasit', 1, 'Garanție o chirie', { moneda: 'necunoscut', unitate: 'luni_chirie' }),
          comision: f('gasit', 0, 'Fără comision', { moneda: 'RON', unitate: 'suma' }),
          durataContractLuni: f('gasit', 12, 'Contract pe minimum 12 luni'),
          reparatii: f('gasit', 'proprietarul', 'Reparațiile majore sunt suportate de proprietar'),
          mobilat: f('gasit', true, 'complet mobilat și utilat'), // inventat: anunțul spune „nemobilat”
          suprafataMp: f('gasit', 48, 'Suprafață 48 mp'),
          localitate: f('gasit', 'Cluj-Napoca', 'zona Gheorgheni, Cluj-Napoca'),
        },
      };
    },
  };
}

test('flux complet: pagina demo → citire → backend → validare + dovezi (server și client) → întrebări + mesaj AI', async () => {
  const p = provider();
  const handler = createAnalyzeHandler({ env: ENV, provider: p, store: createMemoryStore(), log: () => {} });
  const fetchImpl = (url, init) => handler.POST(new Request(url, init));
  const api = {
    extractListing: (text, o) => extractListing(text, { ...o, baseUrl: 'http://api.local', fetchImpl }),
    composeLandlordMessage: (f, o) => composeLandlordMessage(f, { ...o, baseUrl: 'http://api.local', fetchImpl }),
  };

  const { document } = parseHTML(readFileSync(path.join(root, 'demo-site', 'anunt-b.html'), 'utf8'));
  Object.defineProperty(document, 'location', { value: { href: 'http://localhost:5174/anunt-b.html' } });
  const page = readPage(document);

  const det = await runDetective(
    { text: page.text, tip: 'pagina', url: page.url, titlu: page.titlu, setari: { modDemo: false, acordAI: true } },
    { api, installId: INSTALL },
  );
  assert.equal(det.mod, 'ai');
  assert.ok(validateListingAnalysis(det.analiza).ok);
  assert.equal(det.analiza.campuri.chirie.valoare, 1950);
  assert.equal(det.analiza.campuri.garantie.moneda, null);
  assert.equal(det.analiza.campuri.mobilat.status, 'lipsa'); // dovada inventată → De întrebat
  assert.deepEqual(det.retrogradate, ['mobilat']);

  const q = await buildQuestions(det.analiza, { useAI: true, api, installId: INSTALL });
  assert.deepEqual(q.intrebari.map((x) => x.campuri), [['utilitatiIncluse'], ['mobilat']]);
  assert.equal(q.sursaMesaj, 'ai');
  // La AI au plecat doar: textul anunțului și numele câmpurilor lipsă.
  assert.equal(p.seen[1].user, 'Informații de cerut:\n- dacă utilitățile sunt incluse în chirie\n- dacă apartamentul este mobilat');
});

test('flux complet: backend-ul limitează cererile → modul manual, mesajul din șablon', async () => {
  const handler = createAnalyzeHandler({
    env: { ...ENV, RATE_LIMIT_PER_MINUTE_IP: '1' },
    provider: provider(),
    store: createMemoryStore(),
    log: () => {},
  });
  const fetchImpl = (url, init) => handler.POST(new Request(url, init));
  const api = {
    extractListing: (t, o) => extractListing(t, { ...o, baseUrl: 'http://api.local', fetchImpl }),
    composeLandlordMessage: (f, o) => composeLandlordMessage(f, { ...o, baseUrl: 'http://api.local', fetchImpl }),
  };
  const first = await runDetective({ text: 'Garsonieră 400 €', tip: 'text_lipit', setari: { modDemo: false, acordAI: true } }, { api, installId: INSTALL });
  assert.equal(first.mod, 'ai');
  const second = await runDetective({ text: 'Garsonieră 400 €', tip: 'text_lipit', setari: { modDemo: false, acordAI: true } }, { api, installId: INSTALL });
  assert.equal(second.mod, 'manual');
  assert.equal(second.eroare, 'RATE_LIMITED');
  const q = await buildQuestions(second.analiza, { useAI: true, api, installId: INSTALL });
  assert.equal(q.sursaMesaj, 'sablon');
  assert.equal(q.intrebari.length, 10);
});
