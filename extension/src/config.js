// RĂSCRUCE AI — configurația extensiei, fixată la build.
// URL-ul backend-ului NU este secret (cheia API stă doar pe server). Se setează în .env.local:
//   VITE_API_BASE_URL=https://<proiect>.vercel.app   (sau http://localhost:3000 pentru `npm run api`)
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** Cât așteptăm verificarea /api/health la deschiderea panoului. */
export const HEALTH_TIMEOUT_MS = 8000;
