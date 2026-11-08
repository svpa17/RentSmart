// RĂSCRUCE AI — profiluri declarative pentru site-urile cunoscute: doar selectori, citiți de un singur
// cititor comun (readProfile). Un profil nu e obligatoriu: fără el (sau dacă selectorii s-au schimbat),
// se folosește extractorul universal. Adaugă un site nou aici doar după ce l-ai verificat pe pagini reale.
import { cleanText } from './text.js';

/**
 * @typedef {Object} SiteProfile
 * @property {string} name
 * @property {RegExp} host
 * @property {string[]} title
 * @property {string[]} [price]
 * @property {string[]} description
 * @property {string[]} [location]
 * @property {{item: string, label: string, value: string}} [details]  perechi etichetă / valoare
 */

/** @type {SiteProfile[]} */
export const SITE_PROFILES = [
  // publi24.ro — verificat pe 4 anunțuri reale de închiriere (noiembrie 2026).
  {
    name: 'publi24',
    host: /(^|\.)publi24\.ro$/i,
    title: ['.detail-title h1', 'h1'],
    price: ['.detail-title .product-price', '.product-price'],
    description: ['.article-description'],
    location: ['.detail-info p'],
    details: { item: '.article-attributes .attribute-item', label: '.attribute-label', value: '.attribute-value' },
  },
  // homezz.ro — verificat pe 4 anunțuri reale de închiriere (noiembrie 2026); atributele data-test-id.
  {
    name: 'homezz',
    host: /(^|\.)homezz\.ro$/i,
    title: ['h1[data-test-id="ad-title"] > span', 'h1[data-test-id="ad-title"]'],
    price: ['[data-test-id="ad-price"]'],
    description: ['[data-test-id="ad-description"]', '#descriptionBox'],
    details: { item: '[data-test-id="ad-attribute"]', label: 'span:first-child', value: 'span:last-child' },
  },
];

const textOf = (el) => cleanText(el?.innerText ?? el?.textContent ?? '');
/** Text pe un singur rând (prețuri, etichete împărțite în mai multe elemente). */
const inline = (el) => textOf(el).replace(/\n+/g, ' ').trim();

function first(doc, selectors, fn = textOf) {
  for (const sel of selectors ?? []) {
    let el;
    try {
      el = doc.querySelector(sel);
    } catch {
      continue; // selector neacceptat
    }
    const t = el ? fn(el) : '';
    if (t) return t;
  }
  return null;
}

/** @returns {{titlu: string|null, pret: string|null, descriere: string|null, locatie: string|null, detalii: string[]} | null} */
export function readProfile(doc, profile) {
  const titlu = first(doc, profile.title, inline);
  const descriere = first(doc, profile.description);
  if (!titlu || !descriere) return null; // structura s-a schimbat: varianta universală
  const detalii = [];
  if (profile.details) {
    for (const item of doc.querySelectorAll(profile.details.item)) {
      const label = inline(item.querySelector(profile.details.label)).replace(/:$/, '');
      const value = inline(item.querySelector(profile.details.value));
      const line = `${label}: ${value}`;
      if (label && value && label !== value && line.length <= 120 && !detalii.includes(line)) detalii.push(line);
    }
  }
  return {
    titlu,
    pret: first(doc, profile.price, inline),
    descriere,
    locatie: first(doc, profile.location, inline),
    detalii,
  };
}

export function profileFor(hostname) {
  return SITE_PROFILES.find((p) => p.host.test(hostname)) ?? null;
}
