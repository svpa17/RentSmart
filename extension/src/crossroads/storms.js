// RĂSCRUCE AI — Financial Storms (planul, §5.6): construirea, descrierea și precompletarea furtunilor.
// Sumele vin DOAR din formular, local. AI-ul (text liber) doar clasifică tipul, luna și durata.
import { STORM_TYPES } from '../shared/contracts/constants.js';
import { assertValid, validateStorm } from '../shared/contracts/schemas.js';
import { formatNumber } from '../ui/format.js';
import { calendarMonthToT } from './model.js';
import { monthLabel } from './scales.js';

export const STORM_TITLES = Object.freeze({
  [STORM_TYPES.PIERDERE_VENIT]: 'Îmi pierd venitul',
  [STORM_TYPES.CHELTUIALA_NEPREVAZUTA]: 'Am o cheltuială neprevăzută',
  [STORM_TYPES.CRESTERE_CHIRIE]: 'Crește chiria',
});

/** Valorile implicite ale formularului pentru un tip de furtună. */
export function defaultStormValues(tip, { luni, lunaMutarii }) {
  const after = Math.min(Math.max(lunaMutarii + 1, 0), luni - 1);
  switch (tip) {
    case STORM_TYPES.PIERDERE_VENIT:
      return { start: Math.min(3, luni - 1), durata: 2, procent: 100 };
    case STORM_TYPES.CHELTUIALA_NEPREVAZUTA:
      return { luna: after, suma: 1000 };
    case STORM_TYPES.CRESTERE_CHIRIE:
      return { start: after, procent: 10 };
    default:
      throw new RangeError(`Tip necunoscut: ${tip}`);
  }
}

/** Furtuna validată după contract; aruncă ContractError pentru valori invalide. */
export function makeStorm(tip, values, id) {
  const base = { id, tip };
  const s =
    tip === STORM_TYPES.PIERDERE_VENIT
      ? { ...base, start: values.start, durata: values.durata, procent: values.procent }
      : tip === STORM_TYPES.CHELTUIALA_NEPREVAZUTA
        ? { ...base, luna: values.luna, suma: values.suma }
        : { ...base, start: values.start, procent: values.procent };
  return assertValid(validateStorm, s, 'Storm');
}

/** Descrierea pe înțeles a unei situații, cu lunile din calendar. */
export function describeStorm(s, lunaStart, luni = null) {
  const m = (t) => monthLabel(lunaStart, t, { luni });
  switch (s.tip) {
    case STORM_TYPES.PIERDERE_VENIT: {
      const cat = s.procent >= 100 ? 'Pierzi tot venitul' : `Pierzi ${formatNumber(s.procent)}% din venit`;
      return `${cat} timp de ${s.durata} ${s.durata === 1 ? 'lună' : 'luni'}, din ${m(s.start)}`;
    }
    case STORM_TYPES.CHELTUIALA_NEPREVAZUTA:
      return `Plătești ${formatNumber(s.suma)} RON neprevăzut în ${m(s.luna)}`;
    case STORM_TYPES.CRESTERE_CHIRIE:
      return `Chiria crește cu ${formatNumber(s.procent)}% din ${m(s.start)} (după mutare)`;
    default:
      return s.tip;
  }
}

/**
 * Clasificarea AI ({tip, start: lună calendaristică, durata}) → precompletarea formularului.
 * Luna calendaristică devine indicele t prin lunaStart; ce lipsește rămâne valoarea implicită.
 * @returns {{tip: string, values: object} | null}
 */
export function prefillFromClassification(c, { luni, lunaStart, lunaMutarii }) {
  if (!c?.tip || !STORM_TITLES[c.tip]) return null;
  const values = defaultStormValues(c.tip, { luni, lunaMutarii });
  const t = calendarMonthToT(c.start, lunaStart);
  if (t !== null && t < luni) {
    if (c.tip === STORM_TYPES.CHELTUIALA_NEPREVAZUTA) values.luna = t;
    else values.start = t;
  }
  if (c.tip === STORM_TYPES.PIERDERE_VENIT && Number.isInteger(c.durata) && c.durata >= 1) values.durata = c.durata;
  return { tip: c.tip, values };
}
