import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { readPage } from '../../extension/src/content/readPage.js';
import { cleanText, decodeEntities, htmlToText, limitText } from '../../extension/src/content/text.js';
import { demoListingTextA, demoListingTextB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

const root = path.resolve(import.meta.dirname, '..', '..');

/** Documentul unei pagini (linkedom nu are innerText: adaptoarele folosesc textContent ca rezervă). */
function page(html, url) {
  const { document } = parseHTML(html);
  Object.defineProperty(document, 'location', { value: { href: url } });
  return document;
}

// Structura reală storia.ro (verificată pe 5 anunțuri, noiembrie 2026), cu conținut FICTIV.
function storiaLike({ withHooks = true, withNextData = true } = {}) {
  const ad = {
    title: 'Garsonieră luminoasă Zorilor',
    description: 'Garsonieră de 30 mp în Zorilor.<br/>Întreținere aprox. 300 lei/lună.<br/><p>Fără animale.</p>',
    topInformation: [
      { label: 'area', values: ['30'], unit: 'm²' },
      { label: 'rent', values: ['400 €'] },
      { label: 'deposit', values: ['800 €'] },
      { label: 'floor', values: ['floor_no::floor_3'] },
      { label: 'heating', values: ['heating::gas'] },
      { label: 'advertiser_type', values: ['advertiser_type::agency'] },
    ],
    additionalInformation: [{ label: 'heating', values: ['heating::gas'] }],
  };
  const cy = (v) => (withHooks ? ` data-cy="${v}"` : '');
  return `<!doctype html><html><head><title>Storia</title>
    <meta property="og:title" content="Garsonieră - Cluj (judet), Zorilor • www.storia.ro">
    ${withNextData ? `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad } } })}</script>` : ''}
    </head><body><nav>Meniu Vânzare Închiriere Contul meu</nav>
    <main><h1${cy('adPageAdTitle')}>Garsonieră luminoasă Zorilor</h1>
    <strong${cy('adPageHeaderPrice')}>400 €</strong>
    <div${cy('adPageAdDescription')}></div>
    <p>${'Text generic al paginii. '.repeat(20)}</p></main></body></html>`;
}

test('demo-site: varianta generică citește exact textul anunțurilor A și B', () => {
  for (const [file, text] of [['anunt-a', demoListingTextA], ['anunt-b', demoListingTextB]]) {
    const r = readPage(page(readFileSync(path.join(root, 'demo-site', `${file}.html`), 'utf8'), `http://localhost:5174/${file}.html`));
    assert.equal(r.metoda, 'generic');
    assert.equal(r.scurt, false);
    assert.equal(r.url, `http://localhost:5174/${file}.html`);
    for (const line of text.split('\n')) assert.ok(r.text.includes(line), `${file}: ${line}`);
    assert.ok(!r.text.includes('anunțuri inventate pentru demonstrație'), 'antetul site-ului nu intră (main e preferat)');
  }
});

test('storia.ro: adaptorul folosește titlul, prețul, detaliile și descrierea completă din __NEXT_DATA__', () => {
  const r = readPage(page(storiaLike(), 'https://www.storia.ro/ro/oferta/garsoniera-IDabc'), 'https://www.storia.ro/ro/oferta/garsoniera-IDabc');
  assert.equal(r.metoda, 'storia');
  assert.equal(r.titlu, 'Garsonieră luminoasă Zorilor');
  assert.equal(r.pret, '400 €');
  const lines = r.text.split('\n');
  assert.deepEqual(lines.slice(0, 2), ['Garsonieră luminoasă Zorilor', 'Preț: 400 €']);
  assert.ok(lines.includes('Chirie lunară: 400 €'));
  assert.ok(lines.includes('Garanție (depozit): 800 €'));
  assert.ok(lines.includes('Etaj: 3'));
  assert.ok(lines.includes('Încălzire: centrală pe gaz'));
  assert.ok(lines.includes('Întreținere aprox. 300 lei/lună.'));
  assert.ok(!r.text.includes('advertiser'), 'câmpurile nerelevante nu intră');
  assert.ok(!r.text.includes('Meniu'), 'navigația nu intră');
  assert.equal(lines.filter((l) => l.startsWith('Încălzire')).length, 1);
});

test('storia.ro: dacă structura se schimbă, se trece automat la varianta generică', () => {
  const r = readPage(page(storiaLike({ withHooks: false, withNextData: false }), 'https://www.storia.ro/ro/oferta/x'));
  assert.equal(r.metoda, 'generic');
  assert.ok(r.text.includes('Garsonieră luminoasă Zorilor'));
  assert.ok(r.text.includes('Text generic al paginii.'));
  // Doar __NEXT_DATA__ lipsă: adaptorul merge cu ce găsește în pagină.
  const partial = readPage(page(storiaLike({ withNextData: false }), 'https://www.storia.ro/ro/oferta/x'));
  assert.equal(partial.metoda, 'storia');
  assert.equal(partial.titlu, 'Garsonieră luminoasă Zorilor');
});

test('olx.ro: adaptorul pe selectorii data-cy; fără ei, varianta generică', () => {
  const html = `<html><body><main>
    <h4 data-cy="ad_title">Apartament 2 camere Mărăști</h4>
    <div data-testid="ad-price-container"><h3>450 €</h3></div>
    <div data-testid="ad-parameters-container"><p>Suprafata utila: 50 m²</p><p>Compartimentare: Decomandat</p></div>
    <div data-cy="ad_description"><div>Apartament mobilat. Garanție 2 chirii. Fără comision.</div></div>
    </main></body></html>`;
  const r = readPage(page(html, 'https://www.olx.ro/d/oferta/apartament-IDx.html'));
  assert.equal(r.metoda, 'olx');
  assert.equal(r.titlu, 'Apartament 2 camere Mărăști');
  assert.equal(r.pret, '450 €');
  assert.ok(r.text.includes('Suprafata utila: 50 m²'));
  assert.ok(r.text.includes('Garanție 2 chirii. Fără comision.'));
  const generic = readPage(page('<html><body><main><h1>Altă structură</h1><p>Chirie 400 €.</p></main></body></html>', 'https://www.olx.ro/d/x'));
  assert.equal(generic.metoda, 'generic');
  assert.ok(generic.text.includes('Chirie 400 €.'));
});

test('date structurate: ld+json Product/Offer și og:* completează titlul și prețul pe orice site', () => {
  const html = `<html><head><title>Site</title>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Casă de închiriat","description":"Casă cu curte, 3 camere.","offers":{"@type":"Offer","price":2500,"priceCurrency":"RON"}}]}</script>
    <script type="application/ld+json">{ invalid json</script>
    </head><body><article><p>Casă cu curte în Florești, disponibilă din decembrie.</p></article></body></html>`;
  const r = readPage(page(html, 'https://imobil.example/casa'));
  assert.equal(r.titlu, 'Casă de închiriat');
  assert.equal(r.pret, '2500 RON');
  const lines = r.text.split('\n');
  assert.deepEqual(lines.slice(0, 3), ['Casă de închiriat', 'Preț: 2500 RON', 'Casă cu curte, 3 camere.']);
  const og = readPage(page('<html><head><meta property="og:title" content="Garsonieră &amp; parcare"><meta property="og:price:amount" content="300"><meta property="og:price:currency" content="EUR"></head><body><p>x</p></body></html>', 'https://a.example/'));
  assert.equal(og.titlu, 'Garsonieră & parcare');
  assert.equal(og.pret, '300 EUR');
});

test('anunțurile incomplete nu se resping: sub 300 de caractere → „scurt”; textul e limitat la 15.000', () => {
  const short = readPage(page('<html><body><p>Garsonieră, 300 €.</p></body></html>', 'https://x.example/'));
  assert.equal(short.scurt, true);
  assert.equal(short.text, 'Garsonieră, 300 €.');
  const empty = readPage(page('<html><body></body></html>', 'https://x.example/'));
  assert.equal(empty.text, '');
  assert.equal(empty.scurt, true);
  const long = readPage(page(`<html><body><main>${'<p>Rând lung de text din anunț, repetat.</p>'.repeat(1000).replace(/repetat/g, () => Math.random().toString(36))}</main></body></html>`, 'https://x.example/'));
  assert.ok(long.text.length <= 15000);
  assert.ok(long.text.length > 14000);
  assert.equal(long.scurt, false);
});

test('curățarea textului: entități, HTML inert, rânduri duplicate, limită la capăt de rând', () => {
  assert.equal(decodeEntities('A &amp; B &lt;3 &#259; &#x21B; &nbsp;x &bogus;'), 'A & B <3 ă ț  x &bogus;');
  assert.equal(htmlToText('Rând 1<br>Rând 2<script>alert(1)</script><img src=x onerror=alert(1)><ul><li>a</li><li>b</li></ul>'), 'Rând 1\nRând 2\n- a\n- b');
  assert.equal(cleanText('  a  \n\n a \n b  c \n'), 'a\nb c');
  assert.equal(limitText('aaaaaaaaa\nbbbb', 11), 'aaaaaaaaa'); // rândul tăiat aproape de capăt e eliminat
  assert.equal(limitText('aaaa\nbbbbbbbbbb', 12), 'aaaa\nbbbbbbb'); // altfel, tăietură exactă
  assert.equal(limitText('scurt', 12), 'scurt');
});
