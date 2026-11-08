// RĂSCRUCE AI: cursul EUR → RON publicat de BNR, descărcat de pe cursbnr.ro.
// Funcții pure (parsare, calendarul publicării, decizia de reîmprospătare). Scrierea în
// chrome.storage.local e în storage/appData.js. Nu există curs scris în cod: fără curs descărcat
// sau introdus, anunțurile cu sume în EUR rămân incomplete (CURS_LIPSA), ca înainte.

export const BNR_RATE_URL = 'https://www.cursbnr.ro/api/v1/rates?currency=EUR';
/** După o încercare (reușită sau nu), nu mai cerem din nou mai devreme de atât. */
export const RETRY_AFTER_MS = 30 * 60 * 1000;
/** BNR publică în zilele lucrătoare în jurul orei 13:00; lăsăm o marjă. */
const PUBLISH_MINUTES = 13 * 60 + 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Validează răspunsul API-ului: {"date":"2026-11-06","quote":"RON","rates":{"EUR":5.3408}}.
 * @returns {{eurToRon: number, dataPublicarii: string}}
 */
export function parseBnrResponse(body) {
  const eurToRon = body?.rates?.EUR;
  const date = body?.date;
  if (body?.quote !== undefined && body.quote !== 'RON') throw new Error('Cursul nu este exprimat în RON');
  if (typeof eurToRon !== 'number' || !Number.isFinite(eurToRon) || eurToRon <= 0 || eurToRon > 100) throw new Error('Curs EUR invalid');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error('Data publicării lipsește');
  return { eurToRon, dataPublicarii: date };
}

/** Data (AAAA-LL-ZZ), ziua săptămânii (0 = duminică) și minutul zilei, la București. */
function bucharestParts(now) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const isWeekday = (d) => d >= 1 && d <= 5;

/**
 * Cea mai recentă dată la care BNR ar fi trebuit să publice un curs (după calendarul zilelor
 * lucrătoare). Sărbătorile legale nu sunt cunoscute: în acele zile API-ul întoarce cursul anterior,
 * care rămâne valid.
 */
export function expectedPublicationDate(now = new Date()) {
  const { date, weekday, minutes } = bucharestParts(now);
  if (isWeekday(weekday) && minutes >= PUBLISH_MINUTES) return date;
  let t = Date.parse(`${date}T00:00:00Z`) - DAY_MS;
  while (!isWeekday(new Date(t).getUTCDay())) t -= DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Trebuie descărcat cursul? Cursul introdus de utilizator și cel demo au prioritate și nu se
 * înlocuiesc automat.
 * @param {{rate: object|null, status: {incercatLa: string, ok: boolean}|null, now?: Date}} p
 */
export function needsRefresh({ rate, status, now = new Date() }) {
  if (rate && rate.sursa !== 'bnr') return false;
  if (status?.incercatLa && now.getTime() - Date.parse(status.incercatLa) < RETRY_AFTER_MS) return false;
  if (!rate) return true;
  return rate.dataPublicarii < expectedPublicationDate(now);
}

/**
 * Cursul BNR păstrat e posibil depășit: ultima încercare de actualizare a eșuat, iar între timp
 * BNR ar fi trebuit să publice unul mai nou.
 */
export function isPossiblyOutdated({ rate, status, now = new Date() }) {
  return rate?.sursa === 'bnr' && status?.ok === false && rate.dataPublicarii < expectedPublicationDate(now);
}

/** AAAA-LL-ZZ → ZZ.LL.AAAA */
export const formatPublicationDate = (d) => d.split('-').reverse().join('.');
