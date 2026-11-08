# RĂSCRUCE AI: Development Progress

> Context-restore file for future sessions. Source of truth: `IMPLEMENTATION_PLAN.md` (stage table in §12).
> Rules: single developer, local folder only, **no Git**, one stage at a time, wait for `CONTINUE` after each stage.

## Current status
- **Current stage:** Stage 7 (Freeze and rehearsal) is **complete as far as it can be done locally**. **All 8 stages of plan §12 are done.** The codebase is frozen: bug fixes only, each with a regression test.
- **Remaining, user-side only:**
  - deploy the backend and run real AI with `npm run eval -- <URL>`;
  - a live OLX analysis in Chrome;
  - the 2-second readability test with 3 people;
  - the backup video;
  - a timed human rehearsal using `DEMO.md`.
- **Needs the user (outside the codebase):**
  - a Vercel deploy, Upstash Redis, an AI API key, and a spending limit with the AI provider;
  - after that, run `npm run eval -- <URL>`;
  - manual runs on 5 real OLX and 5 real Storia listings in Chrome.
  - See "Stage 2: not verified" and "Stage 3: not verified".

## Roadmap (plan §12)
| # | Stage | Status |
|---|---|---|
| 0 | Foundation: contracts, validation, demo scenario, base engine, `test` script | ✅ |
| 1 | Path to Yes (`engine/pathToYes.js` + tests) | ✅ |
| 2 | Extension and backend skeleton: MV3 manifest, side panel, service worker, `api/` (analyze, health, rate limit, providers), `demo-site/` on :5174 | ✅ (deploy pending, needs the user) |
| 3 | Detective and Questions: readPage + adapters, AI client `analyze()`, question bank, paste/manual/demo modes | ✅ (real AI and real OLX need the user) |
| 4 | Passport, True Cost and confirmations: dashboard, storage sync, `costs.ro.json` | ✅ |
| 5 | Crossroads and Storms: chart, period 1–60, zones, storms, the "Planul" path | ✅ |
| 6 | Polish: consent screen, copy, real-listing testing | ✅ (user-side: the readability test, plus real AI after deploy) |
| 7 | Freeze and rehearsal | ✅ (the video and human rehearsal need the user) |

---

## Stage 0: Foundation ✅
Existed before this session: contracts, schemas (including `enforceEvidence` and `validatePathToYes`), the demo scenario, and the engine (currency, seasons, trueCost, simulate), covered by 40 tests.
**Done in this session:**
- `package.json`: added `"test": "node --test \"extension/src/shared/**/*.test.js\""`.
- `CLAUDE.md`: agent rules from plan §16, plus the user's no-Git rule.

## Stage 1: Path to Yes ✅
**Files**
- New: `extension/src/shared/engine/pathToYes.js`
- New: `extension/src/shared/engine/__tests__/pathToYes.test.js` (9 tests)
- Modified: `extension/src/shared/engine/index.js` (exports), `extension/src/shared/contracts/types.js` (JSDoc note only; the contract is unchanged)

**API**
- `computePathToYes({ passport, apartament, apartamenteSalvate, luni, lunaStart, furtuni }) → PathToYes`. The result is validated with `validatePathToYes`.
- `planSimulationInput(option, sameInput) → SimulationInput`. This is the input for the "Planul" dashed path in Crossroads (Stage 5). It changes exactly one variable.
- `pathToYesHorizons(m, N) → { P, orizontPlan, verificabil }`

**Technical decisions**
- Every option is computed by re-running `simulate()`. No formulas are duplicated.
- How the current plan is checked:
  - If `m < N`, it is checked over the user's N months, the same as `indicatori.sigur` in Crossroads.
  - If `m ≥ N`, it is checked over `m + P` with `P = 12`, because a move whose post-move period was not simulated is never safe (§5.7).
  - If `m + P > 60`, the plan cannot be verified. The result then has no options and an honest message.
- **Postponement (`amanare`):** the smallest `m' > m` that is safe over `m' + P`, where `P = max(N − m, 12)` and `m' + P ≤ 60`.
- **Extra reserve (`rezervaSuplimentara`):** `max_t(prag − S(t))`. This is exact, because adding X to `S0` shifts every `S(t)` by X.
- **Another apartment (`altApartament`):** other saved apartments that are complete and safe under the same move month, horizon and storms.
- **Expense cut (`reducereCheltuieli`):** a binary search for the smallest `d ∈ [1, E]`. There is no option if even `d = E` fails.
- **Message:** if the yearly post-move cash flow without storms is negative, the message warns that an extra reserve only delays the problem. This is an honest-message rule.
- **Option order:** amanare, rezervaSuplimentara, altApartament(s), reducereCheltuieli.

**Tests (all hand-computed from §5.4)**
- **Demo without storms:** both A and B are already safe.
- **Demo with job loss:** A gets postponement `m' = 4` (horizon 16, P = 12), extra reserve 2,700, alternative apartment B, and expense cut 540/month.
- **Postponement trap:** `m' = 4` looks safe over N = 6 but goes negative in winter, so it is rejected. The answer is `m' = 5`.
- **Move after the period:** with `m ≥ N`, the plan is not "already safe" unless the post-move period is verified.
- **60-month cap:** options with `m' + P > 60` are excluded.
- **No solution:** a move that cannot be verified gives no options.
- **Alternative-apartment filters:** incomplete, the same apartment, or unsafe apartments are not proposed.
- **Engine check:** every option, run through `simulate`, satisfies the goal, and the reserve and expense-cut values are minimal (1 RON less fails).
- **Robustness:** incomplete or invalid input is rejected, and the results are deterministic.

**Verification**
- `npm test`: 49/49 pass.
- `npx eslint extension/`: clean.
- `npm run build`: OK. It still builds the template app in `src/`, because the extension build arrives in Stage 2.

**Known limitations**
- `celMaiApropiat` is always `null` in practice. Whenever the plan can be verified, the extra reserve always gives a valid option, so "no option within limits" happens only when the move cannot be verified. In that case there is no closest option to show.
- The storms keep their absolute month indices when the move is postponed. This follows from the plan: the storm months are fixed.

---

## Stage 2: Extension and backend skeleton ✅

### Commands
| Command | What it does |
|---|---|
| `npm test` | 75 tests: engine, contracts, `tests/api`, `tests/extension` |
| `npm run build` | Builds `dist/extension`. This is two Vite builds: the pages and service worker, then the content-script IIFE. |
| `npm run lint` | ESLint |
| `npm run api` | Local backend on :3000, reading `api/.env` |
| `npm run demo-site` | Demo site on :5174 |

### Files
**Removed:** the template app (`src/`, `index.html`, `public/`). §11 allowed this.

**Extension**
- `extension/manifest.json`: MV3, with only `activeTab`, `scripting`, `sidePanel` and `storage`. `host_permissions` is generated at build time from `VITE_API_BASE_URL`.
- `extension/sidepanel.html`, `extension/dashboard.html`: the Vite entry pages.
- `extension/src/config.js`: the backend URL (not a secret), read from `.env.local` via `VITE_API_BASE_URL`.
- `extension/src/background/index.js`: the service worker.
  - It opens the side panel from `action.onClicked`, which also grants activeTab.
  - It generates the install ID on install.
  - It routes `OPEN_DASHBOARD`.
- `extension/src/content/readPage.js` (skeleton: url, title, characters read), `entry.js` (the IIFE exposes `globalThis.__rascruceReadPage`), and `inject.js` (`isInjectable` and `readActiveTab`).
- `extension/src/ai/`
  - `client.js`: `checkHealth()`, which never throws.
  - `errors.js`: the user-facing messages.
  - `redact.js`: `redactContacts` (→ [TELEFON]/[EMAIL]) and `maskAmounts` (→ [SUMĂ]).
- `extension/src/storage/index.js`: get/set, `ensureInstallId`, `onStorageChange`, `clearAllData`.
- `extension/src/ui/`: Tailwind v4 tokens (`styles.css`) and the Brand/Card/Button/Pill components.
- `extension/src/sidepanel/`: AI status (health check → "Analiza AI nu este configurată · mod manual"), the "Citește pagina" button, and a link to the dashboard.
- `extension/src/dashboard/`: navigation skeleton (Passport, Anunțuri salvate, Comparație, Crossroads, Setări).
- `extension/src/shared/contracts/constants.js`: added `AI_TASKS`, `AI_FIELD_STATUSES`, `AI_ERROR_CODES`, `INSTALL_ID_HEADER` and `MAX_STORM_TEXT_CHARS`.

**Backend**
- `api/analyze.js` (POST, OPTIONS) and `api/health.js` (GET, OPTIONS). These are Vercel functions with the Web Request/Response signature.
- `api/_lib/`
  - `config.js`: env only. `AI_MODEL` has **no default**, and Upstash is required in production.
  - `errors.js`: `ApiError` and the HTTP status for each code.
  - `http.js`: CORS, origin filter, `x-install-id` (UUID), client IP, JSON with a size limit.
  - `rateLimit.js`: fixed windows over three levels: IP per minute, install per day, global per day. It uses Upstash REST (INCR + EXPIRE NX in one pipeline) and fails closed. The in-memory store is for tests and local runs only.
  - `validate.js`: layer 1 (requests) and layer 2 (AI responses; invalid fields are demoted to "lipsa", then `enforceEvidence` runs).
  - `outputSchemas.js`: strict JSON schemas, with one union per field. Sentinels are `""` and `"necunoscut"`.
  - `prompts.js`: no calculations, and listing text is treated as data (prompt-injection guard).
  - `tasks.js`: `runTask`, with exactly one retry and a 1 s pause for 429/5xx/network errors. Timeouts are not retried.
  - `handlers.js`: dependency-injected handlers. Logs hold only endpoint, task, ms and code.
  - `providers/anthropic.js`: the official `@anthropic-ai/sdk` (newly added dependency) with `output_config.format` json_schema. It does not use forced `tool_choice`, which recent models reject. Health uses `models.retrieve`. Typed SDK errors map to the error codes.
  - `providers/openaiCompatible.js`: fetch, Chat Completions with strict `response_format`.
- `api/.env.example`

**Other**
- `scripts/dev-api.js`: Node http → Web Request adapter. It loads `api/.env`.
- `demo-site/`: `index.html`, `anunt-a.html`, `anunt-b.html`, `style.css`. "Casa Fictivă" has its own design and does not imitate OLX or Storia. The listing text matches `demoScenario.js` exactly, and every page is labelled "DATE DEMONSTRATIVE".
- `tests/api/backend.test.js` (14 tests), `tests/extension/redact.test.js` (5), `tests/extension/skeleton.test.js` (7).
- Modified: `vite.config.js` (extension build plus manifest plugin), new `vite.content.config.js`, `eslint.config.js` (chrome and node globals), `package.json` (scripts, name), `README.md`, `CLAUDE.md`.

### Technical decisions
- **Content script.** It is built as an IIFE that sets `globalThis.__rascruceReadPage`. The panel then makes a second `executeScript({func})` call to get the result back, because `executeScript({files})` does not reliably return a value from a bundled IIFE. The extension's isolated world persists between injections.
- **AI output fields.** The AI may only use the statuses gasit, neclar and lipsa. A field the AI gets wrong is demoted to "De întrebat" instead of rejecting the whole response. INVALID_RESPONSE is returned only when the structure itself is broken.
- **Order inside `/api/analyze`.** Origin check → install ID → rate limit (before body parsing) → config check → request validation → AI.
- **Server-side redaction.** The server redacts again as a second line of defence: contacts for `extract`, amounts for `storm`.
- **Storm text.** `maskAmounts` masks numbers that carry a currency or have 3+ digits. Small numbers stay ("2 luni", "10%") because the AI must classify duration.
- **Storm AI output.** `{tip, start, durata}`, where `start` is a **calendar month 1–12**. The client will map it to a simulation month index t using `lunaStart` (Stage 5).
- **Extension AI status.** `checkHealth` runs when the panel opens. If it fails, the panel shows "Analiza AI nu este configurată" and switches to manual mode.

### Verification
- `npm test`: **75/75 pass**. `npm run lint`: clean. `npm run build`: OK.
- **Real servers.** The demo site serves on :5174 (200s and correct text). The local API:
  - health without config returns 503 AI_UNAVAILABLE;
  - a request without an install ID returns 400;
  - a bad origin returns 403;
  - the OPTIONS preflight returns 204 with CORS headers;
  - the logs contain no listing text.
- **Chromium smoke test.** I ran headless Edge 157 with `--load-extension=dist/extension` and drove it over the DevTools protocol:
  - the service worker starts, and the manifest permissions are the minimal four;
  - the install ID is generated, and `openPanelOnActionClick` is false;
  - `sidepanel.html` and `dashboard.html` render, and the panel shows "Analiza AI nu este configurată · mod manual";
  - the built content script, evaluated on `localhost:5174/anunt-a.html`, returns the URL, title and 448 characters.
  - All temporary files were inside `.tmp/` and have been deleted.

### Stage 2: not verified (needs the user)
- **Vercel and real AI.** I have not deployed to Vercel and have not made any real AI request. The Anthropic adapter is tested against a fake SDK client only. Whether this model accepts the extraction schema (11 `anyOf` unions) needs the first real `/api/health` and extract call.
- **Production setup.** Upstash credentials, the provider spending limit, and `ALLOWED_ORIGINS` containing the real extension ID.
- **Manual clicks in Chrome.** A real click on the action icon (opening the panel and granting activeTab) and "Citește pagina" on a tab. The headless test could not simulate the user gesture.
- **Vercel build settings.** Vercel will detect Vite and run `npm run build`. That is harmless, but you may set the project's output directory, or ignore it, since only `api/` matters.

### Known limitations
- The phone regex may swallow a short number directly after a phone (e.g. "0722 123 456 2 camere" → "[TELEFON] camere").
- There are no extension icons yet (Chrome shows a letter icon). This is planned for Stage 6 polish.
- The `refusal` stop reason is mapped to AI_UNAVAILABLE, which sends the user to manual mode. Server-side refusal `fallbacks` are not enabled, because the model is env-configurable and the beta parameter is model-specific.

## Stage 3: Detective and Questions ✅

### What the user can do (side panel)
- **Analyse the current page:**
  - The panel reads the page, sends it to AI (consent is asked the first time), runs validation and the evidence check, and shows each field as Găsit / Neclar / De întrebat with the quoted evidence.
  - It also lists questions and a message for the landlord.
- **Pages that can't be read:** on pages where injection is not allowed (chrome://, Web Store, PDF), the paste form opens directly with an explanation.
- **Paste the listing text:** works at any time. A note says phones and emails are hidden automatically.
- **Fill in manually:** all fields start as "De întrebat". Every field has an inline editor, "Ce ți-a răspuns proprietarul?", where the user enters a value plus Confirmat de proprietar / Presupunerea mea and an optional note. The questions and message refresh after each answer.
- **Fewer than 300 characters read:** the analysis runs anyway and shows the "Vezi mai mult / lipește / completează manual" hint.
- **AI errors:**
  - Any AI error leads to manual mode, with all fields "De întrebat", template questions, and the right reason.
  - "Analiza AI nu este configurată…" appears when health failed, "…disponibilă acum…" for other errors, and a dedicated message for rate limiting.
- **Demo mode** is a checkbox in the panel:
  - It uses recorded responses for demo A and B, makes no network requests, and labels results "DATE DEMONSTRATIVE".
  - Text that is not a demo listing goes to manual mode with an explanation.
- **Questions tab:** numbered questions with the fields they cover. The landlord message is editable and has Copy and "Formulează cu AI" buttons.
- **Persistence:** the last analysis stays in `chrome.storage.local` (`analizaCurenta`) and survives closing and reopening the panel.

### Files
**Page reading** (`extension/src/content/`)
- `text.js`: cleaning, entity decoding, inert HTML-to-text (regex, no DOM), the 15,000 cap.
- `structured.js`: ld+json Product/Offer/Apartment… (including `@graph`), plus `og:title`, `og:description` and `og:price:*`.
- `adapters/storia.js`:
  - It reads `data-cy` title and price, plus `__NEXT_DATA__` (full description and `rent`/`deposit`/area/floor/heating, with values translated to Romanian).
  - Real Storia pages leave the description `data-cy` element empty until the page hydrates, so `__NEXT_DATA__` is the main source. This also covers the collapsed "Vezi mai mult" description.
- `adapters/olx.js`: unverified on real pages (see below).
- `readPage.js`: the order is structured data → adapter (try/catch, automatic fallback) → generic text from the richest `main`/`article`, else `body`. It returns `{url, titlu, pret, text, caractereCitite, metoda, scurt}`.

**AI, demo and questions**
- `extension/src/ai/client.js`: `prepareListingText` (15k cap + redaction), `extractListing`, `composeLandlordMessage` (with the `x-install-id` header and a 50 s timeout), `checkHealth`. None of them throw.
- `extension/src/ai/detective.js`:
  - `runDetective` covers the ai / demo / manual modes and runs client-side `validateListingAnalysis` + `enforceEvidence` (layer 3).
  - `buildQuestions` returns an AI message or falls back to the template.
- `extension/src/ai/errors.js`: `manualReason`.
- `extension/src/demo/index.js`: recorded analyses, recognised by a characteristic sentence from the listing.
- `extension/src/shared/fields.js`: `FIELD_TITLES`, `FIELD_LABELS` (now also used by the backend prompts) and `formatFieldValue`.
- `extension/src/shared/contracts/factories.js`: `emptyField`, `createListingAnalysis`, `setUserValue` (statuses confirmat/presupus only, validated), `clearField`.
- `data/questions.ro.json`: the human-written question bank. Each field has a "lipsa" and a "neclar" wording, the two maintenance fields form one group, and it includes the message template.
- `extension/src/shared/questions/index.js`: `questionsFor` (grouping; "lipsa" wins), `askedFields`, `templateMessage`. The JSON is imported with `with { type: 'json' }`, which works in both Node and Vite.

**UI and storage**
- `extension/src/sidepanel/`: `App.jsx` (flow), `FieldList.jsx` (rows and editor), `Panels.jsx` (ConsentCard, PasteForm, QuestionsView), `fieldInput.js` (Romanian number parsing such as „1.950”, „1 950”, „350,5”).
- `extension/src/ui/`: `status.js`, plus StatusBadge, DemoBadge and Notice in `components.jsx`.
- `extension/src/storage/index.js`: `SETTINGS` (`{modDemo, acordAI}`), `getSettings`, `updateSettings`, `CURRENT_ANALYSIS`.

**Evaluation**
- `data/fixtures/listings/eval.ro.json`: 10 fictional listings with expected results, plus demo A and B, for 12 in total.
- `tests/eval/run.js` (`npm run eval -- <URL>`) and `tests/eval/cases.js`.

**Changed and dev-only**
- Changed: `api/_lib/prompts.js` now imports `FIELD_LABELS` from the shared module.
- New devDependency: `linkedom`, a DOM for tests only.

### Technical decisions
- **Consent screen.** It is implemented now (plan §9; Stage 6 only polishes it). It appears only when the AI is reachable and the user has not consented yet. "Completez manual" continues in manual mode without saving consent.
- **Known AI outage.** If `/api/health` already failed, the Detective goes straight to manual mode with the real reason (`aiIndisponibil`). It does not call the AI again, and the user doesn't see a misleading "consent" message.
- **Evidence on the client.** It is checked against the **redacted** text that was actually sent.
- **Demo mode.** It never touches the network. The landlord message in demo mode is the template.
- **Manual-fill source.** It is saved as `sursa.tip: 'text_lipit'` with `url: null`, because the contract has no "manual" source type.
- **Editing a field.** It regenerates the questions and the template message, overwriting manual message edits. "Formulează cu AI" re-asks the AI on demand.

### Verification
- **Tests:** `npm test` passes **98/98**: engine, contracts, backend, readPage (synthetic Storia/OLX/ld+json pages and the demo pages), questions, Detective modes, factories, editor parsing, AI client, eval fixtures, and 2 client↔backend integration tests. `npm run lint` is clean and `npm run build` is OK.
- **Real Storia:** I ran `readPage` on **5 real storia.ro listings** (downloaded temporarily, then deleted). All 5 used the adapter (528–1,217 characters each) with title, price, details including `rent`/`deposit`, and the full description. With the hooks removed, it falls back to the generic text.
- **Browser E2E 1** (headless Edge 157, built extension, no backend), 15/15 PASS:
  - AI not configured → manual pill;
  - demo mode → paste demo A → "DATE DEMONSTRATIVE", "Găsit 6 · Neclar 0 · De întrebat 5", evidence quote shown, 4 questions plus the template message;
  - answering Comision with 0 RON (confirmed) → "Confirmat", and the question count drops to 3;
  - after a reload the analysis persists;
  - non-demo text → manual mode with the real reason plus the short-text hint;
  - "Analizează pagina curentă" on a chrome-extension:// page → paste form.
- **Browser E2E 2** (the extension built against a temporary mock server running the **real** backend handlers with a fake AI provider, and the real extension origin in `ALLOWED_ORIGINS`), 12/12 PASS:
  - health OK, then the consent screen appears, and "Continuă cu AI" stays disabled until the box is ticked;
  - after consent, the analysis runs in AI mode;
  - evidence and an invented-evidence downgrade are shown;
  - the AI-formulated message appears;
  - the backend log shows the phone arrived as `[TELEFON]`;
  - consent is remembered.
- The temporary test harness (`.tmp/`) was deleted, the extension was rebuilt without the mock URL (`host_permissions: []`), and no test processes are left running.

### Stage 3: not verified (needs the user)
- **Real AI.** Real AI extraction on the eval set: `npm run eval -- <URL>` after deploy. The target is 0 "gasit" fields without valid evidence. This also confirms the structured-output schema with the chosen model.
- **OLX.**
  - The adapter is **unverified**: olx.ro returns 403 to automated requests.
  - If its selectors are wrong, the generic fallback still reads the page (structured data plus `main`/`body` text).
  - It needs manual checks on 5 real OLX listings in Chrome.
- **Real Chrome clicks.** A real click on the icon, then "Analizează pagina curentă", on real OLX and Storia tabs (the activeTab grant needs a user gesture). The plan's success criterion is 5 OLX, 5 Storia and localhost.

### Known limitations
- Generic fallback on big portals includes navigation noise (it is capped at 15k). The AI only cites evidence, so noise costs tokens but not correctness.
- Manual edits to the landlord message are lost when a field is edited afterwards.
- There is no save-listing button yet (Stage 4).

## Stage 4: Passport, True Cost and confirmations ✅

### What the user can do
- **Financial Passport** (dashboard): the 7 amounts in whole lei, the move month (0–60, "0 = luna aceasta") and the goal. Help text explains that essential expenses exclude housing and transport. Everything is validated and stays only in `chrome.storage.local`.
- **EUR → RON rate** (dashboard, next to the Passport): entered explicitly, with source 'utilizator' and a date. It can be deleted. There is no default. The demo rate is shown as "FICTIV".
- **Saving listings:** "Salvează anunțul" in the panel, then "Salvat în dashboard". There is a limit of 10. Saving the same id again updates it and keeps the user's costs.
- **Saved listings** (dashboard):
  - Each card shows summer/winter cost, the average, the move payment, and "incomplet" / "peste buget" / "cu estimări" badges.
  - Delete asks for confirmation.
  - Each listing's detail view has two tabs:
    - **Cost real:** the True Cost view plus a form for the user's costs (transport, other costs, move costs; an empty box means the documented rule applies).
    - **Informații și confirmări:** the same field editor as the panel.
- **True Cost view** (shared by panel and dashboard):
  - totals: summer and winter monthly cost, the move payment excluding the first rent, and the recoverable deposit;
  - every amount shows its source (din anunț / confirmat de proprietar / presupus / introdus de tine / estimare / inclus în chirie), its EUR conversion ("350 EUR × 5") and, for estimates, its range;
  - the budget warning and the estimates warning;
  - the CHIRIE_LIPSA / CURS_LIPSA explanations;
  - a "Ipoteze și surse" expander.
- **Panel "Cost real" tab:** for an unsaved analysis it uses empty user costs, with a hint to save. If there is no Passport it shows a link to the dashboard.
- **Comparison** (dashboard):
  - a table covering only the user's saved listings, with the cheapest highlighted;
  - sentences of the form "Dintre anunțurile tale salvate, X are cel mai mic cost lunar estimat…", "…cere cea mai mică plată la mutare…" and "X depășește bugetul tău maxim de chirie."
  - The average is 7 summer months plus 5 winter months. There are no market claims.
- **Settings:**
  - the demo-mode toggle;
  - "Încarcă scenariul demonstrativ", which confirms first and then loads the fictional Passport, demo rate, listings A and B, and demo mode;
  - the AI consent status, with "Retrage acordul";
  - "Șterge toate datele", which confirms first and then clears `chrome.storage.local`.
- **Automatic recalculation and sync:**
  - True Cost and the comparison are derived (`app/derive.js`, `useMemo`) from `{passport, curs, anunțuri, setări}` and are never stored.
  - `useAppData` subscribes to `chrome.storage.onChanged`, so the panel and dashboard update live.
  - For a saved listing, the panel shows the **saved version** (derived, not copied), so dashboard confirmations appear in the panel. Panel confirmations are written to the saved listing too.

### Files
**Data and engine**
- `data/costs.ro.json`: reference ranges with 4 press sources (URLs).
  - Utilities and maintenance: summer 250–550 and winter 500–900 RON.
  - Deposit: 1–2 rents. Commission: 50–100% of one rent.
  - `verificat: false`, because these are press estimates that need human confirmation.
- `extension/src/shared/costReference.js`: `costReferenceRo` (validated) and `costReferenceFor({modDemo})`. Demo mode uses the fictional demo ranges, so the presentation numbers match §10.
- `extension/src/shared/engine/compare.js`: `averageMonthlyCost` and `compareSavedListings`. Ties produce no winner, and incomplete listings are reported separately.

**Storage and derivation**
- `extension/src/storage/appData.js`: `savePassport`, `saveExchangeRate`, `clearExchangeRate`, `saveListing`, `updateSavedAnalysis`, `updateUserCosts`, `removeSavedListing`, `loadDemoScenario`. Every write is validated against the contracts.
- `extension/src/storage/useAppData.js`: a React hook (load, then `onChanged`).
- `extension/src/app/derive.js`: `costContext`, `trueCostOf` (safe, also for unsaved analyses), `deriveAll`.

**UI**
- `extension/src/ui/TrueCostView.jsx` and `ui/format.js` (`formatRON`, `SOURCE_LABELS`, `INCOMPLETE_MESSAGES`, `costItemDetails`).
- Moved: `sidepanel/FieldList.jsx` and `fieldInput.js` are now in `ui/`, shared by panel and dashboard.
- `extension/src/dashboard/`: `App.jsx`, `PassportSection.jsx`, `ListingsSection.jsx`, `OtherSections.jsx` (Comparison, Settings), `forms.js` (pure form parsing for Romanian numbers).
- `extension/src/sidepanel/App.jsx`: `useAppData`, the Save button, the Cost real tab, and the derived `shown` result.

**Tests**
- `extension/src/shared/engine/__tests__/compare.test.js` (4) and `tests/extension/appData.test.js` (8, with a fake `chrome.storage` including `onChanged`).

### Technical decisions
- **Estimate ranges:** demo mode uses the demo ranges, so the §10 table numbers stay exact. Normal mode uses `costs.ro.json`; for example, A's utilities estimate becomes 550/900 instead of 450/900.
- **Comparison metric:** "cel mai mic cost lunar estimat" is the yearly average monthly cost, (7 × summer + 5 × winter) / 12, following the §5.4 season definition. "Which is safer" is left to Crossroads in Stage 5.
- **Passport required for costs:** True Cost needs the Passport (the presumed transport and the budget). Without it, the UI asks for it and does not use a guessed default.
- **Panel ↔ dashboard sync:** the panel's displayed result is derived from the saved listing. A `setState` inside an effect was rejected by the React lint rule and was the wrong design anyway.

### Verification
- **Tests:** `npm test` passes **110/110**. `npm run lint` is clean. `npm run build` is OK, with `host_permissions: []` and no API URL.
- **Browser E2E** (headless Edge, the real extension, dashboard and panel open at the same time), **25/25 PASS**:
  - the empty dashboard;
  - loading the demo scenario (Passport, the FICTIV rate, the DEMO label);
  - A at 2,500/2,950 with 6,750 at the move and B at 2,350/2,450 with 3,450 (the §10 numbers);
  - the comparison sentence for B (2,392 RON average), with no market claims;
  - A's detail: "350 EUR × 5", the commission range 875–1,750, 2 × rent, assumptions and sources;
  - confirming commission = 0 in the dashboard → 5,000 at the move, sourced "confirmat de proprietar";
  - transport 100 → A summer 2,350;
  - budget 1,900 → B "peste buget";
  - in the panel, a new demo B analysis → Cost real (presumed transport) and the budget warning "cu 50 RON";
  - saving it → the dashboard shows "(3)" live;
  - a confirmation made in the panel reaches the saved listing, and one made in the dashboard appears live in the panel;
  - "Șterge toate datele" → storage is empty, the dashboard is empty, and the panel is back home.
  - All temporary files (`.tmp/`) were deleted, and no test processes are left running.

### Known limitations
- `costs.ro.json` ranges are press estimates (`verificat: false`) and should be confirmed by a human.
- The ranges are national and do not depend on city or flat size.
- Native `window.confirm` dialogs are used for destructive actions; they could be replaced with styled dialogs in Stage 6.
- There is no simulation settings UI yet (period, start month); that is Stage 5.

## Stage 5: Crossroads and Storms ✅

### What the user can do
- **Crossroads in the dashboard** (a "Crossroads" section):
  - **Controls:**
    - period quick buttons 3/6/12/18/24 plus a validated 1–60 field (an invalid value shows an error and is not saved);
    - the start month (calendar month);
    - the move month (0–60; edits the Passport, so it recalculates live);
    - when more than 2 listings are saved, a choice of road A and road B.
  - **Chart** (custom SVG, no chart library), drawn only from `simulate()`, `computePathToYes()` and `planSimulationInput()`:
    - roads A and B;
    - the red zone below 0 and the yellow band below the minimum reserve;
    - the "Mutare" marker and, if the plan postpones the move, "Mutare (Planul)";
    - the "Luna X (mai): banii disponibili devin negativi (A)" marker, with the minimum balance in the indicators;
    - the locked deposit as separate bands under the axis ("Garanție blocată A: 3.500 RON");
    - a budget marker (triangle) plus the budget warning from that month;
    - month ticks monthly up to 12, every 3 months up to 24, every 6 beyond;
    - a hover/keyboard tooltip per month: balance, income, housing cost and phase, upfront costs, unexpected expenses, locked deposit, active storms.
  - **Path to Yes:**
    - each unsafe road gets a card with the engine's options in plain language, for example "Amână mutarea cu 2 luni / Mutare în Luna 5 · mai. Verificat pe 12 luni după mutare.", "Strânge încă 2.700 RON…", "Alege B… / Dintre anunțurile tale salvate…" and "Redu cheltuielile… / Doar dacă e realist".
    - Clicking an option makes it the dashed **"Planul"** road.
    - Postponement extends the chart to m' + P, with the note "verificat pe P luni după mutare".
    - Safe roads show the engine's message.
  - **Indicators table:** state (sigur/nesigur), minimum balance with its month, final balance, savings until the move, and the move payment.
  - **Warnings:** the simulation's own warnings (estimates, long horizon > 12, budget, move after the period) and an "Ipoteze" expander.
- **Financial Storms:**
  - Buttons for Pierderea venitului (start month, duration, %), Cheltuială neprevăzută (month, amount) and Creșterea chiriei (start month, %). Each opens a form with sensible defaults, and the value is validated with `validateStorm`.
  - **Free text:** a 500-character limit and the exact notice "Nu include date personale; sumele sunt eliminate automat înainte de trimitere."
    - The text is sent with amounts masked (`maskAmounts`) through `classifyStormText` (task `storm`).
    - The AI's `{tip, start (calendar month), durata}` **pre-fills the form**. The calendar month becomes t via `lunaStart`, and the user enters the amounts.
    - An inline consent checkbox appears if AI consent wasn't given yet.
    - Demo mode uses a recorded classification for „Îmi pierd jobul 2 luni, din aprilie.”, with no network.
    - Anything that fails tells the user to use the buttons.
  - The active storms are listed with remove and "Șterge toate". They apply identically to all roads.
- **Compact Crossroads in the panel** (a "Crossroads" tab):
  - the current listing's road (the saved version if it is saved, otherwise empty user costs) plus its "Planul";
  - safe/unsafe and storm-count pills;
  - the negative-month notice;
  - a "Crossroads complet…" button to the dashboard.
- **Live updates:** changing the period, start month, move month, listing, Passport, confirmations, rate or storms recalculates instantly. Storms changed in the dashboard update the panel live.
- **Consent text:** it now also mentions storm text, as listed in §9.

### Files
**Model and chart** (`extension/src/crossroads/`)
- `scales.js`: `tickStep`, `monthTicks`, `monthLabel`, `linearScale`, `niceStep`, `moneyDomain`.
- `model.js`: `buildCrossroads`, `selectPaths`, `describeOption`, `calendarMonthToT`, `negativeLabel`, `pathName`, and the colours.
- `storms.js`: `STORM_TITLES`, `defaultStormValues`, `makeStorm`, `describeStorm`, `prefillFromClassification`.
- `inputs.js`: `QUICK_PERIODS`, `parsePeriod`, `parseMoveMonth`.
- Components:
  - `parts.jsx`: DangerZone, Path, PlanPath, MoveMarker, NegativeMarker, BudgetMarker, DepositBand.
  - `Crossroads.jsx`: the chart, the tooltip and the legend.
  - `Controls.jsx`, `StormsPanel.jsx`, `CrossroadsSection.jsx` (the dashboard section) and `CompactCrossroads.jsx` (the panel tab).

**Storage, AI client and demo**
- `extension/src/storage/appData.js`:
  - `DATA_KEYS.SIM_SETTINGS` (`setariSimulare`) and `DATA_KEYS.STORMS` (`furtuni`);
  - `defaultSimSettings`, `validateSimSettings`, `saveSimSettings`, `addStorm`, `removeStorm`, `clearStorms`.
  - `loadDemoScenario` now also sets 12 months from January for A and B, with no storms.
- `useAppData.js`: now also returns `simSettings` and `storms`.
- `extension/src/ai/client.js`: `classifyStormText`.
- `extension/src/demo/index.js`: `DEMO_STORM_TEXT` and `findRecordedStorm`.

**Wiring and tests**
- `dashboard/App.jsx` wires the Crossroads section. `sidepanel/App.jsx` adds the Crossroads tab, and `Panels.jsx` has the updated consent wording.
- `tests/extension/crossroads.test.js` (11 tests, values computed by hand) and an updated `appData.test.js`.

### Technical decisions
- **Plain SVG.** The chart is plain React SVG instead of a chart library: a small bundle (dashboard JS 29.6 kB), full control over the zones, markers and bands, and everything is derived from `SimulationResult`.
- **Simulation settings are stored** (`setariSimulare`); storms are stored as user inputs. Everything else is derived and never stored.
- **The "Planul" choice is UI state, not stored.** By default it is the first option of the first unsafe road, which for the demo is postponement to month 4, verified over 16 months. That matches the Stage 1 hand calculation.
- **Storms from free text.** The AI never supplies amounts. Its classification only pre-fills a form that the user reviews and submits.
- **Panel road for an unsaved analysis.** It uses empty user costs (presumed transport, no move costs), so it can differ from the saved version until the listing is saved and its costs are filled in.
- **Visual check.** I reviewed screenshots of the dashboard and panel; this found and fixed a cramped Indicators table (now full width) and a duplicated "A · A ·" legend (`pathName`).

### Verification
- **Tests:** `npm test` passes **121/121**. `npm run lint` is clean. `npm run build` is OK, with `host_permissions: []`.
- **Unit checks (hand-computed):**
  - demo without storms: both roads safe, no plan;
  - with the job-loss storm: A's balances match `demoExpected` (−1,700 in May), B is safe, and A's 4 options read correctly;
  - the default Planul is postponement to month 4 over 16 months, with a minimum of 2,650;
  - the reserve plan has a minimum of exactly 1,000; the alternative-apartment plan equals B's road; the expense-cut plan is 1,000 in May;
  - periods of 1 and 60 months, the move after the period, rent increase over budget, the no-Passport and no-complete-listing states, road selection, ticks and labels;
  - storm building and pre-fill, the recorded demo storm reproducing `demoStormJobLoss`, storm text masked before sending, input parsing, and storage validation.
- **Browser E2E** (headless Edge, real extension, dashboard and panel together), **25/25 PASS**:
  - demo load, then Crossroads at 12 months with the DEMO label;
  - both roads safe with no dashed line; 2 roads, Mutare, and deposit bands of 3,500 and 1,950;
  - the storm button → the storm listed, "Luna 5 (mai): banii disponibili devin negativi (A)", the 4 Path to Yes options, the dashed Planul extended to 16 with "verificat pe 12 luni", and "Mutare (Planul)";
  - the month-5 tooltip shows −1,700 and the storm; choosing "Strânge 2.700" switches the Planul;
  - 24 months gives ticks every 3 and the long-horizon warning; 61 is rejected and 60 is accepted;
  - move month 6 gives 8,500 saved by the move;
  - free text (demo) pre-fills the form and reproduces the scenario;
  - the panel's compact view is "nesigur" with the storm and Planul, no duplicated legend letter, and one road plus Planul;
  - removing the storms in the dashboard updates the panel live to "sigur".
  - Temporary files (`.tmp/`) were deleted and no test processes are left running.

### Known limitations
- The real AI storm classification is untested end to end until the backend is deployed. Demo mode and fake-fetch tests cover the flow.
- The chart is responsive through `viewBox`. On very narrow widths the long negative-month label can crowd the chart; the panel uses the compact variant, which omits that label and shows it as a notice.
- The Planul choice resets when the dashboard is reopened (by design, because it is not stored).

## Stage 6: Polish ✅

### Done
- **Extension icons.**
  - `extension/icons/icon.svg` is the source: a fork in the road, with the green branch as the safe path.
  - `icon-16/32/48/128.png` are generated with `scripts/render-icons.mjs` (headless Edge/Chrome, a dev tool only; the PNGs are checked in).
  - The manifest has `icons` and `action.default_icon`, and the Vite manifest plugin emits the PNGs into `dist/extension/icons/`.
  - I checked the 16 px and 128 px renders visually.
- **Styled confirm dialogs.**
  - `ui/ConfirmDialog.jsx` uses the native `<dialog>` (modal, Esc cancels, focus starts on "Renunță"), and `ui/useConfirm.jsx` is a promise-based hook.
  - They replace all three `window.confirm` calls: load the demo scenario, delete a listing (with its title, styled as a danger action), and delete all data.
- **Copy and numbers.**
  - Engine messages now use Romanian thousands grouping through `shared/engine/format.js` (`ron()`), used in `trueCost`, `simulate`, `pathToYes` and `compare`. For example, "Chiria (1.950 RON) depășește bugetul tău maxim (1.900 RON) cu 50 RON." and "scad sub 1.000 RON".
  - A diacritics audit across all source, data and HTML files found no cedilla ş/ţ.
  - An unsafe-HTML audit found no `dangerouslySetInnerHTML`, `innerHTML` or `eval` in the extension source.
- **Consent screen.** It is restructured into two clear blocks, "Trimitem la serviciul AI doar:" and "Rămân doar în browserul tău:", plus a note that consent can be withdrawn in Setări.
- **Narrow screens (400 px).**
  - The page used to scroll sideways. The fix is `minmax(0,1fr)` / `min-w-0` grids and `p-4 sm:p-6` padding.
  - The Crossroads chart now switches automatically to its compact layout when the container is narrower than 560 px (ResizeObserver), so its labels stay readable.
  - The wide Indicators table scrolls inside its own card.
- **Accessibility and motion.**
  - A visible `:focus-visible` outline on buttons, inputs, summaries and the chart's focusable months.
  - A light fade-in on dashboard section changes, new panel results and Crossroads scenario changes. It is disabled under `prefers-reduced-motion`.
- **OLX adapter verified on real pages.** In a real browser engine (headless Edge, not disguised), the **built** content script on **5 real OLX listings** (Cluj, November 2026) used the OLX adapter **5/5**, with title, price, parameters and description. 4/5 had enough text; one listing has a genuinely short description (194 characters), so the "Vezi mai mult" hint is correct. The adapter comment was updated.

### Verification
- **Tests:** `npm test` passes **121/121**. The manifest test now also checks that every icon referenced exists and is a real PNG. `npm run lint` is clean and `npm run build` is OK (icons emitted).
- **Browser E2E** (headless Edge, real extension, 400 px wide), **13/13 PASS**:
  - the manifest icons;
  - the styled modal opens, "Renunță" has no effect, and "Încarcă scenariul" confirms;
  - no sideways page scroll on Passport, Anunțuri, Comparație and Crossroads, including with a storm;
  - the delete dialog shows the listing title, and Esc cancels it;
  - the panel at 400 px has no sideways scroll.
  - I also reviewed the dialog and narrow-Crossroads screenshots.
- **Real-listing totals** (plan §4 criterion, 5 OLX + 5 Storia + localhost):
  - **OLX** 5/5 in a real browser engine (this stage);
  - **Storia** 5/5 on real page HTML (Stage 3);
  - **localhost** demo pages (Stages 2–3).
- All temporary files were deleted, and no test processes are left running.

### Not verified / honest notes
- **Storia blocks headless browsers** at its CDN ("The request could not be satisfied"), so in this stage the Storia check could not run in a browser engine. The earlier check on real Storia HTML stands. A normal Chrome user is not affected.
- **OLX rate-limits repeated automated visits.** A second automated run got no listing links back, so I stopped instead of retrying against their protection. The 5/5 result comes from the first run.
- **Real AI extraction** on real listings still needs the deployed backend: `npm run eval -- <URL>`, then analyse a real OLX listing end to end in Chrome.
- **The plan's 2-second readability test** of Crossroads with 3 people (§13) is for you to run.

## Stage 7: Freeze and rehearsal ✅

### Bug fix (found by walking through the demo as the presenter)
- **Symptom:** after "Încarcă scenariul demonstrativ", analysing demo listing A in the panel produced a **new random id**.
  - The panel treated it as an unsaved listing.
  - Its Cost real and Crossroads used empty user costs, showing 2,350 RON summer instead of the plan's **2,500**.
  - "Salvează anunțul" would have created a duplicate A.
  - On stage, the panel and dashboard would have shown different numbers for the same flat.
- **Fix** (`extension/src/ai/detective.js`): a recorded demo analysis keeps the fixture id (`demo-a` / `demo-b`), so it **is** the saved demo listing.
- **Regression test** (`tests/extension/detective.test.js`): it failed before the fix (`id-1` instead of `demo-a`) and passes after it.

### Offline rehearsal tool
- **`scripts/rehearsal.mjs`** (`npm run rehearsal`, after `npm run build`) runs the presentation script in headless Chrome/Edge with the built extension.
  - **Every page is set offline before it loads** (`Network.emulateNetworkConditions`), and every network request is logged.
  - It runs 9 timed steps:
    1. load the demo via the dialog;
    2. the panel analysis of A (DEMO label, Găsit 6 · Neclar 0 · De întrebat 5, "Salvat în dashboard", 4 questions);
    3. the panel Cost real (2,500 / 2,950 / 6,750);
    4. the comparison sentence for B (2,392);
    5. Crossroads with both roads safe;
    6. the recorded free-text storm, putting A negative in May;
    7. Path to Yes with 4 options, where "Strânge încă 2.700 RON" becomes the Planul;
    8. the panel's compact Crossroads updated live;
    9. **zero external network requests**.
  - It uses its own temporary browser profile inside the project and deletes it afterwards (`.rehearsal-profile-*`, also in `.gitignore`).
- **Result: 9/9 PASS**, with 15 requests, all `chrome-extension:`, in about 10.6 s automated. It is the plan's "test fără internet" in a repeatable form. The panel now matches the plan's numbers, confirming the fix.

### Demo script
- **`DEMO.md`** (Romanian, for the presenter):
  - preparation checklists (the day before, and 30 minutes before, including `npm run rehearsal`);
  - a **timed 4-minute run-of-show** with what to show and what to say, using the plan's wording ("Dintre anunțurile tale salvate, B este mai sigur");
  - a fallback table (no internet or AI, page not readable, wrong numbers, storm not parsed, extension won't start → video);
  - likely jury questions with answers;
  - the demo numbers for a quick check.
- `README.md` and `CLAUDE.md` now point to `npm run rehearsal`, `DEMO.md` and the freeze rule.

### Verification
- `npm test` passes **121/121**, `npm run lint` is clean, `npm run build` is OK, and `npm run rehearsal` passes **9/9 offline**.
- A freeze sweep found no TODO, FIXME or stray `console.log` in the extension or API source; the only console output is the backend's intended structured log.
- No temporary profiles or browser processes are left behind.

### Post-freeze fix: health check false positive (found while testing with Gemini)
- **Symptom:** with `AI_PROVIDER=openai` and Gemini, `/api/health` said OK, so the panel showed "Analiza AI disponibilă", but every analysis fell back to "Analiza AI nu este configurată".
  - Cause: Gemini still **lists** `gemini-2.5-flash` at `/models/{id}`, but answers requests with 404 "no longer available to new users".
- **Fix** (`api/_lib/providers/openaiCompatible.js`): `checkModel()` now sends a tiny real `chat/completions` request (16 tokens) instead of trusting the model list. The Anthropic adapter keeps `models.retrieve`.
- **Regression test:** added to `tests/api/backend.test.js`.
- **The user's local config** (`api/.env`, not in Git) was changed:
  - `AI_MODEL=gemini-3.6-flash`. Gemini 3.8 and 3.7 Flash were overloaded on the free tier (503s and 45 s timeouts), while 3.6 Flash answered a tiny request in ~2.6 s;
  - `AI_TIMEOUT_MS=45000` and `AI_MAX_OUTPUT_TOKENS=8000`, because Gemini 3.8 Flash thinks before answering, which is slow, and its thinking uses up the output budget.
- **Verified:** `gemini-3.6-flash` accepts the strict extraction schema (HTTP 200) and extracted demo listing B correctly, with an exact quote for every value. It also wrote the landlord message. Retry the check with `node .tmp/diag-gemini.mjs`.

### Post-freeze feature: automatic BNR EUR → RON rate (requested by the user)
- **Source:** `https://www.cursbnr.ro/api/v1/rates?currency=EUR` → `{"date":"2026-11-06","quote":"RON","rates":{"EUR":5.3408}}`. It sends CORS `*` and allows 30 requests per window.
- **No duplicate logic:** the downloaded rate is saved into the existing `cursEur` key as `ExchangeRate { sursa: 'bnr', dataPublicarii }`. The engine (`toRON`), True Cost (rent, deposit, monthly costs), comparison, Crossroads and Path to Yes all pick it up unchanged.
- **New files:**
  - `extension/src/rates/bnrRate.js`: pure functions (parse, the expected publication date in Bucharest time, `needsRefresh`, `isPossiblyOutdated`);
  - `refreshBnrRate` / `switchToBnrRate` in `storage/appData.js` (status in `cursStare`);
  - the `useBnrRateRefresh` hook (panel and dashboard; on open and every 15 min);
  - `ui/RateInfo.jsx`.
- **Rules:**
  - refresh when the stored rate is older than the expected publication date (weekdays after 13:30), with at least 30 min between attempts;
  - on weekends and holidays, the previous rate stays valid;
  - on failure, the last valid rate is kept and labelled "posibil depășit";
  - a user-entered rate takes priority (dashboard button "Folosește cursul BNR automat" switches back);
  - demo mode makes no request;
  - no hardcoded rate: without any rate, EUR listings still show `CURS_LIPSA`.
- **UI:**
  - the rate and its publication date appear under every True Cost (panel and dashboard) and on the Passport rate card;
  - rent and deposit in RON show "≈ N EUR";
  - EUR amounts show "350 EUR × 5,3408";
  - listing cards show "Chirie 1.869 RON (≈ 350 EUR)".
  - Rates are formatted with 4 decimals (`formatRate`); a test caught that the 2-decimal formatter was showing 5,34.
- **Manifest:** `host_permissions` now includes `https://www.cursbnr.ro/*`; `buildManifest` merges it with the backend origin.
- **Bug found and fixed along the way:**
  - the panel's `/api/health` check fired on the first render, before settings loaded (`modDemo` defaulted to false), so one request went out even in demo mode;
  - it now waits for `data.loaded`;
  - regression: `npm run rehearsal` step 9 now separates requests sent before demo mode (only BNR and `/api/health` allowed) from those sent in demo mode (none allowed).
- **Verified:**
  - `npm test` 132/132 (new `tests/extension/bnrRate.test.js`), lint clean, build OK, `npm run rehearsal` 9/9;
  - headless Edge with the built extension, online: rate downloaded (5.3408, published 06.11.2026), cards and True Cost show RON + EUR;
  - offline with the cache off: the old rate is kept, `cursStare.ok=false`, and the "posibil depășit" warning is shown.
- **Plan/CLAUDE.md rule updated** from "only the user's explicit rate" to "an explicit, displayed rate (BNR or user)".

### Post-freeze feature: every rental site + 50% agency commission (requested by the user)
**Why it seemed OLX-only:** nothing in the code restricted it to OLX (no URL allow-list; `activeTab` works on any http(s) page). But on sites without an adapter the old generic fallback sent the whole `body`: menus, app banners, inline scripts and "similar listings", up to 15k characters, and it found no price. Publi24's JSON-LD was also invalid JSON (raw line breaks), and HomeZZ keeps its price in `mainEntity.offers`. Both were ignored.

**The pipeline is one system with one output, `content/readPage.js`:**
1. `structured.js`: JSON-LD (schema.org, read leniently), microdata, `og:*`. It reads the price from `offers`, `mainEntity` or `itemOffered`, the address, `additionalProperty`, `floorSize` and rooms, and the `RealEstateListing` / `LeaseOut` signals.
2. Site-specific extractors: the existing OLX and Storia adapters (unchanged), plus declarative profiles in `profiles.js` read by one shared reader (Publi24 and HomeZZ, verified on real pages). If a profile's selectors no longer match, the read falls back to the universal extractor automatically.
3. `universal.js`: a noise-filtered text walker. It skips nav, page headers and footers, `aside`, forms, dialogs, cookie/newsletter/related/similar blocks, hidden elements and scripts. It scores candidate regions (h1 ancestors, `main`, `article`, schema `itemtype`) by text length, link density, price, rental words and whether they contain the h1.
4. `listing.js`:
   - `assessListing`: does the page look like a rental listing? If not, the panel asks before sending anything to the AI;
   - `listingUrlKey`: ignores the hash and tracking parameters;
   - `analysisKey`: mode + URL + FNV-1a hash of the text.
5. The AI step is unchanged: the backend (Gemini or Claude) extracts the fields from this text, and every value must still quote it exactly (`enforceEvidence`). Missing values stay "De întrebat"; nothing is invented.

**Dynamic content and navigation:**
- **Late-loading pages:** `entry.js` `readWhenReady` returns at once if a listing with a price is already on the page. Otherwise it waits for the DOM to be quiet (700 ms, at most 4 s) and reads again.
- **SPA navigation:** the injected script checks the listing URL every second (and on `popstate`) and sends `RASCRUCE_PAGE_CHANGED`. The panel shows "Ai deschis alt anunț în acest tab" with an "Analizează pagina nouă" button. It never re-analyses on its own.

**No duplicate analyses or AI requests:**
- the panel ignores clicks while a read or analysis is running;
- the same mode + URL + text reuses the current result or one of the last 8 (`analizeRecente`; user edits are kept);
- manual fallbacks (after an error) are not cached.

**Clear failure reasons** (`READ_FAILURE`): a blocked page (chrome://, PDF, Web Store), no access yet (click the icon on that tab), no text (login, CAPTCHA, still loading; protections are not bypassed), and "nu pare un anunț de închiriere" with "Analizează oricum".

**Permissions:** unchanged (`activeTab` + `scripting`; no `<all_urls>`, no content-script matches).

**Commission (Task 2):**
- `DEFAULT_COMMISSION_PERCENT = 50` in the contracts constants. An unstated commission is exactly `round(chirie × 0.5)`, marked "estimare", with no interval.
- The old 50–100% range (`comisionProcentChirie`) was removed from `CostReference`, `costs.ro.json`, the demo fixture and the schema.
- Values stated in the listing win: a percentage, an amount (RON, or EUR converted with the existing rate) and 0. "Neclar" counts as not stated.
- Paid once, at move-in (unchanged).
- UI row: "Comision agenție · estimat la 50% din chirie" / "· specificat în anunț" / "· fără comision, conform anunțului" / "· confirmat de proprietar" / "· introdus de tine" (`commissionHint`).

**Demo numbers changed as a result:**

| | Before | Now |
|---|---|---|
| Listing A commission | 1,750 | 875 |
| Payment at move-in | 6,750 | 5,875 |
| Storm minimum | −1,700 | −825 |
| Path to Yes | move 2 months later · +2,700 · B · −540/month | move 1 month later · +1,825 · B · −365/month |

The story still holds: A goes negative in May, B stays safe, and A gets 4 options. Updated in the fixtures, tests, `DEMO.md`, plan §5/§10 and `npm run rehearsal`.

**Verification:**
- **Unit tests:** `npm test` passes 145/145. New: `tests/extension/sites.test.js` (structure-faithful fictional fixtures), the commission cases in `trueCost.test.js`, and `commissionHint`. Lint is clean, the build is OK, and `npm run rehearsal` passes 9/9.
- **Real pages, saved once to the scratchpad and never committed:**
  - in node: 4 Publi24, 4 HomeZZ and 3 Storia listings;
  - in **real headless Edge** with the built content bundle, external hosts blocked and site hostnames mapped to a local server: all 11 extract the title, price and details through their own extractor, and the universal fallback (unknown host) extracts the price and description of each;
  - also in Edge: a dynamic SPA page waited for its content, and `pushState` produced exactly one page-changed message.
- **Not verified:**
  - imobiliare.ro and OLX answer automated requests with HTTP 403. That was respected, not bypassed. imobiliare.ro relies on the universal extractor plus JSON-LD, and has no profile.
  - The OLX adapter is unchanged.
  - No live click-through in Chrome (the `activeTab` gesture) was possible.

### Post-freeze redesign: RentSmart, Apple-inspired UI (requested by the user)
**Scope:** frontend only. No change to the engine, the contracts, the backend, AI, extraction, the BNR rate or storage keys, so existing saved data still works.
- **Rebrand:** the user-facing name is **RentSmart**: manifest `name`/`short_name`/`default_title`, HTML titles, the in-app logo, panel messages, the demo-site notice and a new icon (`extension/icons/icon.svg` → PNGs via `scripts/render-icons.mjs`). Internal identifiers and code comments are unchanged.
- **Design system** (`ui/styles.css` + `ui/components.jsx`):
  - canvas `#F5F5F7`, white cards (18px radius, soft shadow), text `#1D1D1F`;
  - accents `#007AFF` / `#5856D6` / `#34C759` / `#FF9500` / `#FF3B30` for surfaces, charts and focus;
  - **AA-contrast text variants** (`#0066CC`, `#1E7B34`, `#A35200`, `#D70015`; secondary text `#6E6E73`; `#86868B` only as subtle text);
  - the system font stack (SF on macOS, Segoe UI on Windows; nothing downloaded);
  - an 8px spacing grid, tabular figures for money, and Lucide icons only (the ⚡ emoji was removed);
  - a frosted-glass effect only on the sidebar and the panel header.
  - **No animations:** the fade-in keyframes and button transitions were removed, and a global rule sets `animation`/`transition: none !important`.
- **Dashboard:**
  - a macOS-style sidebar (icons, a blue-tinted active item, a saved-listings count, demo badge and privacy note) that becomes a top bar under 768px;
  - page headers with a Romanian title and description;
  - Passport: 4 summary cards (income, rent budget, minimum reserve, move month), then the form in 3 groups with RON/luni suffixes and inline errors (`aria-invalid`). Same fields and the same `passportFromForm` validation;
  - the rate and privacy cards in a right column;
  - Listings: cards with a link to the original listing, status pills, rent RON+EUR and three cost tiles. The detail view has a segmented control, True Cost on the left and the property summary plus "Costurile tale" on the right;
  - Comparison: a clean table with "Cel mai mic cost" highlighted;
  - Crossroads: a parameters card (radio-group period selector), a chart card in the new palette, Path to Yes option cards and the indicators table;
  - Settings: grouped cards with a switch;
  - empty states for no listings, fewer than 2 listings and no Passport.
- **Side panel** (the extension's compact UI; there is no popup):
  - a sticky frosted header with the logo and a dashboard shortcut;
  - an action-first home screen (large buttons, demo switch);
  - `ui/PropertySummary.jsx`, shared with the dashboard: title, **clickable link to the original listing** (new tab, `noopener noreferrer`), location, rent RON/EUR, detail chips, a commission row ("nemenționat · estimat la 50% din chirie" with the engine's amount), the "Găsit · Neclar · De întrebat" counts and missing-information chips;
  - warnings as compact status rows;
  - a segmented control; the field list grouped into De întrebat / Neclare / Găsite în anunț / Completate de tine; a static loading card.
- **Not built** (they don't exist in the app, so none were invented): roommate comparison, a separate popup. "Better alternatives" = Path to Yes "Alege B"; savings projection = Crossroads.
- **Verified:**
  - `npm test` 145/145, lint clean, build OK, `npm run rehearsal` 9/9 (the real built extension through every key flow);
  - headless Edge capture of 17 screens: dashboard at 1280 and 760px, panel at 360 and 400px. Each had **0 px horizontal overflow, 0 running animations, 0 elements with transitions**;
  - the listing link opens the saved listing URL.
  - Playwright is not installed; the existing headless-Edge/CDP setup was used instead.

### Post-freeze feature: Alternatives + header refresh + new analysis result (requested by the user)
**Side panel:**
- **Refresh icon:** "Analizează alt anunț" moved from the bottom into the header, as an icon left of the dashboard icon:
  - the same classes, size, hover and focus as the dashboard button;
  - tooltip and `aria-label` "Analizează alt anunț";
  - the same handler as before (`onNew` → `setView('home')`, defined once). The bottom button was removed.
- **Result layout** (from the reference image), with all values from the engine:
  - "Rezultatul analizei", then the property card: **real photo**, title, location, rent in RON, and an external link to the original listing;
  - the **verdict** card (`assessAffordability`): "Îți permiți această chirie" / "Buget tensionat" / "Nu este recomandată";
  - the **financial summary**: rent, deposit, agency commission (50% default kept), and "Cost inițial total" (`plataLaMutare`);
  - **Impact în bugetul lunar** (average monthly cost / net income, static bar) and the **RentSmart recommendation**;
  - "Detalii analiză" with the existing tabs (Analiză / Întrebări / Cost real / Crossroads);
  - the bottom actions are exactly "Caută alternative" and "Salvează analiza" (the existing `saveListing`).
- **"Caută alternative":**
  - saves `cerereAlternative` = {id, analiza} (no financial data) in `chrome.storage.local`;
  - opens `dashboard.html#alternative` through the background script (an allow-listed hash);
  - **the search never runs after the analysis**, only on this click.

**Images:**
- **Extraction:** `readPage` returns `imagine`. Sources in order:
  1. the site's own data: the Storia adapter (`medium` 655×491), or JSON-LD `image` (HomeZZ's `og:image` is its logo);
  2. `og:image` / `twitter:image`.
- **Filtering:** https only, with logos, SVGs and "no_img" rejected (`safeImageUrl`).
- **Contract:** `ListingAnalysis.sursa.imagine` is optional (https, ≤ 2048 characters) and is added only when present, so old data stays valid. Tests updated.
- **Display:** `ui/PropertyImage.jsx` gives fixed sizes, rounded corners, `object-fit: cover`, `referrerPolicy="no-referrer"` and lazy loading, with a neutral placeholder when the image is missing or fails. The listing always stays visible.

**Search** (`POST /api/alternatives`, backend `api/_lib/search/`):
- **Access checks (November 2026):**
  - robots.txt allows the results pages on Storia, Publi24 and HomeZZ;
  - all three answer an honest User-Agent (`RentSmart/0.1`);
  - **OLX** returns 403 for any automated request (its official API needs a partner account) and **Imobiliare.ro** returns 403, with robots.txt also forbidding search filters. Both are excluded, and nothing is bypassed.
- **Providers** read the structured data the site already publishes:
  - Storia: `__NEXT_DATA__` with `roomsNumber`, `priceMin` (EUR) and price-ascending sort;
  - Publi24: the JSON-LD `ItemList` (read leniently), by category `apartamente-N-camere`;
  - HomeZZ: `data-props` with `numar_camere` and newest-first sort (cheapest-first returned stale listings).
- **Cities:** slugs for 10 cities in `shared/search/cities.js`, all verified live on all three providers.
- **Service:**
  - runs in parallel, with a 10 s timeout per provider and isolated errors (BLOCAT / TIMEOUT / INDISPONIBIL / STRUCTURA);
  - drops listings that aren't monthly rentals (short-stay, hotel-style, a room or bed in a shared home);
  - deduplicates by URL and across sites (same price, area and similar title);
  - caches for 15 min (a total failure is not cached), with its own rate limit (10/min per IP, 60/day per install).
- **Privacy:** the server receives **only** `{oras, camere, pretMinimEUR}`. Any other key (e.g. `venitNetLunar`) gets a 400.

**Ranking** (`shared/engine/alternatives.js`, deterministic, no AI):
- each candidate goes through the same True Cost (prudent estimates, 50% default commission charged once, EUR→RON at the displayed rate) and the same simulation as a real listing;
- exclusions: over the maximum budget, under the plausibility floor (50% of the analysed rent), not cheaper, unsafe (money goes negative), or no exchange rate;
- tiers:
  - "Potrivire excelentă" = safe + same rooms + area ±25% (proven);
  - "bună" = safe with no known mismatch;
  - "Opțiune economică" = the rest.
- order: tier, then comparability, then cost;
- room counts come from the title first.

**Dashboard:**
- the "Alternative" sidebar item is added after "Anunțuri salvate";
- the page has the analysed listing card (photo, "Anunțul analizat" badge, original link) and 3 pre-filled filters (city, rooms, ≤ RON);
- the search runs automatically once per request, and stale searches are cancelled with `AbortController`;
- changing the maximum re-ranks locally without a request, while changing city or rooms prompts "Caută";
- it shows up to 5 cards ("Arată încă 5" for more), a provider status line, and every requested state: loading, empty (the exact required text), error, rate limit, demo mode, no Passport, no rent;
- results persist (`rezultateAlternative`), so a reload makes no new request.

**Verified:**
- `npm test` 165/165 (new: `tests/api/search.test.js` with fixtures that copy each site's structure but use invented content; `tests/extension/alternatives.test.js`), lint clean, build OK, `npm run rehearsal` 9/9;
- **live E2E** (built extension in headless Edge, the local API, the real providers):
  - an analysis from a real HomeZZ listing: photo loaded, correct link, "Buget tensionat", 50%;
  - the refresh icon resets, and the bottom has only the two buttons;
  - "Caută alternative" opened the Alternatives page, which found 42 recommendations in Cluj-Napoca (Storia 37, Publi24 20, HomeZZ 27 found), the first five with real photos that loaded and valid listing links;
  - the max filter re-ranks with no request, and Iași returned 35 with one new request;
  - a reload made 0 requests;
  - 0 px horizontal overflow, 0 animations.

### Post-freeze feature: automatic analysis on navigation (requested by the user)
**Setting:** "Analizează automat anunțurile", off by default, in the panel's home screen and in dashboard → Setări (`ui/AutoAnalysisSwitch.jsx`, `setari.analizaAutomata`).
- Turning it on requests **optional** host permissions only for the 5 rental sites (`optional_host_permissions`: olx, storia, imobiliare, publi24, homezz), inside the click, then asks for explicit AI consent if it wasn't already given.
- Turning it off removes the permissions.
- No `tabs`, `webNavigation` or `<all_urls>` permission was added.

**Pipeline** (service worker, works with the panel closed): `background/index.js` → `auto/analyzer.js`.
- **Events:**
  - `tabs.onUpdated` (load, reload, back/forward, History API URL changes); `tabs.onActivated`; `tabs.onRemoved`;
  - the content script registered dynamically (`scripting.registerContentScripts`, only on granted sites, only while the setting is on) sends `RASCRUCE_PAGE_CHANGED` on SPA changes.
- **Which pages:** only listing URLs (`auto/sites.js` → `isAutoListingUrl`). Search and list pages become `ignorat`; other sites get no state. After reading, "pare anunț de închiriere" is checked again, so a URL that looks like a listing but isn't a rental becomes `nu-e-anunt` with no AI request.
- **Same pipeline as manual mode:** `readTab` (content/inject.js, `readWhenReady` waits for content that loads late) → `runDetective` (backend AI, validation + quotes) → `buildQuestions(useAI: false)`. The landlord message uses the template, so there is no second Gemini request; "Formulează cu AI" stays in the panel. Costs and the verdict are still computed live from the Passport, not stored.
- **Protection for Gemini:**
  - a 1.2 s debounce per tab, and no reprocessing for a tab already on the same listing (reload, tab switch);
  - a URL cache (24 h, independent of page text, because counters and relative dates change on every load) plus the exact text cache;
  - one in-flight request per listing (two tabs → one request) and at most one AI analysis at a time (a queue);
  - the existing client timeout;
  - after a 429: a 90 s pause (`pauzaAI`) with **no automatic retries**. New listings get the `amanat` state; only "Încearcă din nou" forces a request. The pause then ends on its own.
- **Tab state** (`chrome.storage.session.stareTaburi`) has a generation counter: a late result is cached but never overwrites the listing now open. An "in progress" state left behind by a stopped service worker is redone after 2 min, and a keepalive runs during an analysis.
- **Panel:**
  - it follows the active tab of its window (`sidepanel/useActiveTabState.js`): a finished result shows on its own; running / error / paused show as a static card (`sidepanel/AutoStatus.jsx`) with "Încearcă din nou";
  - it never shows another tab's listing, or a listing that has been navigated away from;
  - "Analizează pagina curentă" on an accepted listing in auto mode goes through the service worker, so there is no duplicate pipeline;
  - the header refresh icon keeps its reset behaviour.
- **Shared cache:** `storage/analysisCache.js` (limit 30) is used by both the panel and the service worker.

**Verified:**
- `npm test` 177/177 (new: `tests/extension/autoAnalyzer.test.js`, 12 scenarios: debounce, reload and tab switch, A→B→A, other site, search page, non-rental listing, race, two tabs one request, 429 with no retries, 24 h TTL, setting off or demo mode, stuck state); lint clean, build OK, `npm run rehearsal` 9/9.
- **E2E in headless Edge** (built extension with site access pre-granted, the saved real Storia, Publi24 and HomeZZ pages under their hostnames, a **simulated** AI backend that counts requests so no Gemini quota was used): **16/16**:
  - the first listing analysed with the panel closed; reload: 0 requests; another Storia listing; HomeZZ, with image; a second Publi24 tab; tab switch: 0 requests; back to a listing: from cache;
  - a search page ignored; a non-accepted site with no state;
  - a slow page (1.5 s) analysed after loading; SPA `pushState` detected;
  - 429 → pause, and the next listing was not sent;
  - the panel opened afterwards shows the active tab's listing with its verdict; switching tabs shows that tab's state; "Încearcă din nou" works;
  - "Caută alternative" opens the current listing;
  - **8 AI requests in total = 7 distinct listings + 1 manual retry**.

### Post-freeze feature: first-use flow (welcome, budget setup, "Bugetul tău") (requested by the user)
- **Audit:** this folder is the RentSmart extension (manifest `RentSmart`; `rascruce-ai` is only the package name).
  - **Design:** kept as it is (light, Apple-style). The brief described "dark navy + cyan", which doesn't match the current design, so no new design was invented.
  - **Git:** not run (`git status` included), per the project rule.
- **Welcome page:**
  - `chrome.runtime.onInstalled`, only for `reason === 'install'` and only when no Passport exists (`background/onboarding.js` → `dashboard.html#bun-venit`). Not on update, Chrome update or browser restart.
  - Full-screen, in the existing design, with exactly the requested Romanian copy. "Configurează RentSmart" → `#configurare` in the real dashboard.
- **Setup form** (`dashboard/Onboarding.jsx` + the pure `dashboard/setupForm.js`):
  - 6 required fields + "Mai multe opțiuni" (reserve, move month 0/1/3/6/other 0–60), with focus on the first field, keyboard use, inline errors in Romanian (`aria-invalid` / `aria-describedby`), and large buttons;
  - it saves **into the existing Financial Passport** (`passportFromForm` + contract), so there is no second source of truth;
  - mapping with no double counting: expenses exclude housing **and** transport; the budget is the rent budget (`bugetMaximChirie`, which is rent-only in the model, so the help text says utilities are computed separately);
  - unknowns never become 0 silently: the main fields are required (type 0 explicitly), and empty optional fields need **explicit confirmation**;
  - nothing is pre-filled with invented values; "Modifică datele" pre-fills from the saved profile;
  - `setari.profilConfigurat` is set only after a successful save. On failure the existing profile is untouched and the form keeps its values.
- **"Bugetul tău"** (new first sidebar item and default landing; all existing items kept):
  - income, expenses, savings (+ reserve), housing budget, **money left each month** (`shared/engine/budget.js` → `monthlyLeftoverNow`, the same as the simulation's pre-move monthly flow), move month;
  - **no affordability verdict** without an apartment;
  - "Acum poți analiza primul apartament." with "Analizează un apartament" (opens the existing side panel plus a 3-step guide) and "Modifică datele";
  - saved apartments are shown with the existing `ListingCard`.
- **Existing users:** the profile is detected from data (`passport`), not only from the new flag, so old profiles count and nothing is reset or deleted.
- **"Încearcă un exemplu"** (`storage/profile.js`):
  - copies the real data (Passport, rate, listings, simulation, storms, current analysis, settings) into `copieDateReale`, then loads the existing demo scenario;
  - the "Exemplu cu date fictive" banner offers "Ieși din exemplu" (exact restore, including keys that were absent) or "Configurează datele tale";
  - a setup saved during the example exits it first, so the real profile is never lost;
  - the old destructive "Încarcă scenariul demonstrativ" button in Settings is unchanged, as used by the presentation and the rehearsal.
- **Verified:**
  - `npm test` 187/187 (new: `tests/extension/onboarding.test.js`, 10 tests), lint clean, build OK, `npm run rehearsal` 9/9;
  - **E2E in headless Edge with a fresh profile (a real install)**, 18/18:
    - the welcome page opens by itself; its copy contains no technical terms;
    - setup with focus on the first field; Tab moves between fields;
    - an empty submit flags 6 errors and saves nothing; an invalid value is rejected while the other entries stay;
    - empty optional fields → confirmation; the save goes into the Passport, "Datele tale au fost salvate.", 3.280 RON left each month, no verdict;
    - after a reload the data stays; "Modifică datele" is pre-filled and updates; the Financial Passport shows the same profile;
    - the example shows fictional data and exiting it gives the real profile back intact;
    - after a **browser restart** the welcome page doesn't reopen and the data is still there.

### Post-freeze: Romanian UX writing pass on all user-facing text (requested by the user)
- **Approach:** two passes. A UX writer rewrote every text in the panel and the dashboard. Then an ordinary renter reviewed the screenshots (`shots5`) and asked for 3 more fixes: the cut-off panel tab, the profile stat cards and the "rezultatul să fie sigur" line.
- **Renames (visible labels only):** "Financial Passport" → "Profilul meu financiar"; "Crossroads" → "Economii în timp" in the sidebar ("Economii" as the panel tab), page title "Cum evoluează economiile tale"; "Path to Yes" → "Cum poți face chiria accesibilă"; "Financial Storms" → "Ce se întâmplă dacă apar cheltuieli neprevăzute?" (furtună → situație); "Drumul A" → "Varianta A"; "Planul" → "Planul ales"; "Interpretează" → "Analizează situația descrisă"; "Salvează Passport-ul" → "Salvează datele financiare"; "Impact în bugetul lunar" → "Cât din venit cheltuiești lunar".
- **Unchanged:** internal identifiers, storage keys, routes, formulas, the API, Gemini, the design.
- **Months:**
  - `monthLabel` (`crossroads/scales.js`) shows the real month name only, with no "Luna N" or "L3".
  - The year is added only when the displayed period crosses a year (`spansYears`, `startYear`, `yearOf`). The year is the next occurrence of the start month, counted from today.
  - On the chart, the "L1…Ln" row is gone; that row now shows the year, and only when the period crosses a year.
- **Warnings now say what happens and when:**
  - "Din mai, cheltuielile depășesc banii pe care îi ai"; on the chart: "Din mai: bani insuficienți (A)";
  - "Din X, economiile scad sub suma păstrată pentru urgențe";
  - statuses: `pathStatus` → "în siguranță" / "sub suma pentru urgențe" / "bani insuficienți".
- **Misleading label found:**
  - "Cost inițial total" left out the first rent, but read like the full amount you pay to move in.
  - The formula is unchanged. The UI now shows "Total de plătit la mutare" = `totalToMoveIn(tc)` (`shared/engine/budget.js`) = `plataLaMutare` + the first rent, with the breakdown: first rent, deposit (refundable), commission, moving (one-time), and the "Fără prima chirie: …" line.
- **Budget percentage** ("Cât din venit cheltuiești lunar"): the text follows the formula exactly. `averageMonthlyCost` (rent + maintenance/utilities + transport + other costs, 7 summer + 5 winter months) is divided by net income.
- **Recommendations** explain why. When costs are estimated, they add: "Unele costuri nu apar în anunț și sunt estimate…".
- **Verified:** `npm test` 187/187 (expectations updated; new assertions for months/years, `negativeShortLabel`, `pathStatus` and `totalToMoveIn`), lint clean, build OK, `npm run rehearsal` 9/9 (texts updated), 17 screenshots at 360/400/760/1280 px with 0 horizontal overflow and 0 animations.

### Post-freeze: "Bugetul tău" only at first use (requested by the user)
- **Rules** (`dashboard/navigation.js`, pure and tested):
  - `isOnboardingDone` = `setari.profilConfigurat` (written by `saveProfile` only after a successful save) **or** an existing `passport` (users from before the flag);
  - exception: while "Încearcă un exemplu" is active, the user is still at first use.
  - Once done:
    - "Bugetul tău" disappears from the sidebar (`visibleSections`);
    - `#buget`, `#bun-venit`, `#configurare` and the default landing all lead to "Profilul meu financiar" (`resolveSection`);
    - the URL hash follows the page shown, so a reload stays there.
- **After the setup form:** an automatic redirect to `#passport`, with "Datele tale au fost salvate. Le poți vedea și modifica oricând aici…". Editing is done in "Profilul meu financiar" (same `passport` key; nothing migrated or deleted).
- **Persistence:** it comes from storage (flag + profile), so it survives a refresh, a closed tab and a browser restart. Only "Șterge tot" from Settings brings back first use, because it deletes the profile.
- **Refactor:** the `useExampleActive` hook moved from `Onboarding.jsx` to `storage/useExampleActive.js`, shared by the banner and `App.jsx`. It returns null until it has been read, to avoid a wrong redirect.
- **Lost (by design):** the "Bugetul tău" summary with "Analizează un apartament" (side panel + 3-step guide) is no longer reachable after setup.
- **Verified:**
  - `npm test` 188/188 (new: the navigation test in `tests/extension/onboarding.test.js`), lint clean, build OK, rehearsal 9/9;
  - E2E in headless Edge with a fresh install, 22/22:
    - welcome page → example (Bugetul tău visible) → exit → setup → redirect to the profile, Bugetul tău gone;
    - reload; `#buget`, `#bun-venit`, `#configurare` and an empty hash → profile;
    - edit + save in the profile;
    - browser restart → no welcome page; the dashboard opens on the profile.

### Post-freeze: the savings chart, redesigned (requested by the user; the reference image was not received)
- **Scope:** only the chart (`crossroads/Crossroads.jsx`, `parts.jsx`), its card (title and description) and the 2 texts that named its green line.
- **Renames:**
  - card title: "Cum evoluează economiile tale";
  - lines: "Dacă alegi acest apartament" (one apartment; with several: "Dacă alegi A · titlu") and "Dacă urmezi recomandarea RentSmart" (the dashed green line of the plan).
- **Two move dates:** `moveDates(model)` in `model.js` uses only existing calculations.
  - Planned = `sim.lunaMutarii` from the profile.
  - Recommended = `plan.lunaMutarii`, from the option computed by Path to Yes (the default or the one chosen). The status is:
    - `diferita`: e.g. postponing the move;
    - `aceeasi`: the chosen option doesn't move the date;
    - `nu-e-nevoie`: every option is safe, so no recommendation is shown;
    - `negasita`: there is a problem, but no computed option fixes it ("nu am găsit o lună potrivită"; no month invented).
  - Shown as 2 cards above the chart plus rounded markers: blue = planned, green = recommended (drawn only when it differs).
- **Texts:**
  - real months: axis labels capitalized, full names when there is room, year only when the period crosses a year;
  - negative balance: "Din mai: cheltuielile depășesc banii disponibili";
  - tooltip shows "Economii: X" or "Cheltuielile depășesc banii disponibili cu X";
  - shorter legends;
  - a note explaining the deposit ("o dai proprietarului… o primești înapoi la finalul contractului… nu intră în economii").
- **Style:** rounded line ends, a lighter grid; no animations.
- **Verified:**
  - `npm test` 189/189 (new: the `moveDates`/`chartLineName` test), lint clean, build OK, rehearsal 9/9;
  - screenshots at 1280/760/360 px (0 overflow, 0 animations);
  - the tooltip on May 2027, read via a real mouse hover, matches the engine: A −825, B 2.400, recommendation 1.575 RON.

### Post-freeze: the savings chart, aligned with the reference image (requested by the user)
- **Visual changes, same data:**
  - header with an icon tile + a large title;
  - rounded labels with icons:
    - orange house "Mutarea planificată: …";
    - green sprout "Mutarea recomandată: …", only if a computed recommendation exists;
    - red "Cheltuielile depășesc banii disponibili" inside the red zone, only where it covers no point;
  - a light green fill under the recommendation line; the pink zone below zero; Y axis in full RON;
  - 4 explanatory cards (blue/green/orange/red) and the deposit card with the shield;
  - the reserve becomes a discreet dashed grey line.
- **Without a recommendation:** a grey "Recomandarea RentSmart" card ("Nu e nevoie de altă lună…" or "Nu am găsit…"); no green line or label.
- **Responsive:**
  - the viewBox follows the container's real width (text at real size);
  - the month labels pick automatically, by measured width: full names → full names every other month → short names;
  - the labels never overlap; the second-row label avoids the first one's line;
  - the cards use container queries (1/2/4 columns).
- **Code:** helpers in `crossroads/chartStyle.js` (`TONES`, `calloutSize`, `textWidth`). Wording from the previous request is kept ("Cheltuielile depășesc banii disponibili", the two move dates), not the image's "Rămâi fără bani".
- **Not available:** Playwright is not installed. The comparison was done with the existing headless Edge screenshots (CDP) at 1280/760/360 px, for 3 states: no recommendation, the default recommendation (postponement), and a chosen recommendation.
- **Verified:** `npm test` 189/189, lint clean, build OK, rehearsal 9/9 (step 6 checks the zone label + "A: din mai"), 0 overflow and 0 animations on all 20 screenshots, the May tooltip = −825 RON (unchanged).

### Remaining (user-side; cannot be done locally)
1. **Deploy:** Vercel, Upstash, the API key and spending limit, `ALLOWED_ORIGINS` with the real extension ID, `.env.local` with `VITE_API_BASE_URL`, then rebuild, then `/api/health`, then `npm run eval -- <URL>` (target: 0 "gasit" without evidence).
2. **One live analysis of a real OLX listing in Chrome** (a real icon click).
3. **Human timed rehearsal** with `DEMO.md`, and **the backup video**.
4. **The 2-second readability test** of Crossroads with 3 people (§13).
5. Optional: a real Wi-Fi-off run in Chrome (`npm run rehearsal` already covers it in emulation).
