// RĂSCRUCE AI — rate limiting persistent pe trei niveluri (planul, §8):
//   1. per IP, pe minut
//   2. per instalare (ID anonim), pe zi
//   3. plafon global zilnic
// Ferestre fixe cu contoare în Redis (Upstash REST: INCR + EXPIRE NX). Fără dependențe externe.
// Store-ul în memorie e doar pentru teste și dezvoltare locală (nu e persistent).

import { ApiError, AI_ERROR_CODES } from './errors.js';

/** @typedef {{incr(key: string, ttlSeconds: number): Promise<number>}} CounterStore */

/** @returns {CounterStore} */
export function createMemoryStore(now = () => Date.now()) {
  const map = new Map();
  return {
    async incr(key, ttlSeconds) {
      const t = now();
      const cur = map.get(key);
      if (!cur || cur.expiresAt <= t) {
        map.set(key, { count: 1, expiresAt: t + ttlSeconds * 1000 });
        return 1;
      }
      cur.count += 1;
      return cur.count;
    },
  };
}

/** @returns {CounterStore} */
export function createUpstashStore({ url, token, fetchImpl = fetch }) {
  return {
    async incr(key, ttlSeconds) {
      const res = await fetchImpl(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, String(ttlSeconds), 'NX'],
        ]),
      });
      if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
      const body = await res.json();
      const count = body?.[0]?.result;
      if (!Number.isInteger(count)) throw new Error('Upstash: răspuns neașteptat');
      return count;
    },
  };
}

/**
 * @param {{store: CounterStore, limits: {perMinuteIp: number, perDayInstall: number, globalDaily: number}, now?: () => number}} opts
 */
export function createRateLimiter({ store, limits, now = () => Date.now() }) {
  const windows = () => {
    const t = now();
    return { minute: Math.floor(t / 60000), day: Math.floor(t / 86400000) };
  };

  async function hit(key, ttl, limit) {
    let count;
    try {
      count = await store.incr(key, ttl);
    } catch {
      // Fail closed: fără contor nu putem proteja bugetul.
      throw new ApiError(AI_ERROR_CODES.AI_UNAVAILABLE, 'Limitarea cererilor nu este disponibilă');
    }
    if (count > limit) throw new ApiError(AI_ERROR_CODES.RATE_LIMITED, 'Prea multe cereri. Încearcă mai târziu.');
  }

  return {
    /** Toate cele trei niveluri: pentru /api/analyze. */
    async checkAnalyze({ ip, installId }) {
      const w = windows();
      await hit(`rl:ip:${ip}:${w.minute}`, 60, limits.perMinuteIp);
      await hit(`rl:inst:${installId}:${w.day}`, 86400, limits.perDayInstall);
      await hit(`rl:global:${w.day}`, 86400, limits.globalDaily);
    },
    /** Căutarea de alternative: per IP (10/min) și per instalare (60/zi); nu consumă credite AI. */
    async checkSearch({ ip, installId }) {
      const w = windows();
      await hit(`rl:search:ip:${ip}:${w.minute}`, 60, 10);
      await hit(`rl:search:inst:${installId}:${w.day}`, 86400, 60);
    },
    /** Doar per IP: pentru /api/health (nu consumă credite AI, dar apelează furnizorul). */
    async checkHealth({ ip }) {
      const w = windows();
      await hit(`rl:health:${ip}:${w.minute}`, 60, limits.perMinuteIp);
    },
  };
}

/** Store-ul potrivit configurației: Upstash dacă e configurat, altfel memorie (doar local). */
export function storeFromConfig(config, fetchImpl) {
  if (config.upstash) return createUpstashStore({ ...config.upstash, fetchImpl });
  return createMemoryStore();
}
