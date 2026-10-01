'use client';

import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';
import { openPdfDocument } from '@/lib/pdfLoader';

interface PdfScrollViewerProps {
  fileUrl?: string | null;
  localFile?: File | null;
  maxHeight?: number;
  title?: string;
}

type PdfDoc = Awaited<ReturnType<typeof openPdfDocument>>;

function PdfPageCanvas({ doc, pageNum, scale }: { doc: PdfDoc; pageNum: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    (async () => {
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      await renderTask.promise;
    })().catch(() => {});

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNum, scale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}
      aria-label={`Página ${pageNum}`}
    />
  );
}

export default function PdfScrollViewer({
  fileUrl,
  localFile,
  maxHeight = 420,
  title = 'Documento',
}: PdfScrollViewerProps) {
  const docRef = useRef<PdfDoc | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [docReady, setDocReady] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    docRef.current = null;
    setDocReady(0);

    (async () => {
      setLoading(true);
      setError('');
      try {
        let data: ArrayBuffer;
        if (localFile) {
          data = await localFile.arrayBuffer();
        } else if (fileUrl) {
          const res = await fetch(toAbsoluteAssetUrl(fileUrl));
          if (!res.ok) throw new Error('No se pudo cargar el PDF');
          data = await res.arrayBuffer();
        } else {
          return;
        }

        const doc = await openPdfDocument({ data });
        if (cancelled) {
          void doc.cleanup();
          return;
        }
        docRef.current = doc;
        setTotalPages(doc.numPages);
        setZoom(1);

        const first = await doc.getPage(1);
        setPageWidth(first.getViewport({ scale: 1 }).width);
        setDocReady((n) => n + 1);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar el PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      void docRef.current?.cleanup?.();
      docRef.current = null;
    };
  }, [fileUrl, localFile]);

  // Mide el ancho solo al montar y en resize de ventana (un canvas no dispara 'resize'),
  // así se evita por completo el bucle de realimentación del ResizeObserver.
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setContainerWidth(el.clientWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [docReady]);

  if (error) {
    return <div style={msgBox}>{error}</div>;
  }

  const doc = docRef.current;
  const fitScale = pageWidth > 0 && containerWidth > 0 ? (containerWidth - 24) / pageWidth : 1;
  const effectiveScale = Math.max(0.1, fitScale * zoom);

  return (
    <div ref={wrapRef} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={toolbar}>
        <span style={{ fontSize: '12px', color: '#64748B' }}>
          {loading ? 'Cargando…' : `${totalPages} pág. · desplázate ↓`}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" style={toolBtn} disabled={loading} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))} aria-label="Alejar">
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: '11px', color: '#64748B', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" style={toolBtn} disabled={loading} onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))} aria-label="Acercar">
          <ZoomIn size={16} />
        </button>
      </div>
      <div style={{ overflow: 'auto', maxHeight, background: '#525659', padding: '12px' }} aria-label={title}>
        {loading || !doc ? (
          <div style={{ ...msgBox, background: 'transparent', color: '#fff', border: 'none' }}>Cargando vista previa…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', width: 'fit-content', minWidth: '100%', margin: '0 auto' }}>
            {Array.from({ length: totalPages }, (_, i) => (
              <PdfPageCanvas key={`${docReady}-${i + 1}`} doc={doc} pageNum={i + 1} scale={effectiveScale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const toolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  background: '#F8FAFC',
  flexShrink: 0,
};

const toolBtn: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: '#fff',
  color: '#334155',
  borderRadius: '6px',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const msgBox: React.CSSProperties = {
  padding: '20px',
  textAlign: 'center',
  fontSize: '13px',
  color: '#64748B',
  border: '1px dashed var(--border)',
  borderRadius: '8px',
  background: '#FAFBFD',
};
