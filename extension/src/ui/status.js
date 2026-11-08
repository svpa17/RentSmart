// RĂSCRUCE AI — etichetele statusurilor din interfață: „Găsit”, „Neclar”, „De întrebat” (+ valorile utilizatorului).
export const STATUS_UI = Object.freeze({
  gasit: { label: 'Găsit', tone: 'found' },
  neclar: { label: 'Neclar', tone: 'unclear' },
  lipsa: { label: 'De întrebat', tone: 'ask' },
  confirmat: { label: 'Confirmat', tone: 'brand' },
  presupus: { label: 'Presupunerea ta', tone: 'neutral' },
});

/** Câte câmpuri are analiza în fiecare status. */
export function countByStatus(analiza) {
  const c = { gasit: 0, neclar: 0, lipsa: 0, confirmat: 0, presupus: 0 };
  for (const f of Object.values(analiza.campuri)) c[f.status] += 1;
  return c;
}
