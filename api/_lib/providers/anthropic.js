// RĂSCRUCE AI — adaptorul Anthropic (Claude API) prin SDK-ul oficial.
// Ieșire structurată: `output_config.format` (json_schema). Nu folosim tool_choice forțat
// (respins de modelele recente). Reîncercarea se face o singură dată, în tasks.js, deci maxRetries: 0.

import Anthropic from '@anthropic-ai/sdk';
import { ApiError, AI_ERROR_CODES as C, isRetryableStatus } from '../errors.js';

/** Mapează erorile SDK-ului pe codurile tipizate. Ordinea: cele mai specifice întâi. */
export function mapAnthropicError(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ApiError(C.TIMEOUT, 'Furnizorul AI nu a răspuns la timp');
  if (err instanceof Anthropic.APIConnectionError) return new ApiError(C.AI_UNAVAILABLE, 'Furnizorul AI nu poate fi contactat', { retryable: true });
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return new ApiError(C.AUTH_ERROR, 'Cheia API nu este validă');
  if (err instanceof Anthropic.NotFoundError) return new ApiError(C.MODEL_UNAVAILABLE, 'Modelul configurat nu este disponibil');
  if (err instanceof Anthropic.RateLimitError) return new ApiError(C.RATE_LIMITED, 'Furnizorul AI a limitat cererile', { retryable: true });
  if (err instanceof Anthropic.APIError && typeof err.status === 'number')
    return new ApiError(C.AI_UNAVAILABLE, 'Furnizorul AI a returnat o eroare', { retryable: isRetryableStatus(err.status) });
  return new ApiError(C.AI_UNAVAILABLE, 'Eroare necunoscută la furnizorul AI');
}

/**
 * @param {{apiKey: string, model: string, timeoutMs: number, effort: string|null}} config
 * @param {{client?: object}} [deps]  client injectabil pentru teste
 */
export function createAnthropicProvider(config, { client } = {}) {
  const sdk = client ?? new Anthropic({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeoutMs });

  return {
    name: 'anthropic',

    async generateJson({ system, user, schema, maxTokens }) {
      let response;
      try {
        response = await sdk.messages.create(
          {
            model: config.model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: { format: { type: 'json_schema', schema }, ...(config.effort ? { effort: config.effort } : {}) },
          },
          { timeout: config.timeoutMs, maxRetries: 0 },
        );
      } catch (err) {
        throw mapAnthropicError(err);
      }
      if (response.stop_reason === 'refusal') throw new ApiError(C.AI_UNAVAILABLE, 'Furnizorul AI a refuzat cererea');
      if (response.stop_reason === 'max_tokens') throw new ApiError(C.INVALID_RESPONSE, 'Răspunsul AI a fost trunchiat');
      const text = (response.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      try {
        return JSON.parse(text);
      } catch {
        throw new ApiError(C.INVALID_RESPONSE, 'Răspunsul AI nu este JSON valid');
      }
    },

    /** Verifică cheia și modelul fără a consuma tokeni (Models API). */
    async checkModel() {
      try {
        await sdk.models.retrieve(config.model, { timeout: config.timeoutMs, maxRetries: 0 });
      } catch (err) {
        throw mapAnthropicError(err);
      }
    },
  };
}
