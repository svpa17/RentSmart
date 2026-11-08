// RentSmart — verdictul financiar al unui apartament, din rezultatele existente ale motorului.
// Nu introduce formule noi de cost: folosește True Cost (computeTrueCost), simularea (simulate) și costul
// lunar mediu (averageMonthlyCost). Regulile de verdict sunt doar o citire a acestor rezultate:
//   - „nerecomandat”: în simulare, banii disponibili devin negativi;
//   - „tensionat”: banii coboară sub rezerva minimă, sau chiria depășește bugetul maxim din Passport;
//   - „permis”: altfel (banii rămân peste rezerva minimă pe toată perioada verificată).
// Perioada verificată: până la 12 luni după mutare (minimum 12 luni), ca în Path to Yes.

import { MAX_SIMULATION_MONTHS } from '../contracts/constants.js';
import { averageMonthlyCost } from './compare.js';
import { simulate } from './simulate.js';

export const VERDICT = Object.freeze({ PERMIS: 'permis', TENSIONAT: 'tensionat', NERECOMANDAT: 'nerecomandat' });

/** Perioada verificată: luna mutării + 12 luni (minimum 12, maximum 60). */
export const affordabilityHorizon = (lunaMutarii) => Math.min(MAX_SIMULATION_MONTHS, Math.max(12, lunaMutarii + 12));

/**
 * @param {{passport: object, trueCost: object, lunaStart: number, furtuni?: object[]}} p
 * @returns {null | {verdict: string, procentVenit: number|null, costLunarMediu: number, soldMinim: number,
 *   lunaSoldMinim: number, primaLunaNegativa: number|null, primaLunaSubRezerva: number|null, pesteBuget: boolean,
 *   pragSigur: number, luni: number}}  null dacă lipsește Passport-ul sau costul real e incomplet
 */
export function assessAffordability({ passport, trueCost, lunaStart, furtuni = [] }) {
  if (!passport || !trueCost?.complet) return null;
  const luni = affordabilityHorizon(passport.lunaMutarii);
  const sim = simulate({ passport, apartamente: [trueCost], luni, lunaStart, furtuni });
  const ind = sim.drumuri[0].indicatori;
  const costLunarMediu = averageMonthlyCost(trueCost);
  const pesteBuget = ind.primaLunaPesteBuget !== null;
  let verdict = VERDICT.PERMIS;
  if (ind.primaLunaNegativa !== null) verdict = VERDICT.NERECOMANDAT;
  else if (!ind.sigur || pesteBuget) verdict = VERDICT.TENSIONAT;
  return {
    verdict,
    // Ponderea costului lunar mediu (chirie + întreținere + transport + alte costuri) în venitul net.
    procentVenit: passport.venitNetLunar > 0 ? Math.round((costLunarMediu * 100) / passport.venitNetLunar) : null,
    costLunarMediu,
    soldMinim: ind.soldMinim,
    lunaSoldMinim: ind.lunaSoldMinim,
    primaLunaNegativa: ind.primaLunaNegativa,
    primaLunaSubRezerva: ind.primaLunaSubRezerva,
    pesteBuget,
    pragSigur: sim.pragSigur,
    luni,
  };
}
