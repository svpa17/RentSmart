// RĂSCRUCE AI — extractorul universal, pentru orice site fără profil (sau cu profilul depășit).
// 1. Textul se citește fără zgomot: navigație, antete și subsoluri de pagină, cookie-uri, „anunțuri
//    similare”, formulare, scripturi și elemente ascunse.
// 2. Se alege zona paginii care seamănă cel mai mult cu anunțul (titlul h1, prețul, cuvintele despre
//    închiriere, puține linkuri), nu toată pagina.
// Nu modifică pagina și nu apasă nimic în ea.
import { cleanText } from './text.js';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'NAV', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'SELECT',
  'OPTION', 'IFRAME', 'DIALOG', 'CANVAS', 'VIDEO', 'AUDIO', 'PICTURE', 'IMG', 'INPUT', 'TEXTAREA', 'HEAD',
]);
const SKIP_ROLES = /^(navigation|banner|contentinfo|dialog|alertdialog|search|menu|menubar|complementary)$/i;
const NOISE = /(^|[-_\s])(cookies?|consent|gdpr|newsletter|breadcrumbs?|share|social|related|similar|recommend(ed|ations)?|promo|ads|advertising|modal|popup|navbar|menu|sidebar|footer)([-_\s]|$)/i;
const BLOCK = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'TR', 'TABLE', 'TBODY',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'BR', 'HR', 'FIGURE', 'FIGCAPTION', 'ADDRESS',
]);

/** Prețuri: „350 EUR”, „1.950 lei”, „€ 400”, „600 €/lună”. */
export const PRICE_RE = /(?:€|\beur(?:o)?\b|\blei\b|\bron\b)\s?\d[\d.,\s]{0,10}\d|\d[\d.\s]{0,10}(?:,\d{1,2})?\s?(?:€|eur(?:o)?(?![a-z])|lei(?![a-z])|ron(?![a-z]))/i;
export const RENT_RE = /chiri[ea]|închiri|inchiri|\bde închiriat|\bfor rent\b|\brent(al)?\b|\bto let\b|\/\s?(lună|luna|month)\b|pe lună|per month|garanți[ea]|depozit/i;

function isNoise(el, insideMain) {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.tagName === 'HEADER' && !insideMain) return true;
  if (el.hasAttribute?.('hidden') || el.getAttribute?.('aria-hidden') === 'true') return true;
  const role = el.getAttribute?.('role');
  if (role && SKIP_ROLES.test(role)) return true;
  const sig = `${el.id ?? ''} ${el.getAttribute?.('class') ?? ''}`;
  if (sig.trim() && NOISE.test(sig)) return true;
  if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return true;
  return false;
}

/**
 * Textul unui element, fără zgomot, cu rânduri la elementele de tip bloc.
 * @returns {{text: string, linkChars: number}}
 */
export function filteredText(root) {
  const parts = [];
  let linkChars = 0;
  const visit = (node, insideMain, inLink) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue;
      parts.push(t);
      if (inLink) linkChars += t.trim().length;
      return;
    }
    if (node.nodeType !== 1) return;
    if (isNoise(node, insideMain)) return;
    const block = BLOCK.has(node.tagName);
    if (block) parts.push('\n');
    const main = insideMain || node.tagName === 'MAIN' || node.tagName === 'ARTICLE';
    const link = inLink || node.tagName === 'A';
    for (const c of node.childNodes) visit(c, main, link);
    if (block) parts.push('\n');
  };
  visit(root, root.tagName === 'MAIN' || root.tagName === 'ARTICLE' || !!root.closest?.('main, article'), false);
  return { text: cleanText(parts.join('')), linkChars };
}

function candidates(doc) {
  const set = new Set();
  const h1 = doc.querySelector('h1');
  for (let el = h1; el && el !== doc.documentElement; el = el.parentElement) set.add(el);
  for (const el of doc.querySelectorAll('main, article, [role="main"], [itemtype*="Offer"], [itemtype*="Product"], [itemtype*="RealEstate"]')) set.add(el);
  if (doc.body) set.add(doc.body);
  return { list: [...set], h1 };
}

function score(el, h1, info) {
  const len = info.text.length;
  if (len === 0) return -Infinity;
  const linkRatio = Math.min(1, info.linkChars / len);
  return (
    Math.min(len, 6000) * (1 - linkRatio) +
    (PRICE_RE.test(info.text) ? 1500 : 0) +
    (RENT_RE.test(info.text) ? 800 : 0) +
    (h1 && el.contains(h1) ? 1000 : 0) -
    Math.max(0, len - 8000) * 0.3
  );
}

/**
 * @param {Document} doc
 * @returns {{titlu: string|null, pret: string|null, text: string}}
 */
export function readUniversal(doc) {
  const { list, h1 } = candidates(doc);
  let best = null;
  for (const el of list) {
    const info = filteredText(el);
    const s = score(el, h1, info);
    if (!best || s > best.s) best = { el, s, info };
  }
  const text = best && best.s > -Infinity ? best.info.text : '';
  const titlu = h1 ? cleanText(h1.textContent ?? '').replace(/\n+/g, ' ') || null : null;
  const m = PRICE_RE.exec(text);
  return { titlu, pret: m ? m[0].trim() : null, text };
}
