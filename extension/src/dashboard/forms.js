// RĂSCRUCE AI — conversia formularelor din dashboard în contracte (pură, testabilă).
import { MAX_MOVE_MONTH, SCHEMA_VERSION } from '../shared/contracts/constants.js';
import { validateFinancialPassport } from '../shared/contracts/schemas.js';

/** Câmpurile Passport-ului, cu explicațiile din interfață (planul, §5.1). */
export const PASSPORT_FIELDS = Object.freeze([
  { key: 'venitNetLunar', label: 'Venit lunar', help: 'Banii care îți intră lunar în cont, după taxe.' },
  { key: 'cheltuieliEsentialeLunare', label: 'Cheltuieli lunare, fără locuință', help: 'Mâncare, telefon, sănătate etc. Fără chirie și fără transport.' },
  { key: 'costLocuintaActuala', label: 'Cât plătești acum pentru locuință', help: 'Chirie și utilități actuale (de exemplu contribuția la părinți). Poate fi 0.' },
  { key: 'transportActualLunar', label: 'Transport lunar', help: 'Cât cheltuiești acum pe lună pentru transport.' },
  { key: 'economiiDisponibile', label: 'Economii disponibile', help: 'Banii puși deoparte pe care îi poți folosi acum.' },
  { key: 'rezervaMinima', label: 'Suma păstrată pentru urgențe', help: 'Suma sub care nu vrei să scadă economiile. Poate fi 0.' },
  { key: 'bugetMaximChirie', label: 'Buget lunar pentru chirie', help: 'Te anunțăm când o chirie trece de această sumă. 0 = fără limită.' },
]);

/** Un întreg ≥ 0 din text („1.500”, „1 500”, „1500”); null dacă nu e valid. */
export function parseWholeRON(raw) {
  const s = String(raw ?? '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/**
 * @param {Record<string, string>} values  valorile din formular (text)
 * @returns {{ok: true, passport: object} | {ok: false, errors: Record<string, string>}}
 */
export function passportFromForm(values) {
  const errors = {};
  const passport = { schemaVersion: SCHEMA_VERSION };
  for (const { key } of PASSPORT_FIELDS) {
    const n = parseWholeRON(values[key]);
    if (n === null) errors[key] = 'Scrie o sumă în lei, doar cifre (de exemplu 2500).';
    else passport[key] = n;
  }
  const m = parseWholeRON(values.lunaMutarii);
  if (m === null || m > MAX_MOVE_MONTH) errors.lunaMutarii = `Scrie peste câte luni te muți: un număr între 0 și ${MAX_MOVE_MONTH}.`;
  else passport.lunaMutarii = m;
  passport.obiectiv = String(values.obiectiv ?? '').trim() || null;
  if (Object.keys(errors).length) return { ok: false, errors };
  const v = validateFinancialPassport(passport);
  if (!v.ok) return { ok: false, errors: Object.fromEntries(v.errors.map((e) => [e.path, e.mesaj])) };
  return { ok: true, passport };
}

export function passportToForm(p) {
  const out = { lunaMutarii: p ? String(p.lunaMutarii) : '0', obiectiv: p?.obiectiv ?? '' };
  for (const { key } of PASSPORT_FIELDS) out[key] = p ? String(p[key]) : '';
  return out;
}

/** Cursul EUR → RON: număr > 0 (acceptă virgula zecimală). */
export function parseRate(raw) {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

/** Costurile introduse de utilizator pentru un apartament: gol → null (motorul aplică regula documentată). */
export function userCostsFromForm(values) {
  const errors = {};
  const out = {};
  for (const key of ['transportLunarRON', 'alteCosturiLunareRON', 'costuriMutareRON']) {
    const raw = String(values[key] ?? '').trim();
    if (raw === '') {
      out[key] = null;
      continue;
    }
    const n = parseWholeRON(raw);
    if (n === null) errors[key] = 'Lei întregi (≥ 0) sau gol.';
    else out[key] = n;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, costuri: out };
}
