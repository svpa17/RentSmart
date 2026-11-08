// RĂSCRUCE AI — redactarea locală înainte de trimiterea la AI (planul, §4 și §9).
// Folosită de extensie (înainte de trimitere) și de backend (apărare suplimentară).
// Funcții pure, fără dependențe.

export const PHONE_TOKEN = '[TELEFON]';
export const EMAIL_TOKEN = '[EMAIL]';
export const AMOUNT_TOKEN = '[SUMĂ]';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Candidat: o secvență de cifre cu separatori uzuali (spațiu, punct, cratimă, slash, paranteze).
const PHONE_CANDIDATE_RE = /(?<![\w+(])(?:\+|\()?\d[\d\s()./-]{7,18}\d(?!\w)/g;

/** Un candidat e telefon dacă are 9–13 cifre și prefix românesc / internațional (0…, 40…, 0040…, +…). */
function looksLikePhone(candidate) {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 13) return false;
  if (candidate.trim().startsWith('+')) return true;
  return digits.startsWith('0') || digits.startsWith('40');
}

/** Ascunde e-mailurile și numerele de telefon. Prețurile, suprafețele și anii rămân neatinse. */
export function redactContacts(text) {
  return String(text)
    .replace(EMAIL_RE, EMAIL_TOKEN)
    .replace(PHONE_CANDIDATE_RE, (m) => (looksLikePhone(m) ? PHONE_TOKEN : m));
}

// Sumele: numere urmate/precedate de monedă, sau orice număr cu cel puțin 3 cifre.
const CURRENCY = '(?:lei|ron|eur|euro|€|\\$|usd)';
const NUMBER = '\\d[\\d.,\\s]*\\d|\\d';
const AMOUNT_WITH_CURRENCY_RE = new RegExp(`(?:${CURRENCY}\\s*(?:${NUMBER}))|(?:(?:${NUMBER})\\s*${CURRENCY}(?![a-zăâîșț]))`, 'gi');
const LARGE_NUMBER_RE = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d{3,}(?:[.,]\d+)?/g;

/**
 * Pentru textul scenariilor de furtună: ascunde contactele și sumele.
 * Numerele mici (≤ 2 cifre, ex. „2 luni”, „10%”) rămân, pentru că AI-ul clasifică doar tipul, luna și durata.
 */
export function maskAmounts(text) {
  return redactContacts(text).replace(AMOUNT_WITH_CURRENCY_RE, AMOUNT_TOKEN).replace(LARGE_NUMBER_RE, AMOUNT_TOKEN);
}
