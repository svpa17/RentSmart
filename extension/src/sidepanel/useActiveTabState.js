// RentSmart — tab-ul activ din fereastra panoului și starea analizei automate pentru el
// (chrome.storage.session, scrisă de service worker). Doar când analiza automată e pornită.
import { useEffect, useState } from 'react';
import { TAB_STATE_KEY } from '../auto/analyzer.js';

export function useActiveTabState(enabled) {
  const [tabId, setTabId] = useState(null);
  const [tabs, setTabs] = useState({});
  useEffect(() => {
    if (!enabled) return undefined;
    let windowId;
    let alive = true;
    chrome.windows
      .getCurrent()
      .then((w) => {
        windowId = w.id;
        return chrome.tabs.query({ active: true, windowId: w.id });
      })
      .then(([t]) => alive && t && setTabId(t.id))
      .catch(() => {});
    chrome.storage.session
      .get(TAB_STATE_KEY)
      .then((r) => alive && setTabs(r[TAB_STATE_KEY] ?? {}))
      .catch(() => {});
    const onActivated = (info) => {
      if (windowId === undefined || info.windowId === windowId) setTabId(info.tabId);
    };
    const onChanged = (changes, area) => {
      if (area === 'session' && TAB_STATE_KEY in changes) setTabs(changes[TAB_STATE_KEY].newValue ?? {});
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [enabled]);
  return { tabId, state: enabled && tabId !== null ? (tabs[tabId] ?? null) : null };
}
