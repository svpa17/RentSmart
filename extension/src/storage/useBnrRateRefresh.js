// RĂSCRUCE AI: hook React care ține cursul BNR la zi cât timp panoul sau dashboard-ul e deschis.
// refreshBnrRate decide singur dacă e nevoie de o cerere (curs depășit, pauză de 30 min între încercări).
import { useEffect } from 'react';
import { refreshBnrRate } from './appData.js';

const CHECK_EVERY_MS = 15 * 60 * 1000;

export function useBnrRateRefresh({ loaded, settings, rate }) {
  const sursa = rate?.sursa ?? null;
  const modDemo = settings.modDemo;
  useEffect(() => {
    // Modul demonstrativ nu face cereri de rețea; cursul manual sau demo nu se înlocuiește automat.
    if (!loaded || modDemo || (sursa !== null && sursa !== 'bnr')) return;
    refreshBnrRate();
    const id = setInterval(() => refreshBnrRate(), CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [loaded, modDemo, sursa]);
}
