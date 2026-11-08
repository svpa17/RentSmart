// RentSmart — pagina de bun venit la prima instalare (chrome.runtime.onInstalled).
// Se deschide doar la reason === 'install' și doar dacă nu există deja un profil (Financial Passport).
// La actualizare ('update'), la actualizarea Chrome sau la repornirea browserului: nu.

export const WELCOME_URL_PATH = 'dashboard.html#bun-venit';

/**
 * @param {{reason?: string}} details  argumentul primit de onInstalled
 * @param {() => Promise<object|null>} getPassport
 */
export async function shouldOpenWelcome(details, getPassport) {
  if (details?.reason !== 'install') return false;
  try {
    return !(await getPassport());
  } catch {
    return true;
  }
}
