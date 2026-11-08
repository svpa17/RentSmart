// RĂSCRUCE AI — hook React: datele din chrome.storage.local, sincronizate live între panou și dashboard.
import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, STORAGE_KEYS, onStorageChange } from './index.js';
import { DATA_KEYS, defaultSimSettings } from './appData.js';

const KEYS = [
  STORAGE_KEYS.SETTINGS,
  DATA_KEYS.PASSPORT,
  DATA_KEYS.EXCHANGE_RATE,
  DATA_KEYS.RATE_STATUS,
  DATA_KEYS.SAVED_LISTINGS,
  DATA_KEYS.SIM_SETTINGS,
  DATA_KEYS.STORMS,
];

function toState(raw) {
  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEYS.SETTINGS] ?? {}) },
    passport: raw[DATA_KEYS.PASSPORT] ?? null,
    rate: raw[DATA_KEYS.EXCHANGE_RATE] ?? null,
    rateStatus: raw[DATA_KEYS.RATE_STATUS] ?? null,
    saved: raw[DATA_KEYS.SAVED_LISTINGS] ?? [],
    simSettings: { ...defaultSimSettings(), ...(raw[DATA_KEYS.SIM_SETTINGS] ?? {}) },
    storms: raw[DATA_KEYS.STORMS] ?? [],
  };
}

/** @returns {{loaded: boolean, settings: object, passport: object|null, rate: object|null, saved: object[], simSettings: object, storms: object[]}} */
export function useAppData() {
  const [state, setState] = useState({ loaded: false, ...toState({}) });
  useEffect(() => {
    let raw = {};
    chrome.storage.local.get(KEYS).then((r) => {
      raw = r;
      setState({ loaded: true, ...toState(raw) });
    });
    return onStorageChange(KEYS, (changes) => {
      raw = { ...raw, ...changes };
      setState({ loaded: true, ...toState(raw) });
    });
  }, []);
  return state;
}
