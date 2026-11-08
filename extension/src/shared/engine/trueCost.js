// RĂSCRUCE AI — True Cost Analyzer. Proprietar: Sebi.
//
// Reguli (vezi planul, §3):
// - Chiria nu se estimează niciodată. Fără chirie utilizabilă → apartament incomplet (CHIRIE_LIPSA).
// - Orice sumă în EUR folosită în calcul cere un curs explicit; altfel incomplet (CURS_LIPSA).
// - Utilități/întreținere: valorile explicite au prioritate. O singură valoare cunoscută se folosește
//   pentru ambele sezoane. Fără valori și cu „utilități incluse” = true → 0 („inclus_in_chirie”).
//   Altfel → capătul prudent (max) din CostReference, marcat „estimare”.
// - Garanția este recuperabilă și se raportează separat; comisionul și mutarea sunt definitive.
// - Prima chirie NU este cost inițial: se plătește ca chirie lunară în luna mutării.
// - Transport necompletat → presupus egal cu transportul actual din Passport.
// - Alte costuri lunare / costuri de mutare necompletate → 0, cu notă.
// - bugetMaximChirie = 0 înseamnă „nesetat” (fără avertizare).

import { COST_SOURCE, DEFAULT_COMMISSION_PERCENT, FIELD_STATUS, INCOMPLETE_REASONS, USABLE_STATUSES, WARNING_CODES } from '../contracts/constants.js';
import {
  assertValid,
  validateCostReference,
  validateExchangeRate,
  validateFinancialPassport,
  validateSavedListing,
} from '../contracts/schemas.js';
import { toRON } from './currency.js';
import { ron } from './format.js';

const STATUS_TO_SOURCE = {
  [FIELD_STATUS.GASIT]: COST_SOURCE.ANUNT,
  [FIELD_STATUS.CONFIRMAT]: COST_SOURCE.CONFIRMAT,
  [FIELD_STATUS.PRESUPUS]: COST_SOURCE.PRESUPUS,
};

const usable = (field) => USABLE_STATUSES.includes(field.status);

const item = (sumaRON, sursa, { interval = null, original = null, nota = null } = {}) => ({
  sumaRON,
  sursa,
  interval,
  original,
  nota,
});

/**
 * @param {import('../contracts/types.js').SavedListing} savedListing
 * @param {{
 *   passport: import('../contracts/types.js').FinancialPassport,
 *   costReference: import('../contracts/types.js').CostReference,
 *   exchangeRate: import('../contracts/types.js').ExchangeRate|null
 * }} ctx
 * @returns {import('../contracts/types.js').TrueCost}
 */
export function computeTrueCost(savedListing, { passport, costReference, exchangeRate = null }) {
  assertValid(validateSavedListing, savedListing, 'SavedListing');
  assertValid(validateFinancialPassport, passport, 'FinancialPassport');
  assertValid(validateCostReference, costReference, 'CostReference');
  if (exchangeRate !== null) assertValid(validateExchangeRate, exchangeRate, 'ExchangeRate');

  const { analiza, costuriUtilizator: user } = savedListing;
  const f = analiza.campuri;
  const motive = new Set();
  let folosesteEstimari = false;

  /** Convertește un câmp monetar; marchează CURS_LIPSA dacă nu se poate. */
  const money = (valoare, moneda) => {
    const ron = toRON(valoare, moneda, exchangeRate);
    if (ron === null) motive.add(INCOMPLETE_REASONS.CURS_LIPSA);
    return ron;
  };
  const originalOf = (valoare, moneda) => (moneda === 'EUR' ? { valoare, moneda } : null);

  // Chirie
  let chirie = null;
  if (usable(f.chirie)) {
    const ron = money(f.chirie.valoare, f.chirie.moneda);
    if (ron !== null) {
      chirie = item(ron, STATUS_TO_SOURCE[f.chirie.status], {
        original: originalOf(f.chirie.valoare, f.chirie.moneda),
      });
    }
  } else {
    motive.add(INCOMPLETE_REASONS.CHIRIE_LIPSA);
  }
  const R = chirie ? chirie.sumaRON : null;

  // Utilități / întreținere
  const ref = costReference.utilitatiLunareRON;
  const knownSeason = (field) => {
    if (!usable(field)) return null;
    const ron = money(field.valoare, field.moneda);
    return ron === null
      ? null
      : item(ron, STATUS_TO_SOURCE[field.status], { original: originalOf(field.valoare, field.moneda) });
  };
  let utilitatiVara = knownSeason(f.intretinereVara);
  let utilitatiIarna = knownSeason(f.intretinereIarna);
  if (utilitatiVara && !utilitatiIarna) {
    utilitatiIarna = { ...utilitatiVara, nota: 'Aceeași valoare pentru ambele sezoane (doar vara e cunoscută).' };
  } else if (utilitatiIarna && !utilitatiVara) {
    utilitatiVara = { ...utilitatiIarna, nota: 'Aceeași valoare pentru ambele sezoane (doar iarna e cunoscută).' };
  } else if (!utilitatiVara && !utilitatiIarna) {
    const incluse = usable(f.utilitatiIncluse) && f.utilitatiIncluse.valoare === true;
    const euCunoscut = [f.intretinereVara, f.intretinereIarna].some((x) => usable(x) && x.moneda === 'EUR');
    if (incluse) {
      utilitatiVara = item(0, COST_SOURCE.INCLUS_IN_CHIRIE);
      utilitatiIarna = item(0, COST_SOURCE.INCLUS_IN_CHIRIE);
    } else if (!euCunoscut) {
      folosesteEstimari = true;
      utilitatiVara = item(ref.vara.max, COST_SOURCE.ESTIMARE, { interval: { ...ref.vara } });
      utilitatiIarna = item(ref.iarna.max, COST_SOURCE.ESTIMARE, { interval: { ...ref.iarna } });
    }
  }
  // Dacă o valoare în EUR nu a putut fi convertită, păstrăm structura cu 0 și apartamentul rămâne incomplet.
  utilitatiVara ??= item(0, COST_SOURCE.ESTIMARE, { nota: 'Nu se poate calcula fără curs.' });
  utilitatiIarna ??= item(0, COST_SOURCE.ESTIMARE, { nota: 'Nu se poate calcula fără curs.' });

  // Costuri introduse de utilizator
  const alteCosturi =
    user.alteCosturiLunareRON === null
      ? item(0, COST_SOURCE.UTILIZATOR, { nota: 'Necompletat; considerat 0.' })
      : item(user.alteCosturiLunareRON, COST_SOURCE.UTILIZATOR);
  const transport =
    user.transportLunarRON === null
      ? item(passport.transportActualLunar, COST_SOURCE.PRESUPUS, { nota: 'Presupus egal cu transportul actual.' })
      : item(user.transportLunarRON, COST_SOURCE.UTILIZATOR);
  const mutare =
    user.costuriMutareRON === null
      ? item(0, COST_SOURCE.UTILIZATOR, { nota: 'Necompletat; considerat 0.' })
      : item(user.costuriMutareRON, COST_SOURCE.UTILIZATOR);

  // Garanție (recuperabilă)
  let garantie = null;
  if (usable(f.garantie)) {
    const sursa = STATUS_TO_SOURCE[f.garantie.status];
    if (f.garantie.unitate === 'luni_chirie') {
      if (R !== null) garantie = item(Math.round(f.garantie.valoare * R), sursa, { nota: `${f.garantie.valoare} × chiria` });
    } else {
      const ron = money(f.garantie.valoare, f.garantie.moneda);
      if (ron !== null) garantie = item(ron, sursa, { original: originalOf(f.garantie.valoare, f.garantie.moneda) });
    }
  } else if (R !== null) {
    folosesteEstimari = true;
    const g = costReference.garantieLuniChirie;
    garantie = item(Math.round(g.max * R), COST_SOURCE.ESTIMARE, {
      interval: { min: Math.round(g.min * R), max: Math.round(g.max * R) },
      nota: `Estimare prudentă: ${g.max} × chiria.`,
    });
  }

  // Comision (definitiv)
  let comision = null;
  if (usable(f.comision)) {
    const sursa = STATUS_TO_SOURCE[f.comision.status];
    if (f.comision.unitate === 'procent_chirie') {
      if (R !== null) comision = item(Math.round((R * f.comision.valoare) / 100), sursa, { nota: `${f.comision.valoare}% din chirie` });
    } else {
      const ron = money(f.comision.valoare, f.comision.moneda);
      if (ron !== null) comision = item(ron, sursa, { original: originalOf(f.comision.valoare, f.comision.moneda) });
    }
  } else if (R !== null) {
    folosesteEstimari = true;
    // Nepomenit în anunț: exact 50% din chirie (fără interval).
    comision = item(Math.round((R * DEFAULT_COMMISSION_PERCENT) / 100), COST_SOURCE.ESTIMARE);
  }

  const motiveIncomplet = [...motive];
  const complet = motiveIncomplet.length === 0 && R !== null && garantie !== null && comision !== null;

  const totaluri = complet
    ? {
        lunarVara: R + utilitatiVara.sumaRON + alteCosturi.sumaRON + transport.sumaRON,
        lunarIarna: R + utilitatiIarna.sumaRON + alteCosturi.sumaRON + transport.sumaRON,
        initialDefinitiv: comision.sumaRON + mutare.sumaRON,
        garantieRecuperabila: garantie.sumaRON,
        plataLaMutare: garantie.sumaRON + comision.sumaRON + mutare.sumaRON,
      }
    : { lunarVara: null, lunarIarna: null, initialDefinitiv: null, garantieRecuperabila: null, plataLaMutare: null };

  const avertizari = [];
  if (R !== null && passport.bugetMaximChirie > 0 && R > passport.bugetMaximChirie) {
    avertizari.push({
      cod: WARNING_CODES.CHIRIE_PESTE_BUGET,
      mesaj: `Chiria (${ron(R)}) e cu ${ron(R - passport.bugetMaximChirie)} peste bugetul tău pentru chirie (${ron(passport.bugetMaximChirie)}).`,
      luna: null,
    });
  }
  if (folosesteEstimari) {
    avertizari.push({
      cod: WARNING_CODES.ESTIMARI_FOLOSITE,
      mesaj: 'Unele costuri nu apar în anunț și sunt estimate. Întreabă-l pe proprietar ca să afli suma exactă.',
      luna: null,
    });
  }

  return {
    listingId: analiza.id,
    titlu: analiza.titlu,
    complet,
    motiveIncomplet,
    lunar: { chirie, utilitatiVara, utilitatiIarna, alteCosturi, transport },
    initial: { garantie, comision, mutare },
    totaluri,
    avertizari,
    folosesteEstimari,
  };
}
