// RĂSCRUCE AI — logica endpoint-urilor, cu dependențe injectabile (teste: furnizor simulat, store în memorie).
// Serverul nu salvează textul anunțurilor; jurnalele conțin doar sarcina, durata și codul de eroare.

import { loadConfig } from './config.js';
import { ApiError, AI_ERROR_CODES as C } from './errors.js';
import { assertOrigin, clientIp, corsHeaders, errorResponse, json, preflight, readJson, requireInstallId } from './http.js';
import { createProvider } from './providers/index.js';
import { createRateLimiter, storeFromConfig } from './rateLimit.js';
import { runTask } from './tasks.js';
import { validateAnalyzeRequest, validateSearchRequest } from './validate.js';
import { createSearchService } from './search/index.js';

const defaultLog = (entry) => console.log(JSON.stringify(entry));

function setup({ env, provider, store, now, log }) {
  const config = loadConfig(env);
  return {
    config,
    log: log ?? defaultLog,
    limiter: createRateLimiter({ store: store ?? storeFromConfig(config), limits: config.limits, now }),
    getProvider: () => provider ?? createProvider(config),
  };
}

function notConfigured() {
  return new ApiError(C.AI_UNAVAILABLE, 'Analiza AI nu este configurată');
}

/** POST /api/analyze */
export function createAnalyzeHandler(deps = {}) {
  const { config, log, limiter, getProvider } = setup({ env: process.env, ...deps });
  const now = deps.now ?? (() => Date.now());

  return {
    OPTIONS: (request) => preflight(request, config.allowedOrigins),
    async POST(request) {
      const started = now();
      const cors = corsHeaders(request.headers.get('origin'), config.allowedOrigins);
      let task = null;
      try {
        assertOrigin(request, config.allowedOrigins);
        const installId = requireInstallId(request);
        await limiter.checkAnalyze({ ip: clientIp(request), installId });
        if (!config.ok) throw notConfigured();
        // Limită de octeți înainte de parsare: textul maxim + o marjă pentru JSON și diacritice.
        const body = await readJson(request, config.maxInputChars * 4 + 2048);
        const input = validateAnalyzeRequest(body, config);
        task = input.task;
        const data = await runTask(input, { provider: getProvider(), maxOutputTokens: config.maxOutputTokens, sleep: deps.sleep });
        log({ endpoint: 'analyze', task, ms: now() - started, code: 'OK' });
        return json(200, { ok: true, task, data }, cors);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'INTERNAL';
        log({ endpoint: 'analyze', task, ms: now() - started, code });
        return errorResponse(err, cors);
      }
    },
  };
}

/**
 * POST /api/alternatives — caută anunțuri de închiriat pe furnizorii permiși (Storia, Publi24, HomeZZ).
 * Primește doar {oras, camere, pretMinimEUR}; nu are nevoie de cheia AI și nu folosește AI.
 */
export function createAlternativesHandler(deps = {}) {
  const { config, log, limiter } = setup({ env: process.env, ...deps });
  const now = deps.now ?? (() => Date.now());
  const service = deps.searchService ?? createSearchService({ fetchImpl: deps.fetchImpl });

  return {
    OPTIONS: (request) => preflight(request, config.allowedOrigins),
    async POST(request) {
      const started = now();
      const cors = corsHeaders(request.headers.get('origin'), config.allowedOrigins);
      try {
        assertOrigin(request, config.allowedOrigins);
        const installId = requireInstallId(request);
        await limiter.checkSearch({ ip: clientIp(request), installId });
        const input = validateSearchRequest(await readJson(request, 1024));
        const data = await service.search(input, { signal: request.signal });
        log({ endpoint: 'alternatives', ms: now() - started, code: 'OK', furnizori: data.furnizori.map((f) => `${f.id}:${f.ok ? f.numar : f.eroare}`).join(','), cache: data.dinCache });
        return json(200, { ok: true, data }, cors);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'INTERNAL';
        log({ endpoint: 'alternatives', ms: now() - started, code });
        return errorResponse(err, cors);
      }
    },
  };
}

/** GET /api/health — verifică cheia și modelul. */
export function createHealthHandler(deps = {}) {
  const { config, log, limiter, getProvider } = setup({ env: process.env, ...deps });
  const now = deps.now ?? (() => Date.now());

  return {
    OPTIONS: (request) => preflight(request, config.allowedOrigins),
    async GET(request) {
      const started = now();
      const cors = corsHeaders(request.headers.get('origin'), config.allowedOrigins);
      try {
        assertOrigin(request, config.allowedOrigins);
        await limiter.checkHealth({ ip: clientIp(request) });
        if (!config.ok) throw notConfigured();
        await getProvider().checkModel();
        log({ endpoint: 'health', ms: now() - started, code: 'OK' });
        return json(200, { ok: true, provider: config.provider, model: config.model }, cors);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'INTERNAL';
        log({ endpoint: 'health', ms: now() - started, code });
        return errorResponse(err, cors);
      }
    },
  };
}
