// RentSmart — ce pagini vede utilizatorul în dashboard, în funcție de starea configurării.
// „Bugetul tău”, pagina de bun venit și formularul de configurare sunt doar pentru prima utilizare.
// După ce profilul financiar e completat, ele dispar definitiv; datele se văd și se modifică
// în „Profilul meu financiar”.
import { hasProfile } from '../storage/profile.js';

/** Paginile primei utilizări (nu mai apar după configurare). */
export const ONBOARDING_SECTIONS = ['buget', 'bun-venit', 'configurare'];
/** Unde ajunge utilizatorul după configurare (și la orice vizită ulterioară, implicit). */
export const PROFILE_SECTION = 'passport';
export const FIRST_USE_SECTION = 'buget';

/**
 * Configurarea e finalizată? Persistă prin date, deci rezistă la reîncărcare și redeschidere:
 * - indicatorul `setari.profilConfigurat` (scris de saveProfile doar după o salvare reușită), sau
 * - un profil existent (`passport`), pentru utilizatorii de dinainte de indicator.
 * Excepție: în „Încearcă un exemplu” (pornit din prima utilizare), profilul e fictiv, iar datele reale
 * încă lipsesc, deci utilizatorul rămâne în fluxul primei utilizări.
 * @param {{passport: object|null, settings: object|null, exampleActive: boolean}} state
 */
export function isOnboardingDone({ passport, settings, exampleActive }) {
  if (exampleActive) return false;
  return Boolean(settings?.profilConfigurat) || hasProfile(passport);
}

/**
 * Pagina afișată pentru o cerere (fragmentul URL sau clicul din meniu). null = pagina implicită.
 * Cu configurarea finalizată, paginile primei utilizări duc la „Profilul meu financiar”.
 */
export function resolveSection(requested, done) {
  if (!requested) return done ? PROFILE_SECTION : FIRST_USE_SECTION;
  if (done && ONBOARDING_SECTIONS.includes(requested)) return PROFILE_SECTION;
  return requested;
}

/** Elementele din meniu: „Bugetul tău” doar cât timp configurarea nu e finalizată. */
export function visibleSections(sections, done) {
  return done ? sections.filter((s) => !ONBOARDING_SECTIONS.includes(s.id)) : sections;
}
