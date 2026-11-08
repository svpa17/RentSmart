// RentSmart — componentele de bază ale interfeței (design inspirat de Apple). Statice: fără animații.
import { CircleAlert, CircleCheck, ExternalLink, Info, KeyRound, TriangleAlert } from 'lucide-react';
import { STATUS_UI } from './status.js';
import { hostOf } from './format.js';

/** Clasa comună a câmpurilor de formular. */
export const inputCls =
  'rs-input h-10 w-full rounded-[10px] border border-hairline bg-white px-3 text-[14px] text-ink placeholder:text-subtle';
export const selectCls = `${inputCls} pr-8`;
export const textareaCls = 'rs-input w-full rounded-[12px] border border-hairline bg-white p-3 text-[14px] leading-relaxed text-ink placeholder:text-subtle';

export function Logo({ size = 28 }) {
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-[8px] bg-blue text-white shadow-[inset_0_-1px_0_rgb(0_0_0/0.15)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <KeyRound size={Math.round(size * 0.55)} strokeWidth={2.4} />
    </span>
  );
}

export function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={compact ? 26 : 30} />
      <div className="leading-tight">
        <div className={`${compact ? 'text-[15px]' : 'text-[17px]'} font-semibold tracking-tight text-ink`}>RentSmart</div>
        {!compact && <div className="text-[12px] text-muted">Costul real al chiriei, înainte să semnezi.</div>}
      </div>
    </div>
  );
}

/**
 * Card alb, colțuri mari, umbră discretă.
 * @param {{title?: any, description?: any, icon?: any, action?: any, padded?: boolean, className?: string, children?: any}} props
 */
export function Card({ title, description, icon: Icon, action, padded = true, className = '', children }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-black/[0.05] bg-card shadow-[var(--shadow-card)] ${padded ? 'p-5' : ''} ${className}`}>
      {(title || action) && (
        <header className={`flex items-start justify-between gap-3 ${children ? 'mb-4' : ''} ${padded ? '' : 'px-5 pt-5'}`}>
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-brand-soft text-blue" aria-hidden="true">
                <Icon size={17} strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold leading-snug tracking-tight text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
          </div>
          {action && <div className="flex-none">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-[#0058b0] active:bg-[#004d9a]',
  secondary: 'bg-fill text-ink hover:bg-fill-strong active:bg-hairline',
  outline: 'border border-hairline bg-white text-ink hover:bg-fill',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-ask-soft text-ask hover:bg-[#ffdcda]',
  dangerSolid: 'bg-red text-white hover:bg-[#e0352b]',
};
const SIZES = {
  sm: 'min-h-8 px-3 text-[13px] rounded-[8px]',
  md: 'min-h-10 px-4 text-[14px] rounded-[10px]',
  lg: 'min-h-11 px-5 text-[15px] rounded-[12px]',
};

export function Button({ variant = 'primary', size = 'md', icon: Icon, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-45 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2} aria-hidden="true" className="flex-none" />}
      {children}
    </button>
  );
}

const TONES = {
  ok: 'bg-found-soft text-found',
  found: 'bg-found-soft text-found',
  warn: 'bg-unclear-soft text-unclear',
  unclear: 'bg-unclear-soft text-unclear',
  ask: 'bg-ask-soft text-ask',
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-fill text-muted',
};
const DOTS = { ok: 'bg-green', found: 'bg-green', warn: 'bg-orange', unclear: 'bg-orange', ask: 'bg-red', brand: 'bg-blue', neutral: 'bg-subtle' };

export function Pill({ tone = 'neutral', dot = true, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-medium ${TONES[tone]} ${className}`}>
      {dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS_UI[status] ?? STATUS_UI.lipsa;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

/** Eticheta obligatorie pe orice rezultat din modul demonstrativ. */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-[6px] bg-unclear-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-unclear">
      DATE DEMONSTRATIVE
    </span>
  );
}

const NOTICE = {
  info: { cls: 'bg-fill text-ink', icon: Info, iconCls: 'text-muted' },
  ok: { cls: 'bg-found-soft text-ink', icon: CircleCheck, iconCls: 'text-green' },
  warn: { cls: 'bg-unclear-soft text-ink', icon: TriangleAlert, iconCls: 'text-orange' },
  danger: { cls: 'bg-ask-soft text-ink', icon: CircleAlert, iconCls: 'text-red' },
};

/** Rând de stare: pictogramă + text, fără chenare grele. */
export function Notice({ tone = 'info', children, className = '' }) {
  const t = NOTICE[tone] ?? NOTICE.info;
  const Icon = t.icon;
  return (
    <div className={`flex items-start gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed ${t.cls} ${className}`}>
      <Icon size={16} strokeWidth={2.2} className={`mt-[2px] flex-none ${t.iconCls}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Antetul unei pagini din dashboard. */
export function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const STAT_ACCENT = { blue: 'text-blue bg-brand-soft', green: 'text-green bg-found-soft', orange: 'text-orange bg-unclear-soft', red: 'text-red bg-ask-soft', indigo: 'text-indigo bg-[#efeffc]', gray: 'text-muted bg-fill' };

/** Card mic de rezumat: etichetă, valoare mare, detaliu. */
export function StatCard({ label, value, hint, icon: Icon, accent = 'blue', valueClass = '' }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-black/[0.05] bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
        {Icon && (
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-[7px] ${STAT_ACCENT[accent]}`} aria-hidden="true">
            <Icon size={14} strokeWidth={2.2} />
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <div className={`num mt-2 truncate text-[22px] font-semibold tracking-tight text-ink ${valueClass}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

/** Mini-tile (în carduri): etichetă + valoare. */
export function Metric({ label, value, hint, tone }) {
  const color = tone === 'ask' ? 'text-ask' : tone === 'ok' ? 'text-found' : 'text-ink';
  return (
    <div className="min-w-0 rounded-[12px] bg-fill px-3 py-2.5">
      <div className="truncate text-[12px] text-muted">{label}</div>
      <div className={`num mt-0.5 text-[15px] leading-snug font-semibold whitespace-nowrap ${color}`}>{value}</div>
      {hint && <div className="truncate text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

/**
 * Segmented control (macOS): un singur rând de opțiuni, selecția pe fundal alb. Static.
 * @param {{options: Array<[string, any]>, value: string, onChange: (id: string) => void, label: string, size?: 'sm'|'md'}} props
 */
export function SegmentedControl({ options, value, onChange, label, size = 'md' }) {
  return (
    <div className="flex w-full gap-0.5 rounded-[10px] bg-fill-strong/70 p-[3px]" role="tablist" aria-label={label}>
      {options.map(([id, text]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`min-w-0 flex-1 cursor-pointer truncate rounded-[8px] px-2 font-medium ${size === 'sm' ? 'min-h-7 text-[12px]' : 'min-h-8 text-[13px]'} ${active ? 'bg-white text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-muted hover:text-ink'}`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** Stare goală: pictogramă, titlu, explicație, acțiune. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-fill text-muted" aria-hidden="true">
          <Icon size={24} strokeWidth={1.8} />
        </span>
      )}
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-[14px] text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Comutator accesibil (checkbox cu role="switch"). */
export function Switch({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" className="rs-switch mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    </label>
  );
}

/** Link către anunțul original, deschis într-un tab nou. */
export function ListingLink({ url, className = '' }) {
  const host = hostOf(url);
  if (!url || !host || !/^https?:/i.test(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex max-w-full items-center gap-1 text-[13px] font-medium text-brand hover:underline ${className}`}
      title={url}
    >
      <span className="truncate">{host}</span>
      <ExternalLink size={13} strokeWidth={2.2} className="flex-none" aria-hidden="true" />
      <span className="sr-only">(deschide anunțul original într-un tab nou)</span>
    </a>
  );
}

/** Rând etichetă / valoare (liste de detalii). */
export function DetailRow({ label, children, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <div className="min-w-0 text-[13px] text-muted">
        {label}
        {hint && <div className="text-[12px] text-subtle">{hint}</div>}
      </div>
      <div className="num min-w-0 text-right text-[14px] font-medium text-ink">{children}</div>
    </div>
  );
}
