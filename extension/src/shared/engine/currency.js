// RĂSCRUCE AI — conversia valutară. Proprietar: Sebi.
// Regula: nu există curs implicit (scris în cod). Orice sumă în EUR are nevoie de un ExchangeRate
// explicit (cursul BNR descărcat, cel introdus de utilizator sau cel „demo”) înainte de orice calcul.

import { validateExchangeRate } from '../contracts/schemas.js';

/** true dacă cursul există și respectă contractul ExchangeRate. */
export function hasValidRate(exchangeRate) {
  return exchangeRate != null && validateExchangeRate(exchangeRate).ok;
}

/**
 * Convertește o sumă în RON întregi.
 * @param {number} valoare
 * @param {'RON'|'EUR'} moneda
 * @param {import('../contracts/types.js').ExchangeRate|null} exchangeRate
 * @returns {number|null} RON întregi, sau null dacă suma e în EUR și lipsește un curs valid.
 */
export function toRON(valoare, moneda, exchangeRate) {
  if (!Number.isFinite(valoare) || valoare < 0) throw new RangeError('Suma trebuie să fie un număr ≥ 0');
  if (moneda === 'RON') return Math.round(valoare);
  if (moneda === 'EUR') {
    if (!hasValidRate(exchangeRate)) return null;
    return Math.round(valoare * exchangeRate.eurToRon);
  }
  throw new RangeError(`Monedă necunoscută: ${moneda}`);
}

/**
 * Echivalentul în EUR întregi al unei sume în RON, doar pentru afișare (calculele rămân în RON).
 * @returns {number|null} null dacă lipsește un curs valid.
 */
export function fromRON(sumaRON, exchangeRate) {
  if (!Number.isFinite(sumaRON) || !hasValidRate(exchangeRate)) return null;
  return Math.round(sumaRON / exchangeRate.eurToRon);
}
