// RĂSCRUCE AI — hook pentru confirmări: const [confirm, dialog] = useConfirm(); if (await confirm({...})) …
import { useCallback, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onClose={(ok) => {
        state.resolve(ok);
        setState(null);
      }}
    />
  ) : null;
  return [confirm, dialog];
}
