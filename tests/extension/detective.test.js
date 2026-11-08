import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestions, runDetective } from '../../extension/src/ai/detective.js';
import { composeLandlordMessage, extractListing, prepareListingText } from '../../extension/src/ai/client.js';
import { manualReason, MANUAL_FALLBACK } from '../../extension/src/ai/errors.js';
import { createListingAnalysis, setUserValue, clearField } from '../../extension/src/shared/contracts/factories.js';
import { ContractError, validateListingAnalysis } from '../../extension/src/shared/contracts/schemas.js';
import { parseEditorValue } from '../../extension/src/ui/fieldInput.js';
import { formatFieldValue } from '../../extension/src/shared/fields.js';
import { demoListingA, demoListingB, demoListingTextA, demoListingTextB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const NOW = new Date('2027-01-02T10:00:00.000Z');
const deps = (api) => ({ api, installId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', now: () => NOW, newId: () => 'id-1' });
const AI_ON = { modDemo: false, acordAI: true };

function fakeApi(result) {
  const calls = [];
  return {
    calls,
    async extractListing(text, opts) {
      calls.push({ text, opts });
      return typeof result === 'function' ? result(text) : result;
    },
  };
}

test('modul demo: răspunsul înregistrat, fără rețea, etichetat demonstrativ', async () => {
  const api = fakeApi(null);
  for (const [text, expected] of [[demoListingTextA, demoListingA], [demoListingTextB, demoListingB]]) {
    const r = await runDetective({ text, tip: 'pagina', url: 'http://localhost:5174/x', setari: { modDemo: true, acordAI: false } }, deps(api));
    assert.equal(r.mod, 'demo');
    assert.equal(r.analiza.demonstrativ, true);
    assert.equal(r.analiza.sursa.tip, 'demo');
    assert.deepEqual(r.analiza.campuri, expected.campuri);
    assert.deepEqual(r.retrogradate, []);
    assert.ok(validateListingAnalysis(r.analiza).ok);
  }
  assert.equal(api.calls.length, 0);
  // Același id ca anunțul demo salvat: panoul și dashboard-ul arată același apartament, cu aceleași cifre.
  const again = await runDetective({ text: demoListingTextA, tip: 'pagina', setari: { modDemo: true, acordAI: false } }, deps(api));
  assert.equal(again.analiza.id, 'demo-a');
  const unknown = await runDetective({ text: 'Alt anunț', tip: 'text_lipit', setari: { modDemo: true, acordAI: true } }, deps(api));
  assert.equal(unknown.mod, 'manual');
  assert.equal(unknown.eroare, 'DEMO_FARA_INREGISTRARE');
  assert.equal(unknown.analiza.demonstrativ, false);
});

test('fără acord: doar modul manual, nimic nu pleacă la AI', async () => {
  const api = fakeApi({ ok: true, data: {} });
  const r = await runDetective({ text: demoListingTextB, tip: 'pagina', setari: { modDemo: false, acordAI: false } }, deps(api));
  assert.equal(r.mod, 'manual');
  assert.equal(r.eroare, 'FARA_ACORD');
  assert.equal(api.calls.length, 0);
  assert.ok(Object.values(r.analiza.campuri).every((f) => f.status === 'lipsa'));
  // AI-ul deja indisponibil (health): motivul real are prioritate față de lipsa acordului.
  const down = await runDetective({ text: 'x', tip: 'pagina', setari: { modDemo: false, acordAI: false }, aiIndisponibil: 'NOT_CONFIGURED' }, deps(api));
  assert.equal(down.eroare, 'NOT_CONFIGURED');
  assert.equal(api.calls.length, 0);
});

test('analiza AI: telefonul e ascuns înainte de trimitere; dovezile se verifică din nou pe client', async () => {
  const campuri = structuredClone(demoListingA.campuri);
  campuri.reparatii = { status: 'gasit', valoare: 'Proprietarul', dovada: 'reparațiile sunt ale proprietarului', actualizatLa: null, nota: null };
  const api = fakeApi({ ok: true, data: { titlu: 'Garsonieră', campuri, campuriRetrogradate: ['comision'] } });
  const r = await runDetective({ text: demoListingTextA, tip: 'pagina', url: 'https://u', setari: AI_ON }, deps(api));
  assert.ok(api.calls[0].text.includes('[TELEFON]') && !api.calls[0].text.includes('0722'));
  assert.equal(api.calls[0].opts.installId, '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e');
  assert.equal(r.mod, 'ai');
  assert.equal(r.analiza.campuri.reparatii.status, 'lipsa'); // dovadă inventată → De întrebat (stratul 3)
  assert.deepEqual(r.retrogradate.sort(), ['comision', 'reparatii']);
  assert.equal(r.analiza.campuri.chirie.status, 'gasit');
  assert.deepEqual(r.analiza.sursa, { tip: 'pagina', url: 'https://u', analizatLa: NOW.toISOString() });
  assert.equal(r.analiza.demonstrativ, false);
});

test('erorile AI duc la modul manual, cu toate câmpurile „De întrebat” și mesajul potrivit', async () => {
  for (const code of ['AI_UNAVAILABLE', 'TIMEOUT', 'RATE_LIMITED', 'NOT_CONFIGURED']) {
    const r = await runDetective({ text: demoListingTextB, tip: 'pagina', setari: AI_ON }, deps(fakeApi({ ok: false, code })));
    assert.equal(r.mod, 'manual');
    assert.equal(r.eroare, code);
    assert.ok(Object.values(r.analiza.campuri).every((f) => f.status === 'lipsa'));
  }
  assert.equal(manualReason('TIMEOUT'), MANUAL_FALLBACK);
  assert.equal(manualReason('TIMEOUT'), 'Analiza AI nu este disponibilă acum. Poți completa manual.');
  assert.match(manualReason('NOT_CONFIGURED'), /nu este disponibilă/);
  // Răspuns care nu respectă contractul → INVALID_RESPONSE.
  const broken = await runDetective({ text: 'x', tip: 'pagina', setari: AI_ON }, deps(fakeApi({ ok: true, data: { campuri: { chirie: {} } } })));
  assert.equal(broken.eroare, 'INVALID_RESPONSE');
});

test('textul scurt se analizează oricum, cu sugestia; textul prea lung e limitat', async () => {
  const api = fakeApi({ ok: false, code: 'AI_UNAVAILABLE' });
  const r = await runDetective({ text: 'Garsonieră 300 €', tip: 'pagina', setari: AI_ON }, deps(api));
  assert.equal(r.scurt, true);
  assert.equal(api.calls.length, 1);
  await runDetective({ text: 'a'.repeat(20000), tip: 'text_lipit', setari: AI_ON }, deps(api));
  assert.equal(api.calls[1].text.length, 15000);
  assert.equal(prepareListingText('Sună la 0722 123 456 sau a@b.ro'), 'Sună la [TELEFON] sau [EMAIL]');
});

test('întrebările: mesaj AI din numele câmpurilor; la eroare, șablonul', async () => {
  const seen = [];
  const ok = { composeLandlordMessage: async (f) => (seen.push(f), { ok: true, data: { mesaj: ' Bună ziua! ' } }) };
  const q = await buildQuestions(demoListingA, { useAI: true, api: ok });
  assert.equal(q.sursaMesaj, 'ai');
  assert.equal(q.mesaj, 'Bună ziua!');
  assert.deepEqual(seen[0], ['intretinereVara', 'intretinereIarna', 'utilitatiIncluse', 'comision', 'reparatii']);
  const failing = { composeLandlordMessage: async () => ({ ok: false, code: 'TIMEOUT' }) };
  const t = await buildQuestions(demoListingA, { useAI: true, api: failing });
  assert.equal(t.sursaMesaj, 'sablon');
  assert.match(t.mesaj, /^Bună ziua!\n/);
  const offline = await buildQuestions(demoListingA, { useAI: false, api: { composeLandlordMessage: () => assert.fail('fără rețea') } });
  assert.equal(offline.sursaMesaj, 'sablon');
  const all = structuredClone(demoListingB);
  all.campuri.utilitatiIncluse = { status: 'confirmat', valoare: false, dovada: null, actualizatLa: NOW.toISOString(), nota: null };
  assert.deepEqual(await buildQuestions(all, { useAI: true, api: ok }), { intrebari: [], mesaj: '', sursaMesaj: 'niciunul' });
});

test('clientul AI: antetul cu ID-ul instalării, corpul cererii și erorile de rețea', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ ok: true, task: 'extract', data: { campuri: {} } }), { status: 200 });
  };
  const r = await extractListing('text', { baseUrl: 'http://api', fetchImpl, installId: 'abc' });
  assert.equal(r.ok, true);
  assert.equal(seen[0].url, 'http://api/api/analyze');
  assert.equal(seen[0].init.headers['x-install-id'], 'abc');
  assert.deepEqual(JSON.parse(seen[0].init.body), { task: 'extract', text: 'text' });
  const err = await composeLandlordMessage(['comision'], {
    baseUrl: 'http://api',
    installId: 'abc',
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: { code: 'RATE_LIMITED' } }), { status: 429 }),
  });
  assert.deepEqual(err, { ok: false, code: 'RATE_LIMITED' });
  const offline = await extractListing('t', { baseUrl: 'http://api', installId: 'a', fetchImpl: async () => { throw new TypeError('x'); } });
  assert.deepEqual(offline, { ok: false, code: 'AI_UNAVAILABLE' });
  assert.deepEqual(await extractListing('t', { baseUrl: '', installId: 'a' }), { ok: false, code: 'NOT_CONFIGURED' });
});

test('completarea manuală: valorile utilizatorului sunt „confirmat” / „presupus”, validate', () => {
  const a = createListingAnalysis({ id: 'm', tip: 'text_lipit', analizatLa: NOW.toISOString() });
  assert.ok(validateListingAnalysis(a).ok);
  const at = NOW.toISOString();
  const b = setUserValue(a, 'chirie', { status: 'confirmat', valoare: 1800, moneda: 'RON', nota: 'mi-a scris pe WhatsApp', actualizatLa: at });
  assert.deepEqual(b.campuri.chirie, { status: 'confirmat', valoare: 1800, dovada: null, actualizatLa: at, nota: 'mi-a scris pe WhatsApp', moneda: 'RON' });
  const c = setUserValue(b, 'garantie', { status: 'presupus', valoare: 2, unitate: 'luni_chirie', moneda: 'EUR', actualizatLa: at });
  assert.equal(c.campuri.garantie.moneda, null);
  assert.equal(formatFieldValue('garantie', c.campuri.garantie), '2 chirii');
  assert.throws(() => setUserValue(a, 'chirie', { status: 'confirmat', valoare: -5, moneda: 'RON', actualizatLa: at }), ContractError);
  assert.throws(() => setUserValue(a, 'chirie', { status: 'confirmat', valoare: 0, moneda: 'RON', actualizatLa: at }), ContractError);
  assert.throws(() => setUserValue(a, 'chirie', { status: 'gasit', valoare: 5, moneda: 'RON', actualizatLa: at }), RangeError);
  assert.throws(() => setUserValue(a, 'mobilat', { status: 'presupus', valoare: 'da', actualizatLa: at }), ContractError);
  assert.equal(clearField(c, 'chirie').campuri.chirie.status, 'lipsa');
});

test('formularul unui câmp: numere în format românesc, Da/Nu, text', () => {
  assert.equal(parseEditorValue('money', '1.950'), 1950);
  assert.equal(parseEditorValue('money', '1 950'), 1950);
  assert.equal(parseEditorValue('money', '350,5'), 350.5);
  assert.equal(parseEditorValue('number', '12'), 12);
  assert.equal(parseEditorValue('boolean', 'nu'), false);
  assert.equal(parseEditorValue('text', '  proprietarul  '), 'proprietarul');
  for (const [type, raw] of [['money', ''], ['money', '-3'], ['money', 'abc'], ['boolean', ''], ['text', '  ']]) {
    assert.throws(() => parseEditorValue(type, raw), Error, `${type}: ${raw}`);
  }
  assert.equal(formatFieldValue('chirie', demoListingA.campuri.chirie), '350 EUR');
  assert.equal(formatFieldValue('chirie', demoListingB.campuri.chirie), '1.950 RON');
  assert.equal(formatFieldValue('comision', demoListingB.campuri.comision), '0 RON');
  assert.equal(formatFieldValue('mobilat', demoListingB.campuri.mobilat), 'Nu');
  assert.equal(formatFieldValue('durataContractLuni', demoListingB.campuri.durataContractLuni), '12 luni');
  assert.equal(formatFieldValue('comision', { valoare: 50, unitate: 'procent_chirie' }), '50% din chirie');
  assert.equal(formatFieldValue('comision', demoListingA.campuri.comision), null);
});
