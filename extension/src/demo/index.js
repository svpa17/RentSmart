// RĂSCRUCE AI — modul demonstrativ (planul, §10): răspunsuri AI înregistrate, nicio cerere de rețea,
// iar fiecare rezultat poartă eticheta „DATE DEMONSTRATIVE”.
import { normalizeForEvidence } from '../shared/contracts/schemas.js';
import { demoListingA, demoListingB } from '../shared/contracts/fixtures/demoScenario.js';

export const DEMO_LABEL = 'DATE DEMONSTRATIVE';

/** Răspunsurile înregistrate ale extragerii, recunoscute după o frază caracteristică din anunț. */
const RECORDED = [
  { marker: 'Garsonieră de închiriat, zona Mănăștur, Cluj-Napoca', analiza: demoListingA },
  { marker: 'Apartament 2 camere, bloc nou (2015), zona Gheorgheni', analiza: demoListingB },
];

/** Scenariul de furtună al prezentării și clasificarea lui înregistrată (fără rețea). */
export const DEMO_STORM_TEXT = 'Îmi pierd jobul 2 luni, din aprilie.';
const RECORDED_STORM = Object.freeze({ tip: 'pierdereVenit', start: 4, durata: 2 });

export function findRecordedStorm(text) {
  return normalizeForEvidence(text).includes(normalizeForEvidence('pierd jobul 2 luni, din aprilie')) ? { ...RECORDED_STORM } : null;
}

/** Analiza înregistrată pentru textul dat, sau null dacă textul nu este unul dintre anunțurile demo. */
export function findRecordedAnalysis(text) {
  const haystack = normalizeForEvidence(text);
  const hit = RECORDED.find((r) => haystack.includes(normalizeForEvidence(r.marker)));
  return hit ? structuredClone(hit.analiza) : null;
}
