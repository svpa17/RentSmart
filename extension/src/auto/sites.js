// RentSmart — site-urile pe care analiza automată poate rula și paginile care sunt anunțuri.
// Analiza automată citește pagini fără clic, deci are nevoie de permisiune pe site: o cerem DOAR pentru
// aceste site-uri (optional_host_permissions), când utilizatorul activează setarea. Pe celelalte site-uri
// analiza rămâne manuală („Analizează pagina curentă”).
// Pe un site acceptat, doar paginile de anunț sunt analizate (nu căutările, listele sau alte pagini).

export const AUTO_SITES = Object.freeze([
  // olx.ro: anunțurile sunt /d/oferta/… (toate categoriile; „pare anunț de închiriere” filtrează restul).
  { id: 'olx', nume: 'OLX', host: /(^|\.)olx\.ro$/i, permission: 'https://*.olx.ro/*', listing: (p) => /^\/(d\/)?oferta\//i.test(p) },
  // storia.ro: /ro/oferta/<slug>-ID…
  { id: 'storia', nume: 'Storia', host: /(^|\.)storia\.ro$/i, permission: 'https://*.storia.ro/*', listing: (p) => /^\/(ro\/)?oferta\//i.test(p) },
  // imobiliare.ro: /oferta/… (neverificat pe pagini reale: site-ul refuză cererile automate).
  { id: 'imobiliare', nume: 'Imobiliare.ro', host: /(^|\.)imobiliare\.ro$/i, permission: 'https://*.imobiliare.ro/*', listing: (p) => /^\/oferta\//i.test(p) },
  // publi24.ro: /anunturi/imobiliare/de-inchiriat/…/anunt/<slug>/<id>.html
  { id: 'publi24', nume: 'Publi24', host: /(^|\.)publi24\.ro$/i, permission: 'https://*.publi24.ro/*', listing: (p) => /^\/anunturi\/imobiliare\/de-inchiriat\/.*\/anunt\/.+\.html$/i.test(p) },
  // homezz.ro: /<slug>-<id numeric>.html
  { id: 'homezz', nume: 'HomeZZ', host: /(^|\.)homezz\.ro$/i, permission: 'https://*.homezz.ro/*', listing: (p) => /^\/[a-z0-9-]+-\d{6,}\.html$/i.test(p) },
]);

/** Permisiunile cerute (doar la activarea setării). */
export const AUTO_PERMISSIONS = Object.freeze(AUTO_SITES.map((s) => s.permission));

export function autoSiteFor(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return AUTO_SITES.find((s) => s.host.test(u.hostname)) ?? null;
  } catch {
    return null;
  }
}

/** URL-ul este o pagină de anunț pe un site acceptat? (căutările și listele nu sunt) */
export function isAutoListingUrl(url) {
  const site = autoSiteFor(url);
  if (!site) return false;
  return site.listing(new URL(url).pathname);
}
