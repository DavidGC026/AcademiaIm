'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';
import { openPdfDocument } from '@/lib/pdfLoader';

interface SecurePdfViewerProps {
  fileUrl?: string | null;
  localFile?: File | null;
  maxHeight?: number;
  title?: string;
  showSideNav?: boolean;
}

type PdfDoc = Awaited<ReturnType<typeof openPdfDocument>>;

const LOAD_TIMEOUT_MS = 30000;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function isPdfBuffer(data: ArrayBuffer): boolean {
  return new TextDecoder().decode(data.slice(0, 5)).startsWith('%PDF-');
}

// ponytail: canvas + pdf.js; zoom vía CSS scale dentro de caja fija (no redimensiona la página).
export default function SecurePdfViewer({
  fileUrl,
  localFile,
  maxHeight = 500,
  title = 'Documento',
  showSideNav = false,
}: SecurePdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const zoomRef = useRef(1);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [docReady, setDocReady] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedH, setExpandedH] = useState(720);

  const shellH = isExpanded ? expandedH : maxHeight;

  const adjustZoom = useCallback((delta: number) => {
    setZoom((z) => clamp(+(z + delta).toFixed(2), 0.5, 3));
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Ctrl+rueda / pinch del trackpad → zoom solo aquí, no en toda la página.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [adjustZoom, loading, isExpanded]);

  // Pinch con dos dedos en móvil/tablet.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;

    const touchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: touchDist(e.touches), startZoom: zoomRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinch.startDist;
      setZoom(clamp(+(pinch.startZoom * ratio).toFixed(2), 0.5, 3));
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [loading, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const update = () => setExpandedH(Math.max(400, window.innerHeight - 48));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isExpanded]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      setPage(1);
      setTotalPages(0);
      setPageSize({ w: 0, h: 0 });
      void docRef.current?.cleanup?.();
      docRef.current = null;

      try {
        let data: ArrayBuffer;
        if (localFile) {
          data = await localFile.arrayBuffer();
        } else if (fileUrl) {
          const res = await withTimeout(
            fetch(toAbsoluteAssetUrl(fileUrl), { credentials: 'include' }),
            LOAD_TIMEOUT_MS,
            'Tiempo de espera agotado al descargar el PDF'
          );
          if (!res.ok) throw new Error(`No se pudo cargar el documento (${res.status})`);
          data = await res.arrayBuffer();
        } else {
          setLoading(false);
          return;
        }

        if (!isPdfBuffer(data)) {
          throw new Error('El archivo recibido no es un PDF válido');
        }

        const doc = await withTimeout(
          openPdfDocument({ data }),
          LOAD_TIMEOUT_MS,
          'Tiempo de espera agotado al procesar el PDF'
        );

        if (cancelled) {
          void doc.cleanup();
          return;
        }

        docRef.current = doc;
        setTotalPages(doc.numPages);
        setPage(1);
        setZoom(1);
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

  useLayoutEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading || totalPages <= 0) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    (async () => {
      setRendering(true);
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;

        const baseVp = pdfPage.getViewport({ scale: 1 });
        const scrollEl = scrollRef.current;
        const viewH = scrollEl ? scrollEl.clientHeight - 40 : 400;
        const viewW = scrollEl ? scrollEl.clientWidth - (showSideNav ? 112 : 40) : 600;
        const fitScale = Math.min(viewH / baseVp.height, viewW / baseVp.width);
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const scale = clamp(fitScale * dpr, 0.5, 6);
        const vp = pdfPage.getViewport({ scale });

        const displayW = Math.floor(vp.width / dpr);
        const displayH = Math.floor(vp.height / dpr);

        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('No se pudo inicializar el lienzo');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = pdfPage.render({ canvasContext: ctx, viewport: vp, canvas });
        await renderTask.promise;

        if (!cancelled) setPageSize({ w: displayW, h: displayH });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al renderizar la página');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [page, docReady, loading, totalPages, showSideNav, isExpanded]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'S', 'P'].includes(e.key)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'ArrowRight') goNext();
  };

  if (error) {
    return <div style={msgBox}>{error}</div>;
  }

  const viewer = (
    <div
      className={`pdf-viewer-shell${isExpanded ? ' pdf-viewer-shell--expanded' : ''}`}
      style={{
        height: shellH,
        maxHeight: shellH,
        contain: isExpanded ? undefined : 'layout size',
        isolation: 'isolate',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div className="pdf-viewer-toolbar">
        <button type="button" disabled={page <= 1 || loading || rendering} onClick={goPrev} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        <span className="pdf-viewer-page-info">
          {loading ? '…' : `${page} / ${totalPages || '?'}`}
        </span>
        <button type="button" disabled={page >= totalPages || loading || rendering} onClick={goNext} aria-label="Página siguiente">
          <ChevronRight size={16} />
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" disabled={loading || rendering} onClick={() => adjustZoom(-0.2)} aria-label="Alejar">
          <ZoomOut size={16} />
        </button>
        <span className="pdf-viewer-zoom-info">{Math.round(zoom * 100)}%</span>
        <button type="button" disabled={loading || rendering} onClick={() => adjustZoom(0.2)} aria-label="Acercar">
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setIsExpanded((v) => !v)}
          aria-label={isExpanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          title={isExpanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isExpanded ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      <div className="pdf-viewer-stage">
        {showSideNav && !loading && totalPages > 0 && (
          <>
            <button
              type="button"
              className="pdf-viewer-side-btn"
              style={{ left: 8 }}
              disabled={page <= 1 || rendering}
              onClick={goPrev}
              aria-label="Página anterior"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              className="pdf-viewer-side-btn"
              style={{ right: 8 }}
              disabled={page >= totalPages || rendering}
              onClick={goNext}
              aria-label="Página siguiente"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className={`pdf-viewer-scroll${showSideNav ? ' pdf-viewer-scroll--sidenav' : ''}`}
        >
          {loading ? (
            <div className="pdf-viewer-loading">Cargando lectura…</div>
          ) : (
            <div
              style={{
                width: pageSize.w ? Math.ceil(pageSize.w * zoom) : '100%',
                height: pageSize.h ? Math.ceil(pageSize.h * zoom) : '100%',
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: pageSize.w || '100%',
                  height: pageSize.h || '100%',
                  background: '#fff',
                  borderRadius: '4px',
                  boxShadow: '0 4px 20px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.06)',
                  lineHeight: 0,
                  opacity: rendering ? 0.85 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <canvas ref={canvasRef} style={{ display: 'block', userSelect: 'none', WebkitUserSelect: 'none' }} aria-label={title} />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="pdf-viewer-footer">
        Solo lectura dentro de la plataforma · usa ← → para pasar página · pellizca con dos dedos para zoom
        {isExpanded ? ' · Esc para salir' : ''}
      </p>
    </div>
  );

  if (isExpanded && typeof document !== 'undefined') {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 13000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          aria-label="Cerrar pantalla completa"
          onClick={() => setIsExpanded(false)}
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
        <div style={{ position: 'relative', width: '100%', maxWidth: '1400px', height: expandedH, zIndex: 1 }}>
          {viewer}
        </div>
      </div>,
      document.body
    );
  }

  return viewer;
}

const msgBox: React.CSSProperties = {
  padding: '20px',
  textAlign: 'center',
  fontSize: '13px',
  color: '#64748B',
  border: '1px dashed var(--border)',
  borderRadius: '8px',
  background: '#FAFBFD',
};
