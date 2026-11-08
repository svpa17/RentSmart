// RĂSCRUCE AI — motorul de simulare (Crossroads). Proprietar: Sebi.
//
// Formulele (planul, §3.3), pentru t = 0 … N−1 și luna mutării m:
//   V(t)  = V − round(V × p(t)/100), unde p(t) = suma procentelor de pierdere active (max 100)
//   R(t)  = round(R × (1 + q(t)/100)), unde q(t) = suma creșterilor de chirie cu start ≤ t
//   U(t)  = utilitățile de iarnă (noiembrie–martie) sau de vară
//   HX(t) = R(t) + U(t) + alteCosturi + transport
//   t < m : F(t) = V(t) − E − H0 − T0 − Sp(t)
//   t = m : F(t) = V(t) − E − HX(t) − G − C − M − Sp(t)
//   t > m : F(t) = V(t) − E − HX(t) − Sp(t)
//   S(t)  = S(t−1) + F(t), S(−1) = S0          (bani disponibili)
//   B(t)  = G pentru t ≥ m, altfel 0           (garanție blocată, NU intră în S)
//   W(t)  = S(t) + B(t)                        (avere totală, informativ)
// Funcție pură: aceleași date → același rezultat. Fără ceas de sistem, fără valori aleatoare.

import { SIMULATION_ASSUMPTIONS, STORM_TYPES, WARNING_CODES } from '../contracts/constants.js';
import { assertValid, validateSimulationInput } from '../contracts/schemas.js';
import { calendarMonth, seasonOf } from './seasons.js';
import { ron } from './format.js';

function stormEffects(furtuni, t, m) {
  let pierdere = 0;
  let crestere = 0;
  let neprevazute = 0;
  const active = [];
  for (const s of furtuni) {
    if (s.tip === STORM_TYPES.PIERDERE_VENIT && t >= s.start && t < s.start + s.durata) {
      pierdere += s.procent;
      active.push(s.id);
    } else if (s.tip === STORM_TYPES.CHELTUIALA_NEPREVAZUTA && t === s.luna) {
      neprevazute += s.suma;
      active.push(s.id);
    } else if (s.tip === STORM_TYPES.CRESTERE_CHIRIE && t >= s.start && t >= m) {
      // Creșterea chiriei contează doar după mutare (înainte nu plătim chiria nouă).
      crestere += s.procent;
      active.push(s.id);
    }
  }
  return { pierdere: Math.min(100, pierdere), crestere, neprevazute, active };
}

function simulatePath(tc, { passport, luni, lunaStart, furtuni }) {
  const {
    venitNetLunar: V,
    cheltuieliEsentialeLunare: E,
    costLocuintaActuala: H0,
    transportActualLunar: T0,
    economiiDisponibile: S0,
    rezervaMinima: Rmin,
    bugetMaximChirie: Bmax,
    lunaMutarii: m,
  } = passport;
  const R = tc.lunar.chirie.sumaRON;
  const G = tc.initial.garantie.sumaRON;
  const C = tc.initial.comision.sumaRON;
  const M = tc.initial.mutare.sumaRON;
  const fixedMonthly = tc.lunar.alteCosturi.sumaRON + tc.lunar.transport.sumaRON;
  const pragSigur = Math.max(0, Rmin);

  const rows = [];
  let S = S0;
  for (let t = 0; t < luni; t += 1) {
    const lunaCalendaristica = calendarMonth(lunaStart, t);
    const sezon = seasonOf(lunaCalendaristica);
    const faza = t < m ? 'inainte' : t === m ? 'mutare' : 'dupa';
    const fx = stormEffects(furtuni, t, m);

    const venit = V - Math.round((V * fx.pierdere) / 100);
    let chirie = null;
    let costLocuinta;
    if (faza === 'inainte') {
      costLocuinta = H0 + T0;
    } else {
      chirie = Math.round(R * (1 + fx.crestere / 100));
      const U = sezon === 'iarna' ? tc.lunar.utilitatiIarna.sumaRON : tc.lunar.utilitatiVara.sumaRON;
      costLocuinta = chirie + U + fixedMonthly;
    }
    const costuriInitiale = faza === 'mutare' ? G + C + M : 0;
    const flux = venit - E - costLocuinta - costuriInitiale - fx.neprevazute;
    S += flux;
    const garantieBlocata = faza === 'inainte' ? 0 : G;
    const baza = E + costLocuinta;

    rows.push({
      t,
      lunaCalendaristica,
      sezon,
      faza,
      venit,
      cheltuieliEsentiale: E,
      costLocuinta,
      chirie,
      costuriInitiale,
      cheltuieliNeprevazute: fx.neprevazute,
      flux,
      bani: S,
      garantieBlocata,
      avereTotala: S + garantieBlocata,
      rezervaLuni: baza > 0 ? Math.round((S / baza) * 10) / 10 : null,
      subZero: S < 0,
      subRezerva: Rmin > 0 && S < Rmin,
      chiriePesteBuget: chirie !== null && Bmax > 0 && chirie > Bmax,
      furtuniActive: fx.active,
    });
  }

  let soldMinim = rows[0].bani;
  let lunaSoldMinim = 0;
  for (const r of rows) {
    if (r.bani < soldMinim) {
      soldMinim = r.bani;
      lunaSoldMinim = r.t;
    }
  }
  const first = (pred) => {
    const r = rows.find(pred);
    return r ? r.t : null;
  };
  const mutareInPerioada = m < luni;
  const lastBeforeMove = Math.min(m, luni) - 1;

  return {
    listingId: tc.listingId,
    titlu: tc.titlu,
    luni: rows,
    indicatori: {
      soldMinim,
      lunaSoldMinim,
      primaLunaNegativa: first((r) => r.subZero),
      primaLunaSubRezerva: first((r) => r.subRezerva),
      primaLunaPesteBuget: first((r) => r.chiriePesteBuget),
      soldFinal: rows[rows.length - 1].bani,
      economiiPanaLaMutare: lastBeforeMove >= 0 ? rows[lastBeforeMove].bani - S0 : 0,
      mutareInPerioada,
      sigur: rows.every((r) => r.bani >= pragSigur),
    },
  };
}

/**
 * @param {import('../contracts/types.js').SimulationInput} input
 * @returns {import('../contracts/types.js').SimulationResult}
 */
export function simulate(input) {
  assertValid(validateSimulationInput, input, 'SimulationInput');
  const { passport, apartamente, luni, lunaStart, furtuni } = input;
  const drumuri = apartamente.map((tc) => simulatePath(tc, { passport, luni, lunaStart, furtuni }));

  const avertizari = [];
  if (passport.lunaMutarii >= luni) {
    avertizari.push({
      cod: WARNING_CODES.MUTARE_DUPA_PERIOADA,
      mesaj: 'Te muți după ultima lună afișată. Alege o perioadă mai lungă ca să vezi și lunile de după mutare.',
      luna: null,
    });
  }
  if (luni > 12) {
    avertizari.push({ cod: WARNING_CODES.ORIZONT_LUNG, mesaj: 'După primele 12 luni, estimările sunt mai puțin sigure.', luna: null });
  }
  if (apartamente.some((tc) => tc.folosesteEstimari)) {
    avertizari.push({
      cod: WARNING_CODES.ESTIMARI_FOLOSITE,
      mesaj: 'Unele costuri nu apar în anunț, așa că le-am estimat cu valori mai mari, ca să nu te ia prin surprindere.',
      luna: null,
    });
  }
  for (const d of drumuri) {
    if (d.indicatori.primaLunaPesteBuget !== null) {
      const row = d.luni[d.indicatori.primaLunaPesteBuget];
      avertizari.push({
        cod: WARNING_CODES.CHIRIE_PESTE_BUGET,
        mesaj: `${d.titlu ?? d.listingId}: chiria (${ron(row.chirie)}) e cu ${ron(row.chirie - passport.bugetMaximChirie)} peste bugetul tău pentru chirie (${ron(passport.bugetMaximChirie)}).`,
        luna: row.t,
      });
    }
  }

  return {
    luni,
    lunaStart,
    lunaMutarii: passport.lunaMutarii,
    pragSigur: Math.max(0, passport.rezervaMinima),
    drumuri,
    avertizari,
    ipoteze: SIMULATION_ASSUMPTIONS,
  };
}
