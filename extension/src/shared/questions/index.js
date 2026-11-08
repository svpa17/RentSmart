// RĂSCRUCE AI — Smart Questions: câmp „De întrebat” → întrebare din banca scrisă de om (data/questions.ro.json).
// AI-ul doar formulează mesajul; dacă nu răspunde, se folosește șablonul de aici.
import questionBank from '../../../../data/questions.ro.json' with { type: 'json' };
import { ASK_STATUSES, LISTING_FIELDS } from '../contracts/constants.js';

export { questionBank };

/**
 * Întrebările pentru câmpurile „neclar” / „lipsa”, în ordinea câmpurilor; un grup → o singură întrebare.
 * @param {import('../contracts/types.js').ListingAnalysis} analysis
 * @returns {Array<{campuri: string[], status: 'neclar'|'lipsa', intrebare: string}>}
 */
export function questionsFor(analysis, bank = questionBank) {
  const out = [];
  const groups = new Map();
  for (const name of LISTING_FIELDS) {
    const field = analysis.campuri[name];
    if (!field || !ASK_STATUSES.includes(field.status)) continue;
    const entry = bank.intrebari[name];
    if (!entry) continue;
    if (entry.grup && groups.has(entry.grup)) {
      const q = groups.get(entry.grup);
      q.campuri.push(name);
      // „lipsa” are întâietate: e întrebarea mai generală.
      if (field.status === 'lipsa' && q.status !== 'lipsa') Object.assign(q, { status: 'lipsa', intrebare: entry.lipsa });
      continue;
    }
    const q = { campuri: [name], status: field.status, intrebare: entry[field.status] };
    if (entry.grup) groups.set(entry.grup, q);
    out.push(q);
  }
  return out;
}

/** Câmpurile pentru care trimitem cererea „message” la AI (doar nume de câmpuri, nicio dată personală). */
export function askedFields(questions) {
  return questions.flatMap((q) => q.campuri);
}

/** Mesajul-șablon pentru proprietar (varianta fără AI). */
export function templateMessage(questions, bank = questionBank) {
  if (questions.length === 0) return '';
  const { salut, introducere, incheiere } = bank.sablonMesaj;
  const lines = questions.map((q, i) => `${i + 1}. ${q.intrebare}`);
  return [salut, introducere, ...lines, incheiere].join('\n');
}
