// RentSmart — panoul lateral (interfața compactă a extensiei): AI Listing Detective + Smart Questions.
// Fluxuri: pagina curentă · text lipit · completare manuală · mod demonstrativ. Orice eroare AI → modul manual.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkCheck, BookmarkPlus, ClipboardPaste, ExternalLink, FileSearch, Info, LayoutDashboard, PenLine, RotateCcw, ScanSearch, Search, TriangleAlert } from 'lucide-react';
import { checkHealth } from '../ai/client.js';
import { buildQuestions, runDetective } from '../ai/detective.js';
import { errorMessage, manualReason } from '../ai/errors.js';
import { costContext, trueCostOf } from '../app/derive.js';
import { readActiveTab } from '../content/inject.js';
import { PAGE_CHANGED_MESSAGE, analysisKey, listingUrlKey } from '../content/listing.js';
import { createListingAnalysis, setUserValue } from '../shared/contracts/factories.js';
import { questionsFor, templateMessage } from '../shared/questions/index.js';
import { saveListing, updateSavedAnalysis } from '../storage/appData.js';
import { STORAGE_KEYS, ensureInstallId, getValue, onStorageChange, setValue, updateSettings } from '../storage/index.js';
import { findAnalysis, rememberAnalysis } from '../storage/analysisCache.js';
import { AUTO_ANALYZE_MESSAGE } from '../auto/analyzer.js';
import { isAutoListingUrl } from '../auto/sites.js';
import AutoAnalysisSwitch from '../ui/AutoAnalysisSwitch.jsx';
import { AutoStatusCard } from './AutoStatus.jsx';
import { useActiveTabState } from './useActiveTabState.js';
import { useAppData } from '../storage/useAppData.js';
import { useBnrRateRefresh } from '../storage/useBnrRateRefresh.js';
import { Brand, Button, Card, Notice, Pill, SegmentedControl, Switch } from '../ui/components.jsx';
import FieldList from '../ui/FieldList.jsx';
import TrueCostView from '../ui/TrueCostView.jsx';
import CompactCrossroads from '../crossroads/CompactCrossroads.jsx';
import { ConsentCard, PasteForm, QuestionsView } from './Panels.jsx';
import { AnalyzedListingCard, BudgetImpactCard, FinancialSummaryCard, RecommendationCard, ResultBadges, VerdictCard } from './ResultCards.jsx';
import { assessAffordability } from '../shared/engine/affordability.js';
import { FIELD_TITLES } from '../shared/fields.js';
import { countByStatus } from '../ui/status.js';
import { INCOMPLETE_MESSAGES } from '../ui/format.js';

const SHORT_TEXT_HINT =
  'Am citit puțin text (sub 300 de caractere). Deschide descrierea completă („Vezi mai mult”), lipește textul sau completează manual câmpurile.';
const BLOCKED_PAGE = 'Conținutul acestei pagini nu poate fi citit (ex. pagini chrome://, Chrome Web Store, PDF). Lipește textul anunțului.';
/** Motivele pentru care o pagină nu poate fi analizată, spuse clar (fără a ocoli vreo protecție). */
const READ_FAILURE = {
  INJECTARE_INTERZISA: BLOCKED_PAGE,
  FARA_TAB: 'Nu găsesc tab-ul activ. Deschide anunțul într-un tab și încearcă din nou.',
  FARA_PERMISIUNE:
    'RentSmart nu are încă acces la această pagină. Apasă iconița RentSmart din bara browserului cât ești pe pagina anunțului (Chrome dă acces doar tab-ului pe care ai apăsat), apoi „Analizează pagina curentă”. Sau lipește textul anunțului.',
  FARA_TEXT:
    'Pagina nu afișează text de citit: poate cere autentificare sau un CAPTCHA, ori încă se încarcă. Nu ocolim aceste protecții: deschide anunțul normal în browser sau lipește textul.',
};

const MODE_LABEL = { ai: 'Analiză AI', demo: 'Mod demonstrativ', manual: 'Completare manuală' };

const openDashboard = () => chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });

function AiStatus({ setari, health }) {
  if (setari.modDemo) return <Pill tone="brand">Mod demonstrativ · fără internet</Pill>;
  if (!health) return <Pill>Se verifică analiza AI…</Pill>;
  if (health.ok) return <Pill tone="ok">Analiza AI disponibilă</Pill>;
  return <Pill tone="warn">{errorMessage(health.code)} · mod manual</Pill>;
}

function CostTab({ data, analiza }) {
  const ctx = costContext(data);
  if (!ctx) {
    return (
      <div className="space-y-3">
        <Notice tone="warn">Completează profilul financiar în dashboard ca să vezi cât te costă de fapt.</Notice>
        <Button variant="secondary" className="w-full" icon={LayoutDashboard} onClick={openDashboard}>
          Deschide dashboard-ul
        </Button>
      </div>
    );
  }
  // Pentru un anunț salvat folosim și costurile introduse de utilizator; altfel, costurile goale.
  const saved = data.saved.find((s) => s.analiza.id === analiza.id);
  const tc = trueCostOf(saved ? { ...saved, analiza } : analiza, ctx);
  return (
    <>
      <TrueCostView tc={tc} exchangeRate={ctx.exchangeRate} rateStatus={ctx.rateStatus} costReference={ctx.costReference} compact />
      {!saved && <p className="mt-3 text-[12px] text-muted">Salvează anunțul ca să adaugi transportul, alte costuri și costurile de mutare.</p>}
    </>
  );
}

/** „Salvează analiza”: aceeași salvare ca înainte (saveListing), acum în acțiunile de jos. */
function SaveButton({ data, analiza }) {
  const [msg, setMsg] = useState(null);
  const isSaved = data.saved.some((s) => s.analiza.id === analiza.id);
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        icon={isSaved ? BookmarkCheck : BookmarkPlus}
        disabled={isSaved}
        onClick={async () => {
          const r = await saveListing(analiza);
          setMsg(r.ok ? null : 'Ai atins limita de anunțuri salvate. Șterge unul din dashboard.');
        }}
      >
        {isSaved ? 'Analiză salvată' : 'Salvează analiza'}
      </Button>
      {msg && <p className="text-center text-[12px] text-ask">{msg}</p>}
    </>
  );
}

/**
 * „Caută alternative”: salvează cererea (doar analiza anunțului, fără date financiare) și deschide
 * dashboard-ul direct pe pagina Alternative, care pornește căutarea. Căutarea NU rulează după analiză.
 */
async function openAlternatives(analiza) {
  await setValue(STORAGE_KEYS.ALT_REQUEST, { id: crypto.randomUUID(), analiza, creatLa: new Date().toISOString() });
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', section: 'alternative' });
}

/** Rânduri de stare compacte, în locul blocurilor de avertizare repetate. */
function StatusRows({ rows }) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-black/[0.05] bg-card shadow-[var(--shadow-card)]">
      {rows.map(({ key, tone, text }) => {
        const Icon = tone === 'warn' ? TriangleAlert : Info;
        return (
          <li key={key} className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13px] leading-snug text-ink">
            <Icon size={16} strokeWidth={2.2} className={`mt-[1px] flex-none ${tone === 'warn' ? 'text-orange' : 'text-blue'}`} aria-hidden="true" />
            <span className="min-w-0">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Result({ rezultat, data, aiReady, busy, onSaveField, onMessageChange, onRephrase }) {
  const [tab, setTab] = useState('analiza');
  const { analiza, mod, eroare, retrogradate, scurt, intrebari } = rezultat;
  const ctx = costContext(data);
  const savedTwin = data.saved.find((s) => s.analiza.id === analiza.id);
  const tc = ctx ? trueCostOf(savedTwin ? { ...savedTwin, analiza } : analiza, ctx) : null;
  // Verdictul vine din motor (simulare pe până la 12 luni după mutare); calcul rapid, fără stare proprie.
  const assessment = tc?.complet ? assessAffordability({ passport: ctx.passport, trueCost: tc, lunaStart: data.simSettings.lunaStart, furtuni: data.storms }) : null;
  const c = countByStatus(analiza);
  const missing = Object.keys(analiza.campuri).filter((n) => analiza.campuri[n].status === 'lipsa' || analiza.campuri[n].status === 'neclar');
  const rows = [
    eroare && { key: 'eroare', tone: 'warn', text: manualReason(eroare) },
    scurt && { key: 'scurt', tone: 'warn', text: SHORT_TEXT_HINT },
    rezultat.refolosit && { key: 'refolosit', tone: 'info', text: 'Același anunț, același text: am refolosit analiza anterioară (fără o nouă cerere AI).' },
    retrogradate.length > 0 && {
      key: 'retrogradate',
      tone: 'info',
      text: `${retrogradate.length === 1 ? 'Un câmp nu avea' : `${retrogradate.length} câmpuri nu aveau`} dovadă în textul anunțului și ${
        retrogradate.length === 1 ? 'a devenit' : 'au devenit'
      } „De întrebat”.`,
    },
  ].filter(Boolean);
  return (
    <div className="space-y-3">
      <h1 className="px-1 text-[17px] font-semibold tracking-tight text-ink">Rezultatul analizei</h1>
      <AnalyzedListingCard analiza={analiza} tc={tc} badges={<ResultBadges analiza={analiza} modeLabel={MODE_LABEL[mod]} saved={Boolean(savedTwin)} />} />
      <StatusRows rows={rows} />

      {!ctx && (
        <Card>
          <Notice tone="warn">Completează profilul financiar în dashboard ca să afli dacă îți permiți chiria.</Notice>
          <Button variant="secondary" className="mt-3 w-full" icon={LayoutDashboard} onClick={openDashboard}>
            Deschide dashboard-ul
          </Button>
        </Card>
      )}
      {ctx && tc && !tc.complet && (
        <div className="space-y-1.5">
          {tc.motiveIncomplet.map((m) => (
            <Notice key={m} tone="warn">
              {INCOMPLETE_MESSAGES[m] ?? m}
            </Notice>
          ))}
        </div>
      )}
      {assessment && (
        <>
          <VerdictCard assessment={assessment} lunaStart={data.simSettings.lunaStart} />
          <FinancialSummaryCard tc={tc} />
          <BudgetImpactCard assessment={assessment} venit={ctx.passport.venitNetLunar} />
          <RecommendationCard verdict={assessment.verdict} estimates={tc.folosesteEstimari} />
        </>
      )}

      <Card padded={false}>
        <div className="px-4 pt-4">
          <h3 className="text-[15px] font-semibold text-ink">Detalii analiză</h3>
          <p className="num mt-0.5 text-[12px] font-medium text-muted">
            {c.gasit} găsite în anunț · {c.neclar} neclare · {c.lipsa} de întrebat
            {c.confirmat + c.presupus > 0 && ` · Completate de tine ${c.confirmat + c.presupus}`}
          </p>
          {missing.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Informații lipsă">
              {missing.map((n) => (
                <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[12px] text-ink ring-1 ring-line">
                  <span className={`h-1.5 w-1.5 rounded-full ${analiza.campuri[n].status === 'lipsa' ? 'bg-red' : 'bg-orange'}`} aria-hidden="true" />
                  {FIELD_TITLES[n]}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3">
            <SegmentedControl
              label="Secțiunile analizei"
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                ['analiza', 'Analiză'],
                ['intrebari', `Întrebări (${intrebari.length})`],
                ['cost', 'Cost real'],
                ['crossroads', 'Economii'],
              ]}
            />
          </div>
        </div>
        <div className="p-4">
          {tab === 'analiza' && <FieldList analiza={analiza} onSaveField={onSaveField} />}
          {tab === 'cost' && <CostTab data={data} analiza={analiza} />}
          {tab === 'crossroads' && <CompactCrossroads data={data} analiza={analiza} />}
          {tab === 'intrebari' && (
            <QuestionsView
              intrebari={intrebari}
              mesaj={rezultat.mesaj}
              sursaMesaj={rezultat.sursaMesaj}
              onMessageChange={onMessageChange}
              canUseAI={aiReady && mod !== 'demo'}
              onRephrase={onRephrase}
              busy={busy}
            />
          )}
        </div>
      </Card>

      <div className="space-y-2 pt-1">
        <Button size="lg" className="w-full" onClick={() => openAlternatives(analiza)}>
          <Search size={17} strokeWidth={2} aria-hidden="true" />
          Caută alternative
          <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
        </Button>
        <SaveButton data={data} analiza={analiza} />
      </div>
    </div>
  );
}

export default function App() {
  const data = useAppData();
  useBnrRateRefresh(data);
  const setari = data.settings;
  const [health, setHealth] = useState(null);
  const [view, setView] = useState('home'); // home | paste | consent | loading | result
  const [pasteReason, setPasteReason] = useState(null);
  const [pending, setPending] = useState(null);
  const [rezultat, setRezultat] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageChange, setPageChange] = useState(null); // URL-ul noului anunț (navigare fără reîncărcare)

  // Ultima analiză vine din chrome.storage.local; dacă e golită din altă parte (ex. scenariul demo
  // sau „Șterge toate datele”), panoul revine la început.
  useEffect(() => {
    getValue(STORAGE_KEYS.CURRENT_ANALYSIS).then((r) => {
      if (r?.analiza) {
        setRezultat(r);
        setView('result');
      }
    });
    return onStorageChange([STORAGE_KEYS.CURRENT_ANALYSIS], (ch) => {
      const r = ch[STORAGE_KEYS.CURRENT_ANALYSIS];
      if (r?.analiza) setRezultat(r);
      else {
        setRezultat(null);
        setView('home');
      }
    });
  }, []);

  // Sincronizare cu dashboard-ul: pentru un anunț salvat, versiunea salvată (cu confirmările făcute
  // eventual în dashboard) este sursa de adevăr. Rezultatul afișat se derivă, nu se copiază.
  const shown = useMemo(() => {
    if (!rezultat) return null;
    const twin = data.saved.find((s) => s.analiza.id === rezultat.analiza.id)?.analiza;
    if (!twin || JSON.stringify(twin) === JSON.stringify(rezultat.analiza)) return rezultat;
    const intrebari = questionsFor(twin);
    return { ...rezultat, analiza: twin, intrebari, mesaj: templateMessage(intrebari), sursaMesaj: intrebari.length ? 'sablon' : 'niciunul' };
  }, [rezultat, data.saved]);

  // Verificarea /api/health la deschidere (nu și în modul demo: nicio cerere de rețea). Așteptăm
  // setările din storage: până atunci modDemo are valoarea implicită (false) și cererea ar pleca și în demo.
  useEffect(() => {
    if (!data.loaded || setari.modDemo) return;
    let alive = true;
    checkHealth().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, [data.loaded, setari.modDemo]);

  // Scriptul de conținut anunță navigarea SPA către alt anunț; nu reanalizăm automat (fără cereri AI nedorite).
  const autoOn = Boolean(setari.analizaAutomata) && !setari.modDemo;
  const { tabId: activeTabId, state: tabState } = useActiveTabState(autoOn);
  const shownUrl = listingUrlKey(shown?.analiza?.sursa?.url ?? null);
  useEffect(() => {
    const listener = (msg, sender) => {
      if (msg?.type !== PAGE_CHANGED_MESSAGE || (sender?.tab && sender.tab.active === false)) return false;
      if (autoOn && isAutoListingUrl(msg.url)) return false;
      setPageChange(listingUrlKey(msg.url) === shownUrl ? null : msg.url);
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [shownUrl, autoOn]);

  const aiReady = !setari.modDemo && health?.ok === true;

  // Rezultatul curent + memoria analizelor recente (AI sau demo), cu modificările făcute de utilizator.
  const saveResult = useCallback(async (r) => {
    setRezultat(r);
    await setValue(STORAGE_KEYS.CURRENT_ANALYSIS, r);
    await rememberAnalysis(r);
  }, []);

  // Analiza automată: panoul urmează tab-ul activ. Rezultatul gata al tab-ului se afișează singur;
  // „în curs” / eroare / pauză apar ca stare compactă. Nu arătăm niciodată anunțul altui tab.
  const tabSig = tabState ? `${activeTabId}|${tabState.gen}|${tabState.stare}|${tabState.cheie ?? ''}` : `${activeTabId}|-`;
  const shownRef = useRef(null);
  useEffect(() => {
    shownRef.current = rezultat;
  }, [rezultat]);
  useEffect(() => {
    if (!autoOn || tabState?.stare !== 'gata') return undefined;
    let alive = true;
    (async () => {
      const r = tabState.cheie ? await findAnalysis(tabState.cheie) : tabState.rezultat;
      if (!alive || !r) return;
      setPageChange(null);
      const cur = shownRef.current;
      if (cur?.cheie !== r.cheie || cur?.tabId !== activeTabId || !r.cheie) await saveResult({ ...r, tabId: activeTabId });
      if (alive) setView('result');
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, tabSig]);

  function retryAuto() {
    if (activeTabId != null) chrome.runtime.sendMessage({ type: AUTO_ANALYZE_MESSAGE, tabId: activeTabId });
  }

  const running = useRef(false);
  async function runWith(input, s) {
    if (running.current) return; // fără analize duble (dublu-clic, reanalizare în timp ce rulează)
    running.current = true;
    try {
      // Același anunț, același text, același mod → refolosim analiza: nicio cerere AI nouă.
      const cheie = analysisKey({ url: input.url, text: input.text, mod: s.modDemo ? 'demo' : 'ai' });
      const reuse = (rezultat?.cheie === cheie && rezultat) || (await findAnalysis(cheie));
      if (reuse) {
        await saveResult({ ...reuse, refolosit: true, tabId: input.tabId });
        setView('result');
        return;
      }
      setView('loading');
      const installId = await ensureInstallId();
      // Dacă /api/health a eșuat deja, nu mai încercăm: modul manual, cu motivul real.
      const aiIndisponibil = !s.modDemo && health && !health.ok ? health.code : null;
      const det = await runDetective({ ...input, setari: s, aiIndisponibil }, { installId });
      const q = await buildQuestions(det.analiza, { useAI: det.mod === 'ai', installId });
      // Doar analizele reușite (AI / demo) se refolosesc; completarea manuală (ex. după o eroare) nu.
      await saveResult({ ...det, metoda: input.metoda ?? null, ...q, cheie: det.mod === 'manual' ? null : cheie, refolosit: false, tabId: input.tabId });
      setView('result');
    } finally {
      running.current = false;
    }
  }

  function startAnalysis(input) {
    if (aiReady && !setari.acordAI) {
      setPending(input);
      setView('consent');
      return;
    }
    runWith(input, setari);
  }

  async function onReadPage() {
    if (busy || running.current) return;
    setPageChange(null);
    if (autoOn) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined && isAutoListingUrl(tab.url)) {
        chrome.runtime.sendMessage({ type: AUTO_ANALYZE_MESSAGE, tabId: tab.id });
        return;
      }
    }
    setBusy(true);
    const r = await readActiveTab();
    setBusy(false);
    if (!r.ok) {
      setPasteReason(READ_FAILURE[r.reason] ?? BLOCKED_PAGE);
      setView('paste');
      return;
    }
    const { text, url, titlu, metoda, pareAnunt, imagine } = r.data;
    const input = { text, tip: 'pagina', url, titlu, metoda, imagine: imagine ?? null, tabId: r.tabId };
    // Nu pare un anunț de închiriere: întrebăm înainte să trimitem textul la AI.
    if (pareAnunt === false) {
      setPending(input);
      setView('notListing');
      return;
    }
    startAnalysis(input);
  }

  async function onManual() {
    const analiza = createListingAnalysis({ id: crypto.randomUUID(), tip: 'text_lipit', analizatLa: new Date().toISOString() });
    const intrebari = questionsFor(analiza);
    await saveResult({
      analiza,
      mod: 'manual',
      eroare: null,
      retrogradate: [],
      scurt: false,
      metoda: 'manual',
      intrebari,
      mesaj: templateMessage(intrebari),
      sursaMesaj: 'sablon',
    });
    setView('result');
  }

  function onSaveField(name, input) {
    try {
      const analiza = setUserValue(shown.analiza, name, { ...input, actualizatLa: new Date().toISOString() });
      const intrebari = questionsFor(analiza);
      saveResult({ ...shown, analiza, intrebari, mesaj: templateMessage(intrebari), sursaMesaj: intrebari.length ? 'sablon' : 'niciunul' });
      // Dacă anunțul e salvat, confirmarea ajunge și în dashboard (recalculare automată acolo).
      updateSavedAnalysis(analiza);
      return null;
    } catch {
      return 'Valoarea nu este validă pentru acest câmp.';
    }
  }

  /** „Analizează alt anunț”: revine la ecranul de început (comportamentul vechiului buton de jos). */
  const onNew = () => setView('home');

  async function onRephrase() {
    setBusy(true);
    const q = await buildQuestions(shown.analiza, { useAI: true, installId: await ensureInstallId() });
    await saveResult({ ...shown, ...q });
    setBusy(false);
  }

  const autoBusy = autoOn && tabState && ['analiza', 'eroare', 'amanat'].includes(tabState.stare) && !['paste', 'consent', 'loading'].includes(view);
  const foreignResult =
    autoOn &&
    view === 'result' &&
    shown &&
    (shown.tabId === undefined ? Boolean(tabState && tabState.stare !== 'ignorat') : shown.tabId !== activeTabId || (tabState && tabState.urlKey !== listingUrlKey(shown.analiza.sursa.url)));
  const effectiveView = autoBusy ? 'auto' : foreignResult ? 'home' : view;

  return (
    <div className="min-h-screen">
      <header className="rs-glass sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
        <Brand compact />
        <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:bg-black/[0.05] hover:text-ink"
          aria-label="Analizează alt anunț"
          title="Analizează alt anunț"
        >
          <RotateCcw size={19} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openDashboard}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:bg-black/[0.05] hover:text-ink"
          aria-label="Deschide dashboard-ul"
          title="Deschide dashboard-ul"
        >
          <LayoutDashboard size={19} strokeWidth={2} aria-hidden="true" />
        </button>
        </div>
      </header>

      <main className="space-y-3 p-3 pb-6">
        <div className="flex px-1">
          <AiStatus setari={setari} health={health} />
        </div>

        {pageChange && effectiveView !== 'loading' && (
          <Notice>
            <span className="font-medium">Ai deschis alt anunț în acest tab.</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={onReadPage} disabled={busy}>
                Analizează pagina nouă
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPageChange(null)}>
                Ignoră
              </Button>
            </div>
          </Notice>
        )}

        {effectiveView === 'home' && (
          <>
            <Card>
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-soft text-blue" aria-hidden="true">
                <ScanSearch size={22} strokeWidth={2} />
              </span>
              <h1 className="text-[20px] font-semibold tracking-tight text-ink">Analizează un anunț</h1>
              <p className="mt-1 text-[14px] text-muted">Citim pagina doar când apeși butonul. Datele tale financiare nu părăsesc browserul.</p>
              <div className="mt-4 space-y-2">
                <Button size="lg" className="w-full" icon={FileSearch} onClick={onReadPage} disabled={busy}>
                  {busy ? 'Se citește…' : 'Analizează pagina curentă'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  icon={ClipboardPaste}
                  onClick={() => {
                    setPasteReason(null);
                    setView('paste');
                  }}
                >
                  Lipește textul anunțului
                </Button>
                <Button variant="secondary" size="lg" className="w-full" icon={PenLine} onClick={onManual}>
                  Completează manual
                </Button>
              </div>
            </Card>
            <Card>
              <AutoAnalysisSwitch settings={setari} compact />
            </Card>
            <Card>
              <Switch
                checked={setari.modDemo}
                onChange={(v) => updateSettings({ modDemo: v })}
                label="Mod demonstrativ"
                description="Răspunsuri înregistrate, fără internet."
              />
            </Card>
          </>
        )}

        {effectiveView === 'notListing' && (
          <Card title="Pagina nu pare un anunț de închiriere" icon={TriangleAlert}>
            <p className="text-[14px] text-muted">
              Nu am găsit semnele unui anunț de închiriere (preț, „chirie”, camere, suprafață). Ca să nu trimitem textul degeaba la AI, alege:
            </p>
            <div className="mt-4 space-y-2">
              <Button size="lg" className="w-full" onClick={() => startAnalysis(pending)}>
                Analizează oricum
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => {
                  setPasteReason(null);
                  setView('paste');
                }}
              >
                Lipește textul anunțului
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setView('home')}>
                Înapoi
              </Button>
            </div>
          </Card>
        )}

        {effectiveView === 'paste' && (
          <PasteForm
            reason={pasteReason}
            busy={busy}
            onCancel={() => setView('home')}
            onSubmit={(text) => startAnalysis({ text, tip: 'text_lipit', url: null, titlu: null, metoda: 'text_lipit' })}
          />
        )}

        {effectiveView === 'consent' && (
          <ConsentCard
            onAccept={async () => runWith(pending, await updateSettings({ acordAI: true }))}
            onDecline={() => runWith(pending, { ...setari, acordAI: false })}
          />
        )}

        {effectiveView === 'loading' && (
          <Card>
            <div className="flex items-start gap-3" role="status">
              <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-brand-soft text-blue" aria-hidden="true">
                <FileSearch size={20} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-ink">Se analizează anunțul…</p>
                <p className="mt-0.5 text-[13px] text-muted">Citim textul și verificăm că fiecare informație are o dovadă în anunț.</p>
              </div>
            </div>
          </Card>
        )}

        {effectiveView === 'auto' && <AutoStatusCard state={tabState} onRetry={retryAuto} />}

        {effectiveView === 'result' && shown && (
          <Result
            key={shown.analiza.id}
            rezultat={shown}
            data={data}
            aiReady={aiReady}
            busy={busy}
            onSaveField={onSaveField}
            onMessageChange={(mesaj) => saveResult({ ...shown, mesaj })}
            onRephrase={onRephrase}
          />
        )}

        {effectiveView !== 'result' && (
          <Button variant="ghost" className="w-full" icon={LayoutDashboard} onClick={openDashboard}>
            Deschide dashboard-ul
          </Button>
        )}
      </main>
    </div>
  );
}
