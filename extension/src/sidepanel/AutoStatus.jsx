// RentSmart — starea analizei automate pentru anunțul din tab-ul activ: în curs, eroare sau pauză AI.
// Static (fără animații). „Încearcă din nou” cere service worker-ului o analiză nouă, fără cache.
import { RotateCcw, ScanSearch, TriangleAlert } from 'lucide-react';
import { errorMessage } from '../ai/errors.js';
import { Button } from '../ui/components.jsx';
import PropertyImage from '../ui/PropertyImage.jsx';
import { hostOf } from '../ui/format.js';


const READ_ERRORS = {
  INJECTARE_INTERZISA: 'Pagina nu a putut fi citită. Reîncarcă anunțul sau lipește textul lui.',
  FARA_PERMISIUNE: 'RentSmart nu are acces la acest site. Pornește din nou „Analizează automat anunțurile” ca să acorzi accesul.',
  FARA_TEXT: 'Pagina nu afișează încă textul anunțului (poate cere autentificare sau încă se încarcă).',
  FARA_TAB: 'Tab-ul nu mai este deschis.',
};

function message(state) {
  if (state.stare === 'analiza') return { title: 'Analizăm automat acest anunț…', text: 'Rezultatul apare aici imediat ce e gata. Poți închide panoul între timp.' };
  if (state.stare === 'amanat') {
    const ora = state.pana ? new Date(state.pana).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : null;
    return {
      title: 'Analiza AI e în pauză',
      text: `Serviciul AI a limitat cererile, așa că nu reîncercăm automat${ora ? ` până la ${ora}` : ''}. Poți reîncerca manual.`,
      error: true,
    };
  }
  return { title: 'Analiza automată nu a reușit', text: READ_ERRORS[state.cod] ?? errorMessage(state.cod), error: true };
}

export function AutoStatusCard({ state, onRetry }) {
  const m = message(state);
  return (
    <section className="rounded-[16px] border border-black/[0.05] bg-card p-4 shadow-[var(--shadow-card)]" role="status">
      <div className="flex gap-3">
        <PropertyImage src={state.imagine} alt={state.titlu ?? 'Anunț'} className="h-[76px] w-[92px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-muted">{hostOf(state.url) ?? ''}</p>
          <h2 className="text-[15px] leading-snug font-semibold text-ink">{state.titlu ?? 'Anunț detectat'}</h2>
        </div>
      </div>
      <div className={`mt-3 flex gap-2.5 rounded-[12px] px-3 py-2.5 ${m.error ? 'bg-unclear-soft' : 'bg-brand-soft'}`}>
        {m.error ? (
          <TriangleAlert size={17} className="mt-0.5 flex-none text-orange" aria-hidden="true" />
        ) : (
          <ScanSearch size={17} className="mt-0.5 flex-none text-blue" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{m.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{m.text}</p>
        </div>
      </div>
      {m.error && (
        <Button variant="secondary" className="mt-3 w-full" icon={RotateCcw} onClick={onRetry}>
          Încearcă din nou
        </Button>
      )}
    </section>
  );
}
