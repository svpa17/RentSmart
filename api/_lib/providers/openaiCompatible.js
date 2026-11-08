// RĂSCRUCE AI — adaptor alternativ pentru API-uri compatibile OpenAI (Chat Completions),
// prin fetch, fără dependențe. Ieșire structurată: `response_format` json_schema strict.

import { ApiError, AI_ERROR_CODES as C, isRetryableStatus } from '../errors.js';

export function mapHttpStatus(status) {
  if (status === 401 || status === 403) return new ApiError(C.AUTH_ERROR, 'Cheia API nu este validă');
  if (status === 404) return new ApiError(C.MODEL_UNAVAILABLE, 'Modelul configurat nu este disponibil');
  if (status === 429) return new ApiError(C.RATE_LIMITED, 'Furnizorul AI a limitat cererile', { retryable: true });
  return new ApiError(C.AI_UNAVAILABLE, 'Furnizorul AI a returnat o eroare', { retryable: isRetryableStatus(status) });
}

function mapFetchError(err) {
  if (err instanceof ApiError) return err;
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return new ApiError(C.TIMEOUT, 'Furnizorul AI nu a răspuns la timp');
  return new ApiError(C.AI_UNAVAILABLE, 'Furnizorul AI nu poate fi contactat', { retryable: true });
}

/**
 * @param {{apiKey: string, model: string, baseUrl: string, timeoutMs: number}} config
 * @param {{fetchImpl?: typeof fetch}} [deps]
 */
export function createOpenAICompatibleProvider(config, { fetchImpl = fetch } = {}) {
  const base = config.baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };

  async function call(path, init) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(config.timeoutMs) });
    } catch (err) {
      throw mapFetchError(err);
    }
    if (!res.ok) throw mapHttpStatus(res.status);
    return res;
  }

  return {
    name: 'openai',

    async generateJson({ system, user, schema, schemaName, maxTokens }) {
      const res = await call('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
        }),
      });
      let body;
      try {
        body = await res.json();
      } catch {
        throw new ApiError(C.INVALID_RESPONSE, 'Răspunsul furnizorului nu este JSON valid');
      }
      const choice = body?.choices?.[0];
      if (choice?.finish_reason === 'length') throw new ApiError(C.INVALID_RESPONSE, 'Răspunsul AI a fost trunchiat');
      if (choice?.message?.refusal) throw new ApiError(C.AI_UNAVAILABLE, 'Furnizorul AI a refuzat cererea');
      try {
        return JSON.parse(choice?.message?.content ?? '');
      } catch {
        throw new ApiError(C.INVALID_RESPONSE, 'Răspunsul AI nu este JSON valid');
      }
    },

    /**
     * Verifică cheia și modelul cu o cerere reală, minusculă. Listarea modelelor nu e de încredere la
     * furnizorii compatibili: Gemini, de exemplu, listează modele care nu mai răspund pentru conturile noi.
     */
    async checkModel() {
      await call('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: config.model, max_tokens: 16, messages: [{ role: 'user', content: 'ok' }] }),
      });
    },
  };
}
