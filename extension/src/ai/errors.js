// RĂSCRUCE AI — mesajele afișate pentru codurile de eroare (backend + modurile Detective-ului).
import { AI_ERROR_CODES as C } from '../shared/contracts/constants.js';
import { NOT_CONFIGURED } from './client.js';

export const MANUAL_FALLBACK = 'Analiza AI nu este disponibilă acum. Poți completa manual.';
export const NOT_CONFIGURED_MESSAGE = 'Analiza AI nu este disponibilă';

const SHORT = {
  [NOT_CONFIGURED]: NOT_CONFIGURED_MESSAGE,
  [C.MODEL_UNAVAILABLE]: NOT_CONFIGURED_MESSAGE,
  [C.AUTH_ERROR]: NOT_CONFIGURED_MESSAGE,
  [C.RATE_LIMITED]: 'Prea multe analize într-un timp scurt',
  [C.TIMEOUT]: 'Serviciul AI nu a răspuns la timp',
  [C.INPUT_TOO_LONG]: 'Textul anunțului este prea lung',
};

/** Mesajul scurt pentru un cod de eroare; implicit, trecerea la modul manual. */
export function errorMessage(code) {
  return SHORT[code] ?? MANUAL_FALLBACK;
}

const MANUAL_REASONS = {
  FARA_ACORD: 'Analiza AI pornește doar cu acordul tău. Poți completa manual câmpurile.',
  DEMO_FARA_INREGISTRARE: 'În modul demonstrativ funcționează doar anunțurile de exemplu A și B. Poți completa manual.',
  [NOT_CONFIGURED]: 'Analiza AI nu este disponibilă acum. Poți completa manual.',
  [C.MODEL_UNAVAILABLE]: 'Analiza AI nu este disponibilă acum. Poți completa manual.',
  [C.AUTH_ERROR]: 'Analiza AI nu este disponibilă acum. Poți completa manual.',
  [C.RATE_LIMITED]: 'Ai făcut multe analize într-un timp scurt. Poți completa manual sau încerca din nou mai târziu.',
};

/** Fraza afișată deasupra formularului manual, după motivul pentru care nu s-a folosit AI-ul. */
export function manualReason(code) {
  if (!code) return null;
  return MANUAL_REASONS[code] ?? MANUAL_FALLBACK;
}
