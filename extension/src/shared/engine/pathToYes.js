// RĂSCRUCE AI — Path to Yes (planul, §5.7). Proprietar: Sebi.
//
// Obiectiv: S(t) ≥ max(0, Rmin) în toate lunile verificate.
// Fiecare opțiune se obține rulând ACELAȘI motor (simulate.js) cu o singură variabilă schimbată:
//   1. amanare             — cel mai mic m' > m sigur pe orizontul m' + P, P = max(N − m, 12), m' + P ≤ 60
//   2. rezervaSuplimentara — deficit = max_t(max(0, Rmin) − S(t)); adăugat la S0 ridică fiecare S(t) cu deficitul
//   3. altApartament       — alt apartament dintre cele salvate, sigur în aceleași condiții
//   4. reducereCheltuieli  — cel mai mic d ∈ [1, E] (căutare binară) pentru care E − d e sigur; „doar dacă e realist”
//
// Orizontul verificat al planului actual:
//   - m < N: cele N luni alese de utilizator (la fel ca indicatorul `sigur` din Crossroads);
//   - m ≥ N: m + P (P = 12), pentru că o dată de mutare a cărei perioadă de după mutare
//     nu a fost simulată nu este niciodată considerată sigură. Dacă m + P > 60, planul nu poate fi verificat.
// Funcție pură și deterministă.

import { MAX_SIMULATION_MONTHS } from '../contracts/constants.js';
import { assertValid, validatePathToYes, validateSimulationInput } from '../contracts/schemas.js';
import { simulate } from './simulate.js';
import { ron } from './format.js';

/** Luni minime verificate după mutare pentru o amânare. */
export const MIN_MONTHS_AFTER_MOVE = 12;

/** Rulează motorul pentru un singur apartament și întoarce drumul lui. */
function runPath(tc, passport, luni, lunaStart, furtuni) {
  return simulate({ passport, apartamente: [tc], luni, lunaStart, furtuni }).drumuri[0];
}

const isSafe = (drum, prag) => drum.luni.every((r) => r.bani >= prag);

/**
 * Orizonturile folosite de Path to Yes.
 * @returns {{P: number, orizontPlan: number, verificabil: boolean}}
 */
export function pathToYesHorizons(lunaMutarii, luni) {
  const P = Math.max(luni - lunaMutarii, MIN_MONTHS_AFTER_MOVE);
  if (lunaMutarii < luni) return { P, orizontPlan: luni, verificabil: true };
  const orizontPlan = lunaMutarii + P;
  return { P, orizontPlan, verificabil: orizontPlan <= MAX_SIMULATION_MONTHS };
}

function findPostponement(tc, { passport, lunaStart, furtuni, P, prag }) {
  for (let m2 = passport.lunaMutarii + 1; m2 + P <= MAX_SIMULATION_MONTHS; m2 += 1) {
    const drum = runPath(tc, { ...passport, lunaMutarii: m2 }, m2 + P, lunaStart, furtuni);
    if (isSafe(drum, prag)) {
      return { tip: 'amanare', listingId: tc.listingId, lunaMutarii: m2, orizontVerificat: m2 + P, luniVerificateDupaMutare: P };
    }
  }
  return null;
}

function findExpenseCut(tc, { passport, orizontPlan, lunaStart, furtuni, prag }) {
  const E = passport.cheltuieliEsentialeLunare;
  const safeWith = (d) =>
    isSafe(runPath(tc, { ...passport, cheltuieliEsentialeLunare: E - d }, orizontPlan, lunaStart, furtuni), prag);
  if (E < 1 || !safeWith(E)) return null;
  let lo = 1;
  let hi = E;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (safeWith(mid)) hi = mid;
    else lo = mid + 1;
  }
  return { tip: 'reducereCheltuieli', listingId: tc.listingId, sumaLunaraRON: lo, doarDacaERealist: true };
}

function buildMessage({ sigurDeja, verificabil, optiuni, prag, fluxNegativDupaMutare, orizontPlan }) {
  // Textele explică pe înțeles ce arată calculele (nu schimbă calculele). prag = suma păstrată pentru urgențe.
  const limita = prag > 0 ? `${ron(prag)}, suma pe care vrei s-o păstrezi pentru urgențe` : 'zero';
  if (!verificabil) {
    return `Te muți prea departe în viitor: putem calcula cel mult ${MAX_SIMULATION_MONTHS} de luni, deci nu putem spune încă dacă îți permiți chiria după mutare.`;
  }
  if (sigurDeja) {
    return `Îți permiți: economiile tale rămân peste ${limita} în toate cele ${orizontPlan} luni verificate.`;
  }
  if (optiuni.length === 0) {
    return 'Nu am găsit o schimbare care să rezolve situația în perioada verificată.';
  }
  let mesaj = `Cu această chirie, economiile tale scad sub ${limita}. Oricare dintre variantele de mai jos rezolvă problema.`;
  if (fluxNegativDupaMutare) {
    mesaj += ' Atenție: după mutare cheltuielile lunare sunt mai mari decât venitul, așa că bani strânși în plus doar amână problema.';
  }
  return mesaj;
}

/**
 * Path to Yes pentru un apartament.
 * @param {Object} input
 * @param {import('../contracts/types.js').FinancialPassport} input.passport
 * @param {import('../contracts/types.js').TrueCost} input.apartament        apartamentul analizat (complet)
 * @param {import('../contracts/types.js').TrueCost[]} [input.apartamenteSalvate]  toate anunțurile salvate (pentru „alt apartament”)
 * @param {number} input.luni        N, 1…60
 * @param {number} input.lunaStart   1…12
 * @param {import('../contracts/types.js').Storm[]} input.furtuni
 * @returns {import('../contracts/types.js').PathToYes}
 */
export function computePathToYes({ passport, apartament, apartamenteSalvate = [], luni, lunaStart, furtuni }) {
  assertValid(validateSimulationInput, { passport, apartamente: [apartament], luni, lunaStart, furtuni }, 'SimulationInput');
  const prag = Math.max(0, passport.rezervaMinima);
  const { P, orizontPlan, verificabil } = pathToYesHorizons(passport.lunaMutarii, luni);

  const base = { listingId: apartament.listingId, pragSigur: prag, celMaiApropiat: null };
  if (!verificabil) {
    const r = { ...base, sigurDeja: false, optiuni: [] };
    r.mesaj = buildMessage({ ...r, verificabil, prag, orizontPlan });
    return assertValid(validatePathToYes, r, 'PathToYes');
  }

  const drum = runPath(apartament, passport, orizontPlan, lunaStart, furtuni);
  const sigurDeja = isSafe(drum, prag);
  const optiuni = [];
  let fluxNegativDupaMutare = false;

  if (!sigurDeja) {
    const ctx = { passport, orizontPlan, lunaStart, furtuni, P, prag };

    const amanare = findPostponement(apartament, ctx);
    if (amanare) optiuni.push(amanare);

    const deficit = Math.max(...drum.luni.map((r) => prag - r.bani));
    optiuni.push({ tip: 'rezervaSuplimentara', listingId: apartament.listingId, sumaRON: deficit });

    for (const alt of apartamenteSalvate) {
      if (!alt || alt.listingId === apartament.listingId || alt.complet !== true) continue;
      if (isSafe(runPath(alt, passport, orizontPlan, lunaStart, furtuni), prag)) {
        optiuni.push({ tip: 'altApartament', listingId: alt.listingId, deLaListingId: apartament.listingId });
      }
    }

    const reducere = findExpenseCut(apartament, ctx);
    if (reducere) optiuni.push(reducere);

    // Fără furtuni, după mutare, soldul scade lună de lună pe un an întreg (vară + iarnă)?
    const calm = runPath(apartament, { ...passport, lunaMutarii: 0 }, 12, lunaStart, []);
    fluxNegativDupaMutare = calm.luni.slice(1).reduce((s, r) => s + r.flux, 0) < 0;
  }

  const r = { ...base, sigurDeja, optiuni };
  r.mesaj = buildMessage({ sigurDeja, verificabil, optiuni, prag, fluxNegativDupaMutare, orizontPlan });
  return assertValid(validatePathToYes, r, 'PathToYes');
}

/**
 * Datele de intrare ale simulării pentru drumul „Planul” (linia punctată din Crossroads):
 * aceleași date, cu o singură variabilă schimbată conform opțiunii.
 * @param {import('../contracts/types.js').PathToYesOption} optiune
 * @param {{passport: Object, apartament: Object, apartamenteSalvate?: Object[], luni: number, lunaStart: number, furtuni: Object[]}} input
 * @returns {import('../contracts/types.js').SimulationInput}
 */
export function planSimulationInput(optiune, { passport, apartament, apartamenteSalvate = [], luni, lunaStart, furtuni }) {
  const { orizontPlan } = pathToYesHorizons(passport.lunaMutarii, luni);
  const sim = { passport, apartamente: [apartament], luni: Math.min(orizontPlan, MAX_SIMULATION_MONTHS), lunaStart, furtuni };
  switch (optiune.tip) {
    case 'amanare':
      return { ...sim, passport: { ...passport, lunaMutarii: optiune.lunaMutarii }, luni: Math.max(luni, optiune.orizontVerificat) };
    case 'rezervaSuplimentara':
      return { ...sim, passport: { ...passport, economiiDisponibile: passport.economiiDisponibile + optiune.sumaRON } };
    case 'altApartament': {
      const alt = apartamenteSalvate.find((a) => a.listingId === optiune.listingId);
      if (!alt) throw new RangeError(`Apartamentul ${optiune.listingId} nu se află printre anunțurile salvate`);
      return { ...sim, apartamente: [alt] };
    }
    case 'reducereCheltuieli':
      return {
        ...sim,
        passport: { ...passport, cheltuieliEsentialeLunare: passport.cheltuieliEsentialeLunare - optiune.sumaLunaraRON },
      };
    default:
      throw new RangeError(`Opțiune necunoscută: ${optiune.tip}`);
  }
}
