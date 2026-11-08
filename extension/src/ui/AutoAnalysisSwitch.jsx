// RentSmart — setarea „Analizează automat anunțurile” (panou + dashboard).
// Pornire: 1) permisiunea doar pentru site-urile de anunțuri (cerută direct în gestul utilizatorului),
// 2) acordul pentru trimiterea textului anunțurilor la AI, dacă nu era dat. Oprire: permisiunea se retrage.
import { useState } from 'react';
import { AUTO_PERMISSIONS, AUTO_SITES } from '../auto/sites.js';
import { updateSettings } from '../storage/index.js';
import { Switch } from './components.jsx';
import { useConfirm } from './useConfirm.jsx';

const SITES = AUTO_SITES.map((s) => s.nume).join(', ');

export default function AutoAnalysisSwitch({ settings, compact = false }) {
  const [confirm, dialog] = useConfirm();
  const [msg, setMsg] = useState(null);

  async function onChange(on) {
    setMsg(null);
    if (!on) {
      await updateSettings({ analizaAutomata: false });
      chrome.permissions.remove({ origins: AUTO_PERMISSIONS }).catch(() => {});
      return;
    }
    // Cererea de permisiune trebuie să fie primul pas din clic (altfel Chrome o refuză).
    const granted = await chrome.permissions.request({ origins: AUTO_PERMISSIONS }).catch(() => false);
    if (!granted) {
      setMsg('Fără permisiunea pentru site-urile de anunțuri, RentSmart nu poate citi automat paginile.');
      return;
    }
    if (!settings.acordAI) {
      const ok = await confirm({
        title: 'Trimitem automat anunțurile la AI?',
        message:
          'Când deschizi un anunț pe aceste site-uri, textul lui (cu telefoanele și e-mailurile ascunse) e trimis la serviciul AI pentru analiză. Datele tale financiare rămân doar în browser.',
        confirmLabel: 'Sunt de acord',
      });
      if (!ok) {
        chrome.permissions.remove({ origins: AUTO_PERMISSIONS }).catch(() => {});
        setMsg('Analiza automată are nevoie de acordul pentru AI. Poți analiza în continuare manual.');
        return;
      }
    }
    await updateSettings({ analizaAutomata: true, acordAI: true });
  }

  return (
    <>
      {dialog}
      <Switch
        checked={Boolean(settings.analizaAutomata)}
        onChange={onChange}
        label="Analizează automat anunțurile"
        description={
          compact
            ? `Pe ${SITES}: când deschizi un anunț, analiza e gata fără clic.`
            : `Pe ${SITES}: când deschizi un anunț, RentSmart îl analizează singur, chiar și cu panoul închis. Cerem acces doar la aceste site-uri; la AI ajunge doar textul anunțului.`
        }
      />
      {msg && <p className="mt-2 text-[12px] font-medium text-ask">{msg}</p>}
      {settings.modDemo && settings.analizaAutomata && <p className="mt-2 text-[12px] text-muted">În modul demonstrativ analiza automată e oprită (fără internet).</p>}
    </>
  );
}
