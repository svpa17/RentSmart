// RentSmart — formularul „Spune-ne câteva lucruri despre bugetul tău” → Financial Passport existent.
// Pur și testabil. Conversia și validarea finală sunt cele existente (passportFromForm + contractul).
// Valorile necunoscute NU devin 0: câmpurile principale sunt obligatorii (utilizatorul scrie 0 dacă e cazul),
// iar pentru câmpurile opționale lăsate goale cerem confirmarea explicită înainte de a folosi 0.
import { MAX_MOVE_MONTH } from '../shared/contracts/constants.js';
import { parseWholeRON, passportFromForm } from './forms.js';

/** Câmpurile formularului, în ordinea afișării, și cheia din Passport în care se salvează fiecare. */
export const SETUP_FIELDS = Object.freeze([
  { key: 'venit', model: 'venitNetLunar', label: 'Venit lunar (lei)', help: 'Banii pe care îi primești lunar, după taxe.', example: 'ex. 4500' },
  { key: 'cheltuieli', model: 'cheltuieliEsentialeLunare', label: 'Cheltuieli lunare, fără locuință (lei)', help: 'De exemplu: mâncare, cumpărături și alte cheltuieli obișnuite. Fără chirie și fără transport.', example: 'ex. 1500' },
  { key: 'locuinta', model: 'costLocuintaActuala', label: 'Cât plătești acum pentru locuință? (lei)', help: 'Chirie și utilități actuale, dacă există. Scrie 0 dacă nu plătești nimic.', example: 'ex. 0' },
  { key: 'transport', model: 'transportActualLunar', label: 'Transport lunar (lei)', help: 'Cât cheltuiești într-o lună pentru transport.', example: 'ex. 150' },
  { key: 'economii', model: 'economiiDisponibile', label: 'Economii disponibile (lei)', help: 'Banii pe care îi ai puși deoparte.', example: 'ex. 6000' },
  { key: 'buget', model: 'bugetMaximChirie', label: 'Buget lunar pentru noua locuință (lei)', help: 'Cât ai vrea să plătești lunar pe chirie. Întreținerea și utilitățile le calculăm separat.', example: 'ex. 2000' },
]);
export const OPTIONAL_FIELDS = Object.freeze([
  { key: 'rezerva', model: 'rezervaMinima', label: 'Rezervă de siguranță (lei)', help: 'Banii pe care vrei să îi păstrezi pentru urgențe.', example: 'ex. 1000' },
]);
/** „Când vrei să te muți?” → luna mutării din Passport (0 = luna aceasta). */
export const MOVE_OPTIONS = Object.freeze([
  ['0', 'Luna aceasta'],
  ['1', 'Într-o lună'],
  ['3', 'În 3 luni'],
  ['6', 'În 6 luni'],
  ['alta', 'Altă perioadă'],
]);

const MSG_EMPTY = 'Completează acest câmp. Scrie 0 dacă nu ai.';
const MSG_NUMBER = 'Scrie o sumă în lei, doar cifre (de exemplu 2500).';

/** Valorile inițiale: din profilul existent (dacă există), altfel goale — niciodată valori inventate. */
export function setupFormFrom(passport) {
  const v = { rezerva: '', mutare: '', mutareAlta: '' };
  for (const f of [...SETUP_FIELDS, ...OPTIONAL_FIELDS]) v[f.key] = passport ? String(passport[f.model]) : '';
  if (passport) {
    const m = String(passport.lunaMutarii);
    if (MOVE_OPTIONS.some(([id]) => id === m)) v.mutare = m;
    else {
      v.mutare = 'alta';
      v.mutareAlta = m;
    }
  }
  return v;
}

/**
 * @param {Record<string, string>} values
 * @param {object|null} existing  profilul existent (păstrăm obiectivul)
 * @param {{confirmDefaults?: boolean}} [opts]  true după ce utilizatorul a confirmat 0 / „luna aceasta” pentru câmpurile opționale goale
 * @returns {{ok: true, passport: object} | {ok: false, errors: Record<string, string>} | {ok: false, needsConfirm: string[]}}
 */
export function profileFromSetupForm(values, existing = null, { confirmDefaults = false } = {}) {
  const errors = {};
  const model = {};
  for (const f of SETUP_FIELDS) {
    const raw = String(values[f.key] ?? '').trim();
    if (!raw) errors[f.key] = MSG_EMPTY;
    else if (parseWholeRON(raw) === null) errors[f.key] = MSG_NUMBER;
    else model[f.model] = raw;
  }
  const missing = [];
  const rez = String(values.rezerva ?? '').trim();
  if (!rez) missing.push('rezerva');
  else if (parseWholeRON(rez) === null) errors.rezerva = MSG_NUMBER;
  else model.rezervaMinima = rez;

  if (!values.mutare) missing.push('mutare');
  else if (values.mutare === 'alta') {
    const m = parseWholeRON(values.mutareAlta);
    if (m === null || m > MAX_MOVE_MONTH) errors.mutareAlta = `Scrie peste câte luni te muți: un număr între 0 și ${MAX_MOVE_MONTH}.`;
    else model.lunaMutarii = String(m);
  } else model.lunaMutarii = values.mutare;

  if (Object.keys(errors).length) return { ok: false, errors };
  if (missing.length && !confirmDefaults) return { ok: false, needsConfirm: missing };
  model.rezervaMinima ??= '0';
  model.lunaMutarii ??= '0';
  model.obiectiv = existing?.obiectiv ?? '';

  const r = passportFromForm(model);
  if (!r.ok) {
    // Erorile contractului, pe câmpurile formularului.
    const byModel = Object.fromEntries([...SETUP_FIELDS, ...OPTIONAL_FIELDS].map((f) => [f.model, f.key]));
    return { ok: false, errors: Object.fromEntries(Object.entries(r.errors).map(([k, m]) => [byModel[k] ?? (k === 'lunaMutarii' ? 'mutareAlta' : k), m])) };
  }
  return { ok: true, passport: r.passport };
}
