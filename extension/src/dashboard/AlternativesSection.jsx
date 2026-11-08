// RentSmart — „Alternative pentru tine”: anunțuri reale, mai avantajoase, găsite pe Storia, Publi24 și HomeZZ.
// - Pornește automat O SINGURĂ DATĂ pentru fiecare cerere „Caută alternative” din panou (nu după analiză).
// - Serverul primește doar orașul, camerele și un preț minim de plauzibilitate; Passport-ul nu pleacă.
// - Clasamentul și toate sumele vin din motor (rankAlternatives → True Cost + simulare), în browser.
// - Nu afișăm niciodată anunțuri inventate: fără rezultate reale → starea goală.
import { useEffect, useRef, useState } from 'react';
import { BedDouble, CircleAlert, ExternalLink, MapPin, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { searchAlternatives } from '../ai/client.js';
import { trueCostOf } from '../app/derive.js';
import { USABLE_STATUSES } from '../shared/contracts/constants.js';
import { formatFieldValue } from '../shared/fields.js';
import { fromRON } from '../shared/engine/currency.js';
import { PLAUSIBILITY_FLOOR, POTRIVIRE, rankAlternatives } from '../shared/engine/alternatives.js';
import { SEARCH_CITIES, SEARCH_ROOMS, cityById, matchCity, roomsFromText } from '../shared/search/cities.js';
import { STORAGE_KEYS, ensureInstallId, onStorageChange, setValue } from '../storage/index.js';
import { Button, Card, EmptyState, Notice, PageHeader, Pill } from '../ui/components.jsx';
import PropertyImage from '../ui/PropertyImage.jsx';
import { formatNumber, formatRON } from '../ui/format.js';

const INITIAL_SHOWN = 5;
const EMPTY_TEXT = 'Nu am găsit momentan alternative potrivite. Încearcă să modifici filtrele sau să cauți din nou.';
const SOURCE_NAME = { storia: 'Storia', publi24: 'Publi24', homezz: 'HomeZZ' };
const PROVIDER_ERROR = { BLOCAT: 'acces refuzat', TIMEOUT: 'nu a răspuns la timp', INDISPONIBIL: 'indisponibil', STRUCTURA: 'pagina s-a schimbat' };
const SEARCH_ERROR = {
  RATE_LIMITED: 'Ai făcut prea multe căutări într-un timp scurt. Încearcă din nou peste un minut.',
  NOT_CONFIGURED: 'Serviciul de căutare nu este configurat în această versiune a extensiei.',
  TIMEOUT: 'Căutarea a durat prea mult. Încearcă din nou.',
};
const POTRIVIRE_UI = {
  [POTRIVIRE.EXCELENTA]: { text: 'Potrivire excelentă', cls: 'bg-[#248A3D]' },
  [POTRIVIRE.BUNA]: { text: 'Potrivire bună', cls: 'bg-[#2E7D52]' },
  [POTRIVIRE.ECONOMICA]: { text: 'Opțiune economică', cls: 'bg-[#1F6F43]' },
};
const usable = (f) => f && USABLE_STATUSES.includes(f.status) && f.valoare !== null && f.valoare !== undefined;
const roomsLabel = (n) => (n === 1 ? 'Garsonieră' : n === 4 ? '4+ camere' : `${n} camere`);

/** Cererea venită din panou și ultimul rezultat salvat (chrome.storage.local, sincronizat live). */
function useAlternativesStore() {
  const [state, setState] = useState({ loaded: false, request: null, results: null });
  useEffect(() => {
    let cur = {};
    const keys = [STORAGE_KEYS.ALT_REQUEST, STORAGE_KEYS.ALT_RESULTS];
    chrome.storage.local.get(keys).then((r) => {
      cur = r;
      setState({ loaded: true, request: r[keys[0]] ?? null, results: r[keys[1]] ?? null });
    });
    return onStorageChange(keys, (ch) => {
      cur = { ...cur, ...ch };
      setState({ loaded: true, request: cur[keys[0]] ?? null, results: cur[keys[1]] ?? null });
    });
  }, []);
  return state;
}

function initialFilters(analiza, passport, chirieRON) {
  const loc = usable(analiza.campuri.localitate) ? String(analiza.campuri.localitate.valoare) : null;
  const maxRent = passport?.bugetMaximChirie > 0 ? passport.bugetMaximChirie : chirieRON;
  return {
    oras: matchCity(loc, analiza.titlu, analiza.sursa.url) ?? '',
    camere: roomsFromText(analiza.titlu) ?? '',
    max: maxRent ? String(maxRent) : '',
  };
}

function OriginalCard({ analiza, chirieRON }) {
  const loc = usable(analiza.campuri.localitate) ? formatFieldValue('localitate', analiza.campuri.localitate) : null;
  const url = analiza.sursa.url && /^https?:/i.test(analiza.sursa.url) ? analiza.sursa.url : null;
  return (
    <Card>
      <div className="flex items-center gap-4">
        <PropertyImage src={analiza.sursa.imagine} alt={analiza.titlu ?? 'Anunțul analizat'} className="h-[84px] w-[112px]" />
        <div className="min-w-0 flex-1">
          <Pill tone="brand" dot={false}>
            Anunțul analizat
          </Pill>
          <h2 className="mt-1.5 truncate text-[16px] font-semibold text-ink">{analiza.titlu ?? 'Anunț fără titlu'}</h2>
          {loc && (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
              <MapPin size={13} aria-hidden="true" /> {loc}
            </p>
          )}
        </div>
        <div className="flex flex-none flex-col items-end gap-2">
          {chirieRON !== null && (
            <p className="num text-[18px] font-semibold text-ink">
              {formatRON(chirieRON)} <span className="text-[13px] font-normal text-muted">/ lună</span>
            </p>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
              Anunțul original <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

const fieldBox = 'flex h-11 items-center gap-2 rounded-[12px] border border-hairline bg-white px-3 text-[14px] text-ink';

function Filters({ value, onChange, onSearch, busy, stale }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={fieldBox}>
        <MapPin size={16} className="flex-none text-muted" aria-hidden="true" />
        <select className="rs-input min-w-36 cursor-pointer bg-transparent outline-none" value={value.oras} onChange={set('oras')} aria-label="Oraș">
          <option value="">Alege orașul</option>
          {SEARCH_CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nume}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldBox}>
        <BedDouble size={16} className="flex-none text-muted" aria-hidden="true" />
        <select className="rs-input cursor-pointer bg-transparent outline-none" value={value.camere} onChange={set('camere')} aria-label="Număr de camere">
          <option value="">Oricâte camere</option>
          {SEARCH_ROOMS.map((n) => (
            <option key={n} value={n}>
              {roomsLabel(n)}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldBox}>
        <SlidersHorizontal size={16} className="flex-none text-muted" aria-hidden="true" />
        <span className="text-muted">≤</span>
        <input
          className="rs-input num w-20 bg-transparent outline-none"
          inputMode="numeric"
          value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value.replace(/[^\d]/g, '') })}
          aria-label="Chiria maximă pe lună (RON)"
          placeholder="fără limită"
        />
        <span className="text-muted">RON</span>
      </label>
      <Button icon={Search} onClick={onSearch} disabled={busy || !value.oras} className="h-11">
        {busy ? 'Se caută…' : 'Caută'}
      </Button>
      {stale && <span className="text-[12px] text-unclear">Filtrele s-au schimbat: apasă „Caută”.</span>}
    </div>
  );
}

function AlternativeCard({ r }) {
  const ui = POTRIVIRE_UI[r.potrivire];
  const place = [r.cartier, r.localitate].filter(Boolean).join(', ');
  const meta = [SOURCE_NAME[r.sursa], r.camere ? roomsLabel(r.camere) : null, r.suprafataMp ? `${r.suprafataMp} mp` : null].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-col gap-4 rounded-[16px] border border-black/[0.05] bg-card p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
      <PropertyImage src={r.imagine} alt={r.titlu ?? 'Anunț'} className="h-[150px] w-full sm:h-[104px] sm:w-[140px]">
        <span className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-center text-[11px] font-semibold text-white ${ui.cls}`}>{ui.text}</span>
      </PropertyImage>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-snug font-semibold text-ink">{r.titlu ?? 'Anunț fără titlu'}</h3>
        {place && (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <MapPin size={13} aria-hidden="true" className="flex-none" /> {place}
          </p>
        )}
        <p className="num mt-1.5 text-[17px] font-semibold text-ink">
          {formatRON(r.chirieRON)} <span className="text-[13px] font-normal text-muted">/ lună</span>
          {r.pret.moneda === 'EUR' && <span className="text-[12px] font-normal text-muted"> · {formatNumber(r.pret.valoare)} EUR</span>}
        </p>
        <p className="num mt-0.5 text-[12px] text-muted">
          {meta} · Cost lunar estimat {formatRON(r.costLunarMediu)} · La mutare {formatRON(r.plataLaMutare)}
          {r.procentVenit !== null && ` · ${r.procentVenit}% din venit`}
        </p>
      </div>
      <div className="flex flex-none flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
        <div className="text-right">
          <span className="num inline-block rounded-full bg-found-soft px-2.5 py-1 text-[13px] font-semibold text-found">−{formatRON(r.economieLunara)} / lună</span>
          <div className="num mt-1 text-[12px] text-muted">Economisești {r.procentEconomie}%</div>
        </div>
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-blue/40 px-3 text-[13px] font-semibold text-brand hover:bg-brand-soft"
        >
          Vezi anunțul <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

export default function AlternativesSection({ data, derived }) {
  const store = useAlternativesStore();
  const { request, results } = store;
  const ctx = derived.ctx;
  const savedTwin = request ? data.saved.find((s) => s.analiza.id === request.analiza.id) : null;
  const analiza = savedTwin?.analiza ?? request?.analiza ?? null;
  const tc = analiza && ctx ? trueCostOf(savedTwin ?? analiza, ctx) : null;
  const chirieRON = tc?.lunar?.chirie?.sumaRON ?? null;

  const [filters, setFilters] = useState(null);
  const [status, setStatus] = useState({ state: 'idle', code: null });
  const [shown, setShown] = useState(INITIAL_SHOWN);
  const controller = useRef(null);
  const autoDone = useRef(null);

  // Filtrele se precompletează pentru fiecare cerere nouă (anunțul analizat + Passport-ul).
  const requestId = request?.id ?? null;
  const [filtersFor, setFiltersFor] = useState(null);
  if (analiza && filtersFor !== requestId) {
    setFiltersFor(requestId);
    setFilters(results?.cerereId === requestId && results.filtre ? results.filtre : initialFilters(analiza, data.passport, chirieRON));
    setShown(INITIAL_SHOWN);
  }

  async function runSearch(f) {
    if (!f?.oras || !request) return;
    controller.current?.abort(); // anulăm căutarea depășită
    const ac = new AbortController();
    controller.current = ac;
    setStatus({ state: 'loading', code: null });
    setShown(INITIAL_SHOWN);
    // Prag de plauzibilitate (din chiria anunțului analizat, nu din Passport), trimis în EUR.
    const pretMinimEUR = chirieRON ? fromRON(Math.round(chirieRON * PLAUSIBILITY_FLOOR), data.rate) : null;
    const res = await searchAlternatives(
      { oras: f.oras, camere: f.camere ? Number(f.camere) : null, pretMinimEUR },
      { installId: await ensureInstallId(), signal: ac.signal },
    );
    if (ac.signal.aborted || res.code === 'ANULAT') return;
    if (!res.ok) {
      setStatus({ state: 'error', code: res.code });
      return;
    }
    await setValue(STORAGE_KEYS.ALT_RESULTS, { cerereId: request.id, filtre: f, data: res.data, at: new Date().toISOString() });
    setStatus({ state: 'done', code: null });
  }

  // Pornire automată: o singură dată per cerere „Caută alternative”, doar dacă nu avem deja rezultatul ei.
  // Pornită dintr-un timer (nu sincron în efect); cleanup-ul îl anulează, deci rulează exact o dată.
  useEffect(() => {
    if (!store.loaded || !request || !filters?.oras || data.settings.modDemo) return undefined;
    if (autoDone.current === request.id || results?.cerereId === request.id) return undefined;
    const t = setTimeout(() => {
      autoDone.current = request.id;
      runSearch(filters);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded, request?.id, filters?.oras]);
  useEffect(() => () => controller.current?.abort(), []);

  const current = results && request && results.cerereId === request.id ? results : null;
  // Clasamentul (motorul) se recalculează local la schimbarea plafonului: fără o nouă cerere de rețea.
  const ranked =
    current && ctx && analiza
      ? rankAlternatives({
      candidates: current.data.rezultate,
      analyzed: { chirieRON, camere: roomsFromText(analiza.titlu), suprafataMp: usable(analiza.campuri.suprafataMp) ? analiza.campuri.suprafataMp.valoare : null },
      ctx,
      maxChirieRON: filters?.max ? Number(filters.max) : null,
          lunaStart: data.simSettings.lunaStart,
          furtuni: data.storms,
        })
      : null;

  const header = <PageHeader title="Alternative pentru tine" description="Chirii similare, mai avantajoase, în funcție de bugetul tău." />;
  if (!store.loaded) return header;
  if (!analiza)
    return (
      <div>
        {header}
        <Card>
          <EmptyState icon={Search} title="Niciun anunț analizat încă">
            Analizează un anunț în panoul RentSmart și apasă „Caută alternative”. Căutăm apoi anunțuri reale, mai avantajoase, pe Storia, Publi24 și HomeZZ.
          </EmptyState>
        </Card>
      </div>
    );

  const stale = Boolean(current && filters && (current.filtre?.oras !== filters.oras || String(current.filtre?.camere ?? '') !== String(filters.camere ?? '')));
  const list = ranked?.recomandari ?? [];
  const furnizori = current?.data.furnizori ?? [];
  const errorText = status.state === 'error' ? (SEARCH_ERROR[status.code] ?? 'Serviciul de căutare nu răspunde acum. Verifică conexiunea și încearcă din nou.') : null;

  return (
    <div>
      {header}
      <div className="space-y-5">
        <OriginalCard analiza={analiza} chirieRON={chirieRON} />
        {filters && <Filters value={filters} onChange={setFilters} onSearch={() => runSearch(filters)} busy={status.state === 'loading'} stale={stale} />}

        {!ctx && <Notice tone="warn">Completează profilul financiar ca să calculăm cât economisești și dacă îți permiți fiecare variantă.</Notice>}
        {ctx && chirieRON === null && <Notice tone="warn">Chiria anunțului analizat nu este cunoscută (sau lipsește cursul EUR): completeaz-o în panou ca să comparăm economiile.</Notice>}
        {filters && !filters.oras && <Notice tone="warn">Nu am recunoscut orașul anunțului. Alege orașul din filtre și apasă „Caută”.</Notice>}
        {data.settings.modDemo && <Notice>Căutarea alternativelor are nevoie de internet și nu este disponibilă în modul demonstrativ.</Notice>}

        {status.state === 'loading' && (
          <Card>
            <div className="flex items-center gap-3" role="status">
              <Search size={20} className="text-blue" aria-hidden="true" />
              <div>
                <p className="text-[15px] font-semibold text-ink">Căutăm alternative…</p>
                <p className="text-[13px] text-muted">
                  Pe Storia, Publi24 și HomeZZ, în {cityById(filters?.oras)?.nume ?? 'orașul ales'}. Durează de obicei câteva secunde.
                </p>
              </div>
            </div>
          </Card>
        )}
        {errorText && <Notice tone="danger">{errorText}</Notice>}

        {current && status.state !== 'loading' && ranked && (
          <section>
            <h2 className="mb-3 text-[20px] font-semibold tracking-tight text-ink">
              {list.length} {list.length === 1 ? 'alternativă recomandată' : 'alternative recomandate'}
            </h2>
            {list.length === 0 ? (
              <Card>
                <EmptyState icon={SearchX} title="Nicio alternativă potrivită">
                  {EMPTY_TEXT}
                </EmptyState>
              </Card>
            ) : (
              <>
                <ul className="space-y-3">
                  {list.slice(0, shown).map((r) => (
                    <AlternativeCard key={r.id} r={r} />
                  ))}
                </ul>
                {list.length > shown && (
                  <Button variant="secondary" className="mt-3" onClick={() => setShown((n) => n + INITIAL_SHOWN)}>
                    Arată încă {Math.min(INITIAL_SHOWN, list.length - shown)}
                  </Button>
                )}
              </>
            )}
            <div className="mt-4 space-y-1 text-[12px] text-muted">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Căutat pe:</span>
                {furnizori.map((f) => (
                  <span key={f.id} className="inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${f.ok ? 'bg-green' : 'bg-red'}`} aria-hidden="true" />
                    {f.nume} {f.ok ? `(${f.numar})` : `(${PROVIDER_ERROR[f.eroare] ?? 'eroare'})`}
                  </span>
                ))}
                <span>· {new Date(current.data.cautatLa).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </p>
              <p>
                Costurile alternativelor folosesc aceleași reguli ca analiza ta: întreținere și garanție estimate prudent, comision 50% din chirie dacă nu
                e precizat. OLX și Imobiliare.ro nu permit căutarea automată, deci nu sunt incluse.
              </p>
              {ranked.excluse.nesigure > 0 && (
                <p className="flex items-center gap-1">
                  <CircleAlert size={12} aria-hidden="true" /> {ranked.excluse.nesigure} anunțuri mai ieftine nu apar aici: cu ele, cheltuielile ar depăși banii pe care îi ai, într-una dintre lunile verificate.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
