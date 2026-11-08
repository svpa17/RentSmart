// RĂSCRUCE AI — funcții pure despre pagina citită, folosite de scriptul de conținut și de panou:
// pare un anunț de închiriere? · cheia URL a anunțului (navigare SPA) · cheia analizei (fără analize duble).
import { PRICE_RE, RENT_RE } from './universal.js';

export const PAGE_CHANGED_MESSAGE = 'RASCRUCE_PAGE_CHANGED';

const PROPERTY_RE = /apartament|garsonier|studio|\bcamer[ăea]|\bmp\b|m²|\bm2\b|\bcas[ăa]\b|vil[ăa]|duplex|\bflat\b|apartment|\broom\b|bedroom|house/i;

/**
 * Semnalele unui anunț de închiriere. Nu blochează nimic: dacă pagina nu pare un anunț, panoul întreabă
 * utilizatorul înainte de a trimite textul la AI (fără cereri inutile).
 * @returns {{pareAnunt: boolean, semnale: string[]}}
 */
export function assessListing({ text = '', titlu = '', url = '', pret = null, structured = null } = {}) {
  const all = `${titlu ?? ''}\n${text}`;
  const semnale = [];
  if (structured?.tipAnunt) semnale.push('schema-anunt');
  if (structured?.inchiriere) semnale.push('schema-inchiriere');
  if (RENT_RE.test(all) || /inchiri|chirie|for-rent|\/rent/i.test(url ?? '')) semnale.push('inchiriere');
  if (pret || PRICE_RE.test(all)) semnale.push('pret');
  if (PROPERTY_RE.test(all)) semnale.push('locuinta');
  const has = (s) => semnale.includes(s);
  const pareAnunt =
    text.trim().length >= 40 && (has('inchiriere') || has('schema-inchiriere') || has('schema-anunt')) && (has('pret') || has('locuinta'));
  return { pareAnunt, semnale };
}

const TRACKING = /^(utm_|fbclid$|gclid$|yclid$|mc_|ref$|reason$|search_reason$|_ga$)/i;

/** URL-ul anunțului fără fragment (#…) și fără parametrii de urmărire: aceeași pagină → aceeași cheie. */
export function listingUrlKey(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.toString().replace(/\?$/, '');
  } catch {
    return null;
  }
}

/** FNV-1a pe 32 de biți: rapid, sincron, suficient pentru a recunoaște același text. */
export function textHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Cheia unei analize: același anunț, același text, același mod (AI / demo) → aceeași cheie. */
export function analysisKey({ url, text, mod }) {
  return `${mod}|${listingUrlKey(url) ?? 'text'}|${textHash(String(text ?? ''))}`;
}
