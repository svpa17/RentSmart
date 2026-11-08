// RĂSCRUCE AI — valorile derivate, recalculate la fiecare schimbare a datelor (planul, §6).
// Nimic de aici nu se salvează: True Cost și comparația vin mereu din {passport, anunțuri, setări, curs}.
import { computeTrueCost } from '../shared/engine/trueCost.js';
import { compareSavedListings } from '../shared/engine/compare.js';
import { costReferenceFor } from '../shared/costReference.js';
import { EMPTY_USER_COSTS } from '../storage/appData.js';

/** Contextul de calcul; null cât timp Passport-ul nu e completat. */
export function costContext({ passport, rate, rateStatus, settings }) {
  if (!passport) return null;
  return { passport, costReference: costReferenceFor(settings), exchangeRate: rate ?? null, rateStatus: rateStatus ?? null };
}

/** True Cost pentru un anunț salvat (sau o analiză nesalvată, cu costurile utilizatorului goale). */
export function trueCostOf(savedOrAnalysis, ctx) {
  if (!ctx || !savedOrAnalysis) return null;
  const saved = savedOrAnalysis.analiza
    ? savedOrAnalysis
    : { analiza: savedOrAnalysis, costuriUtilizator: { ...EMPTY_USER_COSTS }, salvatLa: savedOrAnalysis.sursa.analizatLa };
  try {
    return computeTrueCost(saved, ctx);
  } catch {
    return null;
  }
}

/**
 * Toate valorile derivate pentru dashboard.
 * @returns {{ctx: object|null, items: Array<{saved: object, tc: object|null}>, comparatie: object|null}}
 */
export function deriveAll({ passport, rate, rateStatus, settings, saved }) {
  const ctx = costContext({ passport, rate, rateStatus, settings });
  const items = (saved ?? []).map((s) => ({ saved: s, tc: trueCostOf(s, ctx) }));
  const tcs = items.map((i) => i.tc).filter(Boolean);
  return { ctx, items, comparatie: ctx ? compareSavedListings(tcs) : null };
}
