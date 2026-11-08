// RĂSCRUCE AI — validarea la rulare a contractelor din ./types.js.
// Proprietar: Sebi. Fără dependențe externe (package.json aparține lui Cătălin).
//
// Fiecare validator returnează { ok: boolean, errors: Array<{ path: string, mesaj: string }> }.
// assertValid(...) aruncă ContractError când datele nu respectă contractul.

import {
  ASK_STATUSES,
  COMMISSION_UNITS,
  COST_SOURCES,
  CURRENCIES,
  DEPOSIT_UNITS,
  FIELD_STATUS,
  FIELD_STATUSES,
  LISTING_FIELD_TYPES,
  LISTING_SOURCE_TYPES,
  MAX_MOVE_MONTH,
  MAX_SIMULATION_MONTHS,
  MIN_MOVE_MONTH,
  MIN_SIMULATION_MONTHS,
  PATH_TO_YES_OPTION_TYPES,
  SCHEMA_VERSION,
  STORM_TYPES,
} from './constants.js';

export class ContractError extends Error {
  /** @param {string} name @param {Array<{path: string, mesaj: string}>} errors */
  constructor(name, errors) {
    super(`${name} invalid: ${errors.map((e) => `${e.path}: ${e.mesaj}`).join('; ')}`);
    this.name = 'ContractError';
    this.contract = name;
    this.errors = errors;
  }
}

// ---------------------------------------------------------------------------
// Primitive

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isIso = (v) => typeof v === 'string' && v.length >= 10 && !Number.isNaN(Date.parse(v));

function makeCtx() {
  const errors = [];
  const add = (path, mesaj) => errors.push({ path, mesaj });
  return { errors, add };
}

function result(errors) {
  return { ok: errors.length === 0, errors };
}

function int(ctx, path, v, { min = -Infinity, max = Infinity, nullable = false } = {}) {
  if (v === null && nullable) return;
  if (!Number.isInteger(v)) return ctx.add(path, 'trebuie să fie număr întreg');
  if (v < min) ctx.add(path, `trebuie să fie ≥ ${min}`);
  if (v > max) ctx.add(path, `trebuie să fie ≤ ${max}`);
}

function num(ctx, path, v, { min = -Infinity, max = Infinity, nullable = false, exclusiveMin = false } = {}) {
  if (v === null && nullable) return;
  if (!isFiniteNum(v)) return ctx.add(path, 'trebuie să fie număr');
  if (exclusiveMin ? v <= min : v < min) ctx.add(path, `trebuie să fie ${exclusiveMin ? '>' : '≥'} ${min}`);
  if (v > max) ctx.add(path, `trebuie să fie ≤ ${max}`);
}

function oneOf(ctx, path, v, allowed, { nullable = false } = {}) {
  if (v === null && nullable) return;
  if (!allowed.includes(v)) ctx.add(path, `trebuie să fie una dintre: ${allowed.join(', ')}`);
}

function str(ctx, path, v, { nullable = false, nonEmpty = false } = {}) {
  if (v === null && nullable) return;
  if (typeof v !== 'string') return ctx.add(path, 'trebuie să fie text');
  if (nonEmpty && v.trim().length === 0) ctx.add(path, 'nu poate fi gol');
}

function iso(ctx, path, v, { nullable = false } = {}) {
  if (v === null && nullable) return;
  if (!isIso(v)) ctx.add(path, 'trebuie să fie dată ISO 8601');
}

function obj(ctx, path, v) {
  if (!isObj(v)) {
    ctx.add(path, 'trebuie să fie obiect');
    return false;
  }
  return true;
}

function range(ctx, path, v, { min = 0 } = {}) {
  if (!obj(ctx, path, v)) return;
  num(ctx, `${path}.min`, v.min, { min });
  num(ctx, `${path}.max`, v.max, { min });
  if (isFiniteNum(v.min) && isFiniteNum(v.max) && v.min > v.max) ctx.add(path, 'min nu poate depăși max');
}

/** Normalizează pentru verificarea dovezilor: litere mici, fără diacritice, spații comprimate. */
export function normalizeForEvidence(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Orizont

/** Perioada simulată: număr întreg între 1 și 60. */
export function validateHorizon(luni) {
  const ctx = makeCtx();
  int(ctx, 'luni', luni, { min: MIN_SIMULATION_MONTHS, max: MAX_SIMULATION_MONTHS });
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------
// ListingAnalysis

function validateField(ctx, path, field, type) {
  if (!obj(ctx, path, field)) return;
  oneOf(ctx, `${path}.status`, field.status, FIELD_STATUSES);
  str(ctx, `${path}.dovada`, field.dovada, { nullable: true });
  iso(ctx, `${path}.actualizatLa`, field.actualizatLa, { nullable: true });
  str(ctx, `${path}.nota`, field.nota, { nullable: true });

  const v = field.valoare;
  const known = v !== null && v !== undefined;
  const { status } = field;

  if (status === FIELD_STATUS.GASIT) {
    if (!known) ctx.add(`${path}.valoare`, 'un câmp „gasit” trebuie să aibă valoare');
    if (typeof field.dovada !== 'string' || field.dovada.trim() === '')
      ctx.add(`${path}.dovada`, 'un câmp „gasit” trebuie să aibă fragment-dovadă');
  }
  if (status === FIELD_STATUS.CONFIRMAT || status === FIELD_STATUS.PRESUPUS) {
    if (!known) ctx.add(`${path}.valoare`, `un câmp „${status}” trebuie să aibă valoare`);
    if (!isIso(field.actualizatLa)) ctx.add(`${path}.actualizatLa`, `un câmp „${status}” trebuie să aibă dată`);
  }
  if (ASK_STATUSES.includes(status) && known) {
    ctx.add(`${path}.valoare`, 'un câmp „neclar”/„lipsa” nu poate avea valoare');
  }
  if (!known) return;

  switch (type) {
    case 'money':
      num(ctx, `${path}.valoare`, v, { min: 0 });
      oneOf(ctx, `${path}.moneda`, field.moneda, CURRENCIES);
      break;
    case 'deposit':
      num(ctx, `${path}.valoare`, v, { min: 0 });
      oneOf(ctx, `${path}.unitate`, field.unitate, DEPOSIT_UNITS);
      if (field.unitate === 'suma') oneOf(ctx, `${path}.moneda`, field.moneda, CURRENCIES);
      break;
    case 'commission':
      num(ctx, `${path}.valoare`, v, { min: 0 });
      oneOf(ctx, `${path}.unitate`, field.unitate, COMMISSION_UNITS);
      if (field.unitate === 'suma') oneOf(ctx, `${path}.moneda`, field.moneda, CURRENCIES);
      if (field.unitate === 'procent_chirie') num(ctx, `${path}.valoare`, v, { min: 0, max: 100 });
      break;
    case 'number':
      num(ctx, `${path}.valoare`, v, { min: 0 });
      break;
    case 'boolean':
      if (typeof v !== 'boolean') ctx.add(`${path}.valoare`, 'trebuie să fie adevărat/fals');
      break;
    case 'text':
      str(ctx, `${path}.valoare`, v, { nonEmpty: true });
      break;
    default:
      ctx.add(path, `tip necunoscut: ${type}`);
  }
}

export function validateListingAnalysis(a) {
  const ctx = makeCtx();
  if (!obj(ctx, 'ListingAnalysis', a)) return result(ctx.errors);
  if (a.schemaVersion !== SCHEMA_VERSION) ctx.add('schemaVersion', `trebuie să fie ${SCHEMA_VERSION}`);
  str(ctx, 'id', a.id, { nonEmpty: true });
  str(ctx, 'titlu', a.titlu, { nullable: true });
  if (typeof a.demonstrativ !== 'boolean') ctx.add('demonstrativ', 'trebuie să fie adevărat/fals');
  if (obj(ctx, 'sursa', a.sursa)) {
    oneOf(ctx, 'sursa.tip', a.sursa.tip, LISTING_SOURCE_TYPES);
    str(ctx, 'sursa.url', a.sursa.url, { nullable: true });
    iso(ctx, 'sursa.analizatLa', a.sursa.analizatLa);
    // Imaginea principală a anunțului (opțională): doar https, lungime rezonabilă.
    if ('imagine' in a.sursa && a.sursa.imagine !== null) {
      let ok = typeof a.sursa.imagine === 'string' && a.sursa.imagine.length <= 2048;
      try {
        ok &&= new URL(a.sursa.imagine).protocol === 'https:';
      } catch {
        ok = false;
      }
      if (!ok) ctx.add('sursa.imagine', 'trebuie să fie un URL https');
    }
  }
  if (obj(ctx, 'campuri', a.campuri)) {
    for (const [name, type] of Object.entries(LISTING_FIELD_TYPES)) {
      validateField(ctx, `campuri.${name}`, a.campuri[name], type);
    }
    for (const name of Object.keys(a.campuri)) {
      if (!(name in LISTING_FIELD_TYPES)) ctx.add(`campuri.${name}`, 'câmp necunoscut');
    }
    const chirie = a.campuri.chirie;
    if (isObj(chirie) && isFiniteNum(chirie.valoare) && chirie.valoare <= 0)
      ctx.add('campuri.chirie.valoare', 'chiria trebuie să fie > 0');
  }
  return result(ctx.errors);
}

/**
 * Verificarea dovezilor: orice câmp „gasit” trebuie să aibă un fragment care există
 * în textul trimis la AI. Câmpurile fără dovadă validă devin „lipsa” (De întrebat).
 * Returnează o copie nouă a analizei și lista câmpurilor retrogradate.
 * @param {import('./types.js').ListingAnalysis} analysis
 * @param {string} sourceText
 */
export function enforceEvidence(analysis, sourceText) {
  const haystack = normalizeForEvidence(sourceText);
  const downgraded = [];
  const campuri = {};
  for (const [name, field] of Object.entries(analysis.campuri)) {
    const needsEvidence = field.status === FIELD_STATUS.GASIT || field.status === FIELD_STATUS.NECLAR;
    const evidence = typeof field.dovada === 'string' ? normalizeForEvidence(field.dovada) : '';
    const valid = evidence.length > 0 && haystack.includes(evidence);
    if (needsEvidence && !valid) {
      downgraded.push(name);
      campuri[name] = {
        ...field,
        status: FIELD_STATUS.LIPSA,
        valoare: null,
        dovada: null,
        ...(field.unitate !== undefined ? { unitate: null } : {}),
        ...(field.moneda !== undefined ? { moneda: null } : {}),
      };
    } else {
      campuri[name] = { ...field };
    }
  }
  return { analysis: { ...analysis, campuri }, downgraded };
}

// ---------------------------------------------------------------------------
// FinancialPassport, ExchangeRate, CostReference, SavedListing

export function validateFinancialPassport(p) {
  const ctx = makeCtx();
  if (!obj(ctx, 'FinancialPassport', p)) return result(ctx.errors);
  if (p.schemaVersion !== SCHEMA_VERSION) ctx.add('schemaVersion', `trebuie să fie ${SCHEMA_VERSION}`);
  for (const k of [
    'venitNetLunar',
    'cheltuieliEsentialeLunare',
    'costLocuintaActuala',
    'transportActualLunar',
    'economiiDisponibile',
    'rezervaMinima',
    'bugetMaximChirie',
  ]) {
    int(ctx, k, p[k], { min: 0 });
  }
  int(ctx, 'lunaMutarii', p.lunaMutarii, { min: MIN_MOVE_MONTH, max: MAX_MOVE_MONTH });
  str(ctx, 'obiectiv', p.obiectiv, { nullable: true });
  return result(ctx.errors);
}

export function validateExchangeRate(r) {
  const ctx = makeCtx();
  if (!obj(ctx, 'ExchangeRate', r)) return result(ctx.errors);
  num(ctx, 'eurToRon', r.eurToRon, { min: 0, exclusiveMin: true, max: 100 });
  oneOf(ctx, 'sursa', r.sursa, ['utilizator', 'demo', 'bnr']);
  iso(ctx, 'actualizatLa', r.actualizatLa);
  // Cursul BNR poartă data publicării (AAAA-LL-ZZ), afișată lângă curs.
  if (r.sursa === 'bnr' && !(typeof r.dataPublicarii === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.dataPublicarii) && isIso(r.dataPublicarii)))
    ctx.add('dataPublicarii', 'trebuie să fie o dată AAAA-LL-ZZ pentru cursul BNR');
  return result(ctx.errors);
}

export function validateCostReference(c) {
  const ctx = makeCtx();
  if (!obj(ctx, 'CostReference', c)) return result(ctx.errors);
  if (obj(ctx, 'utilitatiLunareRON', c.utilitatiLunareRON)) {
    range(ctx, 'utilitatiLunareRON.vara', c.utilitatiLunareRON.vara);
    range(ctx, 'utilitatiLunareRON.iarna', c.utilitatiLunareRON.iarna);
  }
  range(ctx, 'garantieLuniChirie', c.garantieLuniChirie);
  if (typeof c.verificat !== 'boolean') ctx.add('verificat', 'trebuie să fie adevărat/fals');
  if (!Array.isArray(c.surse)) ctx.add('surse', 'trebuie să fie listă');
  return result(ctx.errors);
}

export function validateUserApartmentCosts(u) {
  const ctx = makeCtx();
  if (!obj(ctx, 'UserApartmentCosts', u)) return result(ctx.errors);
  for (const k of ['transportLunarRON', 'alteCosturiLunareRON', 'costuriMutareRON']) {
    int(ctx, k, u[k], { min: 0, nullable: true });
  }
  return result(ctx.errors);
}

export function validateSavedListing(s) {
  const ctx = makeCtx();
  if (!obj(ctx, 'SavedListing', s)) return result(ctx.errors);
  for (const e of validateListingAnalysis(s.analiza).errors) ctx.add(`analiza.${e.path}`, e.mesaj);
  for (const e of validateUserApartmentCosts(s.costuriUtilizator).errors)
    ctx.add(`costuriUtilizator.${e.path}`, e.mesaj);
  iso(ctx, 'salvatLa', s.salvatLa);
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------
// Storm

export function validateStorm(s, path = 'furtuna') {
  const ctx = makeCtx();
  if (!obj(ctx, path, s)) return result(ctx.errors);
  str(ctx, `${path}.id`, s.id, { nonEmpty: true });
  const last = MAX_SIMULATION_MONTHS - 1;
  switch (s.tip) {
    case STORM_TYPES.PIERDERE_VENIT:
      int(ctx, `${path}.start`, s.start, { min: 0, max: last });
      int(ctx, `${path}.durata`, s.durata, { min: 1, max: MAX_SIMULATION_MONTHS });
      num(ctx, `${path}.procent`, s.procent, { min: 0, exclusiveMin: true, max: 100 });
      break;
    case STORM_TYPES.CHELTUIALA_NEPREVAZUTA:
      int(ctx, `${path}.luna`, s.luna, { min: 0, max: last });
      int(ctx, `${path}.suma`, s.suma, { min: 1 });
      break;
    case STORM_TYPES.CRESTERE_CHIRIE:
      int(ctx, `${path}.start`, s.start, { min: 0, max: last });
      num(ctx, `${path}.procent`, s.procent, { min: 0, exclusiveMin: true, max: 100 });
      break;
    default:
      ctx.add(`${path}.tip`, `trebuie să fie una dintre: ${Object.values(STORM_TYPES).join(', ')}`);
  }
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------
// TrueCost

function validateCostItem(ctx, path, item, { nullable = false } = {}) {
  if (item === null && nullable) return;
  if (!obj(ctx, path, item)) return;
  int(ctx, `${path}.sumaRON`, item.sumaRON, { min: 0 });
  oneOf(ctx, `${path}.sursa`, item.sursa, COST_SOURCES);
  if (item.interval !== null) range(ctx, `${path}.interval`, item.interval);
  if (item.original !== null && obj(ctx, `${path}.original`, item.original)) {
    num(ctx, `${path}.original.valoare`, item.original.valoare, { min: 0 });
    oneOf(ctx, `${path}.original.moneda`, item.original.moneda, CURRENCIES);
  }
}

export function validateTrueCost(tc) {
  const ctx = makeCtx();
  if (!obj(ctx, 'TrueCost', tc)) return result(ctx.errors);
  str(ctx, 'listingId', tc.listingId, { nonEmpty: true });
  if (typeof tc.complet !== 'boolean') ctx.add('complet', 'trebuie să fie adevărat/fals');
  if (!Array.isArray(tc.motiveIncomplet)) ctx.add('motiveIncomplet', 'trebuie să fie listă');
  if (obj(ctx, 'lunar', tc.lunar)) {
    validateCostItem(ctx, 'lunar.chirie', tc.lunar.chirie, { nullable: !tc.complet });
    for (const k of ['utilitatiVara', 'utilitatiIarna', 'alteCosturi', 'transport'])
      validateCostItem(ctx, `lunar.${k}`, tc.lunar[k]);
  }
  if (obj(ctx, 'initial', tc.initial)) {
    validateCostItem(ctx, 'initial.garantie', tc.initial.garantie, { nullable: !tc.complet });
    validateCostItem(ctx, 'initial.comision', tc.initial.comision, { nullable: !tc.complet });
    validateCostItem(ctx, 'initial.mutare', tc.initial.mutare);
  }
  if (obj(ctx, 'totaluri', tc.totaluri)) {
    for (const k of ['lunarVara', 'lunarIarna', 'initialDefinitiv', 'garantieRecuperabila', 'plataLaMutare'])
      int(ctx, `totaluri.${k}`, tc.totaluri[k], { min: 0, nullable: !tc.complet });
  }
  if (!Array.isArray(tc.avertizari)) ctx.add('avertizari', 'trebuie să fie listă');
  if (tc.complet && Array.isArray(tc.motiveIncomplet) && tc.motiveIncomplet.length > 0)
    ctx.add('motiveIncomplet', 'un cost complet nu poate avea motive de incompletitudine');
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------
// SimulationInput

export function validateSimulationInput(input) {
  const ctx = makeCtx();
  if (!obj(ctx, 'SimulationInput', input)) return result(ctx.errors);
  for (const e of validateFinancialPassport(input.passport).errors) ctx.add(`passport.${e.path}`, e.mesaj);
  for (const e of validateHorizon(input.luni).errors) ctx.add(e.path, e.mesaj);
  int(ctx, 'lunaStart', input.lunaStart, { min: 1, max: 12 });

  if (!Array.isArray(input.apartamente) || input.apartamente.length < 1 || input.apartamente.length > 2) {
    ctx.add('apartamente', 'trebuie să conțină 1 sau 2 apartamente');
  } else {
    input.apartamente.forEach((tc, i) => {
      for (const e of validateTrueCost(tc).errors) ctx.add(`apartamente[${i}].${e.path}`, e.mesaj);
      if (isObj(tc) && tc.complet !== true)
        ctx.add(`apartamente[${i}]`, `apartament incomplet (${(tc.motiveIncomplet || []).join(', ')})`);
    });
  }

  if (!Array.isArray(input.furtuni)) {
    ctx.add('furtuni', 'trebuie să fie listă');
  } else {
    const ids = new Set();
    input.furtuni.forEach((s, i) => {
      for (const e of validateStorm(s, `furtuni[${i}]`).errors) ctx.add(e.path, e.mesaj);
      if (isObj(s)) {
        if (ids.has(s.id)) ctx.add(`furtuni[${i}].id`, 'id duplicat');
        ids.add(s.id);
      }
    });
  }
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------
// SimulationResult

export function validateSimulationResult(r) {
  const ctx = makeCtx();
  if (!obj(ctx, 'SimulationResult', r)) return result(ctx.errors);
  for (const e of validateHorizon(r.luni).errors) ctx.add(e.path, e.mesaj);
  int(ctx, 'lunaStart', r.lunaStart, { min: 1, max: 12 });
  int(ctx, 'lunaMutarii', r.lunaMutarii, { min: MIN_MOVE_MONTH, max: MAX_MOVE_MONTH });
  int(ctx, 'pragSigur', r.pragSigur, { min: 0 });
  if (!Array.isArray(r.drumuri) || r.drumuri.length === 0) {
    ctx.add('drumuri', 'trebuie să fie listă nevidă');
  } else {
    r.drumuri.forEach((d, i) => {
      const p = `drumuri[${i}]`;
      if (!obj(ctx, p, d)) return;
      str(ctx, `${p}.listingId`, d.listingId, { nonEmpty: true });
      if (!Array.isArray(d.luni) || d.luni.length !== r.luni) {
        ctx.add(`${p}.luni`, `trebuie să conțină exact ${r.luni} luni`);
      } else {
        d.luni.forEach((m, t) => {
          if (!isObj(m) || m.t !== t) ctx.add(`${p}.luni[${t}]`, 'index de lună greșit');
          else for (const k of ['venit', 'flux', 'bani', 'garantieBlocata', 'avereTotala']) int(ctx, `${p}.luni[${t}].${k}`, m[k]);
        });
      }
      if (obj(ctx, `${p}.indicatori`, d.indicatori)) {
        int(ctx, `${p}.indicatori.soldMinim`, d.indicatori.soldMinim);
        int(ctx, `${p}.indicatori.soldFinal`, d.indicatori.soldFinal);
        if (typeof d.indicatori.sigur !== 'boolean') ctx.add(`${p}.indicatori.sigur`, 'trebuie să fie adevărat/fals');
      }
    });
  }
  if (!Array.isArray(r.avertizari)) ctx.add('avertizari', 'trebuie să fie listă');
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------
// PathToYes

export function validatePathToYes(p) {
  const ctx = makeCtx();
  if (!obj(ctx, 'PathToYes', p)) return result(ctx.errors);
  str(ctx, 'listingId', p.listingId, { nonEmpty: true });
  int(ctx, 'pragSigur', p.pragSigur, { min: 0 });
  if (typeof p.sigurDeja !== 'boolean') ctx.add('sigurDeja', 'trebuie să fie adevărat/fals');
  str(ctx, 'mesaj', p.mesaj, { nonEmpty: true });
  const checkOption = (o, path) => {
    if (!obj(ctx, path, o)) return;
    oneOf(ctx, `${path}.tip`, o.tip, PATH_TO_YES_OPTION_TYPES);
    str(ctx, `${path}.listingId`, o.listingId, { nonEmpty: true });
    if (o.tip === 'amanare') {
      int(ctx, `${path}.lunaMutarii`, o.lunaMutarii, { min: 1, max: MAX_MOVE_MONTH });
      int(ctx, `${path}.orizontVerificat`, o.orizontVerificat, { min: 1, max: MAX_SIMULATION_MONTHS });
      int(ctx, `${path}.luniVerificateDupaMutare`, o.luniVerificateDupaMutare, { min: 1 });
      if (Number.isInteger(o.lunaMutarii) && Number.isInteger(o.luniVerificateDupaMutare) && Number.isInteger(o.orizontVerificat)
        && o.lunaMutarii + o.luniVerificateDupaMutare !== o.orizontVerificat)
        ctx.add(path, 'orizontVerificat trebuie să fie lunaMutarii + luniVerificateDupaMutare');
    }
    if (o.tip === 'rezervaSuplimentara') int(ctx, `${path}.sumaRON`, o.sumaRON, { min: 1 });
    if (o.tip === 'altApartament') str(ctx, `${path}.deLaListingId`, o.deLaListingId, { nonEmpty: true });
    if (o.tip === 'reducereCheltuieli') {
      int(ctx, `${path}.sumaLunaraRON`, o.sumaLunaraRON, { min: 1 });
      if (o.doarDacaERealist !== true) ctx.add(`${path}.doarDacaERealist`, 'trebuie să fie true');
    }
  };
  if (!Array.isArray(p.optiuni)) ctx.add('optiuni', 'trebuie să fie listă');
  else p.optiuni.forEach((o, i) => checkOption(o, `optiuni[${i}]`));
  if (p.celMaiApropiat !== null) checkOption(p.celMaiApropiat, 'celMaiApropiat');
  if (p.sigurDeja && Array.isArray(p.optiuni) && p.optiuni.length > 0)
    ctx.add('optiuni', 'când apartamentul e deja sigur, lista de opțiuni trebuie să fie goală');
  return result(ctx.errors);
}

// ---------------------------------------------------------------------------

/** Aruncă ContractError dacă validarea eșuează; altfel returnează valoarea. */
export function assertValid(validator, value, name) {
  const { ok, errors } = validator(value);
  if (!ok) throw new ContractError(name, errors);
  return value;
}
