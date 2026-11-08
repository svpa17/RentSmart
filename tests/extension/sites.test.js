// Extracția universală: profiluri (publi24, homezz), date structurate, extractorul universal pe site-uri
// necunoscute, conținut încărcat dinamic, navigare SPA, „nu pare un anunț”, fără analize duble.
// Structurile HTML reproduc paginile reale verificate (noiembrie 2026); conținutul e FICTIV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readPage } from '../../extension/src/content/readPage.js';
import { parseLenientJson } from '../../extension/src/content/structured.js';
import { analysisKey, assessListing, listingUrlKey, textHash } from '../../extension/src/content/listing.js';
import { readWhenReady } from '../../extension/src/content/entry.js';

function page(html, url) {
  const { document, window } = parseHTML(html);
  Object.defineProperty(document, 'location', { value: { href: url } });
  globalThis.MutationObserver = window.MutationObserver;
  return document;
}

const NOISE = `<header><nav><a href="/">Acasă</a><a href="/cont">Contul meu</a></nav></header>
  <div class="cookie-banner">Folosim cookie-uri. Accept</div>
  <div id="appDlModal" class="app-dl-modal">Descarcă aplicația</div>
  <script>var x = function () { return 1; };</script>`;
const FOOTER = `<section class="similar-ads"><h2>Anunțuri similare</h2><a href="/1">Garsonieră 250 €</a><a href="/2">Studio 300 €</a></section>
  <footer>© Portal · Termeni · Contact</footer>`;

// publi24.ro: JSON-LD cu rânduri noi brute în descriere (JSON invalid), .product-price, .article-attributes.
const publi24 = `<html><head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Product","name":"Apartament 2 camere de inchiriat Zorilor",
   "description":"Apartament mobilat.
Preț: 450 €/lună.",
   "offers":{"@type":"Offer","price":"450.00","priceCurrency":"EUR","businessFunction":"http://purl.org/goodrelations/v1#LeaseOut",
     "availableAtOrFrom":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Cluj-Napoca","addressRegion":"Cluj"}}}}
  </script></head><body>${NOISE}
  <div class="row detail-title"><div><h1> Apartament 2 camere de inchiriat Zorilor </h1></div>
    <div><span class="product-price"><span>450</span> <span>EUR <span class="detail-price-type"></span></span></span></div></div>
  <div class="row detail-info"><p><a>Cluj</a>, <a>Cluj-Napoca</a></p></div>
  <div class="article-detail"><h5>Specificații</h5><div class="article-attributes">
    <div class="attribute-item"><div class="attribute-label"><strong>Suprafata utila</strong></div><div class="attribute-value">52 m<sup>2</sup></div></div>
    <div class="attribute-item"><div class="attribute-label"><strong>Etaj</strong></div><div class="attribute-value"><a>etaj 2</a></div></div>
  </div></div>
  <div class="article-description">Apartament mobilat, centrală proprie. Garanție o chirie. Comision 50%.</div>
  ${FOOTER}</body></html>`;

// homezz.ro: JSON-LD RealEstateListing cu prețul în mainEntity.offers; atribute data-test-id.
const homezz = `<html><head><script type="application/ld+json">{"@context":"http://schema.org","@graph":[
  {"@type":"BreadcrumbList","itemListElement":[]},
  {"@type":"RealEstateListing","name":"2 camere Gheorgheni","description":"Apartament de 2 camere.",
   "contentLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Cluj-Napoca","addressRegion":"Cluj"}},
   "mainEntity":{"@type":"Product","offers":{"@type":"Offer","price":"2300","priceCurrency":"RON"},
     "additionalProperty":[{"@type":"PropertyValue","name":"Numar camere","value":"2"}]}}]}</script></head><body>${NOISE}
  <h1 data-test-id="ad-title"><span style="display: block;">2 camere Gheorgheni</span><span class="info-subtitle">Apartament de inchiriat 2 camere</span></h1>
  <div class="main-price" data-test-id="ad-price"> 2.300 lei </div>
  <div class="details-attr"><p data-test-id="ad-attribute"><span>Număr camere</span><span>2</span></p>
    <p data-test-id="ad-attribute"><span>Suprafața utilă</span><span>48 m²</span></p></div>
  <div class="description" id="descriptionBox"><pre data-test-id="ad-description">Apartament de 2 camere, întreținere 300 lei iarna. Fără comision.</pre></div>
  ${FOOTER}</body></html>`;

test('publi24.ro: profilul citește titlul, prețul, locația, specificațiile și descrierea, fără zgomot', () => {
  const r = readPage(page(publi24, 'https://www.publi24.ro/anunturi/imobiliare/de-inchiriat/apartamente/anunt/x/abc.html'));
  assert.equal(r.metoda, 'publi24');
  assert.equal(r.titlu, 'Apartament 2 camere de inchiriat Zorilor');
  assert.equal(r.pret, '450 EUR');
  const lines = r.text.split('\n');
  assert.deepEqual(lines.slice(0, 3), ['Apartament 2 camere de inchiriat Zorilor', 'Preț: 450 EUR', 'Locație: Cluj, Cluj-Napoca']);
  assert.ok(lines.includes('Suprafata utila: 52 m2'));
  assert.ok(lines.includes('Etaj: etaj 2'));
  assert.ok(r.text.includes('Garanție o chirie. Comision 50%.'));
  for (const noise of ['Contul meu', 'cookie', 'Descarcă aplicația', 'function', 'Anunțuri similare', 'Termeni']) assert.ok(!r.text.includes(noise), noise);
  assert.equal(r.pareAnunt, true);
});

test('homezz.ro: profilul pe data-test-id; prețul în RON', () => {
  const r = readPage(page(homezz, 'https://homezz.ro/2-camere-gheorgheni-123456.html'));
  assert.equal(r.metoda, 'homezz');
  assert.equal(r.titlu, '2 camere Gheorgheni');
  assert.equal(r.pret, '2.300 lei');
  assert.ok(r.text.split('\n').includes('Suprafața utilă: 48 m²'));
  assert.ok(r.text.includes('întreținere 300 lei iarna. Fără comision.'));
  assert.ok(!r.text.includes('Anunțuri similare'));
});

test('profil depășit (structura s-a schimbat) → extractorul universal, cu datele structurate', () => {
  const changed = publi24.replace('article-description', 'descriere-noua').replace(/detail-title/g, 'titlu-nou');
  const r = readPage(page(changed, 'https://www.publi24.ro/anunturi/x.html'));
  assert.equal(r.metoda, 'generic');
  assert.equal(r.pret, '450 EUR'); // din JSON-LD (reparat)
  assert.ok(r.text.includes('Garanție o chirie. Comision 50%.'));
  assert.ok(!r.text.includes('Contul meu'));
});

test('site necunoscut (ex. imobiliare.ro, portaluri străine): extractorul universal alege zona anunțului', () => {
  // Aceleași pagini reale, cu un domeniu fără profil: universalul trebuie să citească anunțul.
  for (const [html, pret, needle] of [
    [publi24, '450 EUR', 'Garanție o chirie'],
    [homezz, '2300 RON', 'Fără comision'],
  ]) {
    const r = readPage(page(html, 'https://www.imobiliare.ro/oferta/apartament-de-inchiriat-x'));
    assert.equal(r.metoda, 'generic');
    assert.equal(r.pret, pret);
    assert.ok(r.text.includes(needle));
    assert.ok(!r.text.includes('Contul meu') && !r.text.includes('Anunțuri similare') && !r.text.includes('cookie'));
    assert.equal(r.pareAnunt, true);
  }
  // Fără date structurate: prețul se găsește în text, în EUR sau RON, iar titlul vine din h1.
  const plain = (price) =>
    `<html><body>${NOISE}<div class="wrap"><div class="listing"><h1>Studio for rent, Old Town</h1><div class="price">${price}</div>
     <p>Bright studio, 30 m², deposit one month. Utilities about 80 € per month.</p></div></div>${FOOTER}</body></html>`;
  const eur = readPage(page(plain('€ 650 / month'), 'https://rentals.example.com/listing/9'));
  assert.equal(eur.metoda, 'generic');
  assert.equal(eur.titlu, 'Studio for rent, Old Town');
  assert.equal(eur.pret, '€ 650');
  assert.equal(eur.pareAnunt, true);
  const ron = readPage(page(plain('1.950 lei / lună'), 'https://chirii.example.ro/a/1'));
  assert.equal(ron.pret, '1.950 lei');
  assert.ok(!ron.text.includes('Garsonieră 250 €'), 'prețurile din „anunțuri similare” nu intră');
});

test('date lipsă: nu se inventează nimic (fără preț → pret null, textul rămâne cel din pagină)', () => {
  const r = readPage(page('<html><body><main><h1>Apartament de închiriat</h1><p>Prețul la cerere. 2 camere, mobilat.</p></main></body></html>', 'https://x.example/a'));
  assert.equal(r.pret, null);
  assert.equal(r.text, 'Apartament de închiriat\nPrețul la cerere. 2 camere, mobilat.');
  assert.equal(r.pareAnunt, true); // închiriere + locuință
});

test('„nu pare un anunț de închiriere”: pagini fără semnale → panoul întreabă înainte de AI', () => {
  const news = readPage(page('<html><body><main><h1>Știri</h1><p>Guvernul a anunțat astăzi un nou proiect de lege despre educație.</p></main></body></html>', 'https://stiri.example/a'));
  assert.equal(news.pareAnunt, false);
  // Vânzare (nu închiriere) nu e tratată ca anunț de închiriere.
  assert.equal(assessListing({ text: 'Apartament 3 camere de vânzare, 115.000 EUR, 70 mp.' }).pareAnunt, false);
  assert.equal(assessListing({ text: 'Garsonieră 32 mp, chirie 350 EUR pe lună, garanție o chirie.' }).pareAnunt, true);
  assert.equal(assessListing({ text: 'x'.repeat(50), structured: { tipAnunt: true }, pret: '300 EUR' }).pareAnunt, true);
});

test('JSON-LD invalid din cauza rândurilor noi brute este reparat; JSON-ul stricat rămâne ignorat', () => {
  assert.deepEqual(parseLenientJson('{"a":"x\ny\tz"}'), { a: 'x\ny\tz' });
  assert.deepEqual(parseLenientJson('{"a":"\\"q\\""}'), { a: '"q"' });
  assert.throws(() => parseLenientJson('{ invalid json'));
});

test('conținut încărcat dinamic: citirea așteaptă ca anunțul să apară în DOM', async () => {
  const doc = page('<html><body><div id="app"><p>Se încarcă…</p></div></body></html>', 'https://spa.example/anunt/1');
  setTimeout(() => {
    doc.getElementById('app').innerHTML =
      '<article><h1>Apartament 2 camere de închiriat</h1><div class="price">2.000 lei / lună</div><p>' + 'Descriere completă a anunțului. '.repeat(12) + '</p></article>';
  }, 150);
  const r = await readWhenReady(doc, { quietMs: 200, maxMs: 2000 });
  assert.equal(r.titlu, 'Apartament 2 camere de închiriat');
  assert.equal(r.pret, '2.000 lei');
  assert.equal(r.pareAnunt, true);
  // O pagină deja completă nu așteaptă.
  const t0 = Date.now();
  await readWhenReady(page(publi24, 'https://www.publi24.ro/a.html'), { quietMs: 1000, maxMs: 3000 });
  assert.ok(Date.now() - t0 < 500);
});

test('navigare SPA: cheia URL ignoră fragmentul și parametrii de urmărire, nu și ID-ul anunțului', () => {
  const a = 'https://www.olx.ro/d/oferta/apartament-IDabc.html';
  assert.equal(listingUrlKey(`${a}#galerie`), listingUrlKey(a));
  assert.equal(listingUrlKey(`${a}?utm_source=x&reason=search`), listingUrlKey(a));
  assert.notEqual(listingUrlKey('https://www.olx.ro/d/oferta/apartament-IDdef.html'), listingUrlKey(a));
  assert.notEqual(listingUrlKey('https://spa.example/?id=1'), listingUrlKey('https://spa.example/?id=2'));
  assert.equal(listingUrlKey('nu e url'), null);
});

test('fără analize duble: aceeași pagină + același text + același mod → aceeași cheie', () => {
  const base = { url: 'https://homezz.ro/x-1.html', text: 'Chirie 500 €', mod: 'ai' };
  assert.equal(analysisKey(base), analysisKey({ ...base, url: `${base.url}#foto` }));
  assert.notEqual(analysisKey(base), analysisKey({ ...base, text: 'Chirie 450 €' })); // anunțul s-a schimbat
  assert.notEqual(analysisKey(base), analysisKey({ ...base, mod: 'demo' }));
  assert.equal(textHash('abc'), textHash('abc'));
  assert.notEqual(textHash('abc'), textHash('abd'));
});
