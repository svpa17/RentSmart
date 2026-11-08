// RĂSCRUCE AI — etichetele și afișarea câmpurilor unui anunț (comune extensiei și backend-ului).
import { LISTING_FIELD_TYPES } from './contracts/constants.js';

/** Eticheta scurtă din interfață. */
export const FIELD_TITLES = Object.freeze({
  chirie: 'Chirie',
  intretinereVara: 'Întreținere + utilități (vara)',
  intretinereIarna: 'Întreținere + utilități (iarna)',
  utilitatiIncluse: 'Utilități incluse în chirie',
  garantie: 'Garanție',
  comision: 'Comision',
  durataContractLuni: 'Durata contractului',
  reparatii: 'Reparații',
  mobilat: 'Mobilat',
  suprafataMp: 'Suprafață',
  localitate: 'Localitate',
});

/** Formularea folosită în cererile către AI (sarcina „message”). */
export const FIELD_LABELS = Object.freeze({
  chirie: 'chiria lunară',
  intretinereVara: 'întreținerea și utilitățile vara',
  intretinereIarna: 'întreținerea și utilitățile iarna',
  utilitatiIncluse: 'dacă utilitățile sunt incluse în chirie',
  garantie: 'garanția',
  comision: 'comisionul',
  durataContractLuni: 'durata contractului',
  reparatii: 'cine suportă reparațiile',
  mobilat: 'dacă apartamentul este mobilat',
  suprafataMp: 'suprafața',
  localitate: 'localitatea',
});

const nf = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });
const money = (v, moneda) => `${nf.format(v)} ${moneda ?? ''}`.trim();

/** Valoarea unui câmp, ca text pentru interfață; null dacă nu există. */
export function formatFieldValue(name, field) {
  const v = field?.valoare;
  if (v === null || v === undefined) return null;
  switch (LISTING_FIELD_TYPES[name]) {
    case 'money':
      return money(v, field.moneda);
    case 'deposit':
      return field.unitate === 'luni_chirie' ? `${nf.format(v)} ${v === 1 ? 'chirie' : 'chirii'}` : money(v, field.moneda);
    case 'commission':
      return field.unitate === 'procent_chirie' ? `${nf.format(v)}% din chirie` : money(v, field.moneda);
    case 'boolean':
      return v ? 'Da' : 'Nu';
    case 'number':
      if (name === 'durataContractLuni') return `${nf.format(v)} ${v === 1 ? 'lună' : 'luni'}`;
      if (name === 'suprafataMp') return `${nf.format(v)} mp`;
      return nf.format(v);
    default:
      return String(v);
  }
}
