// RentSmart — Financial Passport + cursul EUR → RON (BNR automat sau introdus de tine). Datele rămân doar în chrome.storage.local.
import { useState } from 'react';
import { CalendarClock, Euro, Lock, PiggyBank, ShieldCheck, Target, Wallet } from 'lucide-react';
import { clearExchangeRate, savePassport, saveExchangeRate, switchToBnrRate } from '../storage/appData.js';
import { Button, Card, Notice, PageHeader, StatCard, inputCls } from '../ui/components.jsx';
import RateInfo from '../ui/RateInfo.jsx';
import { formatRON } from '../ui/format.js';
import { PASSPORT_FIELDS, parseRate, passportFromForm, passportToForm } from './forms.js';

/** Grupurile formularului: aceleași câmpuri și validări, doar organizate. */
const GROUPS = [
  { title: 'Venituri și cheltuieli lunare', description: 'Ce intră și ce iese în fiecare lună, fără chiria nouă.', keys: ['venitNetLunar', 'cheltuieliEsentialeLunare', 'costLocuintaActuala', 'transportActualLunar'] },
  { title: 'Economii și siguranță', description: 'Câți bani ai pus deoparte și cât vrei să păstrezi mereu pentru urgențe.', keys: ['economiiDisponibile', 'rezervaMinima'] },
  { title: 'Mutarea', description: 'Cât vrei să dai pe chirie și când vrei să te muți.', keys: ['bugetMaximChirie', 'lunaMutarii', 'obiectiv'] },
];
const FIELD = Object.fromEntries(PASSPORT_FIELDS.map((f) => [f.key, f]));
const EXTRA = {
  lunaMutarii: { label: 'Luna mutării', help: 'Peste câte luni te muți: 0 = luna aceasta, maximum 60.', suffix: 'luni', inputMode: 'numeric' },
  obiectiv: { label: 'Obiectiv (opțional)', help: 'Ex. „Apartament aproape de facultate”.', wide: true },
};

function Input({ id, label, help, error, suffix = 'RON', inputMode = 'numeric', wide = false, value, onChange }) {
  const errId = `${id}-err`;
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <span className="relative mt-1.5 block">
        <input
          className={`${inputCls} ${suffix ? 'pr-14' : ''} num ${error ? 'border-red' : ''}`}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          aria-label={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errId : undefined}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted">{suffix}</span>}
      </span>
      {help && <span className="mt-1 block text-[12px] text-muted">{help}</span>}
      {error && (
        <span id={errId} className="mt-1 block text-[12px] font-medium text-ask">
          {error}
        </span>
      )}
    </label>
  );
}

function PassportForm({ passport }) {
  const [values, setValues] = useState(() => passportToForm(passport));
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => {
    setSaved(false);
    setValues((v) => ({ ...v, [k]: e.target.value }));
  };

  async function onSave() {
    const r = passportFromForm(values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    await savePassport(r.passport);
    setSaved(true);
  }

  return (
    <Card padded={false}>
      {GROUPS.map((g, gi) => (
        <div key={g.title} className={`p-5 sm:p-6 ${gi > 0 ? 'border-t border-line' : ''}`}>
          <h3 className="text-[15px] font-semibold text-ink">{g.title}</h3>
          <p className="mt-0.5 mb-4 text-[13px] text-muted">{g.description}</p>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {g.keys.map((key) => {
              const base = FIELD[key] ?? {};
              const extra = EXTRA[key] ?? {};
              return (
                <Input
                  key={key}
                  id={`pp-${key}`}
                  label={extra.label ?? base.label}
                  help={extra.help ?? base.help}
                  suffix={key === 'obiectiv' ? null : (extra.suffix ?? 'RON')}
                  inputMode={key === 'obiectiv' ? 'text' : (extra.inputMode ?? 'numeric')}
                  wide={extra.wide}
                  value={values[key]}
                  onChange={set(key)}
                  error={errors[key]}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-[#fbfbfd] px-5 py-4 sm:px-6 rounded-b-[var(--radius-card)]">
        <Button onClick={onSave}>Salvează datele financiare</Button>
        {saved && <span className="text-[13px] font-medium text-found">Salvat. Costurile s-au recalculat.</span>}
        {Object.keys(errors).length > 0 && <span className="text-[13px] font-medium text-ask">Verifică câmpurile marcate.</span>}
      </div>
    </Card>
  );
}

function RateForm({ rate, rateStatus }) {
  const [value, setValue] = useState(rate?.sursa === 'utilizator' ? String(rate.eurToRon) : '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  async function onSave() {
    const n = parseRate(value);
    if (n === null) {
      setError('Introdu un curs pozitiv, de exemplu 4,97.');
      return;
    }
    setError(null);
    await saveExchangeRate(n);
  }
  async function onUseBnr() {
    setBusy(true);
    setInfo(null);
    const r = await switchToBnrRate();
    setBusy(false);
    if (r === 'eroare') setInfo('Cursul BNR nu a putut fi descărcat acum. Verifică conexiunea la internet.');
    if (r === 'omis') setInfo('În modul demonstrativ nu descărcăm cursul (nicio cerere de rețea).');
  }
  const manual = rate && rate.sursa !== 'bnr';
  return (
    <Card title="Curs EUR → RON" icon={Euro} description="Cursul BNR, descărcat automat de pe cursbnr.ro. Cererea nu conține date despre tine.">
      {rate ? (
        <div className="rounded-[12px] bg-fill p-3">
          <RateInfo rate={rate} status={rateStatus} />
        </div>
      ) : (
        <Notice tone="warn">{rateStatus?.ok === false ? 'Cursul BNR nu a putut fi descărcat. Verifică conexiunea sau introdu cursul manual.' : 'Cursul BNR se descarcă…'}</Notice>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={onUseBnr}>
          {manual ? 'Folosește cursul BNR automat' : 'Actualizează cursul BNR'}
        </Button>
        {rate?.sursa === 'utilizator' && (
          <Button variant="ghost" size="sm" onClick={() => clearExchangeRate().then(() => setValue(''))}>
            Șterge cursul meu
          </Button>
        )}
      </div>
      {info && <p className="mt-2 text-[12px] font-medium text-ask">{info}</p>}
      <div className="mt-5 border-t border-line pt-4">
        <label className="block">
          <span className="text-[13px] font-medium text-ink">Curs propriu (opțional)</span>
          <span className="mt-0.5 block text-[12px] text-muted">Are prioritate față de cursul BNR. Nu folosim un curs scris în aplicație.</span>
          <span className="mt-2 flex gap-2">
            <input className={`${inputCls} num`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Curs EUR" placeholder="ex. 4,97" />
            <Button variant="outline" onClick={onSave} className="flex-none">
              Salvează cursul
            </Button>
          </span>
        </label>
        {error && <p className="mt-1 text-[12px] font-medium text-ask">{error}</p>}
      </div>
    </Card>
  );
}

const moveLabel = (m) => (m === 0 ? 'Luna aceasta' : m === 1 ? 'Peste o lună' : `Peste ${m} luni`);

function Summary({ passport }) {
  const p = passport;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={Wallet} accent="blue" label="Venit lunar" value={p ? formatRON(p.venitNetLunar) : '—'} hint={p ? 'după taxe' : 'Necompletat'} />
      <StatCard
        icon={Target}
        accent="indigo"
        label="Buget lunar pentru chirie"
        value={p ? (p.bugetMaximChirie > 0 ? formatRON(p.bugetMaximChirie) : 'Nesetat') : '—'}
        hint={p ? 'te anunțăm când îl depășești' : 'Necompletat'}
      />
      <StatCard icon={ShieldCheck} accent="green" label="Pentru urgențe" value={p ? formatRON(p.rezervaMinima) : '—'} hint={p ? 'nu vrei să scazi sub această sumă' : 'Necompletat'} />
      <StatCard icon={CalendarClock} accent="orange" label="Luna mutării" value={p ? moveLabel(p.lunaMutarii) : '—'} hint={p ? `economii acum: ${formatRON(p.economiiDisponibile)}` : 'Necompletat'} />
    </div>
  );
}

export default function PassportSection({ passport, rate, rateStatus }) {
  return (
    <div>
      <PageHeader title="Profilul meu financiar" description="Venitul, cheltuielile și economiile tale. Le folosim ca să calculăm dacă îți permiți o chirie. Rămân doar în acest browser și nu se trimit niciodată la AI." />
      <Summary passport={passport} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* key: formularul se reinițializează când datele se schimbă din altă parte (ex. scenariul demo). */}
        <PassportForm key={JSON.stringify(passport)} passport={passport} />
        <div className="space-y-5">
          <RateForm key={rate?.sursa === 'utilizator' ? rate.eurToRon : 'auto'} rate={rate} rateStatus={rateStatus} />
          <Card title="Confidențialitate" icon={Lock}>
            <ul className="space-y-2 text-[13px] text-muted">
              <li className="flex gap-2">
                <PiggyBank size={15} className="mt-0.5 flex-none text-green" aria-hidden="true" />
                Sumele sunt în lei întregi pe lună și nu părăsesc browserul.
              </li>
              <li className="flex gap-2">
                <ShieldCheck size={15} className="mt-0.5 flex-none text-green" aria-hidden="true" />
                Toate calculele se fac local. La AI ajunge doar textul anunțului.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
