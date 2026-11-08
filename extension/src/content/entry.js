// Punctul de intrare al scriptului de conținut. Rulează în lumea izolată a extensiei,
// care persistă între injectări: expunem funcția, apoi panoul o apelează cu executeScript({func}).
import { readPage } from './readPage.js';
import { PAGE_CHANGED_MESSAGE, listingUrlKey } from './listing.js';

/**
 * Pagini încărcate dinamic (SPA): dacă prima citire nu arată încă un anunț complet, așteptăm ca DOM-ul
 * să se liniștească (fără modificări timp de `quietMs`, maximum `maxMs`), apoi citim din nou.
 */
export function waitForQuiet(doc, { quietMs = 700, maxMs = 4000 } = {}) {
  return new Promise((resolve) => {
    let timer;
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(cap);
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, quietMs);
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
    timer = setTimeout(done, quietMs);
    const cap = setTimeout(done, maxMs);
  });
}

export async function readWhenReady(doc, opts) {
  const first = readPage(doc);
  if (first.pareAnunt && first.pret) return first; // anunțul e deja în pagină
  await waitForQuiet(doc, opts);
  const second = readPage(doc);
  return second.text.length >= first.text.length ? second : first;
}

/**
 * Navigarea fără reîncărcare (pushState, butonul Înapoi): anunțăm panoul când URL-ul anunțului se
 * schimbă. Panoul NU analizează automat (fără cereri AI nedorite); doar oferă butonul de reanalizare.
 */
function watchNavigation() {
  if (globalThis.__rascruceWatching) return;
  globalThis.__rascruceWatching = true;
  let last = listingUrlKey(location.href);
  const check = () => {
    const now = listingUrlKey(location.href);
    if (now === last) return;
    last = now;
    try {
      chrome.runtime.sendMessage({ type: PAGE_CHANGED_MESSAGE, url: location.href })?.catch?.(() => {});
    } catch {
      // extensia a fost reîncărcată: scriptul vechi nu mai are canal
    }
  };
  addEventListener('popstate', check);
  setInterval(check, 1000);
}

globalThis.__rascruceReadPage = async () => {
  watchNavigation();
  return readWhenReady(document);
};

// Înregistrat automat (analiza automată, pe site-urile permise): urmărim navigarea de la încărcare.
// Scriptul nu trimite conținutul paginii nicăieri; anunță doar că URL-ul s-a schimbat.
if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime?.id) watchNavigation();
