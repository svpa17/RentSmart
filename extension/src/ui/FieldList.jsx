// RentSmart — câmpurile analizei: status, valoare, dovada din anunț și formularul
// „Ce ți-a răspuns proprietarul?” (confirmat) / „presupunerea mea” (presupus).
import { useState } from 'react';
import { LISTING_FIELD_TYPES, LISTING_FIELDS } from '../shared/contracts/constants.js';
import { FIELD_TITLES, formatFieldValue } from '../shared/fields.js';
import { Button, StatusBadge, inputCls as baseInput, selectCls } from './components.jsx';
import { UNITS, parseEditorValue } from './fieldInput.js';

const inputCls = baseInput;

function FieldEditor({ name, field, onSave, onCancel }) {
  const type = LISTING_FIELD_TYPES[name];
  const known = field.valoare !== null && field.valoare !== undefined;
  const [valoare, setValoare] = useState(() => (known ? (type === 'boolean' ? (field.valoare ? 'da' : 'nu') : String(field.valoare)) : ''));
  const [moneda, setMoneda] = useState(field.moneda ?? 'RON');
  const [unitate, setUnitate] = useState(field.unitate ?? UNITS[type]?.[0][0] ?? null);
  const [status, setStatus] = useState(field.status === 'presupus' ? 'presupus' : 'confirmat');
  const [nota, setNota] = useState(field.nota ?? '');
  const [error, setError] = useState(null);
  const needsCurrency = type === 'money' || ((type === 'deposit' || type === 'commission') && unitate === 'suma');

  function save() {
    try {
      const v = parseEditorValue(type, valoare);
      onSave({ status, valoare: v, moneda: needsCurrency ? moneda : null, unitate: UNITS[type] ? unitate : null, nota: nota.trim() || null });
    } catch (e) {
      setError(e.message || 'Valoare invalidă.');
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-[12px] bg-fill p-3.5">
      <label className="block text-[12px] font-semibold text-muted">Ce ți-a răspuns proprietarul?</label>
      <div className="flex gap-2">
        {type === 'boolean' ? (
          <select className={selectCls} value={valoare} onChange={(e) => setValoare(e.target.value)} aria-label="Valoare">
            <option value="">Alege…</option>
            <option value="da">Da</option>
            <option value="nu">Nu</option>
          </select>
        ) : (
          <input
            className={inputCls}
            value={valoare}
            inputMode={type === 'text' ? 'text' : 'decimal'}
            onChange={(e) => setValoare(e.target.value)}
            aria-label="Valoare"
          />
        )}
        {UNITS[type] && (
          <select className={selectCls} value={unitate} onChange={(e) => setUnitate(e.target.value)} aria-label="Unitate">
            {UNITS[type].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        {needsCurrency && (
          <select className={`${selectCls} w-24 flex-none`} value={moneda} onChange={(e) => setMoneda(e.target.value)} aria-label="Monedă">
            <option value="RON">RON</option>
            <option value="EUR">EUR</option>
          </select>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <label className="flex items-center gap-1">
          <input type="radio" className="accent-blue" checked={status === 'confirmat'} onChange={() => setStatus('confirmat')} /> Confirmat de proprietar
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" className="accent-blue" checked={status === 'presupus'} onChange={() => setStatus('presupus')} /> Presupunerea mea
        </label>
      </div>
      <input className={inputCls} placeholder="Notă (opțional)" value={nota} onChange={(e) => setNota(e.target.value)} aria-label="Notă" />
      {error && <p className="text-[12px] font-medium text-ask">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>
          Salvează
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Renunță
        </Button>
      </div>
    </div>
  );
}

function FieldRow({ name, field, editing, onEdit, onSave, onCancel }) {
  const value = formatFieldValue(name, field);
  return (
    <li className="border-b border-line py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-muted">{FIELD_TITLES[name]}</div>
          <div className="num text-[15px] font-medium text-ink">{value ?? <span className="text-subtle">—</span>}</div>
        </div>
        <StatusBadge status={field.status} />
      </div>
      {field.dovada && <blockquote className="mt-1.5 rounded-[8px] bg-fill px-2.5 py-1.5 text-[12px] leading-relaxed text-muted">„{field.dovada}”</blockquote>}
      {field.nota && <p className="mt-1 text-[12px] text-muted">Notă: {field.nota}</p>}
      {editing ? (
        <FieldEditor name={name} field={field} onSave={onSave} onCancel={onCancel} />
      ) : (
        <Button variant="ghost" size="sm" className="mt-1 -ml-3" onClick={onEdit} aria-label={`${field.status === 'lipsa' || field.status === 'neclar' ? 'Completează' : 'Modifică'}: ${FIELD_TITLES[name]}`}>
          {field.status === 'lipsa' || field.status === 'neclar' ? 'Completează' : 'Modifică'}
        </Button>
      )}
    </li>
  );
}

/** Grupurile: ce lipsește, ce e neclar, ce s-a găsit în anunț, ce ai completat tu. */
const GROUPS = [
  { id: 'lipsa', title: 'De întrebat', dot: 'bg-red', statuses: ['lipsa'] },
  { id: 'neclar', title: 'Neclare', dot: 'bg-orange', statuses: ['neclar'] },
  { id: 'gasit', title: 'Găsite în anunț', dot: 'bg-green', statuses: ['gasit'] },
  { id: 'tu', title: 'Completate de tine', dot: 'bg-blue', statuses: ['confirmat', 'presupus'] },
];

/** @param {{analiza: object, onSaveField: (name: string, input: object) => string|null}} props  onSaveField întoarce o eroare sau null */
export default function FieldList({ analiza, onSaveField }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  return (
    <>
      {error && <p className="mb-2 text-[12px] font-medium text-ask">{error}</p>}
      {GROUPS.map((g) => {
        const names = LISTING_FIELDS.filter((n) => g.statuses.includes(analiza.campuri[n].status));
        if (names.length === 0) return null;
        return (
          <div key={g.id} className="mb-4 last:mb-0">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
              <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden="true" />
              {g.title} <span className="num font-medium text-subtle">{names.length}</span>
            </h3>
            <ul className="mt-1">
              {names.map((name) => (
          <FieldRow
            key={name}
            name={name}
            field={analiza.campuri[name]}
            editing={editing === name}
            onEdit={() => {
              setError(null);
              setEditing(name);
            }}
            onCancel={() => setEditing(null)}
            onSave={(input) => {
              const err = onSaveField(name, input);
              setError(err);
              if (!err) setEditing(null);
            }}
          />
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
