// RĂSCRUCE AI — configurația backend-ului, citită DOAR din variabilele de mediu (planul, §8).
// Modelul nu are valoare implicită: AI_MODEL trebuie setat explicit cu un identificator
// verificat ca disponibil în contul API folosit.

export const PROVIDERS = Object.freeze(['anthropic', 'openai']);
export const EFFORT_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

const DEFAULTS = Object.freeze({
  AI_MAX_OUTPUT_TOKENS: 4000,
  MAX_INPUT_CHARS: 15000,
  AI_TIMEOUT_MS: 20000,
  RATE_LIMIT_PER_MINUTE_IP: 10,
  RATE_LIMIT_PER_DAY_INSTALL: 60,
  GLOBAL_DAILY_REQUEST_CAP: 1000,
});

function positiveInt(env, name, errors) {
  const raw = env[name];
  if (raw === undefined || raw === '') return DEFAULTS[name];
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${name} trebuie să fie un întreg pozitiv`);
    return DEFAULTS[name];
  }
  return n;
}

const list = (raw) =>
  String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ok: boolean, errors: string[], provider: string, apiKey: string, model: string, baseUrl: string|null,
 *   effort: string|null, maxOutputTokens: number, maxInputChars: number, timeoutMs: number, allowedOrigins: string[],
 *   upstash: {url: string, token: string}|null, production: boolean,
 *   limits: {perMinuteIp: number, perDayInstall: number, globalDaily: number}}}
 */
export function loadConfig(env = process.env) {
  const errors = [];
  const provider = (env.AI_PROVIDER || 'anthropic').trim();
  if (!PROVIDERS.includes(provider)) errors.push(`AI_PROVIDER trebuie să fie unul dintre: ${PROVIDERS.join(', ')}`);
  const apiKey = (env.AI_API_KEY || '').trim();
  if (!apiKey) errors.push('AI_API_KEY lipsește');
  const model = (env.AI_MODEL || '').trim();
  if (!model) errors.push('AI_MODEL lipsește (nu există model implicit)');
  const baseUrl = (env.AI_BASE_URL || '').trim() || null;
  if (provider === 'openai' && !baseUrl) errors.push('AI_BASE_URL este obligatoriu pentru furnizorul openai');
  const effort = (env.AI_EFFORT || '').trim() || null;
  if (effort && !EFFORT_LEVELS.includes(effort)) errors.push(`AI_EFFORT trebuie să fie unul dintre: ${EFFORT_LEVELS.join(', ')}`);

  const production = env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
  const upstashUrl = (env.UPSTASH_REDIS_REST_URL || '').trim();
  const upstashToken = (env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  const upstash = upstashUrl && upstashToken ? { url: upstashUrl, token: upstashToken } : null;
  // Rate limiting-ul persistent este obligatoriu în producție.
  if (production && !upstash) errors.push('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN lipsesc (obligatorii în producție)');

  // Valorile numerice se citesc înainte de a calcula `ok`, ca erorile lor să conteze.
  const numbers = {
    maxOutputTokens: positiveInt(env, 'AI_MAX_OUTPUT_TOKENS', errors),
    maxInputChars: positiveInt(env, 'MAX_INPUT_CHARS', errors),
    timeoutMs: positiveInt(env, 'AI_TIMEOUT_MS', errors),
  };
  const limits = {
    perMinuteIp: positiveInt(env, 'RATE_LIMIT_PER_MINUTE_IP', errors),
    perDayInstall: positiveInt(env, 'RATE_LIMIT_PER_DAY_INSTALL', errors),
    globalDaily: positiveInt(env, 'GLOBAL_DAILY_REQUEST_CAP', errors),
  };

  return {
    ok: errors.length === 0,
    errors,
    provider,
    apiKey,
    model,
    baseUrl,
    effort,
    ...numbers,
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    upstash,
    production,
    limits,
  };
}
