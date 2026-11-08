// RĂSCRUCE AI — adaptor ușor pentru storia.ro. Verificat pe 5 anunțuri reale (noiembrie 2026).
// Opțional: dacă selectorii nu mai funcționează, întoarce null și se trece la varianta generică.
import { cleanText, htmlToText } from '../text.js';

export const matches = (hostname) => /(^|\.)storia\.ro$/i.test(hostname);

// Câmpurile din __NEXT_DATA__ (ad.topInformation / additionalInformation) pe care le păstrăm.
const LABELS = {
  rent: 'Chirie lunară',
  deposit: 'Garanție (depozit)',
  area: 'Suprafață utilă',
  rooms_num: 'Număr camere',
  floor: 'Etaj',
  heating: 'Încălzire',
  build_year: 'An construcție',
  free_from: 'Disponibil din',
};

const VALUES = {
  ground_floor: 'parter',
  urban: 'termoficare',
  gas: 'centrală pe gaz',
  electrical: 'electrică',
  boiler_room: 'centrală de bloc',
  other: 'altele',
};

function cleanValue(v) {
  const raw = String(v).replace(/^[^:]*::/, '');
  const floor = /^floor_(\d+)$/.exec(raw);
  if (floor) return floor[1];
  return VALUES[raw] ?? raw.replace(/_/g, ' ');
}

function nextAd(doc) {
  try {
    return JSON.parse(doc.querySelector('script#__NEXT_DATA__')?.textContent ?? '').props?.pageProps?.ad ?? null;
  } catch {
    return null;
  }
}

/** @returns {{titlu: string|null, pret: string|null, descriere: string|null, detalii: string[]} | null} */
export function readStoria(doc) {
  const text = (sel) => {
    const el = doc.querySelector(sel);
    return cleanText(el?.innerText ?? el?.textContent ?? '') || null;
  };
  const ad = nextAd(doc);
  const titlu = text('[data-cy="adPageAdTitle"]') ?? (ad?.title ? String(ad.title) : null);
  const pret = text('[data-cy="adPageHeaderPrice"]');
  // Descrierea e completată în pagină doar după hidratare și poate fi restrânsă („Vezi mai mult”):
  // textul complet vine din __NEXT_DATA__ când e disponibil.
  const descriere = (ad?.description ? htmlToText(ad.description) : null) || text('[data-cy="adPageAdDescription"]');

  const detalii = [];
  const seen = new Set();
  for (const item of [...(ad?.topInformation ?? []), ...(ad?.additionalInformation ?? [])]) {
    const label = LABELS[item?.label];
    if (!label || seen.has(item.label) || !Array.isArray(item.values) || item.values.length === 0) continue;
    seen.add(item.label);
    detalii.push(`${label}: ${item.values.map(cleanValue).join(', ')}${item.unit ? ` ${item.unit}` : ''}`);
  }
  if (!titlu && !descriere) return null;
  const img = ad?.images?.[0];
  const imagine = typeof img === 'string' ? img : (img?.medium ?? img?.large ?? null); // medium: suficient pentru miniaturi
  return { titlu, pret, descriere, detalii, imagine };
}
