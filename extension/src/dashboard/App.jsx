// RentSmart — dashboard-ul (pagină a extensiei): Bugetul tău (doar la prima utilizare) · Profilul meu financiar ·
// Anunțuri salvate · Alternative · Comparație · Economii în timp · Setări.
// Rute fără meniu: #bun-venit (prima instalare) și #configurare (formularul de buget).
// După configurare, paginile primei utilizări dispar definitiv (navigation.js).
// Toate valorile derivate se recalculează din chrome.storage.local la fiecare schimbare (și din panoul lateral).
import { Building2, Columns3, House, Lock, Route, Search, Settings, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useBnrRateRefresh } from '../storage/useBnrRateRefresh.js';
import { deriveAll } from '../app/derive.js';
import { useAppData } from '../storage/useAppData.js';
import CrossroadsSection from '../crossroads/CrossroadsSection.jsx';
import { Brand, DemoBadge, Notice } from '../ui/components.jsx';
import ListingsSection from './ListingsSection.jsx';
import { ComparisonSection, SettingsSection } from './OtherSections.jsx';
import PassportSection from './PassportSection.jsx';
import AlternativesSection from './AlternativesSection.jsx';
import { BudgetSection, ExampleBanner, SetupSection, WelcomePage } from './Onboarding.jsx';
import { hasProfile } from '../storage/profile.js';
import { useExampleActive } from '../storage/useExampleActive.js';
import { isOnboardingDone, resolveSection, visibleSections } from './navigation.js';

const SECTIONS = [
  { id: 'buget', label: 'Bugetul tău', icon: House },
  { id: 'passport', label: 'Profilul meu financiar', icon: Wallet },
  { id: 'anunturi', label: 'Anunțuri salvate', icon: Building2 },
  { id: 'alternative', label: 'Alternative', icon: Search },
  { id: 'comparatie', label: 'Comparație', icon: Columns3 },
  { id: 'crossroads', label: 'Economii în timp', icon: Route },
  { id: 'setari', label: 'Setări', icon: Settings },
];
/** Rute fără element în meniu. */
const HIDDEN = ['bun-venit', 'configurare'];
const MENU_FOR = { configurare: 'buget' };

function Sidebar({ sections, active, onSelect, savedCount, demo }) {
  return (
    <aside className="rs-glass border-b border-black/[0.06] md:sticky md:top-0 md:flex md:h-screen md:w-[248px] md:flex-none md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3 md:pb-6">
        <Brand compact />
        <span className="md:hidden">{demo && <DemoBadge />}</span>
      </div>
      <nav aria-label="Secțiuni" className="flex flex-wrap gap-1 px-3 pb-3 md:flex-col md:flex-nowrap md:pb-0">
        <div className="hidden px-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase md:block">Spațiul tău</div>
        {sections.map(({ id, label, icon: Icon }) => {
          const on = id === (MENU_FOR[active] ?? active);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[14px] ${
                on ? 'bg-blue/10 font-semibold text-brand' : 'text-ink hover:bg-black/[0.04]'
              }`}
            >
              <Icon size={17} strokeWidth={2} className={on ? 'text-blue' : 'text-muted'} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {id === 'anunturi' && savedCount > 0 && (
                <span className="num min-w-5 rounded-full bg-black/[0.06] px-1.5 text-center text-[12px] font-medium text-muted">{savedCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto hidden space-y-3 p-5 md:block">
        {demo && <DemoBadge />}
        <p className="flex items-start gap-2 text-[12px] leading-snug text-muted">
          <Lock size={14} strokeWidth={2} className="mt-0.5 flex-none" aria-hidden="true" />
          Datele tale financiare rămân doar în acest browser.
        </p>
      </div>
    </aside>
  );
}

export default function App() {
  const data = useAppData();
  useBnrRateRefresh(data);
  // Secțiunea inițială poate veni din URL (ex. dashboard.html#alternative, deschis de „Caută alternative”).
  const fromHash = () => {
    const h = window.location.hash.replace('#', '');
    return SECTIONS.some((s) => s.id === h) || HIDDEN.includes(h) ? h : null;
  };
  // null = pagina implicită: „Bugetul tău” la prima utilizare, apoi „Profilul meu financiar”.
  const [active, setActive] = useState(() => fromHash());
  const [justSaved, setJustSaved] = useState(false);
  /** Navigarea între secțiuni (actualizează și fragmentul URL: reîncărcarea rămâne pe aceeași pagină). */
  const go = (id) => {
    setJustSaved(false);
    setActive(id);
    history.replaceState(null, '', `#${id}`);
  };
  useEffect(() => {
    const onHash = () => {
      const h = fromHash();
      if (h) setActive(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const derived = useMemo(() => deriveAll(data), [data]);
  const exampleActive = useExampleActive();
  const ready = data.loaded && exampleActive !== null;
  const done = ready && isOnboardingDone({ passport: data.passport, settings: data.settings, exampleActive });
  const section = resolveSection(active, done);
  // Fragmentul URL urmează pagina afișată (ex. #buget → #passport după configurare), ca reîncărcarea să rămână acolo.
  useEffect(() => {
    if (ready && window.location.hash !== `#${section}`) history.replaceState(null, '', `#${section}`);
  }, [ready, section]);

  if (!ready) return null;
  if (section === 'bun-venit') return <WelcomePage onSetup={() => go('configurare')} onExample={() => go('buget')} />;
  return (
    <div className="min-h-screen md:flex">
      <Sidebar sections={visibleSections(SECTIONS, done)} active={section} onSelect={go} savedCount={data.saved.length} demo={data.settings.modDemo} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1120px]">
          <ExampleBanner onConfigure={() => go('configurare')} />
          {section === 'buget' && (
            <BudgetSection
              passport={data.passport}
              items={derived.items}
              ctx={derived.ctx}
              saved={justSaved}
              onEdit={() => go('configurare')}
              onExample={() => go('buget')}
              onOpenListings={() => go('anunturi')}
            />
          )}
          {section === 'configurare' && (
            <SetupSection
              key={JSON.stringify(data.passport)}
              passport={data.passport}
              onSaved={() => {
                // Configurarea s-a încheiat: „Bugetul tău” dispare, datele se văd în „Profilul meu financiar”.
                go('passport');
                setJustSaved(true);
              }}
              onCancel={hasProfile(data.passport) ? () => go('buget') : null}
            />
          )}
          {section === 'passport' && justSaved && (
            <Notice tone="ok" className="mb-5">
              Datele tale au fost salvate. Le poți vedea și modifica oricând aici, în „Profilul meu financiar”.
            </Notice>
          )}
          {section === 'passport' && <PassportSection passport={data.passport} rate={data.rate} rateStatus={data.rateStatus} />}
          {section === 'anunturi' && <ListingsSection items={derived.items} ctx={derived.ctx} />}
          {section === 'alternative' && <AlternativesSection data={data} derived={derived} />}
          {section === 'comparatie' && <ComparisonSection items={derived.items} comparatie={derived.comparatie} ctx={derived.ctx} />}
          {section === 'crossroads' && <CrossroadsSection data={data} derived={derived} />}
          {section === 'setari' && <SettingsSection settings={data.settings} />}
        </div>
      </main>
    </div>
  );
}
