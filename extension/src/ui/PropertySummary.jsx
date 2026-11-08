// RentSmart — rezumatul unui anunț: titlu, link către anunțul original, chirie, detalii, comision și
// informațiile lipsă. Folosit în panoul lateral și în dashboard. Nu calculează nimic: sumele derivate
// (ex. comisionul estimat) vin din True Cost, calculat de motor.
import { Building2, MapPin } from 'lucide-react';
import { DEFAULT_COMMISSION_PERCENT, USABLE_STATUSES } from '../shared/contracts/constants.js';
import { FIELD_TITLES, formatFieldValue } from '../shared/fields.js';
import { fromRON, toRON } from '../shared/engine/currency.js';
import { DemoBadge, ListingLink, Pill } from './components.jsx';
import { countByStatus } from './status.js';
import { commissionHint, formatEUR, formatRON } from './format.js';

const DETAIL_FIELDS = ['suprafataMp', 'mobilat', 'utilitatiIncluse', 'durataContractLuni', 'garantie', 'intretinereVara', 'intretinereIarna', 'reparatii'];
const usable = (f) => f && USABLE_STATUSES.includes(f.status) && f.valoare !== null && f.valoare !== undefined;

function PriceBlock({ field, exchangeRate }) {
  const value = formatFieldValue('chirie', field);
  if (!usable(field)) {
    return (
      <div>
        <div className="text-[12px] font-medium text-muted">Chirie lunară</div>
        <div className="mt-0.5 text-[20px] font-semibold text-subtle">Nemenționată</div>
      </div>
    );
  }
  const ron = field.moneda === 'EUR' ? toRON(field.valoare, 'EUR', exchangeRate) : null;
  const eur = field.moneda === 'EUR' ? null : fromRON(field.valoare, exchangeRate);
  const other = field.moneda === 'EUR' ? (ron === null ? 'curs EUR lipsă' : `≈ ${formatRON(ron)}`) : eur === null ? null : `≈ ${formatEUR(eur)}`;
  return (
    <div>
      <div className="text-[12px] font-medium text-muted">Chirie lunară</div>
      <div className="num mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[26px] font-semibold tracking-tight text-ink">{value}</span>
        <span className="text-[13px] text-muted">/ lună</span>
        {other && <span className="text-[13px] text-muted">{other}</span>}
      </div>
    </div>
  );
}

function CommissionRow({ field, tc }) {
  const item = tc?.initial?.comision ?? null;
  const stated = usable(field);
  return (
    <div className="flex items-start justify-between gap-3 rounded-[12px] bg-fill px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">Comision agenție</div>
        <div className="text-[12px] text-muted">
          {stated ? commissionHint(item ?? { sursa: field.status === 'gasit' ? 'anunt' : field.status === 'confirmat' ? 'confirmat' : 'utilizator', sumaRON: field.valoare }) : `nemenționat · estimat la ${DEFAULT_COMMISSION_PERCENT}% din chirie`}
        </div>
      </div>
      <div className="num text-right text-[14px] font-semibold text-ink">
        {item ? formatRON(item.sumaRON) : stated ? formatFieldValue('comision', field) : '—'}
      </div>
    </div>
  );
}

/**
 * @param {{analiza: object, exchangeRate: object|null, tc?: object|null, mod?: string, actions?: any}} props
 */
export default function PropertySummary({ analiza, exchangeRate, tc = null, modeLabel, actions }) {
  const f = analiza.campuri;
  const c = countByStatus(analiza);
  const details = DETAIL_FIELDS.filter((n) => usable(f[n]) && n !== 'chirie');
  const missing = Object.keys(f).filter((n) => f[n].status === 'lipsa' || f[n].status === 'neclar');
  const loc = usable(f.localitate) ? formatFieldValue('localitate', f.localitate) : null;
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-black/[0.05] bg-card shadow-[var(--shadow-card)]">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {analiza.demonstrativ && <DemoBadge />}
          {modeLabel && <Pill tone="neutral" dot={false}>{modeLabel}</Pill>}
          {actions}
        </div>
        <div className="mt-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-brand-soft text-blue" aria-hidden="true">
            <Building2 size={20} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-ink">{analiza.titlu ?? 'Anunț fără titlu'}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <ListingLink url={analiza.sursa.url} />
              {loc && (
                <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                  <MapPin size={13} aria-hidden="true" />
                  {loc}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <PriceBlock field={f.chirie} exchangeRate={exchangeRate} />
        </div>

        {details.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {details.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-[8px] bg-fill px-2.5 py-1 text-[12px] text-ink">
                <span className="text-muted">{FIELD_TITLES[n]}:</span> <span className="font-medium">{formatFieldValue(n, f[n])}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4">
          <CommissionRow field={f.comision} tc={tc} />
        </div>
      </div>

      <div className="border-t border-line bg-[#fbfbfd] px-5 py-3">
        <p className="num text-[12px] font-medium text-muted">
          {c.gasit} găsite în anunț · {c.neclar} neclare · {c.lipsa} de întrebat
          {c.confirmat + c.presupus > 0 && ` · Completate de tine ${c.confirmat + c.presupus}`}
        </p>
        {missing.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Informații lipsă">
            {missing.map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[12px] text-ink ring-1 ring-line">
                <span className={`h-1.5 w-1.5 rounded-full ${f[n].status === 'lipsa' ? 'bg-red' : 'bg-orange'}`} aria-hidden="true" />
                {FIELD_TITLES[n]}
                <span className="sr-only">{f[n].status === 'lipsa' ? '(lipsă)' : '(neclar)'}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
