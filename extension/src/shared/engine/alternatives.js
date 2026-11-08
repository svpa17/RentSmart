// RentSmart — clasamentul alternativelor găsite pe site-urile de anunțuri. Determinist, fără AI.
// Fiecare alternativă trece prin ACELAȘI motor ca un anunț analizat: True Cost (cu regulile existente:
// estimări prudente pentru întreținere și garanție, comision implicit 50% o singură dată, conversie EUR
// cu cursul afișat) și simularea (assessAffordability). Nu e „mai bună” doar pentru că e mai ieftină:
// contează întâi siguranța financiară, apoi cât de comparabilă e (camere, suprafață), abia apoi prețul.

import { FIELD_STATUS } from '../contracts/constants.js';
import { createListingAnalysis } from '../contracts/factories.js';
import { averageMonthlyCost } from './compare.js';
import { toRON } from './currency.js';
import { VERDICT, assessAffordability } from './affordability.js';
import { computeTrueCost } from './trueCost.js';

export const POTRIVIRE = Object.freeze({ EXCELENTA: 'excelenta', BUNA: 'buna', ECONOMICA: 'economica' });
const ORDER = { excelenta: 0, buna: 1, economica: 2 };
const EMPTY_COSTS = Object.freeze({ transportLunarRON: null, alteCosturiLunareRON: null, costuriMutareRON: null });
/** Pragul de plauzibilitate: sub 50% din chiria analizată, „anunțul” e aproape sigur altceva (cameră, cazare, anunț vechi). */
export const PLAUSIBILITY_FLOOR = 0.5;

/** O alternativă ca anunț salvat: chiria e cea afișată de site; restul câmpurilor sunt „De întrebat”. */
function asSavedListing(c, analizatLa) {
  const analiza = createListingAnalysis({ id: c.id, tip: 'pagina', url: c.url, analizatLa, titlu: c.titlu, imagine: c.imagine ?? null });
  analiza.campuri.chirie = {
    status: FIELD_STATUS.GASIT,
    valoare: c.pret.valoare,
    moneda: c.pret.moneda,
    dovada: `Preț afișat pe ${c.sursa}`,
    actualizatLa: null,
    nota: null,
  };
  return { analiza, costuriUtilizator: { ...EMPTY_COSTS }, salvatLa: analizatLa };
}

/**
 * @param {{
 *   candidates: Array<{id: string, sursa: string, titlu: string|null, url: string, pret: {valoare: number, moneda: 'EUR'|'RON'},
 *     camere: number|null, suprafataMp: number|null, localitate: string|null, cartier: string|null, imagine: string|null}>,
 *   analyzed: {chirieRON: number|null, camere: number|null, suprafataMp: number|null},
 *   ctx: {passport: object, costReference: object, exchangeRate: object|null},
 *   maxChirieRON: number|null, lunaStart: number, furtuni?: object[], now?: Date
 * }} p
 */
export function rankAlternatives({ candidates, analyzed, ctx, maxChirieRON, lunaStart, furtuni = [], now = new Date() }) {
  const at = now.toISOString();
  const excluse = { faraCurs: 0, pestePlafon: 0, subPrag: 0, nuEMaiIeftin: 0, nesigure: 0 };
  const floor = analyzed.chirieRON ? Math.round(analyzed.chirieRON * PLAUSIBILITY_FLOOR) : 0;
  const out = [];
  for (const c of candidates) {
    const chirieRON = toRON(c.pret.valoare, c.pret.moneda, ctx.exchangeRate);
    if (chirieRON === null) {
      excluse.faraCurs += 1;
      continue;
    }
    if (maxChirieRON && chirieRON > maxChirieRON) {
      excluse.pestePlafon += 1;
      continue;
    }
    if (chirieRON < floor) {
      excluse.subPrag += 1;
      continue;
    }
    if (analyzed.chirieRON && chirieRON >= analyzed.chirieRON) {
      excluse.nuEMaiIeftin += 1;
      continue;
    }
    const tc = computeTrueCost(asSavedListing(c, at), ctx);
    const a = assessAffordability({ passport: ctx.passport, trueCost: tc, lunaStart, furtuni });
    if (!a || a.verdict === VERDICT.NERECOMANDAT) {
      excluse.nesigure += 1;
      continue;
    }
    const sameRooms = c.camere !== null && analyzed.camere !== null ? c.camere === analyzed.camere : null;
    const areaClose =
      c.suprafataMp && analyzed.suprafataMp ? Math.abs(c.suprafataMp - analyzed.suprafataMp) / analyzed.suprafataMp <= 0.25 : null;
    let potrivire = POTRIVIRE.ECONOMICA;
    // Excelentă: sigură ȘI comparabilă dovedit (aceleași camere, suprafață ±25%). Bună: sigură, fără nepotriviri cunoscute.
    if (a.verdict === VERDICT.PERMIS && sameRooms === true && areaClose === true) potrivire = POTRIVIRE.EXCELENTA;
    else if ((a.verdict === VERDICT.PERMIS && sameRooms !== false) || (sameRooms === true && areaClose !== false)) potrivire = POTRIVIRE.BUNA;
    const economieLunara = analyzed.chirieRON ? analyzed.chirieRON - chirieRON : null;
    out.push({
      ...c,
      chirieRON,
      economieLunara,
      procentEconomie: economieLunara !== null ? Math.round((economieLunara * 100) / analyzed.chirieRON) : null,
      costLunarMediu: averageMonthlyCost(tc),
      plataLaMutare: tc.totaluri.plataLaMutare,
      garantie: tc.initial.garantie.sumaRON,
      comision: tc.initial.comision.sumaRON,
      folosesteEstimari: tc.folosesteEstimari,
      verdict: a.verdict,
      procentVenit: a.procentVenit,
      soldMinim: a.soldMinim,
      potrivire,
      comparabil: { camere: sameRooms, suprafata: areaClose },
      // Aceleași camere +2; suprafață apropiată +1; o nepotrivire DOVEDITĂ de suprafață −1 (necunoscutul nu e penalizat).
      scorComparabil: (sameRooms ? 2 : 0) + (areaClose === true ? 1 : areaClose === false ? -1 : 0),
    });
  }
  out.sort(
    (x, y) =>
      ORDER[x.potrivire] - ORDER[y.potrivire] ||
      y.scorComparabil - x.scorComparabil ||
      x.costLunarMediu - y.costLunarMediu ||
      x.id.localeCompare(y.id),
  );
  return { recomandari: out, excluse, pragPlauzibilitateRON: floor };
}
