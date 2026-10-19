'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/lib/useModalFocus';

const BookFlipViewer = dynamic(() => import('@/components/BookFlipViewer'), { ssr: false });
const subscribeToMount = () => () => {};

interface FullPagePdfReaderProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fileUrl: string;
  fileName: string;
  secure?: boolean;
}

export default function FullPagePdfReader({
  open,
  onClose,
  title,
  fileUrl,
  fileName,
  secure = false,
}: FullPagePdfReaderProps) {
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, open && mounted);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title || fileName} tabIndex={-1}>
      <BookFlipViewer fileUrl={fileUrl} title={title || fileName} onClose={onClose} secure={secure} />
    </div>,
    document.body
  );
}
