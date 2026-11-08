// RĂSCRUCE AI — accesul la chrome.storage.local (Passport, anunțuri, setări, curs, ID instalare).
// Panoul lateral și dashboard-ul se sincronizează prin chrome.storage.onChanged.

export const STORAGE_KEYS = Object.freeze({
  INSTALL_ID: 'installId',
  /** { modDemo: boolean, acordAI: boolean } */
  SETTINGS: 'setari',
  /** Ultima analiză din panou: { analiza, mod, eroare, retrogradate, scurt, metoda, intrebari, mesaj, sursaMesaj } */
  CURRENT_ANALYSIS: 'analizaCurenta',
  /** Ultimele analize reușite (max. 8), după cheia {mod, URL, text}: aceeași pagină nu se reanalizează. */
  RECENT_ANALYSES: 'analizeRecente',
  /** Cererea „Caută alternative” din panou: { id, analiza, creatLa } (fără date financiare). */
  ALT_REQUEST: 'cerereAlternative',
  /** Ultimul răspuns al căutării: { cerereId, filtre, data, at } (anunțuri publice, fără date financiare). */
  ALT_RESULTS: 'rezultateAlternative',
});

/** analizaAutomata: analiza anunțurilor la navigare, pe site-urile permise (implicit oprită). */
export const DEFAULT_SETTINGS = Object.freeze({ modDemo: false, acordAI: false, analizaAutomata: false });

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await getValue(STORAGE_KEYS.SETTINGS)) ?? {}) };
}

export async function updateSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await setValue(STORAGE_KEYS.SETTINGS, next);
  return next;
}

export async function getValue(key) {
  const r = await chrome.storage.local.get(key);
  return r[key];
}

export async function setValue(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

/** ID anonim, generat la instalare; folosit doar pentru rate limiting pe backend. */
export async function ensureInstallId() {
  let id = await getValue(STORAGE_KEYS.INSTALL_ID);
  if (typeof id !== 'string' || id.length < 32) {
    id = crypto.randomUUID();
    await setValue(STORAGE_KEYS.INSTALL_ID, id);
  }
  return id;
}

/** Abonare la modificări (din orice pagină a extensiei). Returnează funcția de dezabonare. */
export function onStorageChange(keys, callback) {
  const listener = (changes, area) => {
    if (area !== 'local') return;
    const relevant = keys.filter((k) => k in changes);
    if (relevant.length) callback(Object.fromEntries(relevant.map((k) => [k, changes[k].newValue])));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** „Șterge toate datele”: golește chrome.storage.local. */
export async function clearAllData() {
  await chrome.storage.local.clear();
}
