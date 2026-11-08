// RentSmart — anunțurile salvate: lista, apoi detaliile (Cost real, costurile tale, confirmări).
import { useState } from 'react';
import { ArrowLeft, Building2, Receipt, Trash2 } from 'lucide-react';
import { averageMonthlyCost } from '../shared/engine/compare.js';
import { setUserValue } from '../shared/contracts/factories.js';
import { removeSavedListing, updateSavedAnalysis, updateUserCosts } from '../storage/appData.js';
import { Button, Card, DemoBadge, EmptyState, ListingLink, Metric, Notice, PageHeader, Pill, SegmentedControl, inputCls } from '../ui/components.jsx';
import FieldList from '../ui/FieldList.jsx';
import PropertySummary from '../ui/PropertySummary.jsx';
import TrueCostView from '../ui/TrueCostView.jsx';
import { formatRON, formatRONWithEUR } from '../ui/format.js';
import { useConfirm } from '../ui/useConfirm.jsx';
import { userCostsFromForm } from './forms.js';

const NEED_PASSPORT = 'Completează profilul financiar ca să vezi cât te costă de fapt fiecare anunț (folosim transportul și bugetul tău).';

function UserCostsForm({ saved }) {
  const c = saved.costuriUtilizator;
  const [values, setValues] = useState({
    transportLunarRON: c.transportLunarRON ?? '',
    alteCosturiLunareRON: c.alteCosturiLunareRON ?? '',
    costuriMutareRON: c.costuriMutareRON ?? '',
  });
  const [errors, setErrors] = useState({});
  const [ok, setOk] = useState(false);
  const fields = [
    ['transportLunarRON', 'Transport lunar de la această adresă', 'Gol = același ca transportul actual (presupus).'],
    ['alteCosturiLunareRON', 'Alte costuri lunare (internet etc.)', 'Gol = 0.'],
    ['costuriMutareRON', 'Costuri de mutare și dotare (o dată)', 'Gol = 0.'],
  ];
  async function onSave() {
    const r = userCostsFromForm(values);
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    await updateUserCosts(saved.analiza.id, r.costuri);
    setOk(true);
  }
  return (
    <Card title="Costurile tale" icon={Receipt} description="Pentru acest apartament.">
      <div className="space-y-4">
        {fields.map(([k, label, help]) => (
          <label key={k} className="block">
            <span className="text-[13px] font-medium text-ink">{label}</span>
            <span className="relative mt-1.5 block">
              <input
                className={`${inputCls} num pr-14 ${errors[k] ? 'border-red' : ''}`}
                inputMode="numeric"
                value={values[k]}
                onChange={(e) => {
                  setOk(false);
                  setValues((v) => ({ ...v, [k]: e.target.value }));
                }}
                aria-label={label}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted">RON</span>
            </span>
            <span className="mt-1 block text-[12px] text-muted">{help}</span>
            {errors[k] && <span className="block text-[12px] font-medium text-ask">{errors[k]}</span>}
          </label>
        ))}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onSave}>
            Salvează costurile
          </Button>
          {ok && <span className="text-[13px] font-medium text-found">Salvat.</span>}
        </div>
      </div>
    </Card>
  );
}

function Detail({ item, ctx, onBack }) {
  const [tab, setTab] = useState('cost');
  const { saved, tc } = item;
  const a = saved.analiza;

  function onSaveField(name, input) {
    try {
      updateSavedAnalysis(setUserValue(a, name, { ...input, actualizatLa: new Date().toISOString() }));
      return null;
    } catch {
      return 'Valoarea nu este validă pentru acest câmp.';
    }
  }

  return (
    <div>
      <Button variant="ghost" icon={ArrowLeft} className="-ml-2 mb-4" onClick={onBack}>
        Toate anunțurile
      </Button>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <SegmentedControl
            label="Detaliile anunțului"
            value={tab}
            onChange={setTab}
            options={[
              ['cost', 'Cost real'],
              ['campuri', 'Informații și confirmări'],
            ]}
          />
          {tab === 'cost' ? (
            <Card>{ctx ? <TrueCostView tc={tc} exchangeRate={ctx.exchangeRate} rateStatus={ctx.rateStatus} costReference={ctx.costReference} /> : <Notice tone="warn">{NEED_PASSPORT}</Notice>}</Card>
          ) : (
            <Card>
              <FieldList analiza={a} onSaveField={onSaveField} />
            </Card>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <PropertySummary analiza={a} exchangeRate={ctx?.exchangeRate ?? null} tc={tc?.complet ? tc : null} />
          <UserCostsForm key={JSON.stringify(saved.costuriUtilizator)} saved={saved} />
        </div>
      </div>
    </div>
  );
}

export function ListingCard({ item, onOpen, exchangeRate }) {
  const [confirm, dialog] = useConfirm();
  const { saved, tc } = item;
  const a = saved.analiza;
  const avg = averageMonthlyCost(tc);
  const overBudget = tc?.avertizari.some((w) => w.cod === 'CHIRIE_PESTE_BUGET');
  return (
    <Card className="flex flex-col">
      {dialog}
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-brand-soft text-blue" aria-hidden="true">
          <Building2 size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-snug font-semibold text-ink">{a.titlu ?? 'Anunț fără titlu'}</h3>
          <ListingLink url={a.sursa.url} className="mt-0.5" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {a.demonstrativ && <DemoBadge />}
        {tc?.complet && !overBudget && !tc.folosesteEstimari && <Pill tone="ok">toate costurile cunoscute</Pill>}
        {tc && !tc.complet && <Pill tone="ask">lipsesc date</Pill>}
        {overBudget && <Pill tone="ask">peste bugetul pentru chirie</Pill>}
        {tc?.folosesteEstimari && <Pill tone="unclear">unele costuri estimate</Pill>}
      </div>
      {tc?.complet ? (
        <>
          <div className="num mt-4 text-[13px] text-muted">
            Chirie <span className="text-[20px] font-semibold text-ink">{formatRONWithEUR(tc.lunar.chirie.sumaRON, exchangeRate)}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Vara" value={formatRON(tc.totaluri.lunarVara)} />
            <Metric label="Iarna" value={formatRON(tc.totaluri.lunarIarna)} />
            <Metric label="Medie/lună" value={formatRON(avg)} />
          </div>
          <p className="num mt-3 text-[13px] text-muted">
            La mutare: <span className="font-semibold text-ink">{formatRON(tc.totaluri.plataLaMutare)}</span> (fără prima chirie)
          </p>
        </>
      ) : (
        <p className="mt-4 text-[14px] text-muted">{tc ? 'Nu putem calcula încă tot costul: lipsesc date din anunț.' : 'Completează profilul financiar ca să vezi costul.'}</p>
      )}
      <div className="mt-auto flex gap-2 pt-4">
        <Button variant="secondary" className="flex-1" onClick={onOpen}>
          Deschide
        </Button>
        <Button
          variant="ghost"
          icon={Trash2}
          className="text-ask hover:bg-ask-soft"
          aria-label={`Șterge anunțul ${a.titlu ?? ''}`}
          onClick={async () => {
            const ok = await confirm({
              title: 'Ștergi anunțul?',
              message: `„${a.titlu ?? 'Anunț fără titlu'}” va fi eliminat din anunțurile tale salvate, împreună cu confirmările și costurile tale.`,
              confirmLabel: 'Șterge anunțul',
              danger: true,
            });
            if (ok) removeSavedListing(a.id);
          }}
        >
          Șterge
        </Button>
      </div>
    </Card>
  );
}

export default function ListingsSection({ items, ctx }) {
  const [openId, setOpenId] = useState(null);
  const open = items.find((i) => i.saved.analiza.id === openId);
  if (open) return <Detail item={open} ctx={ctx} onBack={() => setOpenId(null)} />;
  return (
    <div>
      <PageHeader
        title="Anunțuri salvate"
        description={items.length ? `${items.length} ${items.length === 1 ? 'anunț salvat' : 'anunțuri salvate'}, cu tot ce ai plăti lunar și la mutare.` : 'Anunțurile salvate din panoul lateral apar aici.'}
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="Nu ai salvat încă niciun anunț">
            Analizează un anunț în panoul lateral și apasă „Salvează anunțul”.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {!ctx && <Notice tone="warn">{NEED_PASSPORT}</Notice>}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <ListingCard key={item.saved.analiza.id} item={item} exchangeRate={ctx?.exchangeRate ?? null} onOpen={() => setOpenId(item.saved.analiza.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
