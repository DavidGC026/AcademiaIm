'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './CampusFlow.module.css';

export default function CampusDialog({ children, titleId, onClose, busy = false }: {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      {children}
    </dialog>
  );
}
