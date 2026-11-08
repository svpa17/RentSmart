// RĂSCRUCE AI — intervalele de referință pentru estimările prudente.
// Modul normal: data/costs.ro.json (cu surse). Modul demonstrativ: valorile FICTIVE ale scenariului demo,
// ca cifrele prezentării să corespundă tabelului din plan (§10).
import costs from '../../../data/costs.ro.json' with { type: 'json' };
import { assertValid, validateCostReference } from './contracts/schemas.js';
import { demoCostReference } from './contracts/fixtures/demoScenario.js';

/** @type {import('./contracts/types.js').CostReference} */
export const costReferenceRo = assertValid(
  validateCostReference,
  {
    utilitatiLunareRON: costs.utilitatiLunareRON,
    garantieLuniChirie: costs.garantieLuniChirie,
    verificat: costs.verificat,
    surse: costs.surse,
  },
  'CostReference',
);

/** Intervalele folosite: cele demo în modul demonstrativ, altfel cele din costs.ro.json. */
export function costReferenceFor({ modDemo }) {
  return modDemo ? demoCostReference : costReferenceRo;
}
