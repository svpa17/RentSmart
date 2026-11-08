// RĂSCRUCE AI — citirea valorilor din formularul unui câmp (pură, testabilă).

/** Unitățile pentru garanție și comision, cu eticheta din interfață. */
export const UNITS = Object.freeze({
  deposit: [
    ['luni_chirie', 'chirii'],
    ['suma', 'sumă fixă'],
  ],
  commission: [
    ['procent_chirie', '% din chirie'],
    ['suma', 'sumă fixă'],
  ],
});

/** Transformă valoarea introdusă în valoarea câmpului; aruncă un mesaj pentru utilizator dacă nu e validă. */
export function parseEditorValue(type, raw) {
  if (type === 'boolean') {
    if (raw !== 'da' && raw !== 'nu') throw new Error('Alege Da sau Nu.');
    return raw === 'da';
  }
  const s = String(raw ?? '').trim();
  if (type === 'text') {
    if (!s) throw new Error('Completează un răspuns.');
    return s;
  }
  // Numere: „1.950”, „1 950” și „1950,5” sunt acceptate (punctul e separator de mii doar înaintea a 3 cifre).
  const normalized = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(normalized);
  if (!s || !Number.isFinite(n) || n < 0) throw new Error('Introdu un număr ≥ 0.');
  return n;
}
