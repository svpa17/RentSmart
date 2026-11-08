// RĂSCRUCE AI — execuția sarcinilor AI: prompt + schemă → furnizor (o reîncercare) → validare.
import { maskAmounts, redactContacts } from '../../extension/src/ai/redact.js';
import { ApiError } from './errors.js';
import { EXTRACT_SCHEMA, MESSAGE_SCHEMA, STORM_SCHEMA } from './outputSchemas.js';
import { EXTRACT_SYSTEM, MESSAGE_SYSTEM, STORM_SYSTEM, extractUser, messageUser, stormUser } from './prompts.js';
import { normalizeExtraction, normalizeMessage, normalizeStorm } from './validate.js';

export const RETRY_DELAY_MS = 1000;
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** O singură reîncercare, cu pauză, pentru erorile marcate retryable (429 / 5xx / rețea). */
export async function withOneRetry(fn, { sleep = defaultSleep, delayMs = RETRY_DELAY_MS } = {}) {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof ApiError) || !err.retryable) throw err;
    await sleep(delayMs);
    return fn();
  }
}

/**
 * @param {{task: string, text?: string, campuriLipsa?: string[]}} input  cererea validată (validateAnalyzeRequest)
 * @param {{provider: object, maxOutputTokens: number, sleep?: Function}} deps
 */
export async function runTask(input, { provider, maxOutputTokens, sleep }) {
  const call = (system, user, schema, schemaName) =>
    withOneRetry(() => provider.generateJson({ system, user, schema, schemaName, maxTokens: maxOutputTokens }), { sleep });

  switch (input.task) {
    case 'extract': {
      // Apărare suplimentară: extensia redactează deja; serverul redactează din nou.
      const text = redactContacts(input.text);
      const raw = await call(EXTRACT_SYSTEM, extractUser(text), EXTRACT_SCHEMA, 'listing_extraction');
      return normalizeExtraction(raw, text);
    }
    case 'message': {
      const raw = await call(MESSAGE_SYSTEM, messageUser(input.campuriLipsa), MESSAGE_SCHEMA, 'landlord_message');
      return normalizeMessage(raw);
    }
    case 'storm': {
      const raw = await call(STORM_SYSTEM, stormUser(maskAmounts(input.text)), STORM_SCHEMA, 'storm_classification');
      return normalizeStorm(raw);
    }
    default:
      throw new Error(`Sarcină necunoscută: ${input.task}`);
  }
}
