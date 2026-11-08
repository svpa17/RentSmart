// RentSmart — căutarea de alternative pe mai mulți furnizori.
// - Furnizorii rulează în paralel (3), fiecare cu timeout propriu; dacă unul cade, ceilalți continuă.
// - Rezultatele se normalizează, se validează (URL-uri https pe domeniul furnizorului) și se deduplică.
// - Cache în memorie (15 min) pe cheia {oraș, camere, preț minim}: aceeași căutare nu reface cererile.
// - NU primește și NU trimite date financiare: doar orașul, camerele și un preț minim de plauzibilitate.
// Calculele financiare (economii, cost real, siguranță) se fac în extensie, în motor.

import { cityById } from '../../../extension/src/shared/search/cities.js';
import { SEARCH_PROVIDERS } from './providers.js';

export const SEARCH_USER_AGENT = 'Mozilla/5.0 (compatible; RentSmart/0.1; personal rental comparison)';
export const PROVIDER_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 50;
const MAX_RESULTS = 120;

/** Coduri per furnizor, afișate în interfață. */
export const PROVIDER_ERRORS = Object.freeze({
  BLOCAT: 'BLOCAT', // 403 / 429 / CAPTCHA: nu insistăm
  TIMEOUT: 'TIMEOUT',
  INDISPONIBIL: 'INDISPONIBIL', // rețea sau 5xx
  STRUCTURA: 'STRUCTURA', // pagina s-a schimbat
});

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Nu sunt chirii lunare comparabile: cazare pe noapte / sezon, regim hotelier, o cameră sau un pat
 * într-o locuință comună. Se elimină înainte de orice clasament.
 */
const NOT_MONTHLY_RENTAL = /\bcazare\b|regim hotelier|\bnoapte\b|per night|\bsezon|\buntold\b|^(o )?(camera|camere|loc|pat)\b|\bloc in camera\b|\bcamera in (apartament|casa)\b|\bdoar o camera\b|\bo camera (la|in|intr)\b|\bshare\b/;
export const isMonthlyRental = (it) => !NOT_MONTHLY_RENTAL.test(norm(it.titlu));

/** Același anunț pe două site-uri: același preț, aceeași suprafață și titluri asemănătoare. */
export function dedupe(items) {
  const byUrl = new Map();
  for (const it of items) if (!byUrl.has(it.url)) byUrl.set(it.url, it);
  const out = [];
  const seen = [];
  for (const it of byUrl.values()) {
    const words = new Set(norm(it.titlu).split(' ').filter((w) => w.length > 2));
    const dup = seen.find((s) => {
      if (s.it.pret.valoare !== it.pret.valoare || s.it.pret.moneda !== it.pret.moneda) return false;
      if (s.it.suprafataMp && it.suprafataMp && s.it.suprafataMp !== it.suprafataMp) return false;
      const common = [...words].filter((w) => s.words.has(w)).length;
      return common / Math.max(1, Math.min(words.size, s.words.size)) >= 0.6;
    });
    if (dup) {
      dup.it.imagine ??= it.imagine; // păstrăm prima variantă, completăm imaginea dacă lipsea
      continue;
    }
    seen.push({ it, words });
    out.push(it);
  }
  return out;
}

async function runProvider(provider, query, { fetchImpl, signal, timeoutMs }) {
  const url = provider.buildUrl(query);
  const started = Date.now();
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': SEARCH_USER_AGENT, 'Accept-Language': 'ro-RO,ro;q=0.9', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(timeoutMs)]),
    });
    if (res.status === 403 || res.status === 429) return { ok: false, eroare: PROVIDER_ERRORS.BLOCAT, items: [], ms: Date.now() - started };
    if (!res.ok) return { ok: false, eroare: PROVIDER_ERRORS.INDISPONIBIL, items: [], ms: Date.now() - started };
    const html = await res.text();
    if (/captcha|cf-challenge|are you a robot/i.test(html.slice(0, 5000))) return { ok: false, eroare: PROVIDER_ERRORS.BLOCAT, items: [], ms: Date.now() - started };
    try {
      return { ok: true, items: provider.parse(html, query), ms: Date.now() - started };
    } catch {
      return { ok: false, eroare: PROVIDER_ERRORS.STRUCTURA, items: [], ms: Date.now() - started };
    }
  } catch (err) {
    const timeout = err?.name === 'TimeoutError';
    return { ok: false, eroare: timeout ? PROVIDER_ERRORS.TIMEOUT : PROVIDER_ERRORS.INDISPONIBIL, items: [], ms: Date.now() - started };
  }
}

/**
 * @param {{providers?: object[], fetchImpl?: typeof fetch, timeoutMs?: number, now?: () => number}} [deps]
 */
export function createSearchService({ providers = SEARCH_PROVIDERS, fetchImpl = fetch, timeoutMs = PROVIDER_TIMEOUT_MS, now = () => Date.now() } = {}) {
  const cache = new Map();
  return {
    /**
     * @param {{oras: string, camere: number|null, pretMinimEUR: number|null}} input  validat în prealabil
     * @param {{signal?: AbortSignal}} [opts]
     */
    async search({ oras, camere, pretMinimEUR }, { signal } = {}) {
      const city = cityById(oras);
      const key = `${oras}|${camere ?? '-'}|${pretMinimEUR ?? '-'}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < CACHE_TTL_MS) return { ...hit.value, dinCache: true };

      const query = { city, camere, pretMinimEUR };
      const runs = await Promise.all(providers.map((p) => runProvider(p, query, { fetchImpl, signal, timeoutMs })));
      const furnizori = providers.map((p, i) => ({ id: p.id, nume: p.nume, ok: runs[i].ok, numar: runs[i].items.length, eroare: runs[i].eroare ?? null }));
      const rezultate = dedupe(runs.flatMap((r) => r.items).filter(isMonthlyRental)).slice(0, MAX_RESULTS);
      const value = { rezultate, furnizori, cautatLa: new Date(now()).toISOString() };
      // Nu păstrăm în cache un eșec total (ex. rețea căzută): următoarea încercare reface cererile.
      if (runs.some((r) => r.ok)) {
        cache.set(key, { at: now(), value });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      }
      return { ...value, dinCache: false };
    },
  };
}
