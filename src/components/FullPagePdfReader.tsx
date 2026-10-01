'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';

const SecurePdfViewer = dynamic(() => import('@/components/SecurePdfViewer'), { ssr: false });

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
}: FullPagePdfReaderProps) {
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(720);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const update = () => setHeight(Math.max(400, window.innerHeight - 48));
    update();
    window.addEventListener('resize', update);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', update);
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || fileName}
    >
      <button
        type="button"
        aria-label="Cerrar lectura"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />
      <div style={{ position: 'relative', width: '100%', maxWidth: '1400px', height, zIndex: 1 }}>
        <SecurePdfViewer
          fileUrl={fileUrl}
          title={title || fileName}
          maxHeight={height}
          showSideNav
        />
      </div>
    </div>,
    document.body
  );
}
