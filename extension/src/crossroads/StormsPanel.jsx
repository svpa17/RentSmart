// RentSmart — Financial Storms: butoane + text liber (AI clasifică doar tipul, luna și durata).
import { useState } from 'react';
import { CloudLightning, X } from 'lucide-react';
import { classifyStormText } from '../ai/client.js';
import { findRecordedStorm, DEMO_STORM_TEXT } from '../demo/index.js';
import { STORM_TYPES, MAX_STORM_TEXT_CHARS } from '../shared/contracts/constants.js';
import { addStorm, clearStorms, removeStorm } from '../storage/appData.js';
import { ensureInstallId, updateSettings } from '../storage/index.js';
import { Button, Card, Notice, inputCls as baseInput, selectCls, textareaCls } from '../ui/components.jsx';
import { STORM_TITLES, defaultStormValues, describeStorm, makeStorm, prefillFromClassification } from './storms.js';
import { monthLabel } from './scales.js';

const inputCls = baseInput;
const FREE_TEXT_NOTICE = 'Nu include date personale; sumele sunt eliminate automat înainte de trimitere.';

function StormForm({ tip, initial, luni, lunaStart, onDone }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState(null);
  const num = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value === '' ? '' : Number(e.target.value) }));
  const monthSelect = (k, label) => (
    <label className="block text-[12px] font-medium text-ink">
      {label}
      <select className={`${selectCls} mt-1`} value={v[k]} onChange={num(k)} aria-label={label}>
        {Array.from({ length: luni }, (_, t) => (
          <option key={t} value={t}>
            {monthLabel(lunaStart, t, { capital: true, luni })}
          </option>
        ))}
      </select>
    </label>
  );
  async function add() {
    try {
      await addStorm(makeStorm(tip, v, crypto.randomUUID()));
      onDone();
    } catch {
      setError('Valori invalide. Verifică luna, durata, procentul sau suma.');
    }
  }
  return (
    <div className="mt-4 space-y-3 rounded-[12px] bg-fill p-3.5">
      <div className="text-[14px] font-semibold text-ink">{STORM_TITLES[tip]}</div>
      <div className="grid grid-cols-2 gap-2">
        {tip === STORM_TYPES.PIERDERE_VENIT && (
          <>
            {monthSelect('start', 'Din luna')}
            <label className="block text-[12px] font-medium text-ink">
              Durata (luni)
              <input className={`${inputCls} num mt-1`} type="number" min="1" max="60" value={v.durata} onChange={num('durata')} aria-label="Durata (luni)" />
            </label>
            <label className="block text-[12px] font-medium text-ink">
              Venit pierdut (%)
              <input className={`${inputCls} num mt-1`} type="number" min="1" max="100" value={v.procent} onChange={num('procent')} aria-label="Venit pierdut (%)" />
            </label>
          </>
        )}
        {tip === STORM_TYPES.CHELTUIALA_NEPREVAZUTA && (
          <>
            {monthSelect('luna', 'În luna')}
            <label className="block text-[12px] font-medium text-ink">
              Suma (RON)
              <input className={`${inputCls} num mt-1`} type="number" min="1" value={v.suma} onChange={num('suma')} aria-label="Suma (RON)" />
            </label>
          </>
        )}
        {tip === STORM_TYPES.CRESTERE_CHIRIE && (
          <>
            {monthSelect('start', 'Din luna')}
            <label className="block text-[12px] font-medium text-ink">
              Creștere (%)
              <input className={`${inputCls} num mt-1`} type="number" min="1" max="100" value={v.procent} onChange={num('procent')} aria-label="Creștere (%)" />
            </label>
          </>
        )}
      </div>
      {error && <p className="text-[12px] font-medium text-ask">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={add}>Adaugă situația</Button>
        <Button variant="outline" onClick={onDone}>
          Renunță
        </Button>
      </div>
    </div>
  );
}

function FreeText({ ctx, settings, aiReady, onPrefill }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const canAI = settings.modDemo || (aiReady && settings.acordAI);
  async function interpret() {
    setMsg(null);
    setBusy(true);
    let c = null;
    if (settings.modDemo) {
      c = findRecordedStorm(text);
      if (!c) setMsg(`În modul demonstrativ funcționează doar textul de exemplu: „${DEMO_STORM_TEXT}”. Sau alege una dintre variantele de mai sus.`);
    } else {
      const r = await classifyStormText(text, { installId: await ensureInstallId() });
      if (r.ok && r.data.tip) c = r.data;
      else setMsg('Nu am înțeles situația descrisă. Alege una dintre variantele de mai sus.');
    }
    setBusy(false);
    const pre = c && prefillFromClassification(c, ctx);
    if (c && !pre) setMsg('Nu am recunoscut ce fel de situație este. Alege una dintre variantele de mai sus.');
    if (pre) onPrefill(pre);
  }
  return (
    <div className="mt-4">
      <label className="block text-[13px] font-medium text-ink">
        Sau descrie în cuvintele tale ce s-ar putea întâmpla
        <textarea
          className={`${textareaCls} mt-1.5 h-20`}
          maxLength={MAX_STORM_TEXT_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={DEMO_STORM_TEXT}
          aria-label="Situația descrisă"
        />
      </label>
      <p className="mt-1 text-[12px] text-muted">{FREE_TEXT_NOTICE} AI-ul alege doar tipul, luna și durata; sumele le completezi tu.</p>
      {!canAI && !settings.modDemo && aiReady && (
        <label className="mt-2 flex items-start gap-2 text-[12px] text-ink">
          <input type="checkbox" onChange={(e) => e.target.checked && updateSettings({ acordAI: true })} />
          Sunt de acord ca textul (fără sume) să fie trimis la serviciul AI.
        </label>
      )}
      {!aiReady && !settings.modDemo && <p className="mt-1 text-[12px] text-muted">Analiza AI nu este disponibilă acum: alege una dintre variantele de mai sus.</p>}
      <Button variant="secondary" className="mt-2" disabled={!canAI || busy || !text.trim()} onClick={interpret}>
        {busy ? 'Se analizează…' : 'Analizează situația descrisă'}
      </Button>
      {msg && (
        <div className="mt-2">
          <Notice tone="warn">{msg}</Notice>
        </div>
      )}
    </div>
  );
}

export default function StormsPanel({ storms, simSettings, passport, settings, aiReady }) {
  const [form, setForm] = useState(null);
  const ctx = { luni: simSettings.luni, lunaStart: simSettings.lunaStart, lunaMutarii: passport?.lunaMutarii ?? 0 };
  const open = (tip, values = defaultStormValues(tip, ctx)) => setForm({ tip, values, key: crypto.randomUUID() });
  return (
    <Card
      title="Ce se întâmplă dacă apar cheltuieli neprevăzute?"
      icon={CloudLightning}
      description="Vezi cum s-ar schimba situația dacă îți pierzi venitul, crește chiria sau apare o cheltuială mare. Se aplică la fel pentru toate variantele."
    >
      <div className="flex flex-wrap gap-2">
        {Object.entries(STORM_TITLES).map(([tip, title]) => (
          <Button key={tip} variant="secondary" size="sm" icon={CloudLightning} onClick={() => open(tip)}>
            {title}
          </Button>
        ))}
      </div>
      {form && <StormForm key={form.key} tip={form.tip} initial={form.values} luni={simSettings.luni} lunaStart={simSettings.lunaStart} onDone={() => setForm(null)} />}
      <FreeText ctx={ctx} settings={settings} aiReady={aiReady} onPrefill={(p) => open(p.tip, p.values)} />
      {storms.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold tracking-wide text-muted uppercase">Situații adăugate</span>
            <Button variant="ghost" size="sm" onClick={clearStorms}>
              Șterge toate
            </Button>
          </div>
          <ul className="space-y-1">
            {storms.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-[10px] bg-unclear-soft px-3 py-2 text-[13px] text-ink">
                <span className="flex min-w-0 items-start gap-2">
                  <CloudLightning size={15} className="mt-0.5 flex-none text-orange" aria-hidden="true" />
                  {describeStorm(s, simSettings.lunaStart, simSettings.luni)}
                </span>
                <button
                  type="button"
                  className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[8px] px-2 py-1 text-[12px] font-medium text-ask hover:bg-ask-soft"
                  onClick={() => removeStorm(s.id)}
                  aria-label="Elimină situația"
                >
                  <X size={13} aria-hidden="true" /> Elimină
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
