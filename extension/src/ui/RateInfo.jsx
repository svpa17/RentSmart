// RentSmart: cursul folosit în calcule, cu data publicării și avertizarea „posibil depășit”.
import { Euro } from 'lucide-react';
import { Notice } from './components.jsx';
import { RATE_OUTDATED_MESSAGE, describeRate } from './format.js';

export default function RateInfo({ rate, status }) {
  const d = describeRate(rate, status);
  if (!d) return null;
  return (
    <div className="space-y-1.5">
      <p className="num flex items-center gap-1.5 text-[12px] text-muted">
        <Euro size={13} aria-hidden="true" className="flex-none" />
        <span>
          {d.text}
          {d.outdated && <strong className="text-ask"> · posibil depășit</strong>}
        </span>
      </p>
      {d.outdated && <Notice tone="warn">{RATE_OUTDATED_MESSAGE}</Notice>}
    </div>
  );
}
