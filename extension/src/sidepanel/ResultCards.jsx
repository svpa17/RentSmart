// RentSmart — cardurile rezultatului analizei în panou: anunțul (cu poză), verdictul financiar, rezumatul
// costurilor, impactul în bugetul lunar și recomandarea. Doar afișare: toate sumele vin din motor
// (True Cost + assessAffordability), nimic nu se calculează aici.
import { ChartColumn, CircleAlert, CircleCheck, ExternalLink, Lightbulb, MapPin, Receipt, TriangleAlert } from 'lucide-react';
import { VERDICT } from '../shared/engine/affordability.js';
import { USABLE_STATUSES } from '../shared/contracts/constants.js';
import { formatFieldValue } from '../shared/fields.js';
import { monthLabel } from '../crossroads/scales.js';
import { totalToMoveIn } from '../shared/engine/budget.js';
import { DemoBadge, Pill } from '../ui/components.jsx';
import PropertyImage from '../ui/PropertyImage.jsx';
import { commissionHint, formatRON, hostOf } from '../ui/format.js';

const usable = (f) => f && USABLE_STATUSES.includes(f.status) && f.valoare !== null && f.valoare !== undefined;
const cardCls = 'rounded-[16px] border border-black/[0.05] bg-card p-4 shadow-[var(--shadow-card)]';

/** Anunțul analizat: poză, titlu, localitate, chiria în RON și linkul către anunțul original. */
export function AnalyzedListingCard({ analiza, tc, badges }) {
  const url = analiza.sursa.url && /^https?:/i.test(analiza.sursa.url) ? analiza.sursa.url : null;
  const loc = usable(analiza.campuri.localitate) ? formatFieldValue('localitate', analiza.campuri.localitate) : null;
  const chirie = tc?.lunar?.chirie?.sumaRON ?? null;
  const pretText = chirie !== null ? formatRON(chirie) : usable(analiza.campuri.chirie) ? formatFieldValue('chirie', analiza.campuri.chirie) : null;
  return (
    <section className={cardCls}>
      {badges && <div className="mb-3 flex flex-wrap items-center gap-1.5">{badges}</div>}
      <div className="flex gap-3">
        <PropertyImage src={analiza.sursa.imagine} alt={analiza.titlu ?? 'Anunț'} className="h-[76px] w-[92px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-ink">{analiza.titlu ?? 'Anunț fără titlu'}</h2>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-brand hover:bg-brand-soft"
                aria-label={`Deschide anunțul original (${hostOf(url) ?? 'site'}) într-un tab nou`}
                title="Deschide anunțul original"
              >
                <ExternalLink size={17} strokeWidth={2} aria-hidden="true" />
              </a>
            )}
          </div>
          {loc && (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
              <MapPin size={12} aria-hidden="true" className="flex-none" />
              <span className="truncate">{loc}</span>
            </p>
          )}
          <p className="num mt-1.5 text-[17px] font-semibold text-ink">
            {pretText ?? <span className="text-[14px] font-medium text-subtle">Chirie nemenționată</span>}
            {pretText && <span className="text-[13px] font-normal text-muted"> / lună</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

const VERDICT_UI = {
  [VERDICT.PERMIS]: { title: 'Îți permiți această chirie', icon: CircleCheck, cls: 'bg-found-soft border-green/25', iconCls: 'text-green', titleCls: 'text-found' },
  [VERDICT.TENSIONAT]: { title: 'Buget tensionat', icon: CircleAlert, cls: 'bg-unclear-soft border-orange/30', iconCls: 'text-orange', titleCls: 'text-unclear' },
  [VERDICT.NERECOMANDAT]: { title: 'Nu este recomandată', icon: TriangleAlert, cls: 'bg-ask-soft border-red/25', iconCls: 'text-red', titleCls: 'text-ask' },
};

function verdictText(a, lunaStart) {
  const luna = (t) => monthLabel(lunaStart, t, { luni: a.luni });
  const urgente = a.pragSigur > 0 ? `suma păstrată pentru urgențe (${formatRON(a.pragSigur)})` : 'zero';
  if (a.verdict === VERDICT.NERECOMANDAT) return `Din ${luna(a.primaLunaNegativa)}, cheltuielile ar depăși banii pe care îi ai.`;
  if (a.verdict === VERDICT.TENSIONAT) {
    if (a.primaLunaSubRezerva !== null) return `Din ${luna(a.primaLunaSubRezerva)}, economiile tale ar scădea sub ${urgente}.`;
    return 'Chiria e peste bugetul pentru chirie pe care l-ai stabilit în profilul tău financiar.';
  }
  return `Economiile tale rămân peste ${urgente} în toate cele ${a.luni} luni pe care le-am verificat.`;
}

export function VerdictCard({ assessment, lunaStart }) {
  const ui = VERDICT_UI[assessment.verdict];
  const Icon = ui.icon;
  return (
    <section className={`flex gap-3 rounded-[16px] border p-4 ${ui.cls}`} aria-label="Verdict financiar">
      <Icon size={24} strokeWidth={2} className={`mt-0.5 flex-none ${ui.iconCls}`} aria-hidden="true" />
      <div className="min-w-0">
        <h3 className={`text-[17px] font-semibold ${ui.titleCls}`}>{ui.title}</h3>
        <p className="mt-0.5 text-[13px] leading-snug text-ink">{verdictText(assessment, lunaStart)}</p>
      </div>
    </section>
  );
}

function SummaryRow({ label, hint, value, strong = false }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-3 py-2 ${strong ? 'rounded-[10px] bg-brand-soft' : ''}`}>
      <div className="min-w-0">
        <div className={`text-[13px] ${strong ? 'font-semibold text-brand' : 'text-ink'}`}>{label}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
      <div className={`num flex-none text-[14px] ${strong ? 'font-semibold text-brand' : 'font-medium text-ink'}`}>{value}</div>
    </div>
  );
}

/**
 * Ce plătești la mutare, pe înțeles: prima chirie, garanția (o primești înapoi), comisionul și mutarea
 * (nu se recuperează), apoi totalul CU prima chirie. Toate sumele vin din motor.
 */
export function FinancialSummaryCard({ tc }) {
  const g = tc.initial.garantie;
  const c = tc.initial.comision;
  const est = (item, text) => (item.sursa === 'estimare' ? `${text} · estimare` : text);
  return (
    <section className={cardCls}>
      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Receipt size={17} className="text-muted" aria-hidden="true" /> Cât plătești la mutare
      </h3>
      <div className="-mx-1 divide-y divide-line">
        <SummaryRow label="Prima chirie" hint="apoi la fel în fiecare lună" value={formatRON(tc.lunar.chirie.sumaRON)} />
        <SummaryRow label="Garanție" hint={est(g, 'o primești înapoi la finalul contractului')} value={formatRON(g.sumaRON)} />
        <SummaryRow label="Comision agenție" hint={`${commissionHint(c)} · o singură dată`} value={formatRON(c.sumaRON)} />
        {tc.initial.mutare.sumaRON > 0 && <SummaryRow label="Mutare și dotare" hint="o singură dată" value={formatRON(tc.initial.mutare.sumaRON)} />}
      </div>
      <div className="mt-2">
        <SummaryRow label="Total de plătit la mutare" hint="cu prima chirie inclusă" value={formatRON(totalToMoveIn(tc))} strong />
      </div>
      <p className="num mt-2 px-1 text-[12px] text-muted">
        Fără prima chirie: {formatRON(tc.totaluri.plataLaMutare)}. Din total, garanția de {formatRON(g.sumaRON)} îți revine la final.
      </p>
    </section>
  );
}

const BAR = { [VERDICT.PERMIS]: 'bg-green', [VERDICT.TENSIONAT]: 'bg-orange', [VERDICT.NERECOMANDAT]: 'bg-red' };
const PCT = { [VERDICT.PERMIS]: 'text-found', [VERDICT.TENSIONAT]: 'text-unclear', [VERDICT.NERECOMANDAT]: 'text-ask' };

/** Ponderea costului lunar mediu în venitul net: bară statică. */
export function BudgetImpactCard({ assessment, venit }) {
  const pct = assessment.procentVenit;
  if (pct === null) return null;
  return (
    <section className={cardCls}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <ChartColumn size={17} className="text-blue" aria-hidden="true" /> Cât din venit cheltuiești lunar
        </h3>
        <span className={`num text-[20px] font-semibold ${PCT[assessment.verdict]}`}>{pct}%</span>
      </div>
      <div
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-fill-strong"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-label="Ponderea costului lunar în venit"
      >
        <div className={`h-full rounded-full ${BAR[assessment.verdict]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="num mt-2 text-[13px] leading-snug text-ink">
        {pct}% din venitul tău lunar ar merge pe chirie, întreținere, utilități și transport.
      </p>
      <p className="num mt-0.5 text-[12px] text-muted">
        În medie {formatRON(assessment.costLunarMediu)} pe lună (vara mai puțin, iarna mai mult), din venitul de {formatRON(venit)}.
      </p>
    </section>
  );
}

const RECOMMENDATION = {
  [VERDICT.PERMIS]: 'Îți poți permite chiria. Înainte să semnezi, compar-o totuși și cu alte anunțuri asemănătoare.',
  [VERDICT.TENSIONAT]: 'Îți poți permite chiria, dar ar rămâne puțini bani pentru neprevăzut. Merită să cauți și variante mai ieftine.',
  [VERDICT.NERECOMANDAT]: 'Cu această chirie nu ți-ar ajunge banii. Caută variante mai ieftine sau vezi în dashboard ce ai putea schimba ca să-ți permiți chiria.',
};

export function RecommendationCard({ verdict, estimates = false }) {
  return (
    <section className={`${cardCls} flex gap-3`}>
      <Lightbulb size={22} strokeWidth={1.9} className="mt-0.5 flex-none text-orange" aria-hidden="true" />
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-ink">Recomandare RentSmart</h3>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{RECOMMENDATION[verdict]}</p>
        {estimates && <p className="mt-1 text-[12px] leading-snug text-muted">Unele costuri nu apar în anunț și sunt estimate. Întreabă-l pe proprietar sumele exacte: rezultatul se poate schimba.</p>}
      </div>
    </section>
  );
}

export function ResultBadges({ analiza, modeLabel, saved }) {
  return (
    <>
      {analiza.demonstrativ && <DemoBadge />}
      {modeLabel && (
        <Pill tone="neutral" dot={false}>
          {modeLabel}
        </Pill>
      )}
      {saved && <Pill tone="ok">Salvat în dashboard</Pill>}
    </>
  );
}
