// RentSmart — comenzile Crossroads: perioada (1–60), luna de start, luna mutării, drumurile comparate.
import { useState } from 'react';
import { savePassport, saveSimSettings } from '../storage/appData.js';
import { MONTH_LONG } from './scales.js';
import { QUICK_PERIODS, parseMoveMonth, parsePeriod } from './inputs.js';

const inputCls = 'rs-input num h-9 w-20 rounded-[10px] border border-hairline bg-white px-3 text-[14px]';

function NumberField({ label, value, parse, onCommit, error, help }) {
  const [text, setText] = useState(String(value));
  const [bad, setBad] = useState(false);
  const commit = () => {
    const n = parse(text);
    setBad(n === null);
    if (n !== null && n !== value) onCommit(n);
  };
  return (
    <label className="block text-[12px]">
      <span className="font-medium text-ink">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          className={inputCls}
          inputMode="numeric"
          value={text}
          aria-label={label}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        {help && <span className="text-muted">{help}</span>}
      </div>
      {bad && <span className="font-medium text-ask">{error}</span>}
    </label>
  );
}

export default function Controls({ simSettings, passport, completeItems }) {
  const { luni, lunaStart, drumuri } = simSettings;
  const selected = drumuri.length ? drumuri : completeItems.slice(0, 2).map((i) => i.saved.analiza.id);
  const setPath = (idx, id) => {
    const next = [...selected];
    next[idx] = id;
    saveSimSettings({ drumuri: [...new Set(next.filter(Boolean))].slice(0, 2) });
  };
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <div className="text-[12px] font-medium text-ink">Câte luni să vedem</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex gap-0.5 rounded-[10px] bg-fill-strong/70 p-[3px]" role="radiogroup" aria-label="Câte luni să vedem">
            {QUICK_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={luni === p}
                onClick={() => saveSimSettings({ luni: p })}
                className={`num min-h-8 min-w-10 cursor-pointer rounded-[8px] px-2.5 text-[13px] font-medium ${luni === p ? 'bg-white text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-muted hover:text-ink'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-muted">luni</span>
        </div>
      </div>
      <NumberField
        key={`luni-${luni}`}
        label="Alt număr de luni (1–60)"
        value={luni}
        parse={parsePeriod}
        onCommit={(n) => saveSimSettings({ luni: n })}
        error="Introdu un număr întreg între 1 și 60."
      />
      <label className="block text-[12px]">
        <span className="font-medium text-ink">Prima lună afișată</span>
        <select
          className="rs-input mt-1 block h-9 rounded-[10px] border border-hairline bg-white px-3 text-[14px]"
          value={lunaStart}
          aria-label="Prima lună afișată"
          onChange={(e) => saveSimSettings({ lunaStart: Number(e.target.value) })}
        >
          {MONTH_LONG.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {passport && (
        <NumberField
          key={`m-${passport.lunaMutarii}`}
          label="Luna mutării"
          value={passport.lunaMutarii}
          parse={parseMoveMonth}
          onCommit={(n) => savePassport({ ...passport, lunaMutarii: n })}
          error="Între 0 (luna aceasta) și 60."
          help="peste câte luni"
        />
      )}
      {completeItems.length > 2 &&
        [0, 1].map((idx) => (
          <label key={idx} className="block text-[12px]">
            <span className="font-medium text-ink">Varianta {String.fromCharCode(65 + idx)}</span>
            <select
              className="rs-input mt-1 block h-9 max-w-56 rounded-[10px] border border-hairline bg-white px-3 text-[14px]"
              value={selected[idx] ?? ''}
              aria-label={`Varianta ${String.fromCharCode(65 + idx)}`}
              onChange={(e) => setPath(idx, e.target.value)}
            >
              {idx === 1 && <option value="">—</option>}
              {completeItems.map((i) => (
                <option key={i.saved.analiza.id} value={i.saved.analiza.id}>
                  {i.saved.analiza.titlu ?? 'Fără titlu'}
                </option>
              ))}
            </select>
          </label>
        ))}
    </div>
  );
}
