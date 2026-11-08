// Căutarea de alternative (backend): parsarea fiecărui furnizor pe structura reală a paginilor (conținut FICTIV),
// URL-urile de căutare, filtrul „nu e chirie lunară”, deduplicarea, izolarea erorilor, cache-ul,
// validarea cererii (nicio dată financiară acceptată) și endpoint-ul cu rate limiting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homezz, publi24, safeImage, storia } from '../../api/_lib/search/providers.js';
import { createSearchService, dedupe, isMonthlyRental } from '../../api/_lib/search/index.js';
import { validateSearchRequest } from '../../api/_lib/validate.js';
import { createAlternativesHandler } from '../../api/_lib/handlers.js';
import { createMemoryStore } from '../../api/_lib/rateLimit.js';
import { cityById, matchCity, roomsFromText } from '../../extension/src/shared/search/cities.js';

const CLUJ = cityById('cluj-napoca');
const EXT = 'chrome-extension://abcdefghijklmnop';
const INSTALL = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const ENV = { ALLOWED_ORIGINS: EXT };

// Structura reală (noiembrie 2026), conținut FICTIV.
const storiaHtml = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      data: {
        searchAds: {
          items: [
            {
              id: 101, title: 'Apartament 2 camere Zorilor', slug: 'apartament-2-camere-zorilor-IDabc', transaction: 'RENT',
              totalPrice: { value: 450, currency: 'EUR' }, roomsNumber: 'TWO', areaInSquareMeters: 52.4,
              location: { reverseGeocoding: { locations: [{ fullName: 'Cluj' }, { fullName: 'Zorilor, Cluj-Napoca, Cluj' }] } },
              images: [{ small: 'https://img.example/s.jpg', medium: 'https://img.example/m.jpg' }],
            },
            { id: 102, title: 'Preț la cerere', slug: 'pret-la-cerere-IDdef', hidePrice: true, totalPrice: { value: 1, currency: 'EUR' } },
            { id: 103, title: 'Fără preț', slug: 'fara-pret-IDghi', totalPrice: null },
            {
              id: 104, title: 'Garsonieră Mărăști', slug: 'garsoniera-marasti-IDjkl', transaction: 'RENT',
              totalPrice: { value: 1600, currency: 'RON' }, roomsNumber: 'ONE', areaInSquareMeters: 30, images: [],
            },
          ],
        },
      },
    },
  },
})}</script></body></html>`;

const publi24Html = `<html><head><script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
  { "@type": "Product", "name": "Ap 2 cam de &#238;nchiriat Gheorgheni ",
    "description": "Apartament mobilat, 48 mp,
balcon.",
    "url": "anunturi/imobiliare/de-inchiriat/apartamente/apartamente-2-camere/anunt/ap-2-cam-gheorgheni/abc123.html",
    "image": [{ "@type": "ImageObject", "contentUrl": "https://s3.publi24.ro/x/top/1.webp" }],
    "offers": { "@type": "Offer", "price": "400.00", "priceCurrency": "EUR",
      "availableAtOrFrom": { "@type": "Place", "address": { "addressLocality": "Cluj-Napoca" } } } },
  { "@type": "Product", "name": "Fără imagine", "url": "anunturi/x/anunt/fara/def456.html",
    "image": [{ "@type": "ImageObject", "contentUrl": "https://s3.publi24.ro/vertical/no_img.png" }],
    "offers": { "@type": "Offer", "price": "1900", "priceCurrency": "RON" } },
  { "@type": "Product", "name": "Link extern", "url": "https://evil.example/x.html", "offers": { "price": "300", "priceCurrency": "EUR" } }
] }
</script></head><body></body></html>`;

const hzProps = {
  filterValues: { tip_proprietate: 'apartamente', numar_camere: '2' },
  initialData: {
    ads: [
      { type: 'ad', details: { id: 9001, title: 'Apartament 2 camere "Iris"', url: 'https://homezz.ro/apartament-2-camere-iris-9001.html', price: '430', currency: '€',
        location: { city: 'Cluj-Napoca' }, images: ['https://homezz.ro/media/9001_1.jpg'], attributes: { square_meters: '46 m²', total_rooms: '2' } } },
      { type: 'ad', details: { id: 9002, title: 'Fără preț', url: 'https://homezz.ro/x-9002.html', price: null, currency: '€' } },
    ],
  },
};
const homezzHtml = `<div id="adListing" data-props='${JSON.stringify(hzProps).replace(/"/g, '&quot;')}'></div>`;

test('Storia: rezultatele din __NEXT_DATA__ → anunțuri normalizate; fără preț / preț ascuns → excluse', () => {
  const r = storia.parse(storiaHtml);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {
    id: 'storia:101', sursa: 'storia', titlu: 'Apartament 2 camere Zorilor', url: 'https://www.storia.ro/ro/oferta/apartament-2-camere-zorilor-IDabc',
    pret: { valoare: 450, moneda: 'EUR' }, camere: 2, suprafataMp: 52, localitate: 'Cluj-Napoca', cartier: 'Zorilor', imagine: 'https://img.example/m.jpg',
  });
  assert.equal(r[1].imagine, null); // fără poză → înlocuitor în interfață, anunțul rămâne
  assert.deepEqual(r[1].pret, { valoare: 1600, moneda: 'RON' });
  assert.throws(() => storia.parse('<html>altă structură</html>'), /STRUCTURA/);
});

test('Publi24: ItemList JSON-LD (cu rânduri noi brute), URL relativ → absolut, „no_img” → fără imagine, linkuri externe respinse', () => {
  const r = publi24.parse(publi24Html, { camere: 2 });
  assert.equal(r.length, 2);
  assert.equal(r[0].titlu, 'Ap 2 cam de închiriat Gheorgheni');
  assert.equal(r[0].url, 'https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/apartamente-2-camere/anunt/ap-2-cam-gheorgheni/abc123.html');
  assert.deepEqual([r[0].pret, r[0].camere, r[0].suprafataMp, r[0].localitate], [{ valoare: 400, moneda: 'EUR' }, 2, 48, 'Cluj-Napoca']);
  assert.equal(r[0].imagine, 'https://s3.publi24.ro/x/top/1.webp');
  assert.equal(r[1].imagine, null);
  assert.ok(!r.some((x) => x.url.includes('evil.example')));
});

test('HomeZZ: data-props (entități HTML) → anunțuri; moneda „€” = EUR; suprafața și camerele din atribute', () => {
  const r = homezz.parse(homezzHtml);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], {
    id: 'homezz:9001', sursa: 'homezz', titlu: 'Apartament 2 camere "Iris"', url: 'https://homezz.ro/apartament-2-camere-iris-9001.html',
    pret: { valoare: 430, moneda: 'EUR' }, camere: 2, suprafataMp: 46, localitate: 'Cluj-Napoca', cartier: null, imagine: 'https://homezz.ro/media/9001_1.jpg',
  });
});

test('URL-urile de căutare (verificate live): oraș, camere, sortare după preț, preț minim doar unde e suportat', () => {
  assert.equal(
    storia.buildUrl({ city: CLUJ, camere: 2, pretMinimEUR: 280 }),
    'https://www.storia.ro/ro/rezultate/inchiriere/apartament/cluj/cluj--napoca?roomsNumber=%5BTWO%5D&priceMin=280&priceCurrency=EUR&by=PRICE&direction=ASC',
  );
  assert.equal(publi24.buildUrl({ city: CLUJ, camere: 2 }), 'https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/apartamente-2-camere/cluj/cluj-napoca/');
  assert.equal(publi24.buildUrl({ city: cityById('bucuresti'), camere: null }), 'https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/bucuresti/');
  assert.equal(homezz.buildUrl({ city: CLUJ, camere: 3 }), 'https://homezz.ro/inchiriere-apartamente/cluj-napoca-cj?numar_camere=3&sort=date_desc');
  assert.equal(homezz.buildUrl({ city: CLUJ, camere: 1 }), 'https://homezz.ro/inchiriere-garsoniere/cluj-napoca-cj?sort=date_desc');
});

test('imagini: doar https, fără logo / SVG / „fără imagine”', () => {
  assert.equal(safeImage('http://x.example/a.jpg'), null);
  assert.equal(safeImage('https://x.example/logo.svg'), null);
  assert.equal(safeImage('javascript:alert(1)'), null);
  assert.equal(safeImage('https://cdn.example/a.webp'), 'https://cdn.example/a.webp');
});

test('nu sunt chirii lunare comparabile: cazare, regim hotelier, camere / paturi în locuințe comune', () => {
  for (const t of ['Cazare garsonieră Mamaia', 'Camera de închiriat pe noapte', 'Camere de inchiriat la casă', 'Loc în cameră pentru studentă', 'Ap. 3 camere regim hotelier', 'Se inchiriaza doar o camera la apartament cu 2 camere', 'Ofer o cameră în apartament'])
    assert.equal(isMonthlyRental({ titlu: t }), false, t);
  for (const t of ['Apartament 2 camere de inchiriat Zorilor', 'Garsonieră modernă Tomis Nord', 'Închiriez ap. 3 camere decomandat'])
    assert.equal(isMonthlyRental({ titlu: t }), true, t);
});

test('deduplicare: același URL o dată; același apartament pe două site-uri (preț, suprafață, titlu) o dată', () => {
  const a = { id: 'storia:1', url: 'https://www.storia.ro/a', titlu: 'Apartament 2 camere 62 mp garaj terasa Buna Ziua', pret: { valoare: 600, moneda: 'EUR' }, suprafataMp: 62, imagine: null };
  const b = { id: 'homezz:2', url: 'https://homezz.ro/b', titlu: 'Apartament 2 camere, 62 mp, garaj, terasa in Buna Ziua', pret: { valoare: 600, moneda: 'EUR' }, suprafataMp: 62, imagine: 'https://homezz.ro/b.jpg' };
  const c = { ...b, id: 'homezz:3', url: 'https://homezz.ro/c', titlu: 'Altă garsonieră Mărăști', pret: { valoare: 600, moneda: 'EUR' } };
  const out = dedupe([a, { ...a }, b, c]);
  assert.deepEqual(out.map((x) => x.id), ['storia:1', 'homezz:3']);
  assert.equal(out[0].imagine, 'https://homezz.ro/b.jpg'); // imaginea completată din duplicat
});

test('serviciul: un furnizor blocat sau căzut nu oprește căutarea; rezultatele sunt filtrate; cache 15 min', async () => {
  let calls = 0;
  let t = 1_000_000;
  const fetchImpl = async (url) => {
    calls += 1;
    if (url.includes('storia')) return new Response(storiaHtml, { status: 200 });
    if (url.includes('publi24')) return new Response('Forbidden', { status: 403 });
    const e = new Error('timeout');
    e.name = 'TimeoutError';
    throw e;
  };
  const svc = createSearchService({ fetchImpl, now: () => t });
  const r = await svc.search({ oras: 'cluj-napoca', camere: 2, pretMinimEUR: null });
  assert.deepEqual(r.furnizori.map((f) => [f.id, f.ok, f.eroare]), [['storia', true, null], ['publi24', false, 'BLOCAT'], ['homezz', false, 'TIMEOUT']]);
  assert.equal(r.rezultate.length, 2);
  assert.equal(r.dinCache, false);
  assert.equal(calls, 3);
  assert.equal((await svc.search({ oras: 'cluj-napoca', camere: 2, pretMinimEUR: null })).dinCache, true);
  assert.equal(calls, 3);
  t += 16 * 60 * 1000;
  await svc.search({ oras: 'cluj-napoca', camere: 2, pretMinimEUR: null });
  assert.equal(calls, 6);

  // Eșec total: nu se păstrează în cache (următoarea încercare reface cererile).
  let n = 0;
  const down = createSearchService({ fetchImpl: async () => { n += 1; throw new TypeError('offline'); } });
  const d = await down.search({ oras: 'iasi', camere: null, pretMinimEUR: null });
  assert.ok(d.furnizori.every((f) => !f.ok && f.eroare === 'INDISPONIBIL'));
  assert.deepEqual(d.rezultate, []);
  await down.search({ oras: 'iasi', camere: null, pretMinimEUR: null });
  assert.equal(n, 6);
});

test('cererea de căutare: doar oraș, camere, preț minim; orice dată financiară e respinsă', () => {
  assert.deepEqual(validateSearchRequest({ oras: 'cluj-napoca', camere: 2, pretMinimEUR: 300 }), { oras: 'cluj-napoca', camere: 2, pretMinimEUR: 300 });
  assert.deepEqual(validateSearchRequest({ oras: 'iasi' }), { oras: 'iasi', camere: null, pretMinimEUR: null });
  for (const bad of [
    { oras: 'cluj-napoca', venitNetLunar: 5200 }, // Passport: niciodată pe server
    { oras: 'cluj-napoca', bugetMaximChirie: 2000 },
    { oras: 'paris' },
    { oras: 'cluj-napoca', camere: 7 },
    { oras: 'cluj-napoca', pretMinimEUR: -1 },
    null,
    [],
  ])
    assert.throws(() => validateSearchRequest(bad), /./, JSON.stringify(bad));
});

test('endpoint: CORS + ID instalare obligatoriu, 200 cu rezultatele, rate limiting separat de AI (10/min per IP)', async () => {
  const searchService = { search: async (q) => ({ rezultate: [], furnizori: [], cautatLa: '2026-11-08T10:00:00.000Z', dinCache: false, q }) };
  const h = createAlternativesHandler({ env: ENV, store: createMemoryStore(), searchService, log: () => {} });
  const req = (body, headers = {}) =>
    new Request('https://api.test/api/alternatives', { method: 'POST', headers: { Origin: EXT, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await h.POST(req({ oras: 'iasi' }))).status, 400); // fără ID de instalare
  const ok = await h.POST(req({ oras: 'iasi', camere: 1 }, { 'x-install-id': INSTALL }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), EXT);
  assert.deepEqual((await ok.json()).data.q, { oras: 'iasi', camere: 1, pretMinimEUR: null });
  assert.equal((await h.POST(req({ oras: 'iasi', venitNetLunar: 1 }, { 'x-install-id': INSTALL }))).status, 400);
  const evil = await h.POST(new Request('https://api.test/api/alternatives', { method: 'POST', headers: { Origin: 'https://evil.example', 'x-install-id': INSTALL }, body: '{}' }));
  assert.equal(evil.status, 403);
  let last;
  for (let i = 0; i < 10; i += 1) last = await h.POST(req({ oras: 'iasi' }, { 'x-install-id': INSTALL }));
  assert.equal(last.status, 429);
});

test('orașul și camerele anunțului analizat (pentru filtrele precompletate)', () => {
  assert.equal(matchCity('Cluj-Napoca'), 'cluj-napoca');
  assert.equal(matchCity(null, 'Apartament 2 camere, zona Mănăștur, Cluj'), 'cluj-napoca');
  assert.equal(matchCity('Constanța', null), 'constanta');
  assert.equal(matchCity('Tomis Nord, Constanta'), 'constanta');
  assert.equal(matchCity('Bucureşti, Sector 3'), 'bucuresti');
  assert.equal(matchCity('Paris'), null);
  assert.equal(roomsFromText('Apartament 2 camere Tomis Nord'), 2);
  assert.equal(roomsFromText('Ap. 3 cam decomandat'), 3);
  assert.equal(roomsFromText('Garsonieră Mănăștur'), 1);
  assert.equal(roomsFromText('Apartament cu două camere'), 2);
  assert.equal(roomsFromText('Vilă 6 camere'), 4); // 4+
  assert.equal(roomsFromText('Apartament luminos'), null);
});

test('camerele: titlul explicit are prioritate față de atributul (uneori greșit) al furnizorului', () => {
  const wrong = { ...hzProps, initialData: { ads: [{ type: 'ad', details: { ...hzProps.initialData.ads[0].details, title: 'Apartament o camera Semicentral' } }] } };
  const r = homezz.parse(`<div id="adListing" data-props='${JSON.stringify(wrong).replace(/"/g, '&quot;')}'></div>`);
  assert.equal(r[0].camere, 1);
});
