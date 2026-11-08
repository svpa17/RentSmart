// RĂSCRUCE AI — validarea cererilor (stratul 1) și a răspunsurilor AI (stratul 2) pe server.
// Stratul 3 rulează în extensie: validateListingAnalysis + enforceEvidence.

import {
  AI_FIELD_STATUSES,
  AI_TASKS,
  LISTING_FIELD_TYPES,
  LISTING_FIELDS,
  MAX_SIMULATION_MONTHS,
  MAX_STORM_TEXT_CHARS,
  STORM_TYPES,
} from '../../extension/src/shared/contracts/constants.js';
import { enforceEvidence, validateListingAnalysis } from '../../extension/src/shared/contracts/schemas.js';
import { ApiError, AI_ERROR_CODES } from './errors.js';
import { UNKNOWN } from './outputSchemas.js';
import { SEARCH_CITIES, SEARCH_ROOMS } from '../../extension/src/shared/search/cities.js';

const bad = (mesaj) => new ApiError(AI_ERROR_CODES.INVALID_REQUEST, mesaj);
const invalid = (mesaj) => new ApiError(AI_ERROR_CODES.INVALID_RESPONSE, mesaj);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Stratul 1: cererea. Returnează intrarea normalizată sau aruncă ApiError.
 * @returns {{task: 'extract', text: string} | {task: 'message', campuriLipsa: string[]} | {task: 'storm', text: string}}
 */
export function validateAnalyzeRequest(body, { maxInputChars }) {
  if (!isObj(body)) throw bad('Corpul cererii trebuie să fie un obiect');
  if (!AI_TASKS.includes(body.task)) throw bad(`task trebuie să fie unul dintre: ${AI_TASKS.join(', ')}`);

  if (body.task === 'extract' || body.task === 'storm') {
    if (typeof body.text !== 'string' || body.text.trim() === '') throw bad('text lipsește');
    const max = body.task === 'storm' ? Math.min(MAX_STORM_TEXT_CHARS, maxInputChars) : maxInputChars;
    if (body.text.length > max) throw new ApiError(AI_ERROR_CODES.INPUT_TOO_LONG, `Textul depășește ${max} de caractere`);
    return { task: body.task, text: body.text };
  }

  // message: doar nume de câmpuri cunoscute — niciun text liber, deci nicio dată personală.
  const list = body.campuriLipsa;
  if (!Array.isArray(list) || list.length === 0) throw bad('campuriLipsa trebuie să fie o listă nevidă');
  if (list.some((c) => !LISTING_FIELDS.includes(c))) throw bad('campuriLipsa conține câmpuri necunoscute');
  return { task: 'message', campuriLipsa: [...new Set(list)] };
}

// ---------------------------------------------------------------------------
// Stratul 2: răspunsurile AI

const emptyToNull = (s) => (typeof s === 'string' && s.trim() !== '' ? s : null);
const unknownToNull = (s) => (s === UNKNOWN || s === undefined ? null : s);

function missingField(type) {
  const f = { status: 'lipsa', valoare: null, dovada: null, actualizatLa: null, nota: null };
  if (type === 'money' || type === 'deposit' || type === 'commission') f.moneda = null;
  if (type === 'deposit' || type === 'commission') f.unitate = null;
  return f;
}

function toField(raw, type) {
  if (!isObj(raw) || !AI_FIELD_STATUSES.includes(raw.status)) return missingField(type);
  const f = missingField(type);
  f.status = raw.status;
  f.dovada = raw.status === 'lipsa' ? null : emptyToNull(raw.dovada);
  f.valoare = raw.status === 'gasit' ? (raw.valoare ?? null) : null;
  if ('moneda' in f) f.moneda = f.valoare === null ? null : unknownToNull(raw.moneda);
  if ('unitate' in f) f.unitate = f.valoare === null ? null : unknownToNull(raw.unitate);
  // Garanția în luni de chirie nu are monedă.
  if (type === 'deposit' && f.unitate === 'luni_chirie') f.moneda = null;
  if (type === 'commission' && f.unitate === 'procent_chirie') f.moneda = null;
  return f;
}

/**
 * Normalizează ieșirea extragerii, validează fiecare câmp și verifică dovezile față de textul trimis.
 * Câmpurile invalide sau fără dovadă devin „lipsa” (De întrebat) în loc să respingă tot răspunsul.
 * @returns {{titlu: string|null, campuri: object, campuriRetrogradate: string[]}}
 */
export function normalizeExtraction(raw, sourceText) {
  if (!isObj(raw) || !isObj(raw.campuri)) throw invalid('Răspunsul AI nu are structura așteptată');
  const campuri = {};
  const retrogradate = new Set();
  for (const [name, type] of Object.entries(LISTING_FIELD_TYPES)) {
    const rawField = raw.campuri[name];
    campuri[name] = toField(rawField, type);
    // Un status nepermis AI-ului (ex. „confirmat”) sau un câmp malformat e retrogradat.
    if (!isObj(rawField) || !AI_FIELD_STATUSES.includes(rawField.status)) retrogradate.add(name);
  }

  const wrap = (c) => ({
    schemaVersion: 1,
    id: 'ai',
    sursa: { tip: 'pagina', url: null, analizatLa: new Date(0).toISOString() },
    titlu: emptyToNull(raw.titlu),
    demonstrativ: false,
    campuri: c,
  });

  const first = validateListingAnalysis(wrap(campuri));
  for (const e of first.errors) {
    const m = /^campuri\.(\w+)/.exec(e.path);
    if (m && m[1] in campuri) {
      campuri[m[1]] = missingField(LISTING_FIELD_TYPES[m[1]]);
      retrogradate.add(m[1]);
    }
  }
  const second = validateListingAnalysis(wrap(campuri));
  if (!second.ok) throw invalid('Răspunsul AI nu respectă contractul');

  const { analysis, downgraded } = enforceEvidence(wrap(campuri), sourceText);
  for (const d of downgraded) retrogradate.add(d);
  return { titlu: analysis.titlu, campuri: analysis.campuri, campuriRetrogradate: [...retrogradate] };
}

export function normalizeMessage(raw) {
  if (!isObj(raw) || typeof raw.mesaj !== 'string' || raw.mesaj.trim() === '') throw invalid('Mesaj lipsă');
  if (raw.mesaj.length > 2000) throw invalid('Mesaj prea lung');
  return { mesaj: raw.mesaj.trim() };
}

export function normalizeStorm(raw) {
  if (!isObj(raw)) throw invalid('Răspunsul AI nu are structura așteptată');
  const tipuri = Object.values(STORM_TYPES);
  if (raw.tip !== UNKNOWN && !tipuri.includes(raw.tip)) throw invalid('Tip de furtună necunoscut');
  const start = Number.isInteger(raw.start) && raw.start >= 1 && raw.start <= 12 ? raw.start : null;
  const durata = Number.isInteger(raw.durata) && raw.durata >= 1 && raw.durata <= MAX_SIMULATION_MONTHS ? raw.durata : null;
  return { tip: raw.tip === UNKNOWN ? null : raw.tip, start, durata };
}

// ---------------------------------------------------------------------------------------------
// POST /api/alternatives: doar orașul, camerele și prețul minim. Orice altă cheie e respinsă,
// ca nicio dată financiară (Passport) să nu poată ajunge, nici din greșeală, pe server.
const SEARCH_KEYS = new Set(['oras', 'camere', 'pretMinimEUR']);

export function validateSearchRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Cererea trebuie să fie un obiect JSON');
  for (const k of Object.keys(body)) if (!SEARCH_KEYS.has(k)) throw bad(`Câmp nepermis: ${k}`);
  if (!SEARCH_CITIES.some((c) => c.id === body.oras)) throw bad('Oraș necunoscut');
  const camere = body.camere ?? null;
  if (camere !== null && !SEARCH_ROOMS.includes(camere)) throw bad('Numărul de camere trebuie să fie 1–4');
  const pretMinimEUR = body.pretMinimEUR ?? null;
  if (pretMinimEUR !== null && !(Number.isInteger(pretMinimEUR) && pretMinimEUR >= 0 && pretMinimEUR <= 20000)) throw bad('Preț minim invalid');
  return { oras: body.oras, camere, pretMinimEUR: pretMinimEUR || null };
}
