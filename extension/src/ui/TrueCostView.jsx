// RentSmart — True Cost Analyzer: costul real lunar și costurile inițiale, cu sursa fiecărei sume.
// Doar afișare: toate sumele vin din True Cost (motorul).
import { SIMULATION_ASSUMPTIONS } from '../shared/contracts/constants.js';
import { Metric, Notice, Pill } from './components.jsx';
import { INCOMPLETE_MESSAGES, SOURCE_LABELS, commissionHint, costItemDetails, formatRON } from './format.js';
import RateInfo from './RateInfo.jsx';
import { totalToMoveIn } from '../shared/engine/budget.js';

function Row({ label, item, exchangeRate, hint, showEur = false }) {
  if (!item) return null;
  const src = SOURCE_LABELS[item.sursa];
  const details = costItemDetails(item, exchangeRate, { showEur });
  return (
    <li className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[14px] text-ink">
          {label}
          {hint && <span className="text-[12px] text-muted"> · {hint}</span>}
        </div>
        {details.length > 0 && <div className="num mt-0.5 text-[12px] text-muted">{details.join(' · ')}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="num text-[14px] font-semibold text-ink">{formatRON(item.sumaRON)}</span>
        {src && <Pill tone={src.tone}>{src.label}</Pill>}
      </div>
    </li>
  );
}

function Group({ title, children, footer }) {
  return (
    <div>
      <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <ul className="rounded-[12px] border border-line px-3">{children}</ul>
      {footer && <p className="mt-1.5 text-[12px] text-muted">{footer}</p>}
    </div>
  );
}

/**
 * @param {{tc: object|null, exchangeRate: object|null, rateStatus?: object|null, costReference: object, compact?: boolean}} props
 */
export default function TrueCostView({ tc, exchangeRate, rateStatus = null, costReference, compact = false }) {
  if (!tc) return null;
  const { lunar, initial, totaluri } = tc;
  const warnings = [
    ...(!tc.complet ? tc.motiveIncomplet.map((m) => ({ key: m, text: INCOMPLETE_MESSAGES[m] ?? m })) : []),
    ...tc.avertizari.map((w) => ({ key: w.cod, text: w.mesaj })),
  ];
  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w) => (
            <Notice key={w.key} tone="warn">
              {w.text}
            </Notice>
          ))}
        </div>
      )}

      {tc.complet && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-4'}`}>
          <Metric label="Pe lună, vara" value={formatRON(totaluri.lunarVara)} hint="aprilie–octombrie" />
          <Metric label="Pe lună, iarna" value={formatRON(totaluri.lunarIarna)} hint="noiembrie–martie" />
          <Metric label="Total la mutare" value={formatRON(totalToMoveIn(tc))} hint={`cu prima chirie · ${formatRON(totaluri.plataLaMutare)} fără ea`} />
          <Metric label="Garanția" value={formatRON(totaluri.garantieRecuperabila)} hint="o primești înapoi la final" />
        </div>
      )}

      <Group title="În fiecare lună">
        <Row label="Chirie" item={lunar.chirie} exchangeRate={exchangeRate} showEur />
        <Row label="Întreținere + utilități (vara)" item={lunar.utilitatiVara} exchangeRate={exchangeRate} />
        <Row label="Întreținere + utilități (iarna)" item={lunar.utilitatiIarna} exchangeRate={exchangeRate} />
        <Row label="Transport de la această adresă" item={lunar.transport} exchangeRate={exchangeRate} />
        <Row label="Alte costuri (internet etc.)" item={lunar.alteCosturi} exchangeRate={exchangeRate} />
      </Group>
      <Group title="O singură dată, la mutare" footer="Pe lângă acestea, în luna mutării plătești și prima chirie (e inclusă în „Total la mutare”).">
        <Row label="Garanție" hint="o primești înapoi" item={initial.garantie} exchangeRate={exchangeRate} showEur />
        <Row label="Comision agenție" hint={commissionHint(initial.comision)} item={initial.comision} exchangeRate={exchangeRate} />
        <Row label="Mutare și dotare" hint="nu se recuperează" item={initial.mutare} exchangeRate={exchangeRate} />
      </Group>

      <RateInfo rate={exchangeRate} status={rateStatus} />

      {!compact && (
        <details className="rounded-[12px] bg-fill p-3 text-[12px] text-muted">
          <summary className="cursor-pointer text-[13px] font-medium text-ink">Cum am calculat</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {SIMULATION_ASSUMPTIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mt-2 font-medium text-ink">
            De unde vin estimările {costReference.verificat ? '(verificate)' : '(din presă, încă neverificate)'}:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {costReference.surse.map((s) => (
              <li key={s} className="break-words">
                {s}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
