// RentSmart — furnizorii pentru „Alternative”: construiesc URL-ul de căutare și citesc datele structurate
// pe care site-ul le publică deja în pagina de rezultate (fără a ocoli protecții, fără autentificare).
// Verificat (noiembrie 2026): robots.txt permite paginile de rezultate pe toate trei; toate răspund unui
// User-Agent care se prezintă onest. OLX și Imobiliare.ro refuză cererile automate (HTTP 403): nu sunt incluse.
//
// Rezultat normalizat (comun tuturor furnizorilor):
// { id, sursa, titlu, url, pret: {valoare, moneda: 'EUR'|'RON'}, camere, suprafataMp, localitate, cartier, imagine }

import { parseLenientJson } from '../../../extension/src/content/structured.js';
import { decodeEntities } from '../../../extension/src/content/text.js';
import { roomsFromText } from '../../../extension/src/shared/search/cities.js';

const ROOMS_ENUM = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
const clean = (s) => (s == null ? null : decodeEntities(String(s)).replace(/\s+/g, ' ').trim() || null);

/** URL https pe domeniul așteptat (sau pe un CDN de imagini https); altfel null. */
export function safeUrl(raw, hostRe) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== 'https:') return null;
    if (hostRe && !hostRe.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
/** Imagine https, nu logo / SVG / „fără imagine”. */
export function safeImage(raw) {
  const u = safeUrl(raw);
  if (!u || /\.svg(\?|$)|no_img|placeholder|logo/i.test(u)) return null;
  return u;
}

function price(valoare, moneda) {
  const v = Number(String(valoare ?? '').replace(/\s/g, '').replace(',', '.'));
  const m = /€|eur/i.test(String(moneda)) ? 'EUR' : /ron|lei/i.test(String(moneda)) ? 'RON' : null;
  return Number.isFinite(v) && v > 0 && m ? { valoare: Math.round(v), moneda: m } : null;
}
const areaOf = (s) => {
  const m = String(s ?? '').match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:mp|m²|m2)(?![a-z0-9])/i);
  return m ? Math.round(Number(m[1].replace(',', '.'))) : null;
};

// ---------------------------------------------------------------------------------------------- Storia
export const storia = {
  id: 'storia',
  nume: 'Storia',
  buildUrl({ city, camere, pretMinimEUR }) {
    const p = new URLSearchParams();
    if (camere) p.set('roomsNumber', `[${ROOMS_ENUM[camere - 1]}]`);
    if (pretMinimEUR) {
      p.set('priceMin', String(pretMinimEUR));
      p.set('priceCurrency', 'EUR');
    }
    p.set('by', 'PRICE');
    p.set('direction', 'ASC');
    return `https://www.storia.ro/ro/rezultate/inchiriere/apartament/${city.storia}?${p}`;
  },
  parse(html) {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('STRUCTURA');
    const items = JSON.parse(m[1])?.props?.pageProps?.data?.searchAds?.items;
    if (!Array.isArray(items)) throw new Error('STRUCTURA');
    const out = [];
    for (const x of items) {
      if (x?.hidePrice || (x?.transaction && x.transaction !== 'RENT')) continue;
      const url = x?.slug ? safeUrl(`https://www.storia.ro/ro/oferta/${encodeURIComponent(x.slug)}`, /(^|\.)storia\.ro$/) : null;
      const pret = price(x?.totalPrice?.value ?? x?.rentPrice?.value, x?.totalPrice?.currency ?? x?.rentPrice?.currency);
      if (!url || !pret) continue;
      const place = x?.location?.reverseGeocoding?.locations?.at?.(-1)?.fullName ?? '';
      const parts = place.split(',').map((s) => s.trim()).filter(Boolean);
      const rooms = ROOMS_ENUM.indexOf(x?.roomsNumber);
      out.push({
        id: `storia:${x.id ?? x.slug}`,
        sursa: 'storia',
        titlu: clean(x.title),
        url,
        pret,
        camere: roomsFromText(x.title) ?? (rooms >= 0 ? rooms + 1 : null),
        suprafataMp: Number.isFinite(x?.areaInSquareMeters) ? Math.round(x.areaInSquareMeters) : null,
        localitate: parts.length >= 2 ? parts[parts.length - 2] : null,
        cartier: parts.length >= 3 ? parts[0] : null,
        imagine: safeImage(x?.images?.[0]?.medium ?? x?.images?.[0]?.large ?? x?.images?.[0]?.small),
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------------------------------------- Publi24
const PUBLI24_CATEGORY = { 1: 'apartamente-1-camera', 2: 'apartamente-2-camere', 3: 'apartamente-3-camere', 4: 'apartamente-4-camere' };

export const publi24 = {
  id: 'publi24',
  nume: 'Publi24',
  buildUrl({ city, camere }) {
    const cat = PUBLI24_CATEGORY[camere] ?? null;
    return `https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/${cat ? `${cat}/` : ''}${city.publi24}/`;
  },
  parse(html, { camere } = {}) {
    let list = null;
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        const j = parseLenientJson(m[1]);
        if (j?.['@type'] === 'ItemList') list = j.itemListElement;
      } catch {
        // alt bloc JSON-LD
      }
    }
    if (!Array.isArray(list)) throw new Error('STRUCTURA');
    const out = [];
    for (const x of list) {
      const url = x?.url ? safeUrl(new URL(String(x.url), 'https://www.publi24.ro/').toString(), /(^|\.)publi24\.ro$/) : null;
      const pret = price(x?.offers?.price, x?.offers?.priceCurrency);
      if (!url || !pret) continue;
      const desc = `${x?.name ?? ''} ${x?.offers?.itemOffered?.description ?? x?.description ?? ''}`;
      out.push({
        id: `publi24:${url.split('/').pop()?.replace(/\.html$/, '')}`,
        sursa: 'publi24',
        titlu: clean(x.name),
        url,
        pret,
        camere: roomsFromText(x.name) ?? camere ?? null,
        suprafataMp: areaOf(desc),
        localitate: clean(x?.offers?.availableAtOrFrom?.address?.addressLocality),
        cartier: null,
        imagine: safeImage([].concat(x?.image ?? [])[0]?.contentUrl ?? [].concat(x?.image ?? [])[0]),
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------------------------------------- HomeZZ
export const homezz = {
  id: 'homezz',
  nume: 'HomeZZ',
  buildUrl({ city, camere }) {
    // Cele mai recente: sortarea după preț crescător aduce anunțuri vechi, probabil neactualizate.
    if (camere === 1) return `https://homezz.ro/inchiriere-garsoniere/${city.homezz}?sort=date_desc`;
    const p = new URLSearchParams();
    if (camere) p.set('numar_camere', String(camere));
    p.set('sort', 'date_desc');
    return `https://homezz.ro/inchiriere-apartamente/${city.homezz}?${p}`;
  },
  parse(html) {
    const m = html.match(/id="adListing"[^>]*data-props='([^']*)'/);
    if (!m) throw new Error('STRUCTURA');
    const props = JSON.parse(decodeEntities(m[1]));
    const ads = props?.initialData?.ads;
    if (!Array.isArray(ads)) throw new Error('STRUCTURA');
    const out = [];
    for (const a of ads) {
      const d = a?.details;
      const url = d?.url ? safeUrl(d.url, /(^|\.)homezz\.ro$/) : null;
      const pret = price(d?.price, d?.currency);
      if (!url || !pret) continue;
      const rooms = Number.parseInt(d?.attributes?.total_rooms, 10);
      out.push({
        id: `homezz:${d.id ?? url}`,
        sursa: 'homezz',
        titlu: clean(d.title),
        url,
        pret,
        camere: roomsFromText(d.title) ?? (Number.isInteger(rooms) && rooms > 0 ? rooms : props?.filterValues?.tip_proprietate === 'garsoniere' ? 1 : null),
        suprafataMp: areaOf(d?.attributes?.square_meters),
        localitate: clean(d?.location?.city),
        cartier: null,
        imagine: safeImage(d?.images?.[0]),
      });
    }
    return out;
  },
};

export const SEARCH_PROVIDERS = Object.freeze([storia, publi24, homezz]);

/** Furnizorii verificați care NU pot fi folosiți și motivul (afișat în interfață). */
export const UNAVAILABLE_PROVIDERS = Object.freeze([
  { id: 'olx', nume: 'OLX', motiv: 'refuză cererile automate (HTTP 403); API-ul oficial cere cont de partener' },
  { id: 'imobiliare', nume: 'Imobiliare.ro', motiv: 'refuză cererile automate (HTTP 403), iar robots.txt interzice filtrele de căutare' },
]);
