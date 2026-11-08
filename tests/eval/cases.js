// RĂSCRUCE AI — setul de evaluare: anunțurile fictive din data/fixtures/listings + anunțurile demo A și B.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { demoListingA, demoListingB, demoListingTextA, demoListingTextB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

function expectedFromDemo(analysis) {
  return Object.fromEntries(
    Object.entries(analysis.campuri).map(([name, f]) => {
      const exp = { status: f.status };
      if (f.status === 'gasit') {
        exp.valoare = f.valoare;
        if (f.moneda) exp.moneda = f.moneda;
        if (f.unitate) exp.unitate = f.unitate;
      }
      return [name, exp];
    }),
  );
}

/** @returns {Array<{id: string, text: string, asteptat: Record<string, {status: string, valoare?: any, moneda?: string, unitate?: string}>}>} */
export function loadEvalCases(root) {
  const file = JSON.parse(readFileSync(path.join(root, 'data', 'fixtures', 'listings', 'eval.ro.json'), 'utf8'));
  return [
    ...file.anunturi,
    { id: 'demo-a', text: demoListingTextA, asteptat: expectedFromDemo(demoListingA) },
    { id: 'demo-b', text: demoListingTextB, asteptat: expectedFromDemo(demoListingB) },
  ];
}
