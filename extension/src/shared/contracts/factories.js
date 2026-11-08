// RĂSCRUCE AI — constructorii pentru ListingAnalysis și câmpurile lui (fără I/O, fără ceas implicit).
import { FIELD_STATUS, LISTING_FIELD_TYPES, SCHEMA_VERSION } from './constants.js';
import { assertValid, validateListingAnalysis } from './schemas.js';

/** Un câmp gol („lipsa” → De întrebat), cu proprietățile cerute de tipul lui. */
export function emptyField(type) {
  const f = { status: FIELD_STATUS.LIPSA, valoare: null, dovada: null, actualizatLa: null, nota: null };
  if (type === 'money' || type === 'deposit' || type === 'commission') f.moneda = null;
  if (type === 'deposit' || type === 'commission') f.unitate = null;
  return f;
}

export function emptyFields() {
  return Object.fromEntries(Object.entries(LISTING_FIELD_TYPES).map(([name, type]) => [name, emptyField(type)]));
}

/**
 * O analiză nouă. Fără `campuri` → toate câmpurile sunt „De întrebat” (completare manuală).
 * @param {{id: string, tip: 'pagina'|'text_lipit'|'demo', url?: string|null, analizatLa: string, titlu?: string|null,
 *   demonstrativ?: boolean, campuri?: object, imagine?: string|null}} p  imagine: URL-ul https al pozei principale (opțional)
 */
export function createListingAnalysis({ id, tip, url = null, analizatLa, titlu = null, demonstrativ = false, campuri, imagine = null }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    // `imagine` apare doar dacă există: analizele vechi (fără imagine) rămân identice și valide.
    sursa: imagine ? { tip, url, analizatLa, imagine } : { tip, url, analizatLa },
    titlu,
    demonstrativ,
    campuri: campuri ?? emptyFields(),
  };
}

/**
 * Valoarea introdusă de utilizator: răspunsul proprietarului („confirmat”) sau presupunerea lui („presupus”).
 * Returnează o analiză nouă, validată.
 * @param {object} analysis
 * @param {string} name  numele câmpului
 * @param {{status: 'confirmat'|'presupus', valoare: any, moneda?: string|null, unitate?: string|null, nota?: string|null, actualizatLa: string}} input
 */
export function setUserValue(analysis, name, { status, valoare, moneda = null, unitate = null, nota = null, actualizatLa }) {
  if (status !== FIELD_STATUS.CONFIRMAT && status !== FIELD_STATUS.PRESUPUS) throw new RangeError('status invalid');
  const type = LISTING_FIELD_TYPES[name];
  if (!type) throw new RangeError(`câmp necunoscut: ${name}`);
  const field = { ...emptyField(type), status, valoare, dovada: null, actualizatLa, nota: nota || null };
  if ('moneda' in field) field.moneda = moneda;
  if ('unitate' in field) field.unitate = unitate;
  if (type === 'deposit' && unitate === 'luni_chirie') field.moneda = null;
  if (type === 'commission' && unitate === 'procent_chirie') field.moneda = null;
  const next = { ...analysis, campuri: { ...analysis.campuri, [name]: field } };
  return assertValid(validateListingAnalysis, next, 'ListingAnalysis');
}

/** Readuce un câmp la „De întrebat”. */
export function clearField(analysis, name) {
  return { ...analysis, campuri: { ...analysis.campuri, [name]: emptyField(LISTING_FIELD_TYPES[name]) } };
}
