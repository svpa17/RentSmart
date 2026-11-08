// RentSmart — dialog de confirmare pentru acțiunile ireversibile (element <dialog> nativ: modal, Esc = renunță).
import { useEffect, useRef } from 'react';
import { Button } from './components.jsx';

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirmă', danger = false, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(92vw,400px)] rounded-[16px] border border-black/[0.06] bg-white p-0 shadow-[var(--shadow-pop)] backdrop:bg-black/30"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-[17px] font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onClose(false)} autoFocus>
            Renunță
          </Button>
          <Button variant={danger ? 'dangerSolid' : 'primary'} onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
