// RentSmart — memoria analizelor reușite (AI sau demo), comună panoului și analizei automate.
// Stă în chrome.storage.local (STORAGE_KEYS.RECENT_ANALYSES), cele mai recente primele.
// Cheia unei analize: `${mod}|${URL normalizat}|${hash text}` (content/listing.js → analysisKey).
// Ce se păstrează: extragerea anunțului (câmpuri + dovezi) și întrebările. Costurile și verdictul NU se
// păstrează: se recalculează mereu din Passport-ul curent, deci o schimbare de Passport nu cere AI din nou.
import { STORAGE_KEYS, getValue, setValue } from './index.js';

export const RECENT_LIMIT = 30;
/** Un anunț reanalizat după acest interval poate avea alt preț: refacem extragerea. */
export const URL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function recentAnalyses() {
  return (await getValue(STORAGE_KEYS.RECENT_ANALYSES)) ?? [];
}

/** Adaugă (sau mută primul) un rezultat cu cheie; fără cheie (ex. completare manuală) nu se păstrează. */
export async function rememberAnalysis(r) {
  if (!r?.cheie) return;
  const rest = (await recentAnalyses()).filter((x) => x.cheie !== r.cheie);
  await setValue(STORAGE_KEYS.RECENT_ANALYSES, [r, ...rest].slice(0, RECENT_LIMIT));
}

export async function findAnalysis(cheie) {
  if (!cheie) return null;
  return (await recentAnalyses()).find((x) => x.cheie === cheie) ?? null;
}

/**
 * Ultima analiză a aceluiași anunț (același URL normalizat), oricare ar fi textul: paginile de anunț au
 * contoare de vizualizări și date relative, deci textul se schimbă la fiecare reîncărcare.
 */
export async function findAnalysisByUrl(urlKey, { mod = 'ai', now = Date.now(), maxAgeMs = URL_CACHE_TTL_MS } = {}) {
  if (!urlKey) return null;
  const prefix = `${mod}|${urlKey}|`;
  return (
    (await recentAnalyses()).find((x) => {
      if (!x.cheie?.startsWith(prefix)) return false;
      const at = Date.parse(x.analiza?.sursa?.analizatLa ?? '');
      return Number.isFinite(at) && now - at <= maxAgeMs;
    }) ?? null
  );
}
