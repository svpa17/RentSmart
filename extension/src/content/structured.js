// RĂSCRUCE AI — datele structurate ale paginii: application/ld+json (schema.org), microdate și meta og:*.
// Funcționează pe orice site. Nu inventează nimic: întoarce doar ce pagina declară explicit.
import { cleanText, decodeEntities } from './text.js';

const meta = (doc, prop) =>
  doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ??
  doc.querySelector(`meta[name="${prop}"]`)?.getAttribute('content') ??
  null;

/** Tipurile schema.org care descriu un anunț / o locuință / o ofertă. */
const LISTING_TYPES = /^(RealEstateListing|Accommodation|Apartment|House|Residence|SingleFamilyResidence|ApartmentComplex|Room|Suite|Place|LodgingBusiness)$/i;
const OFFER_TYPES = /^(Product|Offer|AggregateOffer|Accommodation|Apartment|House|Residence|SingleFamilyResidence|RealEstateListing|Room|Suite)$/i;

function* walk(node, depth = 0) {
  if (depth > 6) return;
  if (Array.isArray(node)) for (const n of node) yield* walk(n, depth + 1);
  else if (node && typeof node === 'object') {
    yield node;
    for (const k of ['@graph', 'mainEntity', 'itemOffered', 'offers']) if (node[k]) yield* walk(node[k], depth + 1);
  }
}

/**
 * JSON.parse tolerant: unele site-uri (ex. publi24.ro) pun rânduri noi brute în șiruri, ceea ce e JSON
 * invalid. Caracterele de control din interiorul șirurilor se escapează; restul rămâne neschimbat.
 */
export function parseLenientJson(src) {
  try {
    return JSON.parse(src);
  } catch {
    let out = '';
    let inStr = false;
    let esc = false;
    for (const ch of String(src)) {
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        else if (ch.charCodeAt(0) < 0x20) {
          out += ch === '\n' ? '\\n' : ch === '\t' ? '\\t' : ch === '\r' ? '' : ' ';
          continue;
        }
      } else if (ch === '"') inStr = true;
      out += ch;
    }
    return JSON.parse(out); // aruncă dacă nici așa nu e JSON
  }
}

const types = (n) => [].concat(n?.['@type'] ?? []).map(String);

/** URL https al unei poze de anunț; null pentru logo, SVG, „fără imagine” sau orice altceva decât https. */
export function safeImageUrl(raw) {
  try {
    const u = new URL(String(raw ?? '').trim());
    if (u.protocol !== 'https:' || u.href.length > 2048) return null;
    if (/\.svg(\?|$)|no_img|placeholder|logo|favicon|sprite/i.test(u.pathname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Prima imagine dintr-un câmp schema.org `image`: șir, listă sau ImageObject. */
function imageOf(n) {
  for (const im of [].concat(n?.image ?? [], n?.mainEntity?.image ?? [], n?.offers?.itemOffered?.image ?? [])) {
    const u = safeImageUrl(typeof im === 'string' ? im : (im?.contentUrl ?? im?.url));
    if (u) return u;
  }
  return null;
}
const str = (v) => (v == null || typeof v === 'object' ? null : cleanText(decodeEntities(String(v))) || null);

function priceOf(n) {
  for (const o of [].concat(n?.offers ?? []).concat(types(n).some((t) => /Offer/i.test(t)) ? [n] : [])) {
    const p = o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price;
    if (p != null && p !== '') {
      const cur = o.priceCurrency ?? o.priceSpecification?.priceCurrency;
      return `${String(p).replace(/\.00$/, '')}${cur ? ` ${cur}` : ''}`;
    }
  }
  return null;
}

function addressOf(n) {
  const a = n?.address ?? n?.contentLocation?.address ?? n?.availableAtOrFrom?.address ?? n?.offers?.availableAtOrFrom?.address;
  if (!a) return null;
  if (typeof a === 'string') return str(a);
  return [a.streetAddress, a.addressLocality, a.addressRegion].map(str).filter(Boolean).join(', ') || null;
}

const UNIT_CODES = { MTK: 'm²', MTR: 'm', FTK: 'ft²' };
const quantity = (v) =>
  v && typeof v === 'object'
    ? [String(v.value ?? '').replace(/\.0+$/, ''), UNIT_CODES[v.unitText ?? v.unitCode] ?? v.unitText ?? v.unitCode].map(str).filter(Boolean).join(' ')
    : str(v);

function detailsOf(n) {
  const out = [];
  for (const p of [].concat(n?.additionalProperty ?? [])) {
    const name = str(p?.name);
    const value = quantity(p?.value);
    if (name && value && `${name}: ${value}`.length <= 120) out.push(`${name}: ${value}`);
  }
  const fixed = [
    ['Suprafață', n?.floorSize],
    ['Număr camere', n?.numberOfRooms],
    ['Dormitoare', n?.numberOfBedrooms],
  ];
  for (const [label, v] of fixed) {
    const value = quantity(v);
    if (value) out.push(`${label}: ${value}`);
  }
  return out;
}

function fromLdJson(doc) {
  const found = { titlu: null, descriere: null, pret: null, locatie: null, detalii: [], tipAnunt: false, inchiriere: false, imagine: null };
  let any = false;
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try {
      data = parseLenientJson(s.textContent);
    } catch {
      continue;
    }
    for (const n of walk(data)) {
      const t = types(n);
      if (!t.some((x) => OFFER_TYPES.test(x) || LISTING_TYPES.test(x))) continue;
      any = true;
      if (t.some((x) => /^RealEstateListing$/i.test(x)) || t.some((x) => LISTING_TYPES.test(x) && !/^Place$/i.test(x))) found.tipAnunt = true;
      if (/LeaseOut/i.test(String(n.businessFunction ?? n.offers?.businessFunction ?? ''))) found.inchiriere = true;
      found.titlu ??= str(n.name);
      found.descriere ??= str(n.description);
      found.pret ??= priceOf(n);
      found.locatie ??= addressOf(n);
      found.imagine ??= imageOf(n);
      for (const d of detailsOf(n)) if (!found.detalii.includes(d)) found.detalii.push(d);
    }
  }
  return any ? found : null;
}

/** Microdate schema.org (itemprop) pentru preț, dacă există. */
function microdataPrice(doc) {
  const el = doc.querySelector('[itemprop="price"]');
  if (!el) return null;
  const v = el.getAttribute('content') ?? el.textContent;
  const cur = doc.querySelector('[itemprop="priceCurrency"]');
  const c = cur?.getAttribute('content') ?? cur?.textContent;
  return v ? cleanText(`${v}${c ? ` ${c}` : ''}`) || null : null;
}

/**
 * @param {Document} doc
 * @returns {{titlu: string|null, descriere: string|null, pret: string|null, locatie: string|null,
 *   detalii: string[], tipAnunt: boolean, inchiriere: boolean, imagine: string|null}}
 */
export function readStructuredData(doc) {
  const ld = fromLdJson(doc) ?? { titlu: null, descriere: null, pret: null, locatie: null, detalii: [], tipAnunt: false, inchiriere: false, imagine: null };
  const amount = meta(doc, 'og:price:amount') ?? meta(doc, 'product:price:amount');
  const currency = meta(doc, 'og:price:currency') ?? meta(doc, 'product:price:currency');
  const clean = (s) => (s ? cleanText(decodeEntities(s)) || null : null);
  return {
    titlu: clean(ld.titlu ?? meta(doc, 'og:title')),
    descriere: clean(ld.descriere ?? meta(doc, 'og:description')),
    pret: clean(ld.pret ?? (amount ? `${amount}${currency ? ` ${currency}` : ''}` : null) ?? microdataPrice(doc)),
    locatie: ld.locatie,
    detalii: ld.detalii,
    tipAnunt: ld.tipAnunt,
    inchiriere: ld.inchiriere,
    // Poza principală: datele structurate întâi (unele site-uri pun logo-ul în og:image), apoi og:image.
    imagine: ld.imagine ?? safeImageUrl(meta(doc, 'og:image')) ?? safeImageUrl(meta(doc, 'og:image:secure_url')) ?? safeImageUrl(meta(doc, 'twitter:image')),
  };
}
