// RĂSCRUCE AI — datele utilizatorului în chrome.storage.local: Passport, curs EUR, anunțuri salvate.
// Totul se validează cu contractele înainte de scriere. Valorile derivate (True Cost, Crossroads,
// Path to Yes) NU se salvează niciodată: se recalculează din aceste date (planul, §6).
import {
  assertValid,
  validateExchangeRate,
  validateFinancialPassport,
  validateListingAnalysis,
  validateHorizon,
  validateSavedListing,
  validateStorm,
  validateUserApartmentCosts,
} from '../shared/contracts/schemas.js';
import { demoExchangeRate, demoPassport, demoSavedA, demoSavedB, demoSimulationSettings } from '../shared/contracts/fixtures/demoScenario.js';
import { STORAGE_KEYS, getSettings, getValue, setValue, updateSettings } from './index.js';
import { BNR_RATE_URL, needsRefresh, parseBnrResponse } from '../rates/bnrRate.js';

export const DATA_KEYS = Object.freeze({
  PASSPORT: 'passport',
  EXCHANGE_RATE: 'cursEur',
  /** { incercatLa: ISO, ok: boolean }: ultima încercare de descărcare a cursului BNR */
  RATE_STATUS: 'cursStare',
  SAVED_LISTINGS: 'anunturiSalvate',
  /** { luni: 1…60, lunaStart: 1…12, drumuri: string[] (maximum 2 id-uri) } */
  SIM_SETTINGS: 'setariSimulare',
  /** Storm[] — furtunile active, aplicate identic pe toate drumurile */
  STORMS: 'furtuni',
});

/** Setările implicite ale simulării: 12 luni, de luna aceasta. */
export function defaultSimSettings(now = new Date()) {
  return { luni: 12, lunaStart: now.getMonth() + 1, drumuri: [] };
}

export function validateSimSettings(s) {
  const errors = [];
  for (const e of validateHorizon(s?.luni).errors) errors.push(e.mesaj);
  if (!Number.isInteger(s?.lunaStart) || s.lunaStart < 1 || s.lunaStart > 12) errors.push('lunaStart trebuie să fie între 1 și 12');
  if (!Array.isArray(s?.drumuri) || s.drumuri.length > 2 || s.drumuri.some((d) => typeof d !== 'string')) errors.push('drumuri: maximum 2 id-uri');
  return { ok: errors.length === 0, errors };
}

/** Actualizează setările simulării (perioada, luna de start, drumurile alese). */
export async function saveSimSettings(patch) {
  const current = (await getValue(DATA_KEYS.SIM_SETTINGS)) ?? defaultSimSettings();
  const next = { ...current, ...patch };
  const v = validateSimSettings(next);
  if (!v.ok) throw new RangeError(v.errors.join('; '));
  await setValue(DATA_KEYS.SIM_SETTINGS, next);
  return next;
}

export async function addStorm(storm) {
  assertValid(validateStorm, storm, 'Storm');
  const list = (await getValue(DATA_KEYS.STORMS)) ?? [];
  await setValue(DATA_KEYS.STORMS, [...list.filter((s) => s.id !== storm.id), storm]);
}

export async function removeStorm(id) {
  const list = (await getValue(DATA_KEYS.STORMS)) ?? [];
  await setValue(DATA_KEYS.STORMS, list.filter((s) => s.id !== id));
}

export async function clearStorms() {
  await setValue(DATA_KEYS.STORMS, []);
}

export const MAX_SAVED_LISTINGS = 10;
export const EMPTY_USER_COSTS = Object.freeze({ transportLunarRON: null, alteCosturiLunareRON: null, costuriMutareRON: null });

const nowIso = (now) => (now ?? new Date()).toISOString();

export async function savePassport(passport) {
  await setValue(DATA_KEYS.PASSPORT, assertValid(validateFinancialPassport, passport, 'FinancialPassport'));
}

/** Cursul introdus explicit de utilizator; are prioritate față de cursul BNR automat. */
export async function saveExchangeRate(eurToRon, now) {
  const rate = assertValid(validateExchangeRate, { eurToRon, sursa: 'utilizator', actualizatLa: nowIso(now) }, 'ExchangeRate');
  await setValue(DATA_KEYS.EXCHANGE_RATE, rate);
  return rate;
}

export async function clearExchangeRate() {
  await setValue(DATA_KEYS.EXCHANGE_RATE, null);
}

let refreshing = null;

/**
 * Descarcă cursul BNR dacă cel salvat e depășit (sau lipsește). La eșec păstrează ultimul curs
 * valid și notează încercarea, ca interfața să-l marcheze „posibil depășit”. Nu face nimic în
 * modul demonstrativ (nicio cerere de rețea) și nu înlocuiește cursul introdus de utilizator.
 * @returns {Promise<'actualizat'|'neschimbat'|'eroare'|'omis'>}
 */
export function refreshBnrRate({ fetchImpl = fetch, now, force = false } = {}) {
  refreshing ??= (async () => {
    const at = now ?? new Date();
    if ((await getSettings()).modDemo) return 'omis';
    const rate = (await getValue(DATA_KEYS.EXCHANGE_RATE)) ?? null;
    const status = (await getValue(DATA_KEYS.RATE_STATUS)) ?? null;
    if (rate && rate.sursa !== 'bnr') return 'omis';
    if (!force && !needsRefresh({ rate, status, now: at })) return 'omis';
    try {
      const res = await fetchImpl(BNR_RATE_URL, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { eurToRon, dataPublicarii } = parseBnrResponse(await res.json());
      const next = assertValid(validateExchangeRate, { eurToRon, sursa: 'bnr', dataPublicarii, actualizatLa: nowIso(at) }, 'ExchangeRate');
      const changed = rate?.eurToRon !== eurToRon || rate?.dataPublicarii !== dataPublicarii;
      await setValue(DATA_KEYS.EXCHANGE_RATE, next);
      await setValue(DATA_KEYS.RATE_STATUS, { incercatLa: nowIso(at), ok: true });
      return changed ? 'actualizat' : 'neschimbat';
    } catch {
      await setValue(DATA_KEYS.RATE_STATUS, { incercatLa: nowIso(at), ok: false });
      return 'eroare';
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Renunță la cursul introdus manual (sau demo) și trece la cursul BNR automat. */
export async function switchToBnrRate({ fetchImpl, now } = {}) {
  const rate = await getValue(DATA_KEYS.EXCHANGE_RATE);
  if (rate && rate.sursa !== 'bnr') await clearExchangeRate();
  return refreshBnrRate({ fetchImpl, now, force: true });
}

export async function getSavedListings() {
  return (await getValue(DATA_KEYS.SAVED_LISTINGS)) ?? [];
}

/**
 * Salvează (sau actualizează, după id) o analiză. Costurile introduse de utilizator se păstrează la actualizare.
 * @returns {Promise<{ok: true} | {ok: false, motiv: 'LIMITA'}>}
 */
export async function saveListing(analiza, now) {
  assertValid(validateListingAnalysis, analiza, 'ListingAnalysis');
  const list = await getSavedListings();
  const i = list.findIndex((s) => s.analiza.id === analiza.id);
  if (i >= 0) {
    list[i] = { ...list[i], analiza };
  } else {
    if (list.length >= MAX_SAVED_LISTINGS) return { ok: false, motiv: 'LIMITA' };
    list.push({ analiza, costuriUtilizator: { ...EMPTY_USER_COSTS }, salvatLa: nowIso(now) });
  }
  await setValue(DATA_KEYS.SAVED_LISTINGS, list.map((s) => assertValid(validateSavedListing, s, 'SavedListing')));
  return { ok: true };
}

/** Actualizează analiza unui anunț deja salvat (confirmări); nu face nimic dacă nu e salvat. */
export async function updateSavedAnalysis(analiza) {
  const list = await getSavedListings();
  const i = list.findIndex((s) => s.analiza.id === analiza.id);
  if (i < 0) return false;
  list[i] = assertValid(validateSavedListing, { ...list[i], analiza }, 'SavedListing');
  await setValue(DATA_KEYS.SAVED_LISTINGS, list);
  return true;
}

export async function updateUserCosts(listingId, costuriUtilizator) {
  assertValid(validateUserApartmentCosts, costuriUtilizator, 'UserApartmentCosts');
  const list = await getSavedListings();
  const i = list.findIndex((s) => s.analiza.id === listingId);
  if (i < 0) return false;
  list[i] = { ...list[i], costuriUtilizator };
  await setValue(DATA_KEYS.SAVED_LISTINGS, list);
  return true;
}

export async function removeSavedListing(listingId) {
  const list = await getSavedListings();
  await setValue(DATA_KEYS.SAVED_LISTINGS, list.filter((s) => s.analiza.id !== listingId));
}

/**
 * Încarcă scenariul demonstrativ FICTIV (planul, §10): Passport, curs demo și anunțurile A și B.
 * Activează și modul demonstrativ, ca fiecare rezultat să poarte eticheta „DATE DEMONSTRATIVE”.
 */
export async function loadDemoScenario() {
  await setValue(DATA_KEYS.PASSPORT, structuredClone(demoPassport));
  await setValue(DATA_KEYS.EXCHANGE_RATE, structuredClone(demoExchangeRate));
  await setValue(DATA_KEYS.SAVED_LISTINGS, [structuredClone(demoSavedA), structuredClone(demoSavedB)]);
  // Simularea demo: 12 luni din ianuarie, A și B, fără furtuni (furtuna se adaugă în prezentare).
  await setValue(DATA_KEYS.SIM_SETTINGS, { ...demoSimulationSettings, drumuri: ['demo-a', 'demo-b'] });
  await setValue(DATA_KEYS.STORMS, []);
  await setValue(STORAGE_KEYS.CURRENT_ANALYSIS, null);
  await updateSettings({ modDemo: true });
}
