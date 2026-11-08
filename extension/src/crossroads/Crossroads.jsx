// RentSmart — graficul „Cum evoluează economiile tale”: economiile lună de lună pentru fiecare apartament
// (+ linia recomandării RentSmart, dacă există). Desenat exclusiv din modelul construit din SimulationResult
// (model.js). Nimic hardcodat: datele de mutare vin din simulare și din varianta aleasă (moveDates).
import { useEffect, useRef, useState } from 'react';
import { CloudLightning, House, ShieldCheck, Sprout, TrendingUp, TriangleAlert } from 'lucide-react';
import { formatNumber, formatRON } from '../ui/format.js';
import { PLAN_COLOR, chartLineName, moveDates, pathName, pathStatus } from './model.js';
import {
  BudgetMarker,
  Callout,
  DangerZone,
  MoveLine,
  MoveTriangle,
  NegativeMarker,
  Path,
  PlanArea,
  PlanPath,
} from './parts.jsx';
import { TONES, calloutSize, textWidth } from './chartStyle.js';
import { linearScale, monthLabel, monthTicks, moneyDomain, spansYears, yearOf, MONTH_LONG, MONTH_SHORT } from './scales.js';
import { calendarMonth } from '../shared/engine/seasons.js';
import { describeStorm } from './storms.js';

const PLAN_LINE_NAME = 'Dacă urmezi recomandarea RentSmart';
const NEGATIVE_TEXT = 'Cheltuielile depășesc banii disponibili';
const FAZA = { inainte: 'înainte de mutare', mutare: 'luna mutării', dupa: 'după mutare' };
const LOCUINTA = { inainte: 'Locuința de acum și transport', mutare: 'Chirie, întreținere și transport', dupa: 'Chirie, întreținere și transport' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Tooltip({ t, model, lunaStart, storms, left }) {
  const multi = model.paths.length > 1;
  const rows = model.paths.map((p) => ({ name: chartLineName(p, model.paths.length), color: p.color, m: p.drum.luni[t], eticheta: multi ? ` ${p.eticheta}` : '' }));
  if (model.plan) rows.push({ name: PLAN_LINE_NAME, color: PLAN_COLOR, m: model.plan.drum.luni[t], eticheta: '' });
  const active = new Set(rows.flatMap((r) => r.m?.furtuniActive ?? []));
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-64 rounded-[16px] border border-black/[0.06] bg-white/95 p-3 text-[12px] shadow-[var(--shadow-pop)]"
      style={{ left: `clamp(0px, calc(${left}% - 8rem), calc(100% - 16rem))` }}
      role="status"
    >
      <div className="mb-2 text-[13px] font-semibold text-ink">{monthLabel(lunaStart, t, { capital: true, luni: model.xLuni })}</div>
      {rows.map(
        ({ name, color, m, eticheta }) =>
          m && (
            <div key={name} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-2 w-2 flex-none rounded-full" style={{ background: color }} />
                <span className="truncate">{name}</span>
                <span className="flex-none">· {FAZA[m.faza]}</span>
              </div>
              <div className={`num mt-0.5 text-[13px] font-semibold ${m.bani < 0 ? 'text-ask' : 'text-ink'}`}>
                {m.bani < 0 ? `${NEGATIVE_TEXT} cu ${formatRON(-m.bani)}` : `Economii: ${formatRON(m.bani)}`}
              </div>
              <div className="num text-muted">
                Venit {formatRON(m.venit)} · {LOCUINTA[m.faza]} {formatRON(m.costLocuinta)}
              </div>
              {m.costuriInitiale > 0 && <div className="num text-muted">Plăți la mutare: {formatRON(m.costuriInitiale)}</div>}
              {m.cheltuieliNeprevazute > 0 && <div className="num text-muted">Cheltuială neprevăzută: {formatRON(m.cheltuieliNeprevazute)}</div>}
              {m.garantieBlocata > 0 && (
                <div className="num text-muted">
                  Garanția{eticheta}: {formatRON(m.garantieBlocata)}, o primești înapoi la final
                </div>
              )}
            </div>
          ),
      )}
      {active.size > 0 && (
        <div className="mt-1 border-t border-line pt-1.5 text-unclear">
          {storms.filter((s) => active.has(s.id)).map((s) => (
            <div key={s.id} className="flex items-start gap-1">
              <CloudLightning size={12} className="mt-0.5 flex-none" aria-hidden="true" /> {describeStorm(s, lunaStart, model.xLuni)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Un card explicativ de sub grafic: semn + titlu + descriere scurtă, pe fundal pastel. */
function InfoCard({ bg, swatch, title, children }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-[16px] px-4 py-3.5" style={{ background: bg }}>
      <span className="mt-[3px] flex h-5 w-6 flex-none items-center justify-center" aria-hidden="true">
        {swatch}
      </span>
      <div className="min-w-0">
        <div className="text-[14px] leading-snug font-semibold text-ink">{title}</div>
        <div className="mt-1 text-[12.5px] leading-snug text-muted">{children}</div>
      </div>
    </div>
  );
}

const lineSwatch = (color) => <span className="inline-block h-[3px] w-6 rounded-full" style={{ background: color }} />;
const dashedSwatch = <span className="inline-block w-6 border-t-[3px] border-dashed" style={{ borderColor: PLAN_COLOR }} />;
/** Culoarea textului pentru litera unei linii (variantă închisă, contrast AA). */
const LETTER_TEXT = { '#007AFF': '#0066CC', '#5856D6': '#4B49B8' };

/** Cele patru carduri explicative, cu date reale (nimic inventat când nu există o recomandare). */
function Explanations({ model, dates, lunaStart, n }) {
  const luna = (t) => monthLabel(lunaStart, t, { capital: true, luni: n });
  const multi = model.paths.length > 1;
  const r = dates.recomandata;
  const pentru = multi && r.pentru ? ` (pentru ${r.pentru})` : '';
  const negative = model.paths.filter((p) => p.drum.indicatori.primaLunaNegativa !== null);
  const actiune = model.plan ? model.plan.text.titlu.charAt(0).toLowerCase() + model.plan.text.titlu.slice(1) : '';
  return (
    <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
      <InfoCard
        bg="#EEF5FF"
        swatch={
          multi ? (
            <span className="flex flex-col gap-1">
              {model.paths.map((p) => (
                <span key={p.listingId}>{lineSwatch(p.color)}</span>
              ))}
            </span>
          ) : (
            lineSwatch(model.paths[0].color)
          )
        }
        title={multi ? 'Dacă alegi unul dintre apartamente' : 'Dacă alegi acest apartament'}
      >
        {multi
          ? model.paths.map((p) => (
              <span key={p.listingId} className="block truncate" title={pathName(p)}>
                <span className="font-semibold" style={{ color: LETTER_TEXT[p.color] ?? 'inherit' }}>
                  {p.eticheta}
                </span>{' '}
                {pathName(p).replace(`${p.eticheta} · `, '')}
              </span>
            ))
          : 'Cum se schimbă banii tăi dacă alegi acest apartament.'}
      </InfoCard>
      {model.plan ? (
        <InfoCard bg="#EDF8EF" swatch={dashedSwatch} title={PLAN_LINE_NAME}>
          Banii tăi dacă urmezi recomandarea{pentru}: {actiune}.{' '}
          <span className="font-medium text-found">{r.status === 'diferita' ? `Mutarea recomandată: ${luna(r.t)}.` : `Mutarea rămâne în ${luna(r.t)}.`}</span>
        </InfoCard>
      ) : (
        <InfoCard bg="var(--color-fill)" swatch={<Sprout size={18} color="#8E8E93" strokeWidth={2.1} />} title="Recomandarea RentSmart">
          {r.status === 'nu-e-nevoie'
            ? 'Nu e nevoie de altă lună de mutare: cu luna planificată, economiile rămân peste suma pentru urgențe.'
            : 'Nu am găsit o lună de mutare potrivită: nicio schimbare calculată nu rezolvă situația în perioada verificată.'}
        </InfoCard>
      )}
      <InfoCard bg="#FFF6EA" swatch={<House size={18} color={TONES.orange.line} strokeWidth={2.2} />} title={`Mutarea planificată: ${luna(dates.planificata.t)}`}>
        Luna în care plătești garanția și te muți în apartament.{dates.planificata.inPerioada ? '' : ' Este după perioada afișată.'}
      </InfoCard>
      <InfoCard bg="#FFF0EF" swatch={<TriangleAlert size={18} color={TONES.red.line} strokeWidth={2.2} />} title={NEGATIVE_TEXT}>
        Zona roșie: lunile în care cheltuielile sunt mai mari decât banii pe care îi ai.{' '}
        {negative.length > 0 ? (
          <span className="font-medium text-ask">
            {negative.map((p) => `${multi ? `${p.eticheta}: din` : 'Din'} ${monthLabel(lunaStart, p.drum.indicatori.primaLunaNegativa, { luni: n })}`).join(' · ')}.
          </span>
        ) : (
          'Nu se întâmplă în perioada afișată.'
        )}
      </InfoCard>
    </div>
  );
}

/** Garanția, explicată simplu (nu intră în economii). */
function DepositNote({ model }) {
  const multi = model.paths.length > 1;
  const value = multi ? model.paths.map((p) => `${p.eticheta} ${formatRON(p.garantie)}`).join(' · ') : formatRON(model.paths[0].garantie);
  return (
    <div className="mt-3 flex items-center gap-4 rounded-[16px] bg-[#F2F7FF] px-4 py-3.5">
      <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white text-blue shadow-[0_1px_2px_rgba(0,0,0,0.06)]" aria-hidden="true">
        <ShieldCheck size={21} strokeWidth={2} />
      </span>
      <span className="h-9 w-px flex-none bg-black/[0.08]" aria-hidden="true" />
      <div className="min-w-0">
        <div className="num text-[16px] font-semibold text-ink">Garanție: {value}</div>
        <div className="text-[12.5px] leading-snug text-muted">
          Bani pe care îi plătești la mutare și îi primești înapoi la finalul contractului. De aceea nu îi socotim în economii.
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{model: object, lunaStart: number, prag: number, storms: object[], compact?: boolean, header?: boolean}} props
 */
export default function Crossroads({ model, lunaStart, prag, storms, compact: compactProp = false, header = false }) {
  const [hover, setHover] = useState(null);
  // Sub 560px lățime disponibilă, graficul complet ar avea textul ilizibil: trecem la varianta compactă.
  const wrapRef = useRef(null);
  // Lățimea reală a containerului: viewBox-ul o urmează, ca textul să rămână la mărimea lui reală (fără micșorare).
  const [width, setWidth] = useState(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = compactProp || (width !== null && width < 560);
  const multi = model.paths.length > 1;
  const n = model.xLuni;
  const dates = moveDates(model);
  const rec = dates.recomandata;
  const lunaMutarii = model.sim.lunaMutarii;
  const luna = (t) => (compact ? cap(MONTH_SHORT[calendarMonth(lunaStart, t) - 1]) : monthLabel(lunaStart, t, { capital: true, luni: n }));

  // --- geometrie (coordonate în viewBox; SVG-ul se scalează cu lățimea)
  const W = width ? Math.min(Math.max(width, 300), 1200) : compact ? 360 : 860;
  const fs = compact ? 10.5 : 13.5;
  const right = 16;
  const left = compact ? 40 : 84;
  const minX = left;
  const maxX = W - right;
  const x = linearScale([0, Math.max(1, n - 1)], [left, maxX]);

  // Etichetele mutărilor: deasupra zonei cu linii, ca să nu acopere datele.
  const showPlanned = lunaMutarii < n;
  const showRecommended = rec.status === 'diferita' && rec.inPerioada;
  const plannedLabel = compact ? `Planificată: ${luna(lunaMutarii)}` : `Mutarea planificată: ${luna(lunaMutarii)}`;
  const recLabel = showRecommended ? (compact ? `Recomandată: ${luna(rec.t)}` : `Mutarea recomandată: ${luna(rec.t)}`) : '';
  const place = (cx, w) => Math.min(Math.max(cx - w / 2, minX), maxX - w);
  const pSize = calloutSize(plannedLabel, fs);
  const rSize = calloutSize(recLabel, fs);
  const callouts = [];
  if (showPlanned) callouts.push({ key: 'p', cx: x(lunaMutarii), label: plannedLabel, ...pSize, row: 0, left: place(x(lunaMutarii), pSize.w), icon: House, tone: TONES.orange });
  if (showRecommended) {
    const cx = x(rec.t);
    let l = place(cx, rSize.w);
    let row = 0;
    const p = callouts[0];
    if (p && l < p.left + p.w + 8 && l + rSize.w > p.left - 8) {
      row = 1;
      // Pe al doilea rând, eticheta nu stă peste linia verticală a primei etichete.
      const half = rSize.h / 2;
      if (cx >= p.cx) l = Math.min(Math.max(p.cx + 10, cx - rSize.w + half), cx - half);
      else l = Math.max(Math.min(p.cx - 10 - rSize.w, cx - half), cx - rSize.w + half);
      l = Math.min(Math.max(l, minX), maxX - rSize.w);
    }
    callouts.push({ key: 'r', cx, label: recLabel, ...rSize, row, left: l, icon: Sprout, tone: TONES.green, dashed: true });
  }
  const rowH = pSize.h + 12;
  const rows = callouts.length ? Math.max(...callouts.map((c) => c.row)) + 1 : 0;
  const top = 8 + rows * rowH + 6;
  const yearRow = !compact && spansYears(lunaStart, n);
  const plotBottom = top + (compact ? 190 : 280);
  const H = plotBottom + (yearRow ? 40 : 28);

  const values = [...model.paths.flatMap((p) => p.drum.luni.map((r) => r.bani)), ...(model.plan?.drum.luni.map((r) => r.bani) ?? [])];
  const domain = moneyDomain(values, prag);
  const y = linearScale([domain.min, domain.max], [plotBottom, top]);
  const ticks = monthTicks(n);
  const colW = (maxX - left) / Math.max(1, n - 1);
  // Etichetele lunilor: numele întregi dacă încap fără să se suprapună, altfel cele scurte; la nevoie se sar etichete.
  const axisFs = compact ? 10 : 12;
  const layoutTicks = (names, list) => {
    const anchorOf = (i) => (list.length > 2 && i === 0 ? 'start' : list.length > 2 && i === list.length - 1 ? 'end' : 'middle');
    const boxes = list.map((t, i) => {
      const text = cap(names[calendarMonth(lunaStart, t) - 1]);
      const w = textWidth(text, axisFs);
      const a = anchorOf(i);
      const x0 = a === 'start' ? x(t) : a === 'end' ? x(t) - w : x(t) - w / 2;
      return { t, text, anchor: a, x0, x1: x0 + w };
    });
    const fits = boxes.every((b, i) => i === 0 || b.x0 >= boxes[i - 1].x1 + 8);
    return { boxes, fits };
  };
  // Ordinea: nume întregi pe toate lunile → nume întregi din două în două (ca în referință) → nume scurte.
  const everyOther = ticks.filter((_, i) => i % 2 === 0);
  const attempts = compact ? [[MONTH_SHORT, ticks]] : [[MONTH_LONG, ticks], [MONTH_LONG, everyOther], [MONTH_SHORT, ticks]];
  let axis = null;
  for (const [names, list] of attempts) {
    axis = layoutTicks(names, list);
    if (axis.fits) break;
  }
  const axisLabels = [];
  for (const b of axis.boxes) {
    if (!axisLabels.length || b.x0 >= axisLabels[axisLabels.length - 1].x1 + 8) axisLabels.push(b);
  }
  // Ultima lună rămâne mereu vizibilă: dacă se suprapune, renunțăm la eticheta dinaintea ei.
  const lastBox = axis.boxes[axis.boxes.length - 1];
  if (lastBox && axisLabels[axisLabels.length - 1] !== lastBox) {
    while (axisLabels.length > 1 && lastBox.x0 < axisLabels[axisLabels.length - 1].x1 + 8) axisLabels.pop();
    axisLabels.push(lastBox);
  }
  const fmtAxis = (v) => (compact ? (Math.abs(v) >= 1000 ? `${formatNumber(v / 1000)}k` : formatNumber(v)) : `${formatNumber(v)} RON`);

  // Eticheta zonei roșii: în zonă, acolo unde acoperă cele mai puține puncte ale liniilor.
  let redPill = null;
  const negSize = calloutSize(NEGATIVE_TEXT, fs);
  const zoneH = plotBottom - y(0);
  if (domain.min < 0 && zoneH >= negSize.h + 10 && negSize.w < maxX - minX - 24) {
    const py = y(0) + (zoneH - negSize.h) / 2;
    const pts = [...model.paths.flatMap((p) => p.drum.luni), ...(model.plan?.drum.luni ?? [])].map((m) => [x(m.t), y(m.bani)]);
    const candidates = [maxX - negSize.w - 12, minX + 12, (minX + maxX - negSize.w) / 2];
    const score = (l) => pts.filter(([px, ppy]) => px >= l - 6 && px <= l + negSize.w + 6 && ppy >= py - 8 && ppy <= py + negSize.h + 8).length;
    const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));
    // Doar dacă nu acoperă nicio valoare: altfel explicația rămâne în cardul de sub grafic.
    if (score(best) === 0) redPill = { left: best, y: py };
  }

  const summary = model.paths
    .map((p) => `${chartLineName(p, model.paths.length)}: ${pathStatus(p.drum.indicatori).text}, cei mai puțini bani ${formatNumber(p.drum.indicatori.soldMinim)} RON`)
    .join('; ');

  return (
    <div className="@container relative" ref={wrapRef}>
      {header && (
        <div className="mb-4 flex items-start gap-3.5">
          <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-brand-soft text-blue" aria-hidden="true">
            <TrendingUp size={22} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[22px] leading-tight font-semibold tracking-tight text-ink">Cum evoluează economiile tale</h2>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              {model.plan
                ? `Vezi diferența dintre ${multi ? 'apartamentele salvate' : 'acest apartament'} și recomandarea RentSmart, lună de lună.`
                : `Câți bani îți rămân la sfârșitul fiecărei luni, pe ${model.sim.luni} luni.`}
            </p>
          </div>
        </div>
      )}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Cum evoluează economiile tale, pe ${model.sim.luni} luni. ${summary}`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <filter id="rs-soft-shadow" x="-10%" y="-30%" width="120%" height="170%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>
          <DangerZone x0={left} x1={maxX} y={y} domain={domain} prag={prag} compact={compact} />
          {domain.ticks.map((v) => (
            <g key={v}>
              {v !== 0 && <line x1={left} x2={maxX} y1={y(v)} y2={y(v)} stroke="#EFEFF4" strokeWidth="1" />}
              <text x={left - 10} y={y(v) + 4} fontSize={compact ? 10 : 11.5} textAnchor="end" fill="#6E6E73">
                {fmtAxis(v)}
              </text>
            </g>
          ))}
          <line x1={left} x2={left} y1={top} y2={plotBottom} stroke="#E5E5EA" strokeWidth="1" />
          {axisLabels.map(({ t, text, anchor }) => (
            <g key={t}>
              <text x={x(t)} y={plotBottom + 18} fontSize={axisFs} textAnchor={anchor} fill="#3A3A3C">
                {text}
              </text>
              {yearRow && (t === 0 || calendarMonth(lunaStart, t) === 1) && (
                <text x={x(t)} y={plotBottom + 32} fontSize="10" textAnchor={anchor === 'middle' ? 'middle' : anchor} fill="#8E8E93">
                  {yearOf(lunaStart, t)}
                </text>
              )}
            </g>
          ))}
          {model.sim.luni < n && <line x1={x(model.sim.luni - 1)} x2={x(model.sim.luni - 1)} y1={top} y2={plotBottom} stroke="#E5E5EA" strokeWidth="1" />}

          {model.plan && <PlanArea luni={model.plan.drum.luni} x={x} y={y} color={PLAN_COLOR} clipTop={top} id="rs-plan-area" />}

          {callouts.map((c) => (
            <MoveLine key={`l-${c.key}`} cx={c.cx} top={8 + c.row * rowH + c.h + 6} bottom={plotBottom} color={c.tone.line} dashed={c.dashed} />
          ))}

          {model.plan && <PlanPath luni={model.plan.drum.luni} x={x} y={y} color={PLAN_COLOR} label={PLAN_LINE_NAME} />}
          {model.paths.map((p) => (
            <Path key={p.listingId} luni={p.drum.luni} x={x} y={y} color={p.color} dots={n <= 24} label={chartLineName(p, model.paths.length)} />
          ))}
          {model.paths.map((p) => {
            const tb = p.drum.indicatori.primaLunaPesteBuget;
            return tb !== null ? <BudgetMarker key={`b-${p.listingId}`} t={tb} bani={p.drum.luni[tb].bani} x={x} y={y} /> : null;
          })}
          {model.paths.map((p) => {
            const tn = p.drum.indicatori.primaLunaNegativa;
            return tn === null ? null : <NegativeMarker key={`n-${p.listingId}`} t={tn} bani={p.drum.luni[tn].bani} x={x} y={y} />;
          })}
          {showPlanned && <MoveTriangle cx={x(lunaMutarii)} y={y(0)} color={TONES.orange.line} />}
          {showRecommended && model.plan?.drum.luni[rec.t] && (
            <circle cx={x(rec.t)} cy={y(model.plan.drum.luni[rec.t].bani)} r="5" fill={PLAN_COLOR} stroke="#fff" strokeWidth="2" />
          )}

          {callouts.map((c) => (
            <Callout key={c.key} left={c.left} y={8 + c.row * rowH} label={c.label} icon={c.icon} tone={c.tone} fontSize={fs} pointerX={c.cx} />
          ))}
          {redPill && <Callout left={redPill.left} y={redPill.y} label={NEGATIVE_TEXT} icon={TriangleAlert} tone={TONES.red} fontSize={fs} />}

          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={plotBottom} stroke="#1D1D1F" strokeWidth="1" opacity="0.15" />}
          {Array.from({ length: n }, (_, t) => (
            <rect
              key={t}
              x={x(t) - colW / 2}
              y={top}
              width={colW}
              height={plotBottom - top}
              fill="transparent"
              tabIndex={0}
              aria-label={monthLabel(lunaStart, t, { capital: true, luni: n })}
              onMouseEnter={() => setHover(t)}
              onFocus={() => setHover(t)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null && <Tooltip t={hover} model={model} lunaStart={lunaStart} storms={storms} left={(x(hover) / W) * 100} />}
      </div>

      <div className="mt-4">
        <Explanations model={model} dates={dates} lunaStart={lunaStart} n={n} />
        <DepositNote model={model} />
      </div>
    </div>
  );
}
