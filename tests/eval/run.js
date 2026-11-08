// RĂSCRUCE AI — evaluarea extragerii AI pe backend-ul real (planul, §15).
// Rulare:  node tests/eval/run.js http://localhost:3000      (sau URL-ul de producție)
// Fiecare rulare face ~12 cereri reale la furnizorul AI (costă credite).
// Ținta: ZERO câmpuri „gasit” fără dovadă validă. Exit code 1 dacă ținta nu e atinsă.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { enforceEvidence, normalizeForEvidence } from '../../extension/src/shared/contracts/schemas.js';
import { prepareListingText, extractListing } from '../../extension/src/ai/client.js';
import { loadEvalCases } from './cases.js';

const baseUrl = (process.argv[2] || process.env.EVAL_API_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Folosire: node tests/eval/run.js <URL backend>');
  process.exit(2);
}

const installId = randomUUID();
const cases = loadEvalCases(path.resolve(import.meta.dirname, '..', '..'));
let fieldsChecked = 0;
let fieldsMatched = 0;
let foundWithoutEvidence = 0;
let invented = 0;
const failures = [];

for (const c of cases) {
  const sent = prepareListingText(c.text);
  const res = await extractListing(sent, { baseUrl, installId, timeoutMs: 60000 });
  if (!res.ok) {
    failures.push(`${c.id}: eroare ${res.code}`);
    continue;
  }
  const campuri = res.data.campuri;
  // Ținta principală: fiecare „gasit” are fragmentul în textul trimis.
  const haystack = normalizeForEvidence(sent);
  for (const [name, f] of Object.entries(campuri)) {
    if (f.status === 'gasit' && !(f.dovada && haystack.includes(normalizeForEvidence(f.dovada)))) {
      foundWithoutEvidence += 1;
      failures.push(`${c.id}.${name}: „gasit” fără dovadă validă`);
    }
  }
  // Verificarea de pe client nu trebuie să mai găsească nimic de retrogradat.
  const { downgraded } = enforceEvidence({ campuri }, sent);
  if (downgraded.length) failures.push(`${c.id}: retrogradate pe client: ${downgraded.join(', ')}`);

  for (const [name, exp] of Object.entries(c.asteptat)) {
    fieldsChecked += 1;
    const got = campuri[name];
    const ok = got.status === exp.status && ['valoare', 'moneda', 'unitate'].every((k) => !(k in exp) || got[k] === exp[k]);
    if (ok) fieldsMatched += 1;
    else {
      if (exp.status !== 'gasit' && got.status === 'gasit') invented += 1;
      failures.push(`${c.id}.${name}: așteptat ${JSON.stringify(exp)}, primit ${JSON.stringify({ status: got.status, valoare: got.valoare, moneda: got.moneda, unitate: got.unitate })}`);
    }
  }
}

console.log(`Anunțuri: ${cases.length}`);
console.log(`Câmpuri corecte: ${fieldsMatched}/${fieldsChecked} (${((fieldsMatched / Math.max(1, fieldsChecked)) * 100).toFixed(1)}%)`);
console.log(`„Găsit” fără dovadă validă: ${foundWithoutEvidence} (ținta: 0)`);
console.log(`Valori inventate (așteptat neclar/lipsă, primit găsit): ${invented}`);
if (failures.length) console.log(`\nDiferențe:\n- ${failures.join('\n- ')}`);
process.exit(foundWithoutEvidence === 0 ? 0 : 1);

