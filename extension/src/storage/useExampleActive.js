// RentSmart — e activ „Încearcă un exemplu”? (există copia datelor reale). null cât timp se citește.
import { useEffect, useState } from 'react';
import { EXAMPLE_BACKUP_KEY } from './profile.js';

export function useExampleActive() {
  const [active, setActive] = useState(null);
  useEffect(() => {
    let alive = true;
    chrome.storage.local.get(EXAMPLE_BACKUP_KEY).then((r) => {
      if (alive) setActive(Boolean(r[EXAMPLE_BACKUP_KEY]));
    });
    const onChanged = (changes, area) => {
      if (area === 'local' && EXAMPLE_BACKUP_KEY in changes) setActive(Boolean(changes[EXAMPLE_BACKUP_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);
  return active;
}
