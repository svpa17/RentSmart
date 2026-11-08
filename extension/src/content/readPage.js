// RĂSCRUCE AI — citirea paginii active (planul, §4). Rulează în pagină (script de conținut), pe orice site.
// Un singur sistem, cu aceeași ieșire pentru toate site-urile:
//   1. date structurate (ld+json schema.org, microdate, og:*), pe orice site;
//   2. extractor specific, dacă site-ul e cunoscut și structura lui se potrivește: adaptoarele OLX și
//      Storia + profilurile declarative (profiles.js: publi24, homezz);
//   3. extractorul universal (universal.js): zona anunțului, fără navigație și alt zgomot.
// Apoi AI-ul (prin backend) extrage câmpurile din acest text, cu dovadă exactă pentru fiecare valoare.
// Anunțurile incomplete nu se resping: se întoarce ce există, iar sub 300 de caractere se marchează „scurt”.
import { readOlx, matches as isOlx } from './adapters/olx.js';
import { readStoria, matches as isStoria } from './adapters/storia.js';
import { profileFor, readProfile } from './profiles.js';
import { readStructuredData, safeImageUrl } from './structured.js';
import { readUniversal } from './universal.js';
import { assessListing } from './listing.js';
import { MAX_TEXT_CHARS, SHORT_TEXT_CHARS, cleanText, limitText } from './text.js';

const ADAPTERS = [
  { name: 'storia', matches: isStoria, read: readStoria },
  { name: 'olx', matches: isOlx, read: readOlx },
];

function runSpecific(doc, hostname) {
  for (const a of ADAPTERS) {
    if (!a.matches(hostname)) continue;
    try {
      const r = a.read(doc);
      if (r) return { name: a.name, ...r };
    } catch {
      // Selectorii s-au schimbat: trecem la varianta universală.
    }
  }
  const profile = profileFor(hostname);
  if (profile) {
    try {
      const r = readProfile(doc, profile);
      if (r) return { name: profile.name, ...r };
    } catch {
      // idem
    }
  }
  return null;
}

/**
 * @param {Document} doc
 * @returns {{url: string|null, titlu: string|null, pret: string|null, text: string, caractereCitite: number,
 *   metoda: string, scurt: boolean, pareAnunt: boolean, semnale: string[], imagine: string|null}}
 *   imagine: poza principală a anunțului (https) din datele site-ului sau og:image; null dacă nu există
 *   metoda: 'storia' | 'olx' | 'publi24' | 'homezz' | 'generic' (extractorul universal)
 */
export function readPage(doc) {
  const url = doc.location?.href ?? null;
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    // fără URL valid
  }
  const structured = readStructuredData(doc);
  const specific = runSpecific(doc, hostname);

  let titlu;
  let pret;
  let lines;
  if (specific) {
    titlu = specific.titlu ?? structured.titlu;
    pret = specific.pret ?? structured.pret;
    const locatie = specific.locatie ?? structured.locatie;
    const detalii = specific.detalii.length ? specific.detalii : structured.detalii;
    lines = [titlu, pret && `Preț: ${pret}`, locatie && `Locație: ${locatie}`, ...detalii, specific.descriere];
  } else {
    const u = readUniversal(doc);
    const body = u.text;
    titlu = structured.titlu ?? u.titlu ?? (cleanText(doc.title ?? '') || null);
    // Prețul din datele structurate primește un rând propriu; cel găsit în text e deja în text.
    pret = structured.pret ?? u.pret;
    const missing = (s) => (s && !body.includes(s) ? s : null);
    lines = [
      missing(titlu),
      structured.pret && `Preț: ${structured.pret}`,
      structured.locatie && missing(structured.locatie) && `Locație: ${structured.locatie}`,
      ...structured.detalii.filter((d) => !body.includes(d)),
      missing(structured.descriere),
      body,
    ];
  }
  const text = limitText(cleanText(lines.filter(Boolean).join('\n')), MAX_TEXT_CHARS);
  const { pareAnunt, semnale } = assessListing({ text, titlu, url, pret, structured });
  return {
    url,
    titlu,
    pret,
    text,
    caractereCitite: text.length,
    metoda: specific?.name ?? 'generic',
    scurt: text.length < SHORT_TEXT_CHARS,
    pareAnunt,
    semnale,
    imagine: safeImageUrl(specific?.imagine) ?? structured.imagine,
  };
}
