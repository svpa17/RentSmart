// RĂSCRUCE AI — adaptor ușor pentru olx.ro.
// Verificat pe 5 anunțuri reale randate în browser (noiembrie 2026): titlu, preț, parametri și descriere.
// Selectorii folosesc atributele data-cy / data-testid. Dacă nu găsesc titlul și descrierea, întoarce null
// și se folosește varianta generică (date structurate + textul paginii).
import { cleanText } from '../text.js';

export const matches = (hostname) => /(^|\.)olx\.ro$/i.test(hostname);

function first(doc, selectors) {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const t = cleanText(el?.innerText ?? el?.textContent ?? '');
    if (t) return t;
  }
  return null;
}

/** @returns {{titlu: string|null, pret: string|null, descriere: string|null, detalii: string[]} | null} */
export function readOlx(doc) {
  const titlu = first(doc, ['[data-cy="ad_title"]', '[data-testid="ad_title"]', '[data-testid="offer_title"]']);
  const pret = first(doc, ['[data-testid="ad-price-container"]', '[data-cy="ad-price"]']);
  const descriere = first(doc, ['[data-cy="ad_description"]', '[data-testid="ad_description"]']);
  const params = doc.querySelector('[data-testid="ad-parameters-container"], [data-testid="main-parameters"]');
  const detalii = params
    ? cleanText(params.innerText ?? params.textContent ?? '').split('\n').filter((l) => l.length <= 120)
    : [];
  if (!titlu || !descriere) return null;
  return { titlu, pret, descriere, detalii };
}
