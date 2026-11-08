// RĂSCRUCE AI — utilitare HTTP (Web Request/Response), CORS și identificarea clientului.
// CORS NU este autentificare: e doar un filtru suplimentar pentru browsere (planul, §8).
import { INSTALL_ID_HEADER } from '../../extension/src/shared/contracts/constants.js';
import { ApiError, AI_ERROR_CODES } from './errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Antetele CORS pentru o origine permisă; nimic pentru celelalte. */
export function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${INSTALL_ID_HEADER}`,
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/** Respinge cererile din browsere cu o origine nepermisă. Cererile fără Origin trec (le limitează rate limiting-ul). */
export function assertOrigin(request, allowedOrigins) {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.includes(origin)) throw new ApiError(AI_ERROR_CODES.FORBIDDEN_ORIGIN, 'Origine nepermisă');
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorResponse(err, headers = {}) {
  const e = err instanceof ApiError ? err : new ApiError(AI_ERROR_CODES.AI_UNAVAILABLE, 'Eroare internă');
  const extra = e.code === AI_ERROR_CODES.RATE_LIMITED ? { 'Retry-After': '60' } : {};
  return json(e.status, { ok: false, error: { code: e.code, mesaj: e.message } }, { ...headers, ...extra });
}

export function preflight(request, allowedOrigins) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin, allowedOrigins);
  return new Response(null, { status: Object.keys(headers).length ? 204 : 403, headers });
}

/** IP-ul clientului: x-real-ip (Vercel), apoi primul din x-forwarded-for. */
export function clientIp(request) {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'unknown';
}

/** ID-ul anonim al instalării (UUID generat la instalarea extensiei). Obligatoriu pentru /api/analyze. */
export function requireInstallId(request) {
  const id = request.headers.get(INSTALL_ID_HEADER);
  if (!id || !UUID_RE.test(id)) throw new ApiError(AI_ERROR_CODES.INVALID_REQUEST, 'Lipsește ID-ul instalării');
  return id.toLowerCase();
}

/** Corpul JSON, limitat ca dimensiune înainte de parsare. */
export async function readJson(request, maxBytes) {
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(AI_ERROR_CODES.INPUT_TOO_LONG, 'Cererea este prea mare');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(AI_ERROR_CODES.INVALID_REQUEST, 'Corpul cererii nu este JSON valid');
  }
}
