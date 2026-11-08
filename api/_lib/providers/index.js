// RĂSCRUCE AI — interfața-adaptor pentru furnizorii AI, aleasă din AI_PROVIDER.
//
// Un furnizor implementează:
//   generateJson({system, user, schema, schemaName, maxTokens}) → obiect JSON (sau aruncă ApiError)
//   checkModel() → void (sau aruncă ApiError: AUTH_ERROR / MODEL_UNAVAILABLE / ...)
import { createAnthropicProvider } from './anthropic.js';
import { createOpenAICompatibleProvider } from './openaiCompatible.js';

export function createProvider(config) {
  if (config.provider === 'anthropic') return createAnthropicProvider(config);
  if (config.provider === 'openai') return createOpenAICompatibleProvider(config);
  throw new Error(`Furnizor necunoscut: ${config.provider}`);
}
