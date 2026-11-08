# RĂSCRUCE AI

> **Know before you commit.** Extensie Chrome (MV3) care arată costul real al unei chirii, înainte să semnezi.

Planul complet: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · progresul: [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md)

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm install` | instalează dependențele |
| `npm test` | testele unitare (motor, contracte, backend, extensie), cu `node --test` |
| `npm run build` | construiește extensia în `dist/extension` |
| `npm run lint` | ESLint |
| `npm run demo-site` | anunțurile fictive pe `http://localhost:5174` |
| `npm run api` | backend-ul local pe `http://localhost:3000` (citește `api/.env`) |
| `npm run eval -- <URL backend>` | evaluarea extragerii AI pe 12 anunțuri fictive (cereri reale, costă credite) |
| `npm run rehearsal` | repetiția demo-ului fără internet (după `npm run build`; cere Chrome/Edge local). Scenariul complet: [DEMO.md](DEMO.md) |
| `node scripts/render-icons.mjs` | regenerează iconițele PNG din `extension/icons/icon.svg` (cere Chrome/Edge local; PNG-urile sunt deja incluse) |

## Încărcarea extensiei în Chrome

1. `npm run build`
2. `chrome://extensions` → activează **Developer mode** → **Load unpacked** → alege `dist/extension`
3. Deschide un anunț (de ex. `http://localhost:5174/anunt-a.html`) și apasă iconița RĂSCRUCE: se deschide panoul lateral.

## Backend-ul AI

- Variabilele sunt descrise în [api/.env.example](api/.env.example). Cheia API stă **doar** pe server.
- Local: copiază `api/.env.example` în `api/.env`, completează cheia și modelul, apoi `npm run api`.
- Extensia află adresa backend-ului la build, din `.env.local` din rădăcină:
  `VITE_API_BASE_URL=http://localhost:3000` (sau URL-ul de producție Vercel). `host_permissions` se generează doar pentru acest domeniu.
- Producție: `vercel deploy --prod`, cu variabilele setate în proiectul Vercel (inclusiv Upstash Redis), o **limită de cheltuieli** setată în consola furnizorului AI și `ALLOWED_ORIGINS` cu ID-ul extensiei. După deploy: `GET /api/health`.
