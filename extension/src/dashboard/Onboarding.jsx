// RentSmart — prima utilizare: pagina de bun venit, formularul de configurare și „Bugetul tău”.
// Folosește designul și componentele existente. Profilul se salvează în Financial Passport (aceeași sursă
// de adevăr pentru tot motorul). Fără verdicte financiare până nu există un apartament analizat.
import { useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, FlaskConical, HardDrive, ListChecks, PencilLine, PiggyBank, ScanSearch, ShieldCheck, Target, TrendingUp, Wallet } from 'lucide-react';
import { enterExample, exitExample, hasProfile, saveProfile } from '../storage/profile.js';
import { useExampleActive } from '../storage/useExampleActive.js';
import { monthlyLeftoverNow } from '../shared/engine/budget.js';
import { Brand, Button, Card, EmptyState, Notice, PageHeader, StatCard, inputCls, selectCls } from '../ui/components.jsx';
import { formatRON } from '../ui/format.js';
import { useConfirm } from '../ui/useConfirm.jsx';
import { ListingCard } from './ListingsSection.jsx';
import { MOVE_OPTIONS, OPTIONAL_FIELDS, SETUP_FIELDS, profileFromSetupForm, setupFormFrom } from './setupForm.js';

/** Banda „Exemplu cu date fictive”, cu întoarcerea la datele proprii. */
export function ExampleBanner({ onConfigure }) {
  const active = useExampleActive();
  if (!active) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-orange/30 bg-unclear-soft px-4 py-3">
      <div className="flex items-start gap-2.5">
        <FlaskConical size={18} className="mt-0.5 flex-none text-orange" aria-hidden="true" />
        <div>
          <p className="text-[15px] font-semibold text-ink">Exemplu cu date fictive</p>
          <p className="text-[13px] text-muted">Datele tale nu au fost modificate. Le găsești la loc când ieși din exemplu.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => exitExample()}>
          Ieși din exemplu
        </Button>
        <Button size="sm" onClick={async () => {
          await exitExample();
          onConfigure();
        }}>
          Configurează datele tale
        </Button>
      </div>
    </div>
  );
}

/** Pagina de bun venit (prima instalare). */
export function WelcomePage({ onSetup, onExample }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Card className="p-8 sm:p-10">
          <h1 className="text-center text-[30px] leading-tight font-semibold tracking-[-0.02em] text-ink">Bine ai venit în RentSmart!</h1>
          <p className="mt-3 text-center text-[17px] leading-relaxed text-muted">Află cât te costă cu adevărat o chirie și dacă se potrivește bugetului tău.</p>
          <ul className="mx-auto mt-7 max-w-[400px] space-y-3">
            <li className="flex items-center gap-3 text-[16px] text-ink">
              <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-brand-soft text-blue" aria-hidden="true">
                <ListChecks size={19} />
              </span>
              Completezi câteva date despre bugetul tău.
            </li>
            <li className="flex items-center gap-3 text-[16px] text-ink">
              <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-found-soft text-green" aria-hidden="true">
                <HardDrive size={19} />
              </span>
              Datele rămân salvate în browserul tău.
            </li>
          </ul>
          <div className="mt-8 space-y-3">
            <Button size="lg" className="w-full text-[16px]" onClick={onSetup} autoFocus>
              Configurează RentSmart
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full text-[16px]"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await enterExample();
                onExample();
              }}
            >
              Încearcă un exemplu
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoneyInput({ field, value, error, onChange, inputRef }) {
  const id = `setup-${field.key}`;
  return (
    <label className="block" htmlFor={id}>
      <span className="text-[15px] font-medium text-ink">{field.label}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-muted">{field.help}</span>
      <span className="relative mt-2 block">
        <input
          id={id}
          ref={inputRef}
          className={`${inputCls} num h-12 pr-12 text-[16px] ${error ? 'border-red' : ''}`}
          inputMode="numeric"
          autoComplete="off"
          placeholder={field.example}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] text-muted">lei</span>
      </span>
      {error && (
        <span id={`${id}-err`} className="mt-1.5 block text-[13px] font-medium text-ask">
          {error}
        </span>
      )}
    </label>
  );
}

/** Formularul de configurare (și „Modifică datele”). */
export function SetupSection({ passport, onSaved, onCancel }) {
  const [values, setValues] = useState(() => setupFormFrom(passport));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => Boolean(passport));
  const [confirm, dialog] = useConfirm();
  const firstRef = useRef(null);
  const refs = useRef({});
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  const set = (k) => (v) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSave() {
    setSaveError(null);
    let r = profileFromSetupForm(values, passport);
    if (!r.ok && r.needsConfirm) {
      const names = r.needsConfirm.map((k) => (k === 'rezerva' ? 'rezerva de siguranță' : 'momentul mutării'));
      const ok = await confirm({
        title: 'Câteva informații lipsesc',
        message: `Nu ai completat ${names.join(' și ')}. Putem considera${r.needsConfirm.includes('rezerva') ? ' rezervă 0 lei' : ''}${r.needsConfirm.length === 2 ? ' și' : ''}${r.needsConfirm.includes('mutare') ? ' mutarea în luna aceasta' : ''}? Le poți schimba oricând.`,
        confirmLabel: 'Da, continuă',
      });
      if (!ok) {
        setMoreOpen(true);
        return;
      }
      r = profileFromSetupForm(values, passport, { confirmDefaults: true });
    }
    if (!r.ok) {
      setErrors(r.errors);
      const first = [...SETUP_FIELDS, ...OPTIONAL_FIELDS, { key: 'mutareAlta' }].find((f) => r.errors[f.key]);
      if (first && ['rezerva', 'mutareAlta'].includes(first.key)) setMoreOpen(true);
      if (first) setTimeout(() => refs.current[first.key]?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      await saveProfile(r.passport);
      onSaved();
    } catch {
      setSaveError('Nu am putut salva datele. Verifică valorile și încearcă din nou. Ce ai scris a rămas în formular.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[860px]">
      {dialog}
      <PageHeader title="Spune-ne câteva lucruri despre bugetul tău" description="Folosim aceste date ca să calculăm cât te-ar costa o locuință." />
      <Card padded={false}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <div className="grid gap-x-6 gap-y-6 p-6 sm:grid-cols-2 sm:p-8">
            {SETUP_FIELDS.map((f, i) => (
              <MoneyInput
                key={f.key}
                field={f}
                value={values[f.key]}
                error={errors[f.key]}
                onChange={set(f.key)}
                inputRef={(el) => {
                  refs.current[f.key] = el;
                  if (i === 0) firstRef.current = el;
                }}
              />
            ))}
          </div>
          <div className="border-t border-line px-6 py-4 sm:px-8">
            <button
              type="button"
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-[15px] font-medium text-brand"
              aria-expanded={moreOpen}
              aria-controls="setup-more"
              onClick={() => setMoreOpen((o) => !o)}
            >
              <ChevronDown size={18} className={moreOpen ? 'rotate-180' : ''} aria-hidden="true" />
              Mai multe opțiuni
            </button>
            {moreOpen && (
              <div id="setup-more" className="mt-4 grid gap-x-6 gap-y-6 pb-2 sm:grid-cols-2">
                {OPTIONAL_FIELDS.map((f) => (
                  <MoneyInput key={f.key} field={f} value={values[f.key]} error={errors[f.key]} onChange={set(f.key)} inputRef={(el) => (refs.current[f.key] = el)} />
                ))}
                <div>
                  <label htmlFor="setup-mutare" className="text-[15px] font-medium text-ink">
                    Când vrei să te muți?
                  </label>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">Ne ajută să vedem cât poți economisi până atunci.</span>
                  <select id="setup-mutare" className={`${selectCls} mt-2 h-12 text-[16px]`} value={values.mutare} onChange={(e) => set('mutare')(e.target.value)}>
                    <option value="">Alege…</option>
                    {MOVE_OPTIONS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {values.mutare === 'alta' && (
                    <label htmlFor="setup-mutareAlta" className="mt-3 block">
                      <span className="text-[14px] text-ink">Peste câte luni? (0–60)</span>
                      <input
                        id="setup-mutareAlta"
                        ref={(el) => (refs.current.mutareAlta = el)}
                        className={`${inputCls} num mt-1.5 h-12 text-[16px] ${errors.mutareAlta ? 'border-red' : ''}`}
                        inputMode="numeric"
                        value={values.mutareAlta}
                        onChange={(e) => set('mutareAlta')(e.target.value)}
                        aria-invalid={errors.mutareAlta ? 'true' : undefined}
                      />
                    </label>
                  )}
                  {errors.mutareAlta && <span className="mt-1.5 block text-[13px] font-medium text-ask">{errors.mutareAlta}</span>}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-[#fbfbfd] px-6 py-5 sm:px-8">
            <Button type="submit" size="lg" className="text-[16px]" disabled={busy}>
              {busy ? 'Se salvează…' : 'Salvează și continuă'}
            </Button>
            {onCancel && (
              <Button variant="ghost" size="lg" onClick={onCancel}>
                Renunță
              </Button>
            )}
            {Object.values(errors).some(Boolean) && <span className="text-[14px] font-medium text-ask">Verifică câmpurile marcate cu roșu.</span>}
          </div>
          {saveError && (
            <div className="px-6 pb-5 sm:px-8">
              <Notice tone="danger">{saveError}</Notice>
            </div>
          )}
        </form>
      </Card>
      <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
        <ShieldCheck size={15} className="text-green" aria-hidden="true" />
        Nu îți cerem nume, CNP, telefon sau adresă. Datele rămân doar în acest browser.
      </p>
    </div>
  );
}

/** „Bugetul tău”: rezumatul profilului (fără verdicte) + următorul pas. */
export function BudgetSection({ passport, items, ctx, saved, onEdit, onExample, onOpenListings }) {
  const [windowId, setWindowId] = useState(null);
  const [panelHint, setPanelHint] = useState(false);
  useEffect(() => {
    chrome.windows
      .getCurrent()
      .then((w) => setWindowId(w.id))
      .catch(() => {});
  }, []);

  if (!hasProfile(passport)) {
    return (
      <div>
        <PageHeader title="Bugetul tău" description="Află cât te costă cu adevărat o chirie și dacă se potrivește bugetului tău." />
        <Card>
          <EmptyState
            icon={Wallet}
            title="Încă nu ai completat datele despre buget"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="lg" onClick={onEdit}>
                  Configurează RentSmart
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={async () => {
                    await enterExample();
                    onExample();
                  }}
                >
                  Încearcă un exemplu
                </Button>
              </div>
            }
          >
            Completezi câteva date despre bugetul tău. Datele rămân salvate în browserul tău.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const p = passport;
  const leftover = monthlyLeftoverNow(p);
  const moveText = p.lunaMutarii === 0 ? 'luna aceasta' : p.lunaMutarii === 1 ? 'peste o lună' : `peste ${p.lunaMutarii} luni`;
  return (
    <div>
      {saved && (
        <div className="mb-5">
          <Notice tone="ok">Datele tale au fost salvate.</Notice>
        </div>
      )}
      <PageHeader title="Bugetul tău" description="Iată situația ta financiară pe baza datelor introduse." />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Wallet} accent="blue" label="Venit lunar" value={formatRON(p.venitNetLunar)} hint="după taxe" />
        <StatCard icon={ListChecks} accent="gray" label="Cheltuieli lunare" value={formatRON(p.cheltuieliEsentialeLunare)} hint="fără locuință și transport" />
        <StatCard icon={PiggyBank} accent="green" label="Economii disponibile" value={formatRON(p.economiiDisponibile)} hint={`rezervă de siguranță: ${formatRON(p.rezervaMinima)}`} />
        <StatCard icon={Target} accent="indigo" label="Buget dorit pentru locuință" value={p.bugetMaximChirie > 0 ? formatRON(p.bugetMaximChirie) : 'Nesetat'} hint="pe lună, pentru chirie" />
        <StatCard
          icon={TrendingUp}
          accent={leftover < 0 ? 'red' : 'green'}
          label="Bani rămași lunar"
          value={formatRON(leftover)}
          valueClass={leftover < 0 ? 'text-ask' : ''}
          hint="după cheltuieli, transport și locuința de acum"
        />
        <StatCard icon={CalendarClock} accent="orange" label="Mutarea" value={moveText.charAt(0).toUpperCase() + moveText.slice(1)} hint="o poți schimba oricând" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-brand-soft text-blue" aria-hidden="true">
              <ScanSearch size={22} />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold text-ink">Acum poți analiza primul apartament.</h2>
              <p className="mt-0.5 text-[14px] text-muted">Îți arătăm costul real și dacă se potrivește bugetului tău.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              icon={ScanSearch}
              onClick={() => {
                setPanelHint(true);
                if (windowId !== null) chrome.sidePanel.open({ windowId }).catch(() => {});
              }}
            >
              Analizează un apartament
            </Button>
            <Button variant="secondary" size="lg" icon={PencilLine} onClick={onEdit}>
              Modifică datele
            </Button>
          </div>
        </div>
        {panelHint && (
          <ol className="mt-5 grid gap-3 border-t border-line pt-5 text-[15px] text-ink sm:grid-cols-3">
            {['Deschide un anunț de închiriere (de exemplu pe Storia, OLX sau Publi24).', 'Apasă iconița RentSmart din bara browserului.', 'Apasă „Analizează pagina curentă”.'].map((t, i) => (
              <li key={t} className="flex gap-3 rounded-[12px] bg-fill p-3">
                <span className="num inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white text-[14px] font-semibold text-brand ring-1 ring-line">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {items.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[20px] font-semibold tracking-tight text-ink">Apartamentele tale salvate</h2>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <ListingCard key={item.saved.analiza.id} item={item} exchangeRate={ctx?.exchangeRate ?? null} onOpen={onOpenListings} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
