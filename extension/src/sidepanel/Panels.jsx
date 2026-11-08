// RentSmart — ecranele secundare ale panoului: acordul pentru AI, textul lipit, întrebările.
import { useState } from 'react';
import { ClipboardPaste, Copy, Lock, MessageSquareText, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { FIELD_TITLES } from '../shared/fields.js';
import { Button, Card, Notice, textareaCls } from '../ui/components.jsx';

/** Ecranul de acord (planul, §9): ce se trimite și ce rămâne local. Fără bifă → doar modul manual. */
export function ConsentCard({ onAccept, onDecline }) {
  const [checked, setChecked] = useState(false);
  return (
    <Card title="Înainte de prima analiză AI" icon={ShieldCheck}>
      <div className="space-y-3 text-[13px]">
        <div className="rounded-[12px] bg-fill p-3.5">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Send size={15} className="text-blue" aria-hidden="true" />
            Trimitem la serviciul AI doar:
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink">
            <li>textul anunțului, cu telefoanele și e-mailurile ascunse;</li>
            <li>lista informațiilor lipsă, pentru mesajul către proprietar;</li>
            <li>textul unei situații neprevăzute descrise de tine, fără sume.</li>
          </ul>
        </div>
        <div className="rounded-[12px] bg-found-soft p-3.5">
          <div className="flex items-center gap-2 font-semibold text-found">
            <Lock size={15} aria-hidden="true" />
            Rămân doar în browserul tău:
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink">
            <li>venitul, economiile și cheltuielile (profilul tău financiar);</li>
            <li>anunțurile salvate, confirmările și setările.</li>
          </ul>
          <p className="mt-1.5 text-[12px] text-muted">Toate calculele se fac local. Nu le trimitem niciodată.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-[14px] text-ink">
          <input type="checkbox" className="mt-1 h-4 w-4 flex-none accent-blue" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>Sunt de acord ca textul anunțului să fie trimis la serviciul AI pentru analiză.</span>
        </label>
        <p className="text-[12px] text-muted">Poți retrage acordul oricând din dashboard → Setări. Fără acord, poți completa manual câmpurile.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!checked} onClick={onAccept}>
          Continuă cu AI
        </Button>
        <Button variant="secondary" onClick={onDecline}>
          Completez manual
        </Button>
      </div>
    </Card>
  );
}

export function PasteForm({ reason, onSubmit, onCancel, busy }) {
  const [text, setText] = useState('');
  return (
    <Card title="Lipește textul anunțului" icon={ClipboardPaste}>
      {reason && (
        <div className="mb-3">
          <Notice tone="warn">{reason}</Notice>
        </div>
      )}
      <textarea
        className={`${textareaCls} h-48`}
        placeholder="Copiază descrierea completă a anunțului (inclusiv „Vezi mai mult”) și lipește-o aici."
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Textul anunțului"
      />
      <p className="mt-1.5 text-[12px] text-muted">Telefoanele și e-mailurile sunt ascunse automat înainte de trimitere.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy || text.trim().length === 0} onClick={() => onSubmit(text)}>
          Analizează textul
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Înapoi
        </Button>
      </div>
    </Card>
  );
}

export function QuestionsView({ intrebari, mesaj, sursaMesaj, onMessageChange, canUseAI, onRephrase, busy }) {
  const [copied, setCopied] = useState(false);
  if (intrebari.length === 0) {
    return <Notice tone="ok">Nu mai ai nimic de întrebat: toate informațiile sunt găsite sau confirmate.</Notice>;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(mesaj);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {intrebari.map((q, i) => (
          <li key={q.campuri.join('+')} className="flex gap-3 rounded-[12px] bg-fill p-3">
            <span className="num inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-[12px] font-semibold text-brand ring-1 ring-line">
              {i + 1}
            </span>
            <div className="min-w-0 text-[14px] text-ink">
              {q.intrebare}
              <span className="mt-0.5 block text-[12px] text-muted">{q.campuri.map((c) => FIELD_TITLES[c]).join(', ')}</span>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <MessageSquareText size={14} aria-hidden="true" />
            Mesaj pentru proprietar {sursaMesaj === 'ai' ? '(formulat cu AI)' : '(șablon)'}
          </span>
          {canUseAI && (
            <Button variant="ghost" size="sm" icon={Sparkles} disabled={busy} onClick={onRephrase}>
              {busy ? 'Se formulează…' : 'Formulează cu AI'}
            </Button>
          )}
        </div>
        <textarea className={`${textareaCls} h-44`} value={mesaj} onChange={(e) => onMessageChange(e.target.value)} aria-label="Mesaj pentru proprietar" />
        <Button variant="secondary" className="mt-2 w-full" icon={Copy} onClick={copy}>
          {copied ? 'Copiat!' : 'Copiază mesajul'}
        </Button>
      </div>
    </div>
  );
}
