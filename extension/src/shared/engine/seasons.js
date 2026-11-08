// RĂSCRUCE AI — sezonalitate. Proprietar: Sebi.
import { WINTER_MONTHS } from '../contracts/constants.js';

/** Luna calendaristică (1…12) pentru indicele t, pornind de la lunaStart (1…12). */
export function calendarMonth(lunaStart, t) {
  return ((lunaStart - 1 + t) % 12) + 1;
}

/** 'iarna' pentru noiembrie–martie, altfel 'vara'. */
export function seasonOf(calendar) {
  return WINTER_MONTHS.includes(calendar) ? 'iarna' : 'vara';
}
