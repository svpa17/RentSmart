// RĂSCRUCE AI — scalele și marcajele graficului Crossroads (pure, testabile).
import { calendarMonth } from '../shared/engine/seasons.js';

export const MONTH_SHORT = Object.freeze(['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']);
export const MONTH_LONG = Object.freeze([
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]);

/** Pasul marcajelor de lună (planul, §7): lunar până la 12, din 3 în 3 până la 24, din 6 în 6 peste 24. */
export function tickStep(luni) {
  if (luni <= 12) return 1;
  if (luni <= 24) return 3;
  return 6;
}

/** Indicii t ai marcajelor: 0, pas, 2·pas, … și ultima lună. */
export function monthTicks(luni) {
  const step = tickStep(luni);
  const ticks = [];
  for (let t = 0; t < luni; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== luni - 1) ticks.push(luni - 1);
  return ticks;
}

/**
 * Anul în care începe perioada afișată: luna de start e luna curentă sau următoarea ei apariție
 * (așa se creează implicit setările: perioada începe în luna curentă).
 */
export function startYear(lunaStart, now = new Date()) {
  return lunaStart >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
}

/** Perioada trece de un an calendaristic (atunci afișăm și anul, ca lunile să nu se confunde). */
export const spansYears = (lunaStart, luni) => Number.isInteger(luni) && lunaStart - 1 + luni > 12;

/** Anul calendaristic al lunii t a perioadei. */
export const yearOf = (lunaStart, t, now = new Date()) => startYear(lunaStart, now) + Math.floor((lunaStart - 1 + t) / 12);

/**
 * Numele lunii t a perioadei (t = 0 e luna de start): „mai”, „Mai” (capital) sau „mai 2027” (când
 * perioada de `luni` trece de un an). Fără numerotări tehnice de tipul „Luna 5”.
 */
export function monthLabel(lunaStart, t, { long = true, capital = false, luni = null, now = new Date() } = {}) {
  const cal = calendarMonth(lunaStart, t);
  let s = (long ? MONTH_LONG : MONTH_SHORT)[cal - 1];
  if (spansYears(lunaStart, luni)) s += ` ${yearOf(lunaStart, t, now)}`;
  return capital ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Pas „rotund” pentru axa banilor: 1, 2, 2,5 sau 5 × 10^k. */
export function niceStep(range, target = 5) {
  const raw = Math.max(range, 1) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * Domeniul axei banilor: include mereu 0 și pragul de siguranță, rotunjit la pas.
 * @returns {{min: number, max: number, ticks: number[]}}
 */
export function moneyDomain(values, prag = 0) {
  const lo = Math.min(0, prag, ...values);
  const hi = Math.max(0, prag, ...values);
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step === hi ? hi + step : Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return { min, max, ticks };
}
