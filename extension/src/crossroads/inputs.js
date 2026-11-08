// RĂSCRUCE AI — validarea comenzilor Crossroads (pură, testabilă).

/** Butoanele rapide ale perioadei (planul, §7). */
export const QUICK_PERIODS = Object.freeze([3, 6, 12, 18, 24]);

/** Perioada: întreg între 1 și 60; null altfel. */
export function parsePeriod(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 60 ? n : null;
}

/** Luna mutării: întreg între 0 și 60; null altfel. */
export function parseMoveMonth(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n <= 60 ? n : null;
}
