// RentSmart — elementele graficului „Cum evoluează economiile tale” (SVG). Toate coordonatele vin din scale + SimulationResult.
import { calloutSize } from './chartStyle.js';

/** Zona roșie sub zero (cheltuielile depășesc banii disponibili) și linia discretă a sumei pentru urgențe. */
export function DangerZone({ x0, x1, y, domain, prag, compact }) {
  const yZero = y(0);
  const yBottom = y(domain.min);
  return (
    <g aria-hidden="true">
      {domain.min < 0 && <rect x={x0} y={yZero} width={x1 - x0} height={Math.max(0, yBottom - yZero)} fill="#FF3B30" fillOpacity="0.09" />}
      <line x1={x0} x2={x1} y1={yZero} y2={yZero} stroke="#FF3B30" strokeOpacity="0.45" strokeWidth="1.2" />
      {prag > 0 && (
        <g>
          <line x1={x0} x2={x1} y1={y(prag)} y2={y(prag)} stroke="#8E8E93" strokeOpacity="0.7" strokeWidth="1" strokeDasharray="2 4" strokeLinecap="round" />
          {!compact && (
            <text x={x1 - 4} y={y(prag) - 5} fontSize="10" textAnchor="end" fill="#6E6E73">
              Suma pentru urgențe
            </text>
          )}
        </g>
      )}
    </g>
  );
}

/** Zona verde, discretă, sub linia recomandării (doar deasupra lui zero). */
export function PlanArea({ luni, x, y, color, clipTop, id }) {
  if (luni.length < 2) return null;
  const y0 = y(0);
  const pts = luni.map((m) => `${x(m.t)},${y(m.bani)}`).join(' ');
  const poly = `${pts} ${x(luni[luni.length - 1].t)},${y0} ${x(luni[0].t)},${y0}`;
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="0" y={clipTop} width="100%" height={Math.max(0, y0 - clipTop)} />
        </clipPath>
        <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polygon points={poly} fill={`url(#${id}-g)`} clipPath={`url(#${id})`} />
    </g>
  );
}

/** O linie din grafic: economiile lună de lună. */
export function Path({ luni, x, y, color, dashed = false, dots = true, label }) {
  const points = luni.map((m) => `${x(m.t)},${y(m.bani)}`).join(' ');
  return (
    <g aria-label={label}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={dashed ? 2.5 : 3}
        strokeDasharray={dashed ? '8 6' : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dots && luni.map((m) => <circle key={m.t} cx={x(m.t)} cy={y(m.bani)} r="3.6" fill={color} stroke="#fff" strokeWidth="1.6" />)}
    </g>
  );
}

/** Linia punctată a recomandării RentSmart. */
export function PlanPath(props) {
  return <Path {...props} dashed dots={false} />;
}

/**
 * Etichetă rotunjită cu iconiță și vârf spre punctul la care se referă (pointerX).
 * Rămâne în interiorul graficului (între minX și maxX).
 */
export function Callout({ left, y, label, icon: Icon, tone, fontSize, pointerX = null, pointerDown = true }) {
  const { w, h, icon } = calloutSize(label, fontSize);
  const px = pointerX === null ? null : Math.min(Math.max(pointerX, left + h / 2), left + w - h / 2);
  return (
    <g>
      <rect x={left} y={y} width={w} height={h} rx={h / 2} fill={tone.bg} filter="url(#rs-soft-shadow)" />
      {px !== null && pointerDown && <path d={`M${px - 6} ${y + h - 0.5} L${px} ${y + h + 6} L${px + 6} ${y + h - 0.5} Z`} fill={tone.bg} />}
      <Icon x={left + fontSize * 0.85} y={y + (h - icon) / 2} size={icon} color={tone.text} strokeWidth={2.1} aria-hidden="true" />
      <text x={left + fontSize * 0.85 + icon + fontSize * 0.45} y={y + h / 2 + fontSize * 0.36} fontSize={fontSize} fontWeight="600" fill={tone.text}>
        {label}
      </text>
    </g>
  );
}

/** Linia verticală a unei luni de mutare (planificată sau recomandată). */
export function MoveLine({ cx, top, bottom, color, dashed = false }) {
  return (
    <line
      x1={cx}
      x2={cx}
      y1={top}
      y2={bottom}
      stroke={color}
      strokeWidth="1.5"
      strokeOpacity={dashed ? 0.9 : 0.55}
      strokeDasharray={dashed ? '4 4' : undefined}
      strokeLinecap="round"
    />
  );
}

/** Marcajul de pe axă al mutării planificate (triunghi, ca în legendă). */
export function MoveTriangle({ cx, y, color }) {
  return <path d={`M${cx} ${y - 7} L${cx + 6} ${y + 3} L${cx - 6} ${y + 3} Z`} fill={color} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />;
}

/** Punctul în care economiile devin negative: inel roșu. */
export function NegativeMarker({ t, bani, x, y }) {
  return <circle cx={x(t)} cy={y(bani)} r="7" fill="none" stroke="#FF3B30" strokeWidth="2.2" />;
}

/** Marcajul lunii în care chiria trece de buget. */
export function BudgetMarker({ t, bani, x, y }) {
  const cx = x(t);
  const cy = y(bani) - 11;
  return (
    <g aria-label="Chiria depășește bugetul">
      <circle cx={cx} cy={cy} r="4" fill="#8E8E93" />
    </g>
  );
}
