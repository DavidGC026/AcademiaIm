'use client';

import { useEffect, type RefObject } from 'react';

/** Mantiene la navegación por teclado dentro del lector y devuelve el foco al cerrarlo. */
export function useModalFocus(dialogRef: RefObject<HTMLElement | null>, open = true) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.focus();
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog.contains(document.activeElement)) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', trapTab);
    return () => {
      dialog.removeEventListener('keydown', trapTab);
      if (previous?.isConnected) previous.focus();
    };
  }, [dialogRef, open]);
}
