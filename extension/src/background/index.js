// RentSmart — service worker: deschide panoul lateral la click, rutează mesajele și rulează analiza
// automată a anunțurilor la navigare (auto/analyzer.js), și cu panoul închis.
import { buildQuestions, runDetective } from '../ai/detective.js';
import { AUTO_ANALYZE_MESSAGE, createAutoAnalyzer } from '../auto/analyzer.js';
import { AUTO_PERMISSIONS } from '../auto/sites.js';
import { CONTENT_SCRIPT_FILE, readTab } from '../content/inject.js';
import { PAGE_CHANGED_MESSAGE } from '../content/listing.js';
import { findAnalysis, findAnalysisByUrl, rememberAnalysis } from '../storage/analysisCache.js';
import { STORAGE_KEYS, ensureInstallId, getSettings, getValue } from '../storage/index.js';
import { DATA_KEYS } from '../storage/appData.js';
import { WELCOME_URL_PATH, shouldOpenWelcome } from './onboarding.js';

export const MESSAGES = Object.freeze({ OPEN_DASHBOARD: 'OPEN_DASHBOARD' });
/** Secțiunile dashboard-ului care se pot deschide direct (fragmentul URL, fără date). */
const DASHBOARD_SECTIONS = new Set(['alternative']);
const AUTO_SCRIPT_ID = 'rentsmart-auto';

// Service worker-ul se oprește după ~30 s fără evenimente; o analiză AI poate dura mai mult.
// Cât timp rulează o analiză, un apel ușor la API-ul extensiei îl ține activ.
let keepAlive = null;
function setBusy(busy) {
  if (busy && !keepAlive) keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  if (!busy && keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
}

const auto = createAutoAnalyzer({
  getSettings,
  getTab: (tabId) => chrome.tabs.get(tabId).catch(() => null),
  readTab: async (tabId) => {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    return tab ? readTab(tab) : { ok: false, reason: 'FARA_TAB' };
  },
  // Aceeași linie ca analiza manuală: Detective (AI prin backend, validare + dovezi), apoi întrebările.
  // Mesajul pentru proprietar: șablonul (fără o a doua cerere AI); „Formulează cu AI” rămâne în panou.
  analyze: async (input, settings) => {
    const installId = await ensureInstallId();
    const det = await runDetective({ ...input, setari: settings, aiIndisponibil: null }, { installId });
    const q = await buildQuestions(det.analiza, { useAI: false, installId });
    return { ...det, metoda: input.metoda ?? null, ...q };
  },
  cache: { findAnalysis, findAnalysisByUrl, rememberAnalysis },
  session: {
    get: async (key) => (await chrome.storage.session.get(key))[key],
    set: (key, value) => chrome.storage.session.set({ [key]: value }),
  },
  onBusy: setBusy,
});

/** Scriptul de conținut pe site-urile permise (doar cu setarea activă): urmărește navigarea fără reîncărcare. */
async function syncAutoContentScript() {
  try {
    const settings = await getSettings();
    const granted = [];
    for (const origin of AUTO_PERMISSIONS) if (await chrome.permissions.contains({ origins: [origin] })) granted.push(origin);
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [AUTO_SCRIPT_ID] });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [AUTO_SCRIPT_ID] });
    if (settings.analizaAutomata && !settings.modDemo && granted.length) {
      await chrome.scripting.registerContentScripts([
        { id: AUTO_SCRIPT_ID, matches: granted, js: [CONTENT_SCRIPT_FILE], runAt: 'document_idle', persistAcrossSessions: true },
      ]);
    }
  } catch {
    // ex. o înregistrare simultană: următorul eveniment o reface
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureInstallId();
  // Prima instalare (fără profil salvat): pagina de bun venit, într-un tab nou.
  shouldOpenWelcome(details, () => getValue(DATA_KEYS.PASSPORT)).then((open) => {
    if (open) chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_URL_PATH) });
  });
  // Deschidem panoul manual, din onClicked, ca să primim și permisiunea activeTab pe tab-ul curent.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  syncAutoContentScript();
});
chrome.runtime.onStartup.addListener(syncAutoContentScript);
chrome.permissions.onAdded.addListener(syncAutoContentScript);
chrome.permissions.onRemoved.addListener(syncAutoContentScript);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEYS.SETTINGS in changes) syncAutoContentScript();
});

chrome.action.onClicked.addListener((tab) => {
  // Apelul trebuie să rămână sincron în gestul utilizatorului (fără await înainte).
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Navigarea: încărcare, reîncărcare, înapoi/înainte și History API (URL-ul se schimbă fără reîncărcare).
// tabs.onUpdated arată URL-ul doar pentru site-urile la care avem permisiune.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') auto.notify(tabId);
});
chrome.tabs.onActivated.addListener(({ tabId }) => auto.notify(tabId));
chrome.tabs.onRemoved.addListener((tabId) => auto.forget(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MESSAGES.OPEN_DASHBOARD) {
    const hash = DASHBOARD_SECTIONS.has(message.section) ? `#${message.section}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${hash}`) }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true; // răspuns asincron
  }
  // Scriptul de conținut: URL-ul anunțului s-a schimbat fără reîncărcare (SPA).
  if (message?.type === PAGE_CHANGED_MESSAGE && sender.tab?.id !== undefined) {
    auto.notify(sender.tab.id);
    return false;
  }
  // Panoul: „Încearcă din nou” / „Analizează pagina curentă” în modul automat.
  if (message?.type === AUTO_ANALYZE_MESSAGE && Number.isInteger(message.tabId)) {
    auto.analyzeNow(message.tabId).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  return false;
});
