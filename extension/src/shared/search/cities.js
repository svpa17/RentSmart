// RentSmart — orașele în care caută „Alternative”, cu adresele (slug-urile) verificate pe fiecare furnizor.
// Comun extensiei (filtre) și backend-ului (URL-urile de căutare). Verificat live, noiembrie 2026:
// fiecare slug a întors anunțuri din orașul corect pe Storia, Publi24 și HomeZZ.

export const SEARCH_CITIES = Object.freeze([
  { id: 'bucuresti', nume: 'București', storia: 'bucuresti', publi24: 'bucuresti', homezz: 'bucuresti-if' },
  { id: 'cluj-napoca', nume: 'Cluj-Napoca', storia: 'cluj/cluj--napoca', publi24: 'cluj/cluj-napoca', homezz: 'cluj-napoca-cj' },
  { id: 'iasi', nume: 'Iași', storia: 'iasi/iasi', publi24: 'iasi/iasi', homezz: 'iasi-is' },
  { id: 'timisoara', nume: 'Timișoara', storia: 'timis/timisoara', publi24: 'timis/timisoara', homezz: 'timisoara-tm' },
  { id: 'constanta', nume: 'Constanța', storia: 'constanta/constanta', publi24: 'constanta/constanta', homezz: 'constanta-ct' },
  { id: 'brasov', nume: 'Brașov', storia: 'brasov/brasov', publi24: 'brasov/brasov', homezz: 'brasov-bv' },
  { id: 'craiova', nume: 'Craiova', storia: 'dolj/craiova', publi24: 'dolj/craiova', homezz: 'craiova-dj' },
  { id: 'sibiu', nume: 'Sibiu', storia: 'sibiu/sibiu', publi24: 'sibiu/sibiu', homezz: 'sibiu-sb' },
  { id: 'oradea', nume: 'Oradea', storia: 'bihor/oradea', publi24: 'bihor/oradea', homezz: 'oradea-bh' },
  { id: 'galati', nume: 'Galați', storia: 'galati/galati', publi24: 'galati/galati', homezz: 'galati-gl' },
]);

/** Numărul de camere acceptat de filtre: 1 (garsonieră) … 4 (4 sau mai multe). */
export const SEARCH_ROOMS = Object.freeze([1, 2, 3, 4]);

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const cityById = (id) => SEARCH_CITIES.find((c) => c.id === id) ?? null;

/** Orașul (din lista de mai sus) pomenit într-un text: localitatea anunțului, titlul sau URL-ul. */
export function matchCity(...texts) {
  const hay = fold(texts.filter(Boolean).join(' ')).replace(/[^a-z0-9]+/g, ' ');
  for (const c of SEARCH_CITIES) {
    const names = [c.id.replace(/-/g, ' '), fold(c.nume).replace(/[^a-z0-9]+/g, ' ')];
    if (c.id === 'cluj-napoca') names.push('cluj');
    if (names.some((n) => new RegExp(`(^| )${n}( |$)`).test(hay))) return c.id;
  }
  return null;
}

const WORDS = { o: 1, una: 1, doua: 2, trei: 3, patru: 4, cinci: 5 };

/** Numărul de camere din titlu („2 camere”, „ap. 3 cam”, „garsonieră”, „două camere”); null dacă nu reiese. */
export function roomsFromText(...texts) {
  const t = fold(texts.filter(Boolean).join(' '));
  if (/\bgarsonier|\bstudio\b/.test(t)) return 1;
  const m = t.match(/\b(\d)\s*(?:camere|cam\b|cam\.|rooms?\b|-?camere)/) ?? t.match(/\b(o|una|doua|trei|patru|cinci)\s+camer/);
  if (!m) return null;
  const n = /\d/.test(m[1]) ? Number(m[1]) : WORDS[m[1]];
  return n >= 1 ? Math.min(n, 4) : null;
}
