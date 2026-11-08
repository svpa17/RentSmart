import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { createAnalyzeHandler, createHealthHandler } from '../../api/_lib/handlers.js';
import { loadConfig } from '../../api/_lib/config.js';
import { ApiError, AI_ERROR_CODES as C } from '../../api/_lib/errors.js';
import { createMemoryStore, createUpstashStore, createRateLimiter } from '../../api/_lib/rateLimit.js';
import { createAnthropicProvider } from '../../api/_lib/providers/anthropic.js';
import { createOpenAICompatibleProvider } from '../../api/_lib/providers/openaiCompatible.js';
import { EXTRACT_SCHEMA, MESSAGE_SCHEMA, STORM_SCHEMA } from '../../api/_lib/outputSchemas.js';
import { normalizeStorm, validateAnalyzeRequest } from '../../api/_lib/validate.js';
import { demoListingTextA } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const EXT = 'chrome-extension://abcdefghijklmnop';
const INSTALL = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const ENV = {
  AI_PROVIDER: 'anthropic',
  AI_API_KEY: 'test-key',
  AI_MODEL: 'test-model',
  ALLOWED_ORIGINS: `${EXT},http://localhost:5174`,
  RATE_LIMIT_PER_MINUTE_IP: '3',
  RATE_LIMIT_PER_DAY_INSTALL: '5',
  GLOBAL_DAILY_REQUEST_CAP: '8',
};

const field = (status, valoare, dovada, extra = {}) => ({ status, valoare, dovada, ...extra });
const lipsa = (extra = {}) => field('lipsa', null, '', extra);
const MONEY_NONE = { moneda: 'necunoscut' };

/** Ieșirea AI pentru anunțul A: corectă, cu un comision cu dovadă inventată. */
function extractionA() {
  return {
    titlu: 'Garsonieră Mănăștur',
    campuri: {
      chirie: field('gasit', 350, 'Preț: 350 EUR/lună', { moneda: 'EUR' }),
      intretinereVara: lipsa(MONEY_NONE),
      intretinereIarna: lipsa(MONEY_NONE),
      utilitatiIncluse: lipsa(),
      garantie: field('gasit', 2, 'Se cer 2 chirii garanție', { moneda: 'necunoscut', unitate: 'luni_chirie' }),
      comision: field('gasit', 50, 'comision 50%', { moneda: 'necunoscut', unitate: 'procent_chirie' }),
      durataContractLuni: field('gasit', 12, 'Contract minim 12 luni'),
      reparatii: lipsa(),
      mobilat: field('gasit', true, 'mobilată și utilată'),
      suprafataMp: field('gasit', 32, 'Suprafață 32 mp'),
      localitate: field('gasit', 'Cluj-Napoca', 'zona Mănăștur, Cluj-Napoca'),
    },
  };
}

function fakeProvider(outputs = {}) {
  const calls = [];
  return {
    calls,
    name: 'fake',
    async generateJson(args) {
      calls.push(args);
      const out = outputs[args.schemaName];
      if (typeof out === 'function') return out(args, calls.length);
      return structuredClone(out);
    },
    async checkModel() {
      if (outputs.health) throw outputs.health;
    },
  };
}

function makeAnalyze({ env = ENV, provider = fakeProvider({ listing_extraction: extractionA() }), now, sleep = async () => {}, logs = [] } = {}) {
  const h = createAnalyzeHandler({ env, provider, store: createMemoryStore(now), now, sleep, log: (e) => logs.push(e) });
  return { h, provider, logs };
}

function post(body, { origin = EXT, installId = INSTALL, ip = '1.2.3.4' } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-real-ip': ip };
  if (origin) headers.Origin = origin;
  if (installId) headers['x-install-id'] = installId;
  return new Request('https://api.test/api/analyze', { method: 'POST', headers, body: JSON.stringify(body) });
}

const body = async (res) => res.json();

// ---------------------------------------------------------------------------

test('configurație: modelul nu are valoare implicită; Upstash obligatoriu în producție', () => {
  const noModel = loadConfig({ AI_API_KEY: 'k' });
  assert.equal(noModel.ok, false);
  assert.ok(noModel.errors.some((e) => e.includes('AI_MODEL')));
  assert.equal(noModel.model, '');
  const prod = loadConfig({ ...ENV, VERCEL_ENV: 'production' });
  assert.ok(prod.errors.some((e) => e.includes('UPSTASH')));
  assert.equal(loadConfig({ ...ENV, VERCEL_ENV: 'production', UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't' }).ok, true);
  assert.equal(loadConfig({ ...ENV, MAX_INPUT_CHARS: '-3' }).ok, false);
  assert.equal(loadConfig({ ...ENV, AI_PROVIDER: 'openai' }).ok, false); // lipsește AI_BASE_URL
  assert.equal(loadConfig(ENV).maxInputChars, 15000);
});

test('validarea cererii: sarcină, text, lungime, câmpuri cunoscute', () => {
  const cfg = { maxInputChars: 100 };
  const code = (b) => {
    try {
      validateAnalyzeRequest(b, cfg);
      return 'OK';
    } catch (e) {
      return e.code;
    }
  };
  assert.equal(code({ task: 'extract', text: 'abc' }), 'OK');
  assert.equal(code({ task: 'hack', text: 'abc' }), C.INVALID_REQUEST);
  assert.equal(code({ task: 'extract', text: '   ' }), C.INVALID_REQUEST);
  assert.equal(code({ task: 'extract', text: 'x'.repeat(101) }), C.INPUT_TOO_LONG);
  assert.equal(code({ task: 'message', campuriLipsa: ['chirie', 'comision'] }), 'OK');
  assert.equal(code({ task: 'message', campuriLipsa: ['venitNetLunar'] }), C.INVALID_REQUEST);
  assert.equal(code({ task: 'message', campuriLipsa: [] }), C.INVALID_REQUEST);
  assert.equal(code({ task: 'storm', text: 'x'.repeat(101) }), C.INPUT_TOO_LONG);
  assert.equal(code(null), C.INVALID_REQUEST);
});

test('extract: telefonul e ascuns înainte de AI; dovezile inventate devin „lipsa”; răspuns validat', async () => {
  const { h, provider, logs } = makeAnalyze();
  const res = await h.POST(post({ task: 'extract', text: demoListingTextA }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), EXT);
  const out = await body(res);
  assert.equal(out.ok, true);
  const sent = provider.calls[0].user;
  assert.ok(sent.includes('[TELEFON]') && !sent.includes('0722'));
  const { campuri, campuriRetrogradate } = out.data;
  assert.deepEqual(campuri.chirie, { status: 'gasit', valoare: 350, dovada: 'Preț: 350 EUR/lună', actualizatLa: null, nota: null, moneda: 'EUR' });
  assert.equal(campuri.garantie.unitate, 'luni_chirie');
  assert.equal(campuri.garantie.moneda, null);
  assert.equal(campuri.comision.status, 'lipsa'); // „comision 50%” nu apare în anunț
  assert.deepEqual(campuriRetrogradate, ['comision']);
  assert.equal(campuri.intretinereVara.status, 'lipsa');
  assert.equal(campuri.intretinereVara.dovada, null);
  // Jurnalele nu conțin textul anunțului.
  assert.ok(!JSON.stringify(logs).includes('Mănăștur'));
  assert.deepEqual(Object.keys(logs[0]).sort(), ['code', 'endpoint', 'ms', 'task']);
});

test('extract: câmpurile invalide sunt retrogradate, structura greșită dă INVALID_RESPONSE', async () => {
  const bad = extractionA();
  bad.campuri.chirie = field('confirmat', 350, 'Preț: 350 EUR/lună', { moneda: 'EUR' }); // AI-ul nu poate confirma
  bad.campuri.suprafataMp = field('gasit', null, 'Suprafață 32 mp'); // „gasit” fără valoare
  bad.campuri.mobilat = field('gasit', 'da', 'mobilată și utilată'); // tip greșit
  const { h } = makeAnalyze({ provider: fakeProvider({ listing_extraction: bad }) });
  const out = await body(await h.POST(post({ task: 'extract', text: demoListingTextA })));
  assert.equal(out.data.campuri.chirie.status, 'lipsa');
  assert.equal(out.data.campuri.suprafataMp.status, 'lipsa');
  assert.equal(out.data.campuri.mobilat.status, 'lipsa');
  assert.deepEqual(out.data.campuriRetrogradate.sort(), ['chirie', 'comision', 'mobilat', 'suprafataMp']);

  const { h: h2 } = makeAnalyze({ provider: fakeProvider({ listing_extraction: { nimic: true } }) });
  const res = await h2.POST(post({ task: 'extract', text: demoListingTextA }));
  assert.equal(res.status, 502);
  assert.equal((await body(res)).error.code, C.INVALID_RESPONSE);
});

test('cererea fără ID de instalare și originea nepermisă sunt respinse; preflight CORS', async () => {
  const { h, provider } = makeAnalyze();
  const noId = await h.POST(post({ task: 'extract', text: 'abc' }, { installId: null }));
  assert.equal(noId.status, 400);
  assert.equal((await body(noId)).error.code, C.INVALID_REQUEST);
  const badOrigin = await h.POST(post({ task: 'extract', text: 'abc' }, { origin: 'https://evil.example' }));
  assert.equal(badOrigin.status, 403);
  assert.equal(badOrigin.headers.get('access-control-allow-origin'), null);
  assert.equal(provider.calls.length, 0);
  const pre = h.OPTIONS(new Request('https://api.test/api/analyze', { method: 'OPTIONS', headers: { Origin: EXT } }));
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers'), /x-install-id/);
  assert.equal(h.OPTIONS(new Request('https://api.test/', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('rate limiting pe trei niveluri: per IP pe minut, per instalare pe zi, plafon global', async () => {
  let t = Date.UTC(2027, 0, 1, 10, 0, 0);
  const now = () => t;
  const { h, provider } = makeAnalyze({ now, provider: fakeProvider({ landlord_message: { mesaj: 'Bună ziua' } }) });
  const msg = { task: 'message', campuriLipsa: ['comision'] };
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];

  // Per IP: 3 pe minut.
  for (let i = 0; i < 3; i += 1) assert.equal((await h.POST(post(msg))).status, 200);
  const limited = await h.POST(post(msg));
  assert.equal(limited.status, 429);
  assert.equal((await body(limited)).error.code, C.RATE_LIMITED);
  assert.equal(limited.headers.get('retry-after'), '60');
  t += 60_000; // fereastra următoare
  // Per instalare: 5 pe zi (3 deja + 2) — apoi respins, chiar de pe alt IP.
  assert.equal((await h.POST(post(msg, { ip: '5.5.5.5' }))).status, 200);
  assert.equal((await h.POST(post(msg, { ip: '5.5.5.6' }))).status, 200);
  assert.equal((await h.POST(post(msg, { ip: '5.5.5.7' }))).status, 429);
  // Plafon global: 8 pe zi. Consumate: 5 (cererile respinse per IP / per instalare nu ajung la contorul global).
  for (const [i, id] of ids.entries()) assert.equal((await h.POST(post(msg, { ip: `6.6.6.${i}`, installId: id }))).status, 200);
  const global = await h.POST(post(msg, { ip: '7.7.7.7', installId: '44444444-4444-4444-8444-444444444444' }));
  assert.equal(global.status, 429);
  assert.equal(provider.calls.length, 8);
});

test('o singură reîncercare, cu pauză, la 429/5xx; timeout-ul și erorile definitive nu se reîncearcă', async () => {
  const sleeps = [];
  const sleep = async (ms) => sleeps.push(ms);
  const flaky = fakeProvider({
    landlord_message: (_a, n) => {
      if (n === 1) throw new ApiError(C.AI_UNAVAILABLE, 'x', { retryable: true });
      return { mesaj: 'Bună ziua, aș dori detalii.' };
    },
  });
  const ok = await makeAnalyze({ provider: flaky, sleep }).h.POST(post({ task: 'message', campuriLipsa: ['comision'] }));
  assert.equal(ok.status, 200);
  assert.deepEqual(sleeps, [1000]);
  assert.equal(flaky.calls.length, 2);

  const always = fakeProvider({ landlord_message: () => { throw new ApiError(C.RATE_LIMITED, 'x', { retryable: true }); } });
  const r = await makeAnalyze({ provider: always }).h.POST(post({ task: 'message', campuriLipsa: ['comision'] }));
  assert.equal(r.status, 429);
  assert.equal(always.calls.length, 2);

  const timeout = fakeProvider({ landlord_message: () => { throw new ApiError(C.TIMEOUT, 'x'); } });
  const t = await makeAnalyze({ provider: timeout }).h.POST(post({ task: 'message', campuriLipsa: ['comision'] }));
  assert.equal(t.status, 504);
  assert.equal((await body(t)).error.code, C.TIMEOUT);
  assert.equal(timeout.calls.length, 1);
});

test('message: AI-ul primește doar etichetele câmpurilor; storm: sumele sunt mascate', async () => {
  const provider = fakeProvider({
    landlord_message: { mesaj: '  Bună ziua! 1. Care este comisionul?  ' },
    storm_classification: { tip: 'pierdereVenit', start: 4, durata: 2 },
  });
  const { h } = makeAnalyze({ provider });
  const m = await body(await h.POST(post({ task: 'message', campuriLipsa: ['comision', 'comision', 'garantie'] })));
  assert.equal(m.data.mesaj, 'Bună ziua! 1. Care este comisionul?');
  assert.equal(provider.calls[0].user, 'Informații de cerut:\n- comisionul\n- garanția');
  const s = await body(await h.POST(post({ task: 'storm', text: 'Pierd jobul 2 luni din aprilie, salariu 5.200 lei' })));
  assert.deepEqual(s.data, { tip: 'pierdereVenit', start: 4, durata: 2 });
  assert.ok(provider.calls[1].user.includes('[SUMĂ]'));
  assert.ok(!provider.calls[1].user.includes('5.200'));
  assert.deepEqual(normalizeStorm({ tip: 'necunoscut', start: 13, durata: 0 }), { tip: null, start: null, durata: null });
});

test('backend neconfigurat: analiza și health răspund AI_UNAVAILABLE', async () => {
  const env = { ...ENV, AI_MODEL: '' };
  const a = await makeAnalyze({ env }).h.POST(post({ task: 'extract', text: 'abc' }));
  assert.equal(a.status, 503);
  assert.equal((await body(a)).error.code, C.AI_UNAVAILABLE);
  const health = createHealthHandler({ env, provider: fakeProvider(), store: createMemoryStore(), log: () => {} });
  const r = await health.GET(new Request('https://api.test/api/health', { headers: { Origin: EXT } }));
  assert.equal((await body(r)).error.code, C.AI_UNAVAILABLE);
});

test('/api/health: OK, model inexistent, cheie invalidă', async () => {
  const run = async (healthErr) => {
    const h = createHealthHandler({ env: ENV, provider: fakeProvider({ health: healthErr }), store: createMemoryStore(), log: () => {} });
    const res = await h.GET(new Request('https://api.test/api/health', { headers: { Origin: EXT } }));
    return { status: res.status, body: await res.json() };
  };
  const ok = await run(null);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { ok: true, provider: 'anthropic', model: 'test-model' });
  assert.equal((await run(new ApiError(C.MODEL_UNAVAILABLE))).body.error.code, C.MODEL_UNAVAILABLE);
  assert.equal((await run(new ApiError(C.AUTH_ERROR))).body.error.code, C.AUTH_ERROR);
});

// ---------------------------------------------------------------------------
// Adaptoarele de furnizor

const apiError = (status) => Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message: 'x' } }, 'x', new Headers());

test('adaptorul Anthropic: cerere cu ieșire structurată, fără tool_choice; maparea erorilor', async () => {
  const requests = [];
  let behaviour = () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"mesaj":"Bună"}' }] });
  const client = {
    messages: { create: async (params, opts) => { requests.push({ params, opts }); return behaviour(); } },
    models: { retrieve: async () => behaviour() },
  };
  const p = createAnthropicProvider({ model: 'm', timeoutMs: 20000, effort: 'low' }, { client });
  assert.deepEqual(await p.generateJson({ system: 's', user: 'u', schema: MESSAGE_SCHEMA, schemaName: 'x', maxTokens: 100 }), { mesaj: 'Bună' });
  const { params, opts } = requests[0];
  assert.equal(params.model, 'm');
  assert.deepEqual(params.output_config, { format: { type: 'json_schema', schema: MESSAGE_SCHEMA }, effort: 'low' });
  assert.equal(params.tool_choice, undefined);
  assert.deepEqual(opts, { timeout: 20000, maxRetries: 0 });

  const codeOf = async (fn) => {
    try {
      await fn();
      return 'OK';
    } catch (e) {
      return `${e.code}${e.retryable ? '+retry' : ''}`;
    }
  };
  const gen = () => p.generateJson({ system: 's', user: 'u', schema: MESSAGE_SCHEMA, schemaName: 'x', maxTokens: 100 });
  behaviour = () => { throw apiError(404); };
  assert.equal(await codeOf(() => p.checkModel()), C.MODEL_UNAVAILABLE);
  behaviour = () => { throw apiError(401); };
  assert.equal(await codeOf(() => p.checkModel()), C.AUTH_ERROR);
  behaviour = () => { throw apiError(429); };
  assert.equal(await codeOf(gen), `${C.RATE_LIMITED}+retry`);
  behaviour = () => { throw apiError(529); };
  assert.equal(await codeOf(gen), `${C.AI_UNAVAILABLE}+retry`);
  behaviour = () => { throw apiError(400); };
  assert.equal(await codeOf(gen), C.AI_UNAVAILABLE);
  behaviour = () => { throw new Anthropic.APIConnectionTimeoutError(); };
  assert.equal(await codeOf(gen), C.TIMEOUT);
  behaviour = () => ({ stop_reason: 'refusal', content: [] });
  assert.equal(await codeOf(gen), C.AI_UNAVAILABLE);
  behaviour = () => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"mes' }] });
  assert.equal(await codeOf(gen), C.INVALID_RESPONSE);
  behaviour = () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'nu e json' }] });
  assert.equal(await codeOf(gen), C.INVALID_RESPONSE);
});

test('adaptorul compatibil OpenAI: response_format strict și maparea statusurilor', async () => {
  const seen = [];
  let reply = { status: 200, body: { choices: [{ finish_reason: 'stop', message: { content: '{"mesaj":"ok"}' } }] } };
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  };
  const p = createOpenAICompatibleProvider({ apiKey: 'k', model: 'gpt-x', baseUrl: 'https://llm.example/v1/', timeoutMs: 1000 }, { fetchImpl });
  assert.deepEqual(await p.generateJson({ system: 's', user: 'u', schema: MESSAGE_SCHEMA, schemaName: 'landlord_message', maxTokens: 50 }), { mesaj: 'ok' });
  assert.equal(seen[0].url, 'https://llm.example/v1/chat/completions');
  const sent = JSON.parse(seen[0].init.body);
  assert.equal(sent.response_format.json_schema.strict, true);
  assert.equal(seen[0].init.headers.Authorization, 'Bearer k');
  for (const [status, code] of [[404, C.MODEL_UNAVAILABLE], [401, C.AUTH_ERROR], [429, C.RATE_LIMITED], [503, C.AI_UNAVAILABLE]]) {
    reply = { status, body: {} };
    await assert.rejects(p.checkModel(), (e) => e.code === code);
  }
  // Regresie: health-ul trimite o cerere reală (nu doar listarea modelelor), ca un model listat dar
  // indisponibil (ex. Gemini: „no longer available to new users”) să nu pară funcțional.
  seen.length = 0;
  reply = { status: 200, body: { choices: [{ finish_reason: 'length', message: { content: 'o' } }] } };
  await p.checkModel();
  assert.equal(seen[0].url, 'https://llm.example/v1/chat/completions');
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(JSON.parse(seen[0].init.body).model, 'gpt-x');
});

test('Upstash: INCR + EXPIRE NX într-un pipeline; dacă Redis cade, cererile sunt refuzate (fail closed)', async () => {
  const seen = [];
  const store = createUpstashStore({
    url: 'https://redis.example/',
    token: 't',
    fetchImpl: async (url, init) => {
      seen.push({ url, init });
      return new Response(JSON.stringify([{ result: 4 }, { result: 1 }]), { status: 200 });
    },
  });
  assert.equal(await store.incr('k', 60), 4);
  assert.equal(seen[0].url, 'https://redis.example/pipeline');
  assert.deepEqual(JSON.parse(seen[0].init.body), [['INCR', 'k'], ['EXPIRE', 'k', '60', 'NX']]);

  const down = createRateLimiter({
    store: createUpstashStore({ url: 'https://r', token: 't', fetchImpl: async () => new Response('', { status: 500 }) }),
    limits: { perMinuteIp: 1, perDayInstall: 1, globalDaily: 1 },
  });
  await assert.rejects(down.checkAnalyze({ ip: 'i', installId: 'x' }), (e) => e.code === C.AI_UNAVAILABLE);
});

test('schemele de ieșire respectă regulile ieșirii structurate stricte', () => {
  const check = (s, path) => {
    if (s.anyOf) return s.anyOf.forEach((x, i) => check(x, `${path}.anyOf[${i}]`));
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false, path);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), path);
      for (const [k, v] of Object.entries(s.properties)) check(v, `${path}.${k}`);
    }
    for (const forbidden of ['minimum', 'maximum', 'minLength', 'maxLength']) assert.equal(s[forbidden], undefined, path);
  };
  for (const s of [EXTRACT_SCHEMA, MESSAGE_SCHEMA, STORM_SCHEMA]) check(s, 'schema');
});
