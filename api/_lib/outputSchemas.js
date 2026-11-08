// RĂSCRUCE AI — schemele JSON ale ieșirii structurate pentru fiecare sarcină AI.
// Compatibile cu structured outputs (Anthropic `output_config.format`) și cu `response_format`
// json_schema strict (OpenAI-compatibil): toate obiectele au `additionalProperties: false`
// și toate proprietățile sunt obligatorii. Uniunile sunt păstrate la minimum: „necunoscut”
// și șirul gol țin locul lui null, iar codul le normalizează (validate.js).

import { AI_FIELD_STATUSES, COMMISSION_UNITS, DEPOSIT_UNITS, LISTING_FIELD_TYPES, STORM_TYPES } from '../../extension/src/shared/contracts/constants.js';

export const UNKNOWN = 'necunoscut';

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const strictObject = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const VALUE_SCHEMA = {
  money: { type: 'number' },
  deposit: { type: 'number' },
  commission: { type: 'number' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  text: { type: 'string' },
};

function fieldSchema(type) {
  const props = {
    status: { type: 'string', enum: [...AI_FIELD_STATUSES] },
    valoare: nullable(VALUE_SCHEMA[type]),
    dovada: { type: 'string', description: 'Fragment copiat exact din anunț; șir gol dacă nu există.' },
  };
  if (type === 'money' || type === 'deposit' || type === 'commission') {
    props.moneda = { type: 'string', enum: ['RON', 'EUR', UNKNOWN] };
  }
  if (type === 'deposit') props.unitate = { type: 'string', enum: [...DEPOSIT_UNITS, UNKNOWN] };
  if (type === 'commission') props.unitate = { type: 'string', enum: [...COMMISSION_UNITS, UNKNOWN] };
  return strictObject(props);
}

export const EXTRACT_SCHEMA = strictObject({
  titlu: { type: 'string', description: 'Titlul anunțului, sau șir gol.' },
  campuri: strictObject(Object.fromEntries(Object.entries(LISTING_FIELD_TYPES).map(([name, type]) => [name, fieldSchema(type)]))),
});

export const MESSAGE_SCHEMA = strictObject({
  mesaj: { type: 'string' },
});

export const STORM_SCHEMA = strictObject({
  tip: { type: 'string', enum: [...Object.values(STORM_TYPES), UNKNOWN] },
  start: nullable({ type: 'integer', description: 'Luna calendaristică de început, 1–12.' }),
  durata: nullable({ type: 'integer', description: 'Durata în luni.' }),
});
