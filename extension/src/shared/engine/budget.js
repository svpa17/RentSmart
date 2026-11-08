// RentSmart — rezumatul bugetului din Financial Passport (pagina „Bugetul tău”).
// Nu e o formulă nouă: este exact fluxul lunar „înainte de mutare” din simulare (simulate.js):
//   venit net − cheltuieli esențiale − (costul locuinței actuale + transportul actual).

/**
 * Banii care rămân lunar acum, înainte de mutare. null dacă lipsește Passport-ul.
 * @param {import('../contracts/types.js').FinancialPassport|null} passport
 * @returns {number|null}
 */
export function monthlyLeftoverNow(passport) {
  if (!passport) return null;
  return passport.venitNetLunar - passport.cheltuieliEsentialeLunare - (passport.costLocuintaActuala + passport.transportActualLunar);
}

/**
 * Totalul de plătit la mutare, CU prima chirie: plata la mutare din True Cost (garanție + comision +
 * mutare și dotare, care exclude prima chirie) + chiria primei luni. În simulare, luna mutării plătește
 * exact aceste sume (plus întreținerea lunii). null dacă True Cost e incomplet.
 */
export function totalToMoveIn(tc) {
  if (!tc?.complet) return null;
  return tc.totaluri.plataLaMutare + tc.lunar.chirie.sumaRON;
}
