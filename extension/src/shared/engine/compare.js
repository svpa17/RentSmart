// RĂSCRUCE AI — comparația anunțurilor SALVATE de utilizator (planul, §1 „Domeniul comparației”).
// Compară doar ce a salvat utilizatorul, niciodată „piața”. Formulări permise:
//   „Dintre anunțurile tale salvate, B are cel mai mic cost lunar estimat…”, „A depășește bugetul tău…”.
// Costul lunar mediu pe an: 7 luni de vară + 5 luni de iarnă (iarna = noiembrie–martie, §5.4).

import { WARNING_CODES, WINTER_MONTHS } from '../contracts/constants.js';
import { ron } from './format.js';

const WINTER = WINTER_MONTHS.length;
const SUMMER = 12 - WINTER;

/** Costul lunar mediu pe un an calendaristic, RON întregi; null pentru un apartament incomplet. */
export function averageMonthlyCost(tc) {
  if (!tc?.complet) return null;
  return Math.round((SUMMER * tc.totaluri.lunarVara + WINTER * tc.totaluri.lunarIarna) / 12);
}

/** Câștigătorul unic după o valoare (cea mai mică); null la egalitate. */
function lowest(items, value) {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => value(a) - value(b));
  if (value(sorted[0]) === value(sorted[1])) return null;
  return { listingId: sorted[0].listingId, valoare: value(sorted[0]) };
}

/**
 * @param {import('../contracts/types.js').TrueCost[]} trueCosts  costurile reale ale anunțurilor salvate
 * @returns {{
 *   comparabile: string[],
 *   incomplete: Array<{listingId: string, motive: string[]}>,
 *   celMaiMicCostLunar: {listingId: string, valoare: number}|null,
 *   ceaMaiMicaPlataLaMutare: {listingId: string, valoare: number}|null,
 *   pesteBuget: string[],
 *   mesaje: string[]
 * }}
 */
export function compareSavedListings(trueCosts) {
  const name = (id) => trueCosts.find((t) => t.listingId === id)?.titlu ?? id;
  const complete = trueCosts.filter((t) => t.complet);
  const celMaiMicCostLunar = lowest(complete, averageMonthlyCost);
  const ceaMaiMicaPlataLaMutare = lowest(complete, (t) => t.totaluri.plataLaMutare);
  const pesteBuget = trueCosts.filter((t) => t.avertizari.some((w) => w.cod === WARNING_CODES.CHIRIE_PESTE_BUGET)).map((t) => t.listingId);

  const mesaje = [];
  if (celMaiMicCostLunar) {
    mesaje.push(
      `Dintre anunțurile tale salvate, ${name(celMaiMicCostLunar.listingId)} are cel mai mic cost lunar estimat (${ron(celMaiMicCostLunar.valoare)} în medie pe lună).`,
    );
  }
  if (ceaMaiMicaPlataLaMutare) {
    mesaje.push(
      `Dintre anunțurile tale salvate, ${name(ceaMaiMicaPlataLaMutare.listingId)} cere cea mai mică plată la mutare (${ron(ceaMaiMicaPlataLaMutare.valoare)}, fără prima chirie).`,
    );
  }
  for (const id of pesteBuget) mesaje.push(`${name(id)}: chiria e peste bugetul tău pentru chirie.`);
  if (complete.length < 2 && trueCosts.length >= 2) {
    mesaje.push('Ca să compari, ai nevoie de cel puțin două anunțuri salvate la care se cunoaște chiria.');
  }

  return {
    comparabile: complete.map((t) => t.listingId),
    incomplete: trueCosts.filter((t) => !t.complet).map((t) => ({ listingId: t.listingId, motive: t.motiveIncomplet })),
    celMaiMicCostLunar,
    ceaMaiMicaPlataLaMutare,
    pesteBuget,
    mesaje,
  };
}
