// RentSmart — analiza automată a anunțurilor la navigare. Rulează în service worker (fără panou deschis).
// Folosește ACEEAȘI linie ca analiza manuală: citirea paginii (content/readPage) → Detective (AI prin
// backend, validare + dovezi) → întrebări din șablon. Costurile și verdictul le calculează panoul din
// Passport, ca înainte; aici nu se calculează nimic financiar.
//
// Protecții pentru cererile AI (Gemini are limite):
//   - debounce per tab (evenimentele de navigare vin în rafale);
//   - un tab care e deja la același anunț nu se reanalizează (reîncărcare, comutare de taburi);
//   - cache pe URL-ul anunțului (24 h) și pe text, comun tuturor taburilor;
//   - o singură cerere în curs per anunț (două taburi cu același anunț → o cerere);
//   - cel mult o analiză AI odată (coadă), cu timeout-ul clientului existent;
//   - după „prea multe cereri”: pauză, fără reîncercări automate; doar „Încearcă din nou” forțează.
// Rezultatele întârziate nu înlocuiesc anunțul curent: fiecare tab are o generație; un rezultat pentru o
// generație veche intră doar în cache.
//
// Starea per tab (chrome.storage.session, citită de panou):
//   { url, urlKey, stare: 'analiza'|'gata'|'eroare'|'amanat'|'nu-e-anunt'|'ignorat', cheie?, rezultat?, cod?, pana?, titlu?, imagine?, gen, actualizatLa }

import { analysisKey, listingUrlKey } from '../content/listing.js';
import { AI_ERROR_CODES } from '../shared/contracts/constants.js';
import { autoSiteFor, isAutoListingUrl } from './sites.js';

export const TAB_STATE_KEY = 'stareTaburi';
/** Mesajul panoului către service worker: analizează acum tab-ul dat (fără cache). */
export const AUTO_ANALYZE_MESSAGE = 'RENTSMART_AUTO_ANALYZE';
export const AI_PAUSE_KEY = 'pauzaAI';
export const DEBOUNCE_MS = 1200;
export const RATE_LIMIT_PAUSE_MS = 90 * 1000;
const STALE_ANALYSIS_MS = 2 * 60 * 1000;
const SETTLED = new Set(['analiza', 'gata', 'nu-e-anunt', 'eroare', 'amanat']);

/**
 * @param {{
 *   getSettings: () => Promise<object>,
 *   getTab: (tabId: number) => Promise<{id: number, url?: string}|null>,
 *   readTab: (tabId: number) => Promise<{ok: true, data: object} | {ok: false, reason: string}>,
 *   analyze: (input: object, settings: object) => Promise<object>,   Detective + întrebări (fără AI pentru mesaj)
 *   cache: {findAnalysis: Function, findAnalysisByUrl: Function, rememberAnalysis: Function},
 *   session: {get: (key: string) => Promise<any>, set: (key: string, value: any) => Promise<void>},
 *   now?: () => number, debounceMs?: number, setTimer?: Function, clearTimer?: Function, onBusy?: (busy: boolean) => void
 * }} deps
 */
export function createAutoAnalyzer(deps) {
  const now = deps.now ?? (() => Date.now());
  const debounceMs = deps.debounceMs ?? DEBOUNCE_MS;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t));
  const timers = new Map();
  const inflight = new Map(); // urlKey → Promise<rezultat>
  let gen = 0;
  let queue = Promise.resolve();
  let busy = 0;
  let tabs = null; // încărcat leneș din storage.session (supraviețuiește repornirii service worker-ului)

  async function loadTabs() {
    tabs ??= (await deps.session.get(TAB_STATE_KEY)) ?? {};
    return tabs;
  }
  async function setTab(tabId, value) {
    const t = await loadTabs();
    if (value === null) delete t[tabId];
    else t[tabId] = { ...value, actualizatLa: new Date(now()).toISOString() };
    await deps.session.set(TAB_STATE_KEY, { ...t });
  }
  const isCurrent = (tabId, g) => tabs?.[tabId]?.gen === g;

  /** Cel mult o analiză AI odată. */
  function enqueue(job) {
    const run = queue.then(async () => {
      busy += 1;
      deps.onBusy?.(true);
      try {
        return await job();
      } finally {
        busy -= 1;
        if (busy === 0) deps.onBusy?.(false);
      }
    });
    queue = run.catch(() => {});
    return run;
  }

  async function process(tabId, { force = false } = {}) {
    const settings = await deps.getSettings();
    if (!settings.analizaAutomata || settings.modDemo) return;
    const tab = await deps.getTab(tabId);
    const url = tab?.url ?? null;
    if (!url || !autoSiteFor(url)) {
      // Nu e un site acceptat (sau nu avem permisiune să-i vedem URL-ul): nu reținem nimic despre el.
      if ((await loadTabs())[tabId]) await setTab(tabId, null);
      return;
    }
    const urlKey = listingUrlKey(url);
    const cur = (await loadTabs())[tabId];
    if (!isAutoListingUrl(url)) {
      if (cur?.urlKey !== urlKey || cur?.stare !== 'ignorat') await setTab(tabId, { url, urlKey, stare: 'ignorat', gen: ++gen });
      return;
    }
    // Același anunț în același tab (reîncărcare, comutare de taburi, evenimente duble): nimic nou.
    // Excepție: o „analiză în curs” rămasă de la un service worker oprit între timp (mai veche de 2 min).
    const abandoned = cur?.stare === 'analiza' && now() - Date.parse(cur.actualizatLa ?? 0) > STALE_ANALYSIS_MS && !inflight.has(urlKey);
    if (!force && cur?.urlKey === urlKey && SETTLED.has(cur.stare) && !abandoned) return;

    if (!force) {
      const cached = await deps.cache.findAnalysisByUrl(urlKey, { now: now() });
      if (cached) {
        await setTab(tabId, { url, urlKey, stare: 'gata', cheie: cached.cheie, titlu: cached.analiza.titlu, imagine: cached.analiza.sursa.imagine ?? null, gen: ++gen });
        return;
      }
    }

    const g = ++gen;
    await setTab(tabId, { url, urlKey, stare: 'analiza', gen: g, titlu: cur?.urlKey === urlKey ? (cur.titlu ?? null) : null, imagine: null });
    const read = await deps.readTab(tabId);
    if (!isCurrent(tabId, g)) return;
    if (!read.ok) {
      await setTab(tabId, { url, urlKey, stare: 'eroare', cod: read.reason, gen: g });
      return;
    }
    const data = read.data;
    // Pagina a navigat între timp: evenimentul pentru noul URL o va relua.
    if (listingUrlKey(data.url) !== urlKey) return;
    const base = { url, urlKey, gen: g, titlu: data.titlu ?? null, imagine: data.imagine ?? null };
    if (data.pareAnunt === false) {
      await setTab(tabId, { ...base, stare: 'nu-e-anunt' });
      return;
    }
    const cheie = analysisKey({ url: data.url, text: data.text, mod: 'ai' });
    if (!force) {
      const exact = await deps.cache.findAnalysis(cheie);
      if (exact) {
        await setTab(tabId, { ...base, stare: 'gata', cheie });
        return;
      }
    }
    // Pauză după limitarea cererilor: fără reîncercare automată (doar „Încearcă din nou”, adică force).
    const pana = (await deps.session.get(AI_PAUSE_KEY)) ?? 0;
    if (!force && pana > now()) {
      await setTab(tabId, { ...base, stare: 'amanat', cod: AI_ERROR_CODES.RATE_LIMITED, pana });
      return;
    }
    await setTab(tabId, { ...base, stare: 'analiza' });

    let job = inflight.get(urlKey);
    if (!job) {
      job = enqueue(async () => {
        const input = { text: data.text, tip: 'pagina', url: data.url, titlu: data.titlu, imagine: data.imagine ?? null, metoda: data.metoda };
        const r = await deps.analyze(input, settings);
        const result = { ...r, cheie: r.mod === 'manual' ? null : cheie, refolosit: false };
        if (r.eroare === AI_ERROR_CODES.RATE_LIMITED) await deps.session.set(AI_PAUSE_KEY, now() + RATE_LIMIT_PAUSE_MS);
        await deps.cache.rememberAnalysis(result); // doar rezultatele cu cheie (AI reușită)
        return result;
      }).finally(() => inflight.delete(urlKey));
      inflight.set(urlKey, job);
    }
    let result;
    try {
      result = await job;
    } catch {
      if (isCurrent(tabId, g)) await setTab(tabId, { ...base, stare: 'eroare', cod: AI_ERROR_CODES.AI_UNAVAILABLE });
      return;
    }
    if (!isCurrent(tabId, g)) return; // utilizatorul a plecat de pe anunț: rezultatul rămâne doar în cache
    // Fără AI (eroare, limită, fără acord): rezultatul manual se păstrează doar pentru acest tab.
    await setTab(tabId, result.cheie ? { ...base, stare: 'gata', cheie: result.cheie } : { ...base, stare: 'gata', rezultat: result, cod: result.eroare ?? null });
  }

  return {
    /** Un eveniment de navigare (tabs.onUpdated, onActivated, mesajul scriptului de conținut): cu debounce. */
    notify(tabId) {
      clearTimer(timers.get(tabId));
      timers.set(
        tabId,
        setTimer(() => {
          timers.delete(tabId);
          return process(tabId).catch(() => {});
        }, debounceMs),
      );
    },
    /** „Încearcă din nou” / „Analizează pagina curentă” în modul automat: imediat, fără cache. */
    analyzeNow(tabId, { force = true } = {}) {
      clearTimer(timers.get(tabId));
      timers.delete(tabId);
      return process(tabId, { force });
    },
    async forget(tabId) {
      clearTimer(timers.get(tabId));
      timers.delete(tabId);
      if ((await loadTabs())[tabId]) await setTab(tabId, null);
    },
    /** Pentru teste. */
    _process: process,
  };
}
