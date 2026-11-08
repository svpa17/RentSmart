// RĂSCRUCE AI — API-ul public al motorului financiar. Proprietar: Sebi.
export { toRON, hasValidRate } from './currency.js';
export { calendarMonth, seasonOf } from './seasons.js';
export { computeTrueCost } from './trueCost.js';
export { simulate } from './simulate.js';
export { computePathToYes, planSimulationInput, pathToYesHorizons, MIN_MONTHS_AFTER_MOVE } from './pathToYes.js';
export { assessAffordability, affordabilityHorizon, VERDICT } from './affordability.js';
export { rankAlternatives, POTRIVIRE, PLAUSIBILITY_FLOOR } from './alternatives.js';
export { monthlyLeftoverNow, totalToMoveIn } from './budget.js';
