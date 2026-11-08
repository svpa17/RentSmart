// RĂSCRUCE AI — modelul Crossroads: datele salvate → SimulationResult + Path to Yes + drumul „Planul”.
// Toate cifrele vin din motor (simulate, computePathToYes, planSimulationInput). Nimic hardcodat, nimic salvat.
import { simulate } from '../shared/engine/simulate.js';
import { computePathToYes, planSimulationInput } from '../shared/engine/pathToYes.js';
import { calendarMonth } from '../shared/engine/seasons.js';
import { MAX_SIMULATION_MONTHS } from '../shared/contracts/constants.js';
import { formatNumber } from '../ui/format.js';
import { monthLabel } from './scales.js';

/** Culorile drumurilor: A, B, Planul (punctat). */
export const PATH_COLORS = Object.freeze(['#007AFF', '#5856D6']);
export const PLAN_COLOR = '#248A3D';

/** Prima lună t (0…59) care cade în luna calendaristică dată; null dacă nu e validă. */
export function calendarMonthToT(cal, lunaStart) {
  if (!Number.isInteger(cal) || cal < 1 || cal > 12) return null;
  for (let t = 0; t < 12; t += 1) if (calendarMonth(lunaStart, t) === cal) return t;
  return null;
}

/** Drumurile afișate: cele alese (maximum 2, complete), altfel primele două complete. */
export function selectPaths(items, drumuri = []) {
  const complete = items.filter((i) => i.tc?.complet);
  const chosen = drumuri.map((id) => complete.find((i) => i.saved.analiza.id === id)).filter(Boolean);
  const pick = chosen.length ? chosen : complete;
  return pick.slice(0, 2);
}

/** Textul unei opțiuni Path to Yes, pentru card. */
export function describeOption(o, { passport, lunaStart, titluri }) {
  switch (o.tip) {
    case 'amanare': {
      const k = o.lunaMutarii - passport.lunaMutarii;
      return {
        titlu: `Amână mutarea cu ${k} ${k === 1 ? 'lună' : 'luni'}`,
        detaliu: `Te muți în ${monthLabel(lunaStart, o.lunaMutarii, { luni: o.orizontVerificat })}. Am verificat ${o.luniVerificateDupaMutare} luni după mutare.`,
      };
    }
    case 'rezervaSuplimentara':
      return { titlu: `Strânge încă ${formatNumber(o.sumaRON)} RON înainte de mutare`, detaliu: 'Cu acești bani în plus, economiile nu mai scad sub suma păstrată pentru urgențe.' };
    case 'altApartament':
      return {
        titlu: `Alege ${titluri[o.listingId] ?? 'alt anunț salvat'}`,
        detaliu: 'Dintre anunțurile tale salvate, cu acesta economiile rămân peste suma pentru urgențe, în aceleași condiții.',
      };
    case 'reducereCheltuieli':
      return {
        titlu: `Redu cheltuielile lunare cu ${formatNumber(o.sumaLunaraRON)} RON`,
        detaliu: 'Cheltuielile obișnuite (fără locuință și transport). Doar dacă e realist pentru tine.',
      };
    default:
      return { titlu: o.tip, detaliu: '' };
  }
}

/**
 * @param {{ctx: object|null, items: Array<{saved: object, tc: object|null}>, simSettings: {luni: number, lunaStart: number, drumuri?: string[]},
 *   storms: object[], planChoice?: {listingId: string, index: number}|null}} input
 * @returns {{status: 'fara-passport'|'fara-anunturi'|'ok', incomplete: object[], sim: object|null, paths: object[],
 *   plan: object|null, xLuni: number}}
 */
export function buildCrossroads({ ctx, items, simSettings, storms, planChoice = null }) {
  const incomplete = items.filter((i) => i.tc && !i.tc.complet).map((i) => ({ listingId: i.saved.analiza.id, titlu: i.saved.analiza.titlu, motive: i.tc.motiveIncomplet }));
  if (!ctx) return { status: 'fara-passport', incomplete, sim: null, paths: [], plan: null, xLuni: simSettings.luni };
  const selected = selectPaths(items, simSettings.drumuri);
  if (selected.length === 0) return { status: 'fara-anunturi', incomplete, sim: null, paths: [], plan: null, xLuni: simSettings.luni };

  const { luni, lunaStart } = simSettings;
  const { passport } = ctx;
  const apartamente = selected.map((i) => i.tc);
  const allComplete = items.map((i) => i.tc).filter((t) => t?.complet);
  const titluri = Object.fromEntries(items.map((i) => [i.saved.analiza.id, i.saved.analiza.titlu]));
  const sim = simulate({ passport, apartamente, luni, lunaStart, furtuni: storms });

  const paths = sim.drumuri.map((d, idx) => {
    const ptyInput = { passport, apartament: apartamente[idx], apartamenteSalvate: allComplete, luni, lunaStart, furtuni: storms };
    const pathToYes = computePathToYes(ptyInput);
    return {
      listingId: d.listingId,
      titlu: d.titlu,
      color: PATH_COLORS[idx],
      eticheta: String.fromCharCode(65 + idx),
      drum: d,
      demonstrativ: selected[idx].saved.analiza.demonstrativ,
      garantie: apartamente[idx].initial.garantie.sumaRON,
      plataLaMutare: apartamente[idx].totaluri.plataLaMutare,
      pathToYes,
      optiuni: pathToYes.optiuni.map((o) => ({ ...o, text: describeOption(o, { passport, lunaStart, titluri }) })),
      ptyInput,
    };
  });

  // Drumul „Planul”: opțiunea aleasă (implicit prima) a primului drum nesigur.
  let plan = null;
  const target = paths.find((p) => p.listingId === planChoice?.listingId && p.optiuni.length) ?? paths.find((p) => p.optiuni.length);
  if (target) {
    const index = target.listingId === planChoice?.listingId ? Math.min(planChoice.index, target.optiuni.length - 1) : 0;
    const optiune = target.pathToYes.optiuni[index];
    const planSim = simulate(planSimulationInput(optiune, { ...target.ptyInput, apartamenteSalvate: allComplete.filter(Boolean) }));
    plan = {
      listingId: target.listingId,
      index,
      optiune,
      text: target.optiuni[index].text,
      drum: planSim.drumuri[0],
      lunaMutarii: planSim.lunaMutarii,
      luniVerificateDupaMutare: optiune.tip === 'amanare' ? optiune.luniVerificateDupaMutare : null,
    };
  }

  const xLuni = Math.min(MAX_SIMULATION_MONTHS, Math.max(luni, plan?.drum.luni.length ?? 0));
  return { status: 'ok', incomplete, sim, paths, plan, xLuni };
}

/** Numele unui drum în legendă: „A · titlu” (fără dublarea literei dacă titlul o conține deja). */
export function pathName(p) {
  const titlu = p.titlu ?? 'Fără titlu';
  return titlu.startsWith(`${p.eticheta} ·`) ? titlu : `${p.eticheta} · ${titlu}`;
}

/** Mesajul pentru luna în care banii nu mai ajung: „Din mai, cheltuielile depășesc banii pe care îi ai”. */
export function negativeLabel(lunaStart, t, luni = null) {
  return `Din ${monthLabel(lunaStart, t, { luni })}, cheltuielile depășesc banii pe care îi ai`;
}

/** Textul scurt de pe grafic: „Din mai: bani insuficienți”. */
export function negativeShortLabel(lunaStart, t, luni = null) {
  return `Din ${monthLabel(lunaStart, t, { luni })}: bani insuficienți`;
}

/**
 * Starea unei variante, pe înțeles, din indicatorii simulării:
 * bani insuficienți (soldul devine negativ) · sub suma pentru urgențe · în siguranță.
 */
export function pathStatus(ind) {
  if (ind.primaLunaNegativa !== null) return { tone: 'ask', text: 'bani insuficienți' };
  if (!ind.sigur) return { tone: 'unclear', text: 'sub suma pentru urgențe' };
  return { tone: 'ok', text: 'în siguranță' };
}

/**
 * Numele unei linii din grafic, pe înțeles: „Dacă alegi acest apartament” (un singur anunț afișat),
 * altfel „Dacă alegi A · titlu”, ca liniile să se poată deosebi.
 */
export function chartLineName(p, count) {
  return count <= 1 ? 'Dacă alegi acest apartament' : `Dacă alegi ${pathName(p)}`;
}

/**
 * Cele două date de mutare din grafic, doar din calculele existente (nimic inventat):
 * - planificată: luna mutării din profil (simularea);
 * - recomandată: luna mutării din varianta aleasă la „Cum poți face chiria accesibilă” (model.plan).
 *   status: 'diferita' (ex. amânarea) · 'aceeasi' (varianta aleasă nu mută data) ·
 *   'nu-e-nevoie' (toate variantele sunt în siguranță cu data planificată) ·
 *   'negasita' (există o problemă, dar calculele nu au găsit nicio variantă).
 */
export function moveDates(model) {
  const planificata = { t: model.sim.lunaMutarii, inPerioada: model.sim.lunaMutarii < model.sim.luni };
  const target = model.plan ? model.paths.find((p) => p.listingId === model.plan.listingId) : null;
  if (model.plan) {
    const t = model.plan.lunaMutarii;
    return {
      planificata,
      recomandata: {
        status: t === planificata.t ? 'aceeasi' : 'diferita',
        t,
        inPerioada: t < model.xLuni,
        pentru: model.paths.length > 1 && target ? target.eticheta : null,
        actiune: model.plan.text.titlu,
      },
    };
  }
  const allSafe = model.paths.every((p) => p.drum.indicatori.sigur);
  return { planificata, recomandata: { status: allSafe ? 'nu-e-nevoie' : 'negasita', t: null, inPerioada: false, pentru: null, actiune: null } };
}
