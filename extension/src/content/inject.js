// RentSmart — injectarea scriptului de conținut: din panou (activeTab, după clic) sau din analiza automată
// (permisiune opțională pe site-urile de anunțuri). Nu ocolim CAPTCHA, autentificarea sau alte protecții:
// citim doar ce pagina afișează deja utilizatorului.

export const CONTENT_SCRIPT_FILE = 'content/readPage.js';

/** Paginile pe care Chrome nu permite injectarea → formularul de text lipit (etapa 3). */
export function isInjectable(url) {
  if (!url) return true; // fără URL vizibil (permisiunea activeTab încă neacordată): încercăm
  if (!/^https?:/i.test(url)) return false;
  if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)) return false;
  if (/\.pdf($|[?#])/i.test(url)) return false;
  return true;
}

/**
 * Citește un tab anume (scriptul de conținut + readWhenReady: așteaptă conținutul încărcat dinamic).
 * @param {{id: number, url?: string}} tab
 * @returns {Promise<{ok: true, data: object, tabId: number} | {ok: false, reason: 'INJECTARE_INTERZISA' | 'FARA_PERMISIUNE' | 'FARA_TEXT'}>}
 */
export async function readTab(tab) {
  if (!isInjectable(tab.url)) return { ok: false, reason: 'INJECTARE_INTERZISA' };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT_FILE] });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.__rascruceReadPage?.() ?? null,
    });
    if (!result?.result) return { ok: false, reason: 'INJECTARE_INTERZISA' };
    if (!result.result.text?.trim()) return { ok: false, reason: 'FARA_TEXT' };
    return { ok: true, data: result.result, tabId: tab.id };
  } catch {
    // Fără URL vizibil = fără acces la tab (activeTab neacordat): îi spunem utilizatorului cum îl acordă.
    return { ok: false, reason: tab.url ? 'INJECTARE_INTERZISA' : 'FARA_PERMISIUNE' };
  }
}

/**
 * Tab-ul activ, citit la cererea utilizatorului (panoul lateral).
 * @returns {Promise<{ok: true, data: object, tabId: number} | {ok: false, reason: 'INJECTARE_INTERZISA' | 'FARA_TAB' | 'FARA_PERMISIUNE' | 'FARA_TEXT'}>}
 *   FARA_PERMISIUNE: pagina e web, dar extensia nu are acces (iconița nu a fost apăsată pe acest tab,
 *   sau tab-ul a navigat de atunci). FARA_TEXT: pagina nu arată text (ex. autentificare, CAPTCHA, încărcare).
 */
export async function readActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, reason: 'FARA_TAB' };
  return readTab(tab);
}
