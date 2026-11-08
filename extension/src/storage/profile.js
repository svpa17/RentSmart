// RentSmart — profilul financiar (Financial Passport) la prima configurare și „Încearcă un exemplu”.
// Sursa de adevăr rămâne una singură: cheia `passport` din chrome.storage.local (DATA_KEYS.PASSPORT),
// folosită de True Cost, Crossroads, Furtuni, Path to Yes și comparație.
//
// „Încearcă un exemplu” NU suprascrie datele reale: le copiază deoparte (EXAMPLE_BACKUP_KEY), încarcă
// scenariul demonstrativ existent și, la ieșire, pune înapoi exact ce era (inclusiv cheile care lipseau).
import { DATA_KEYS, loadDemoScenario, savePassport } from './appData.js';
import { STORAGE_KEYS, getValue, updateSettings } from './index.js';

export const EXAMPLE_BACKUP_KEY = 'copieDateReale';
/** Tot ce atinge scenariul demonstrativ: se salvează înainte și se restaurează la ieșire. */
const EXAMPLE_KEYS = [
  DATA_KEYS.PASSPORT,
  DATA_KEYS.EXCHANGE_RATE,
  DATA_KEYS.SAVED_LISTINGS,
  DATA_KEYS.SIM_SETTINGS,
  DATA_KEYS.STORMS,
  STORAGE_KEYS.CURRENT_ANALYSIS,
  STORAGE_KEYS.SETTINGS,
];

/** Utilizatorul are un profil? Datele existente au prioritate: un profil vechi (fără indicator) contează. */
export const hasProfile = (passport) => Boolean(passport);

export async function isExampleActive() {
  return Boolean(await getValue(EXAMPLE_BACKUP_KEY));
}

/** Intră în exemplu: copiază datele reale deoparte (o singură dată), apoi încarcă scenariul demonstrativ. */
export async function enterExample(now = new Date()) {
  if (!(await isExampleActive())) {
    const snapshot = await chrome.storage.local.get(EXAMPLE_KEYS);
    await chrome.storage.local.set({ [EXAMPLE_BACKUP_KEY]: { date: snapshot, creatLa: now.toISOString() } });
  }
  await loadDemoScenario();
}

/** Iese din exemplu: pune înapoi exact datele reale de dinainte. Întoarce false dacă nu era în exemplu. */
export async function exitExample() {
  const backup = await getValue(EXAMPLE_BACKUP_KEY);
  if (!backup) return false;
  const saved = backup.date ?? {};
  const absent = EXAMPLE_KEYS.filter((k) => !(k in saved));
  if (absent.length) await chrome.storage.local.remove(absent);
  if (Object.keys(saved).length) await chrome.storage.local.set(saved);
  await chrome.storage.local.remove(EXAMPLE_BACKUP_KEY);
  return true;
}

/**
 * Salvează profilul din formularul de configurare, în Passport-ul existent (validat de contract).
 * Dacă utilizatorul era în exemplu, întâi îi restaurăm datele reale, ca profilul nou să nu se piardă.
 * Configurarea se marchează ca finalizată doar după ce salvarea reușește.
 */
export async function saveProfile(passport) {
  await exitExample();
  await savePassport(passport); // aruncă ContractError dacă datele nu sunt valide: nimic nu se scrie
  await updateSettings({ profilConfigurat: true, modDemo: false });
}
