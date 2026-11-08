// RĂSCRUCE AI — erorile tipizate ale backend-ului (planul, §8).
// Fișierele din `api/_lib` nu devin funcții serverless (prefixul `_`).
import { AI_ERROR_CODES as C } from '../../extension/src/shared/contracts/constants.js';

export { C as AI_ERROR_CODES };

/** Statusul HTTP pentru fiecare cod. */
export const HTTP_STATUS = Object.freeze({
  [C.INVALID_REQUEST]: 400,
  [C.FORBIDDEN_ORIGIN]: 403,
  [C.INPUT_TOO_LONG]: 413,
  [C.RATE_LIMITED]: 429,
  [C.INVALID_RESPONSE]: 502,
  [C.AI_UNAVAILABLE]: 503,
  [C.MODEL_UNAVAILABLE]: 503,
  [C.AUTH_ERROR]: 503,
  [C.TIMEOUT]: 504,
});

export class ApiError extends Error {
  /** @param {string} code unul dintre AI_ERROR_CODES @param {string} [mesaj] @param {{retryable?: boolean}} [opts] */
  constructor(code, mesaj = code, { retryable = false } = {}) {
    super(mesaj);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
  }

  get status() {
    return HTTP_STATUS[this.code] ?? 500;
  }
}

/** Erorile de furnizor pentru care facem o singură reîncercare (429 / 5xx / rețea). */
export function isRetryableStatus(status) {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}
