// RĂSCRUCE AI — formatarea sumelor și a surselor pentru interfață (pură, testabilă).
import { fromRON } from '../shared/engine/currency.js';
import { DEFAULT_COMMISSION_PERCENT } from '../shared/contracts/constants.js';
import { formatPublicationDate, isPossiblyOutdated } from '../rates/bnrRate.js';

const nf = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

export const formatRON = (n) => (n === null || n === undefined ? '—' : `${nf.format(n)} RON`);
export const formatNumber = (n) => nf.format(n);
/** Cursul, cu cele 4 zecimale publicate de BNR (formatNumber rotunjește la 2). */
const rateNf = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 4 });
export const formatRate = (n) => rateNf.format(n);
export const formatEUR = (n) => (n === null || n === undefined ? '—' : `${nf.format(n)} EUR`);

/** „1.950 RON (≈ 365 EUR)”: suma în RON cu echivalentul în EUR, dacă există curs. */
export function formatRONWithEUR(sumaRON, exchangeRate) {
  const eur = fromRON(sumaRON, exchangeRate);
  return eur === null ? formatRON(sumaRON) : `${formatRON(sumaRON)} (≈ ${formatEUR(eur)})`;
}

/** Eticheta comisionului: precizat în anunț / confirmat / introdus de tine sau estimat la 50%. */
export function commissionHint(item) {
  if (!item) return null;
  if (item.sursa === 'estimare') return `estimat la ${DEFAULT_COMMISSION_PERCENT}% din chirie`;
  if (item.sursa === 'anunt') return item.sumaRON === 0 ? 'fără comision, conform anunțului' : 'specificat în anunț';
  if (item.sursa === 'confirmat') return 'confirmat de proprietar';
  return 'introdus de tine';
}

/**
 * Descrierea cursului folosit, pentru interfață.
 * @returns {{text: string, outdated: boolean}|null}
 */
export function describeRate(rate, status, now = new Date()) {
  if (!rate) return null;
  const valoare = `1 EUR = ${formatRate(rate.eurToRon)} RON`;
  if (rate.sursa === 'bnr')
    return { text: `Curs BNR: ${valoare}, publicat ${formatPublicationDate(rate.dataPublicarii)}`, outdated: isPossiblyOutdated({ rate, status, now }) };
  const zi = new Date(rate.actualizatLa).toLocaleDateString('ro-RO');
  if (rate.sursa === 'demo') return { text: `Curs fictiv (exemplu): ${valoare}`, outdated: false };
  return { text: `Curs introdus de tine: ${valoare}, salvat ${zi}`, outdated: false };
}

export const RATE_OUTDATED_MESSAGE = 'Cursul BNR nu a putut fi actualizat. Folosim ultimul curs salvat, care poate fi depășit.';

export const SOURCE_LABELS = Object.freeze({
  anunt: { label: 'din anunț', tone: 'found' },
  confirmat: { label: 'confirmat de proprietar', tone: 'brand' },
  presupus: { label: 'presupunerea ta', tone: 'neutral' },
  utilizator: { label: 'introdus de tine', tone: 'neutral' },
  estimare: { label: 'estimare', tone: 'unclear' },
  inclus_in_chirie: { label: 'inclus în chirie', tone: 'found' },
});

export const INCOMPLETE_MESSAGES = Object.freeze({
  CHIRIE_LIPSA: 'Chiria lipsește. Completează chiria (răspunsul proprietarului sau presupunerea ta) ca să vezi costul real.',
  CURS_LIPSA: 'Anunțul are prețuri în euro, dar cursul BNR nu a putut fi descărcat încă. Verifică internetul sau scrie cursul în „Profilul meu financiar”.',
});

/**
 * Detaliile unei sume: conversia din EUR și intervalul unei estimări. Cu `showEur` (chiria,
 * garanția), o sumă în RON primește și echivalentul în EUR.
 */
export function costItemDetails(item, exchangeRate, { showEur = false } = {}) {
  if (!item) return [];
  const out = [];
  if (item.original?.moneda === 'EUR' && exchangeRate) {
    out.push(`${formatNumber(item.original.valoare)} EUR × ${formatRate(exchangeRate.eurToRon)}`);
  } else if (showEur && item.sumaRON > 0) {
    const eur = fromRON(item.sumaRON, exchangeRate);
    if (eur !== null) out.push(`≈ ${formatEUR(eur)}`);
  }
  if (item.interval) out.push(`interval ${formatNumber(item.interval.min)}–${formatNumber(item.interval.max)} RON`);
  if (item.nota) out.push(item.nota);
  return out;
}

/** Domeniul unui URL („olx.ro”) pentru afișare; null dacă nu e un URL valid. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
