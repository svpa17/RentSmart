// RĂSCRUCE AI — clientul backend-ului AI: /api/health și /api/analyze (extract, message).
// La AI pleacă doar textul anunțului (cu telefoanele și e-mailurile ascunse) sau numele câmpurilor lipsă.
// Nicio funcție de aici nu aruncă: erorile devin { ok: false, code } și extensia trece la modul manual.
import { API_BASE_URL, HEALTH_TIMEOUT_MS } from '../config.js';
import { AI_ERROR_CODES, INSTALL_ID_HEADER, MAX_STORM_TEXT_CHARS } from '../shared/contracts/constants.js';
import { maskAmounts, redactContacts } from './redact.js';

export const NOT_CONFIGURED = 'NOT_CONFIGURED';
/** Serverul face cel mult o reîncercare a unui apel de ~20 s; lăsăm marjă. */
export const ANALYZE_TIMEOUT_MS = 50000;
export const MAX_INPUT_CHARS = 15000;

const networkCode = (err) => (err?.name === 'TimeoutError' ? AI_ERROR_CODES.TIMEOUT : AI_ERROR_CODES.AI_UNAVAILABLE);

/**
 * Verifică dacă analiza AI e disponibilă.
 * @returns {Promise<{ok: true, model: string} | {ok: false, code: string}>}
 */
export async function checkHealth({ baseUrl = API_BASE_URL, fetchImpl = fetch, timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
  if (!baseUrl) return { ok: false, code: NOT_CONFIGURED };
  try {
    const res = await fetchImpl(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) return { ok: true, model: body.model };
    return { ok: false, code: body?.error?.code ?? AI_ERROR_CODES.AI_UNAVAILABLE };
  } catch (err) {
    return { ok: false, code: networkCode(err) };
  }
}

async function analyze(payload, { baseUrl = API_BASE_URL, fetchImpl = fetch, installId, timeoutMs = ANALYZE_TIMEOUT_MS }) {
  if (!baseUrl) return { ok: false, code: NOT_CONFIGURED };
  try {
    const res = await fetchImpl(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [INSTALL_ID_HEADER]: installId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok && body.data) return { ok: true, data: body.data };
    return { ok: false, code: body?.error?.code ?? AI_ERROR_CODES.AI_UNAVAILABLE };
  } catch (err) {
    return { ok: false, code: networkCode(err) };
  }
}

/** Pregătește textul pentru trimitere: limită de lungime + telefoane/e-mailuri ascunse. */
export function prepareListingText(text) {
  return redactContacts(String(text ?? '').slice(0, MAX_INPUT_CHARS));
}

/**
 * Extragerea câmpurilor. `text` trebuie să fie deja pregătit cu prepareListingText (dovezile se verifică pe el).
 * @returns {Promise<{ok: true, data: {titlu: string|null, campuri: object, campuriRetrogradate: string[]}} | {ok: false, code: string}>}
 */
export function extractListing(text, opts) {
  return analyze({ task: 'extract', text }, opts);
}

/**
 * Clasificarea unui scenariu de furtună din text liber. Sumele sunt mascate ([SUMĂ]) înainte de trimitere;
 * AI-ul întoarce doar {tip, start (lună calendaristică), durata}.
 */
export function classifyStormText(text, opts) {
  return analyze({ task: 'storm', text: maskAmounts(String(text ?? '').slice(0, MAX_STORM_TEXT_CHARS)) }, opts);
}

/** Mesajul pentru proprietar, formulat de AI din lista câmpurilor lipsă. */
export function composeLandlordMessage(campuriLipsa, opts) {
  return analyze({ task: 'message', campuriLipsa }, opts);
}

/** Căutarea de alternative: 3 furnizori în paralel pe server (fiecare cu timeout de 10 s). */
export const SEARCH_TIMEOUT_MS = 30000;

/**
 * Caută anunțuri de închiriat pe furnizorii permiși. Trimite DOAR orașul, camerele și prețul minim de
 * plauzibilitate: nicio dată din Passport. `signal` anulează o căutare depășită (filtre schimbate).
 * @param {{oras: string, camere: number|null, pretMinimEUR: number|null}} query
 * @returns {Promise<{ok: true, data: {rezultate: object[], furnizori: object[], cautatLa: string, dinCache: boolean}} | {ok: false, code: string}>}
 */
export async function searchAlternatives(query, { baseUrl = API_BASE_URL, fetchImpl = fetch, installId, signal, timeoutMs = SEARCH_TIMEOUT_MS } = {}) {
  if (!baseUrl) return { ok: false, code: NOT_CONFIGURED };
  try {
    const res = await fetchImpl(`${baseUrl}/api/alternatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [INSTALL_ID_HEADER]: installId },
      body: JSON.stringify({ oras: query.oras, camere: query.camere ?? null, pretMinimEUR: query.pretMinimEUR ?? null }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok && body.data) return { ok: true, data: body.data };
    return { ok: false, code: body?.error?.code ?? AI_ERROR_CODES.AI_UNAVAILABLE };
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, code: 'ANULAT' };
    return { ok: false, code: networkCode(err) };
  }
}
