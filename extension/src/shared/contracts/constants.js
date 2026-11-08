// RĂSCRUCE AI — constante comune pentru contracte și motor.
// Proprietar: Sebi. Modificările se fac doar prin PR aprobat de echipă.

export const SCHEMA_VERSION = 1;

/** Limitele perioadei simulate (Crossroads). */
export const MIN_SIMULATION_MONTHS = 1;
export const MAX_SIMULATION_MONTHS = 60;

/** Luna mutării: câte luni de acum (0 = luna aceasta). */
export const MIN_MOVE_MONTH = 0;
export const MAX_MOVE_MONTH = 60;

/** Lunile calendaristice de iarnă (noiembrie–martie). */
export const WINTER_MONTHS = Object.freeze([11, 12, 1, 2, 3]);

export const CURRENCIES = Object.freeze(['RON', 'EUR']);

/**
 * Statusul unui câmp din anunț.
 * - gasit: extras din anunț, cu fragment-dovadă
 * - confirmat: confirmat de proprietar (introdus de utilizator după discuție)
 * - presupus: presupunere a utilizatorului, marcată ca atare
 * - neclar: menționat ambiguu în anunț → „De întrebat”
 * - lipsa: nu apare în anunț → „De întrebat”
 */
export const FIELD_STATUS = Object.freeze({
  GASIT: 'gasit',
  CONFIRMAT: 'confirmat',
  PRESUPUS: 'presupus',
  NECLAR: 'neclar',
  LIPSA: 'lipsa',
});
export const FIELD_STATUSES = Object.freeze(Object.values(FIELD_STATUS));

/** Statusurile a căror valoare poate fi folosită în calcule. */
export const USABLE_STATUSES = Object.freeze([
  FIELD_STATUS.GASIT,
  FIELD_STATUS.CONFIRMAT,
  FIELD_STATUS.PRESUPUS,
]);

/** Statusurile afișate în interfață ca „De întrebat”. */
export const ASK_STATUSES = Object.freeze([FIELD_STATUS.NECLAR, FIELD_STATUS.LIPSA]);

/** Tipul fiecărui câmp din ListingAnalysis.campuri. */
export const LISTING_FIELD_TYPES = Object.freeze({
  chirie: 'money',
  intretinereVara: 'money',
  intretinereIarna: 'money',
  utilitatiIncluse: 'boolean',
  garantie: 'deposit',
  comision: 'commission',
  durataContractLuni: 'number',
  reparatii: 'text',
  mobilat: 'boolean',
  suprafataMp: 'number',
  localitate: 'text',
});
export const LISTING_FIELDS = Object.freeze(Object.keys(LISTING_FIELD_TYPES));

export const DEPOSIT_UNITS = Object.freeze(['suma', 'luni_chirie']);
export const COMMISSION_UNITS = Object.freeze(['suma', 'procent_chirie']);

export const LISTING_SOURCE_TYPES = Object.freeze(['pagina', 'text_lipit', 'demo']);

/** Sursa fiecărei sume din TrueCost. */
export const COST_SOURCE = Object.freeze({
  ANUNT: 'anunt',
  CONFIRMAT: 'confirmat',
  PRESUPUS: 'presupus',
  UTILIZATOR: 'utilizator',
  ESTIMARE: 'estimare',
  INCLUS_IN_CHIRIE: 'inclus_in_chirie',
});
export const COST_SOURCES = Object.freeze(Object.values(COST_SOURCE));

export const STORM_TYPES = Object.freeze({
  PIERDERE_VENIT: 'pierdereVenit',
  CHELTUIALA_NEPREVAZUTA: 'cheltuialaNeprevazuta',
  CRESTERE_CHIRIE: 'crestereChirie',
});

/** Motive pentru care un apartament nu poate intra în simulare. */
export const INCOMPLETE_REASONS = Object.freeze({
  CHIRIE_LIPSA: 'CHIRIE_LIPSA',
  CURS_LIPSA: 'CURS_LIPSA',
});

export const WARNING_CODES = Object.freeze({
  CHIRIE_PESTE_BUGET: 'CHIRIE_PESTE_BUGET',
  MUTARE_DUPA_PERIOADA: 'MUTARE_DUPA_PERIOADA',
  ESTIMARI_FOLOSITE: 'ESTIMARI_FOLOSITE',
  ORIZONT_LUNG: 'ORIZONT_LUNG',
});

export const PATH_TO_YES_OPTION_TYPES = Object.freeze([
  'amanare',
  'rezervaSuplimentara',
  'altApartament',
  'reducereCheltuieli',
]);

/** Ipotezele afișate utilizatorului în interfață. */
/**
 * Comisionul de agenție implicit, când anunțul nu îl precizează: exact 50% din chiria lunară
 * (decizia utilizatorului). Comisionul precizat în anunț (procent, sumă sau 0) are întotdeauna prioritate.
 */
export const DEFAULT_COMMISSION_PERCENT = 50;

export const SIMULATION_ASSUMPTIONS = Object.freeze([
  'Costurile rămân aceleași de la o lună la alta, cu excepția iernii (încălzirea) și a situațiilor neprevăzute pe care le adaugi. Nu ținem cont de inflație.',
  'Garanția o primești înapoi abia la finalul contractului, așa că nu o socotim ca bani disponibili în perioada afișată.',
  'Când anunțul nu spune cât e întreținerea sau garanția, folosim o valoare mai mare decât media și o marcăm „estimare”.',
  'Când anunțul nu pomenește comisionul de agenție, îl socotim 50% din chirie, plătit o singură dată, la mutare.',
  'Sumele în euro sunt transformate în lei cu cursul BNR afișat (sau cu cursul introdus de tine) și rotunjite la leu.',
  'O situație neprevăzută pe care o adaugi se aplică la fel pentru toate variantele comparate.',
  'Prima chirie se plătește în luna mutării, ca orice chirie lunară.',
]);

// ---------------------------------------------------------------------------
// Integrarea AI (planul, §8)

/** Sarcinile acceptate de POST /api/analyze. */
export const AI_TASKS = Object.freeze(['extract', 'message', 'storm']);

/** Statusurile pe care AI-ul le poate atribui; „confirmat” și „presupus” vin doar de la utilizator. */
export const AI_FIELD_STATUSES = Object.freeze([FIELD_STATUS.GASIT, FIELD_STATUS.NECLAR, FIELD_STATUS.LIPSA]);

/** Codurile de eroare tipizate, comune backend-ului și extensiei. */
export const AI_ERROR_CODES = Object.freeze({
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  INPUT_TOO_LONG: 'INPUT_TOO_LONG',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  AUTH_ERROR: 'AUTH_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  FORBIDDEN_ORIGIN: 'FORBIDDEN_ORIGIN',
});

/** Antetul cu ID-ul anonim al instalării (rate limiting per instalare). */
export const INSTALL_ID_HEADER = 'x-install-id';

/** Lungimea maximă a textului unui scenariu de furtună trimis la AI. */
export const MAX_STORM_TEXT_CHARS = 500;
