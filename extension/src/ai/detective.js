// RĂSCRUCE AI — AI Listing Detective + Smart Questions: textul anunțului → ListingAnalysis validată → întrebări + mesaj.
// Moduri: „ai” (backend), „demo” (răspunsuri înregistrate, fără rețea) și „manual” (fără AI: totul „De întrebat”).
// Stratul 3 de validare: validateListingAnalysis + enforceEvidence rulează aici, pe client, pentru orice răspuns AI.
import { findRecordedAnalysis } from '../demo/index.js';
import { createListingAnalysis } from '../shared/contracts/factories.js';
import { enforceEvidence, validateListingAnalysis } from '../shared/contracts/schemas.js';
import { AI_ERROR_CODES } from '../shared/contracts/constants.js';
import { askedFields, questionsFor, templateMessage } from '../shared/questions/index.js';
import { SHORT_TEXT_CHARS } from '../content/text.js';
import { composeLandlordMessage, extractListing, prepareListingText } from './client.js';

export const DETECTIVE_CODES = Object.freeze({
  FARA_ACORD: 'FARA_ACORD',
  DEMO_FARA_INREGISTRARE: 'DEMO_FARA_INREGISTRARE',
});

/**
 * @param {{text: string, tip: 'pagina'|'text_lipit', url?: string|null, titlu?: string|null,
 *   setari: {modDemo: boolean, acordAI: boolean}, aiIndisponibil?: string|null}} input
 *   aiIndisponibil: codul de la /api/health când știm deja că AI-ul nu e disponibil (nu mai încercăm).
 * @param {{api?: {extractListing: Function}, installId?: string, now?: () => Date, newId?: () => string}} [deps]
 * @returns {Promise<{analiza: object, mod: 'ai'|'demo'|'manual', eroare: string|null, retrogradate: string[], scurt: boolean}>}
 */
export async function runDetective({ text, tip, url = null, titlu = null, imagine = null, setari, aiIndisponibil = null }, deps = {}) {
  const api = deps.api ?? { extractListing };
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const id = (deps.newId ?? (() => crypto.randomUUID()))();
  const sent = prepareListingText(text);
  const scurt = sent.trim().length < SHORT_TEXT_CHARS;
  const manual = (eroare) => ({
    analiza: createListingAnalysis({ id, tip, url, analizatLa: now, titlu, demonstrativ: false, imagine }),
    mod: 'manual',
    eroare,
    retrogradate: [],
    scurt,
  });

  if (setari.modDemo) {
    const recorded = findRecordedAnalysis(sent);
    if (!recorded) return manual(DETECTIVE_CODES.DEMO_FARA_INREGISTRARE);
    const analiza = createListingAnalysis({
      // Id-ul înregistrării (demo-a / demo-b): e același apartament ca în scenariul demo salvat,
      // deci panoul și dashboard-ul folosesc aceleași costuri și arată aceleași cifre.
      id: recorded.id,
      tip: 'demo',
      url,
      analizatLa: now,
      titlu: recorded.titlu,
      demonstrativ: true,
      campuri: recorded.campuri,
      imagine,
    });
    const checked = enforceEvidence(analiza, sent);
    return { analiza: checked.analysis, mod: 'demo', eroare: null, retrogradate: checked.downgraded, scurt };
  }

  if (aiIndisponibil) return manual(aiIndisponibil);
  if (!setari.acordAI) return manual(DETECTIVE_CODES.FARA_ACORD);

  const res = await api.extractListing(sent, { installId: deps.installId });
  if (!res.ok) return manual(res.code);

  const analiza = createListingAnalysis({
    id,
    tip,
    url,
    analizatLa: now,
    titlu: res.data.titlu ?? titlu,
    demonstrativ: false,
    campuri: res.data.campuri,
    imagine,
  });
  if (!validateListingAnalysis(analiza).ok) return manual(AI_ERROR_CODES.INVALID_RESPONSE);
  const checked = enforceEvidence(analiza, sent);
  const retrogradate = [...new Set([...(res.data.campuriRetrogradate ?? []), ...checked.downgraded])];
  return { analiza: checked.analysis, mod: 'ai', eroare: null, retrogradate, scurt };
}

/**
 * Întrebările și mesajul pentru proprietar. AI-ul doar formulează mesajul; fără AI → șablonul.
 * @returns {Promise<{intrebari: Array, mesaj: string, sursaMesaj: 'ai'|'sablon'|'niciunul'}>}
 */
export async function buildQuestions(analiza, { useAI, api = { composeLandlordMessage }, installId } = {}) {
  const intrebari = questionsFor(analiza);
  if (intrebari.length === 0) return { intrebari, mesaj: '', sursaMesaj: 'niciunul' };
  const sablon = templateMessage(intrebari);
  if (!useAI) return { intrebari, mesaj: sablon, sursaMesaj: 'sablon' };
  const res = await api.composeLandlordMessage(askedFields(intrebari), { installId });
  if (res.ok && typeof res.data?.mesaj === 'string' && res.data.mesaj.trim()) {
    return { intrebari, mesaj: res.data.mesaj.trim(), sursaMesaj: 'ai' };
  }
  return { intrebari, mesaj: sablon, sursaMesaj: 'sablon' };
}
