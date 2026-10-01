'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import HTMLFlipBook from 'react-pageflip';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';
import { openPdfDocument } from '@/lib/pdfLoader';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

const FlipPage = forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, ref) => (
  <div
    ref={ref}
    style={{
      backgroundColor: '#fff',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    {children}
  </div>
));
FlipPage.displayName = 'FlipPage';

interface BookFlipViewerProps {
  fileUrl: string;
  title: string;
  onClose: () => void;
  /** Fetch autenticado (libros de biblioteca). */
  secure?: boolean;
}

export default function BookFlipViewer({ fileUrl, title, onClose, secure = false }: BookFlipViewerProps) {
  const flipBookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; flip: (n: number) => void } } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFs, setIsFs] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [viewMode, setViewMode] = useState<'spread' | 'single'>('spread');
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);

  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef({ startX: 0, startY: 0, dist: 0, pinching: false, baseZoom: 1, lastTap: 0 });
  const panRef = useRef({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const mouseDragRef = useRef({ down: false, x: 0, y: 0, sl: 0, st: 0 });

  const maxPageIndex = Math.max(0, total - 1);
  const zoomActive = zoom > 1;
  const flipbookActive = !isMobile && viewMode === 'spread' && !zoomActive;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      setIsMobile(mq.matches);
      setViewMode(mq.matches ? 'single' : window.innerWidth >= 1024 ? 'spread' : 'single');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const flashUI = useCallback(() => {
    setShowUI(true);
    if (uiTimer.current) clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => {
      if (isMobile) setShowUI(false);
    }, 3000);
  }, [isMobile]);

  useEffect(() => {
    flashUI();
    return () => {
      if (uiTimer.current) clearTimeout(uiTimer.current);
    };
  }, [flashUI]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setContentSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, isMobile, viewMode, zoomActive]);

  const renderPage = useCallback(async (pdf: Awaited<ReturnType<typeof openPdfDocument>>, num: number) => {
    try {
      const p = await pdf.getPage(num);
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const scale = clamp(2 * dpr, 2, 3);
      const vp = p.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext('2d', { alpha: false });
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
      return c.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPages([]);
      setPage(0);
      setProgress(0);
      try {
        const res = await fetch(toAbsoluteAssetUrl(fileUrl), secure ? { credentials: 'include' } : undefined);
        if (!res.ok) throw new Error('No se pudo cargar el documento');
        const buf = await res.arrayBuffer();
        const pdf = await openPdfDocument({ data: buf });
        const imgs: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const img = await renderPage(pdf, i);
          if (img) imgs.push(img);
          setProgress(Math.round((i / pdf.numPages) * 100));
        }
        if (cancelled) {
          void pdf.cleanup();
          return;
        }
        setPages(imgs);
        setTotal(imgs.length);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar el PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, secure, renderPage]);

  const next = useCallback(() => {
    if (flipbookActive) {
      try {
        flipBookRef.current?.pageFlip()?.flipNext();
      } catch {
        /* noop */
      }
      flashUI();
      return;
    }
    setPage((p) => Math.min(p + 1, maxPageIndex));
    setOffset({ x: 0, y: 0 });
    flashUI();
  }, [flipbookActive, maxPageIndex, flashUI]);

  const prev = useCallback(() => {
    if (flipbookActive) {
      try {
        flipBookRef.current?.pageFlip()?.flipPrev();
      } catch {
        /* noop */
      }
      flashUI();
      return;
    }
    setPage((p) => Math.max(p - 1, 0));
    setOffset({ x: 0, y: 0 });
    flashUI();
  }, [flipbookActive, flashUI]);

  const goToIndex = useCallback(
    (idx: number) => {
      const n = clamp(idx, 0, maxPageIndex);
      if (flipbookActive) {
        try {
          flipBookRef.current?.pageFlip()?.flip(n);
        } catch {
          /* noop */
        }
      }
      setPage(n);
      setOffset({ x: 0, y: 0 });
      flashUI();
    },
    [flipbookActive, maxPageIndex, flashUI]
  );

  const toggleFs = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFs(true);
    } else {
      document.exitFullscreen();
      setIsFs(false);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          prev();
          break;
        case 'Home':
          goToIndex(0);
          break;
        case 'End':
          goToIndex(maxPageIndex);
          break;
        case '+':
        case '=':
          setZoom((z) => clamp(z + 0.25, 1, 3));
          break;
        case '-':
        case '_':
          setZoom((z) => clamp(z - 0.25, 1, 3));
          break;
        case 'f':
        case 'F':
          toggleFs();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
            setIsFs(false);
          } else if (zoomActive) {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev, goToIndex, maxPageIndex, zoomActive, toggleFs, onClose]);

  const clampOffset = useCallback((nx: number, ny: number, z: number) => {
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return { x: nx, y: ny };
    const maxX = Math.max(0, (img.clientWidth * z - cont.clientWidth) / 2);
    const maxY = Math.max(0, (img.clientHeight * z - cont.clientHeight) / 2);
    return { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) };
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      flashUI();
      const t = touchRef.current;
      if (e.touches.length === 2) {
        t.pinching = true;
        t.dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        t.baseZoom = zoom;
      } else if (e.touches.length === 1) {
        t.pinching = false;
        t.startX = e.touches[0].clientX;
        t.startY = e.touches[0].clientY;
        const now = Date.now();
        if (now - t.lastTap < 300) {
          setZoom((z) => (z > 1 ? 1 : 2));
          setOffset({ x: 0, y: 0 });
        }
        t.lastTap = now;
        if (zoom > 1) {
          panRef.current = {
            dragging: true,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            ox: offset.x,
            oy: offset.y,
          };
        }
      }
    },
    [zoom, offset, flashUI]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = touchRef.current;
      if (t.pinching && e.touches.length === 2) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const newZ = clamp(t.baseZoom * (d / t.dist), 1, 4);
        setZoom(newZ);
        if (newZ <= 1) setOffset({ x: 0, y: 0 });
        else setOffset((o) => clampOffset(o.x, o.y, newZ));
      } else if (e.touches.length === 1 && panRef.current.dragging && zoom > 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - panRef.current.startX;
        const dy = e.touches[0].clientY - panRef.current.startY;
        setOffset(clampOffset(panRef.current.ox + dx, panRef.current.oy + dy, zoom));
      }
    },
    [zoom, clampOffset]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = touchRef.current;
      if (t.pinching) {
        t.pinching = false;
        return;
      }
      panRef.current.dragging = false;
      if (zoom > 1) return;
      const dx = (e.changedTouches[0]?.clientX || 0) - t.startX;
      const dy = (e.changedTouches[0]?.clientY || 0) - t.startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) next();
        else prev();
      }
    },
    [zoom, next, prev]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    mouseDragRef.current = { down: true, x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    setGrabbing(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !mouseDragRef.current.down) return;
    el.scrollLeft = mouseDragRef.current.sl - (e.clientX - mouseDragRef.current.x);
    el.scrollTop = mouseDragRef.current.st - (e.clientY - mouseDragRef.current.y);
  }, []);

  const endMouseDrag = useCallback(() => {
    mouseDragRef.current.down = false;
    setGrabbing(false);
  }, []);

  if (loading) {
    return (
      <div style={shell}>
        <div style={loadingBox}>
          <div style={spinner} />
          <p style={{ color: '#c9d1d9', fontSize: '14px', margin: '16px 0 8px' }}>
            {progress > 0 ? 'Preparando páginas…' : 'Conectando…'}
          </p>
          {progress > 0 && (
            <>
              <div style={progressTrack}>
                <div style={{ ...progressBar, width: `${progress}%` }} />
              </div>
              <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '6px' }}>{progress}%</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={shell}>
        <header style={topBar}>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Cerrar">
            <ArrowLeft size={18} />
          </button>
          <span style={titleStyle}>{title}</span>
        </header>
        <div style={loadingBox}>
          <p style={{ color: '#f87171', marginBottom: '12px' }}>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const fitHeight = contentSize.h ? Math.max(200, contentSize.h - 32) : 0;
  const pageLabel =
    flipbookActive && page + 1 < total ? `${page + 1}–${page + 2} / ${total}` : `${page + 1} / ${total}`;

  if (isMobile) {
    return (
      <div
        style={{ ...shell, userSelect: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ ...mobileTop, opacity: showUI ? 1 : 0.35 }}>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Cerrar">
            <ArrowLeft size={18} />
          </button>
          <span style={{ ...titleStyle, flex: 1, fontSize: '12px' }}>{title}</span>
          <button type="button" onClick={toggleFs} style={iconBtn} aria-label="Pantalla completa">
            {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>

        <div ref={containerRef} style={mobileStage} onClick={flashUI}>
          {page < pages.length ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={pages[page]}
              alt={`Página ${page + 1}`}
              draggable={false}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
                transition: touchRef.current.pinching || panRef.current.dragging ? 'none' : 'transform 0.2s ease',
              }}
            />
          ) : (
            <div style={{ color: '#fff', textAlign: 'center', padding: '32px' }}>
              <p style={{ fontWeight: 700, fontSize: '18px' }}>Fin del libro</p>
              <p style={{ opacity: 0.7, fontSize: '13px' }}>Solo lectura · Academia IMCYC</p>
            </div>
          )}
        </div>

        <div style={{ ...mobileBottom, opacity: showUI ? 1 : 0.35 }}>
          <input
            type="range"
            min={0}
            max={maxPageIndex}
            value={page}
            onChange={(e) => goToIndex(Number(e.target.value))}
            style={{ width: '100%', marginBottom: '8px', accentColor: '#58a6ff' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="button" onClick={prev} disabled={page <= 0} style={iconBtn}>
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={next} disabled={page >= maxPageIndex} style={iconBtn}>
                <ChevronRight size={20} />
              </button>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
              {page + 1} / {total}
            </span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button type="button" onClick={() => { setZoom((z) => clamp(z - 0.5, 1, 4)); setOffset({ x: 0, y: 0 }); }} disabled={zoom <= 1} style={iconBtn}>
                <ZoomOut size={18} />
              </button>
              <span style={{ color: zoom > 1 ? '#58a6ff' : 'rgba(255,255,255,0.6)', fontSize: '11px', minWidth: '36px', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button type="button" onClick={() => setZoom((z) => clamp(z + 0.5, 1, 4))} style={iconBtn}>
                <ZoomIn size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={topBar}>
        <button type="button" onClick={onClose} style={iconBtn} aria-label="Cerrar">
          <ArrowLeft size={18} />
        </button>
        <span style={titleStyle}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button type="button" onClick={() => setZoom((z) => clamp(z - 0.25, 1, 3))} disabled={zoom <= 1} style={iconBtn} aria-label="Alejar">
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            style={{ ...zoomLabel, color: zoom !== 1 ? '#58a6ff' : '#8b949e' }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => setZoom((z) => clamp(z + 0.25, 1, 3))} disabled={zoom >= 3} style={iconBtn} aria-label="Acercar">
            <ZoomIn size={16} />
          </button>
          <span style={divider} />
          <button
            type="button"
            onClick={() => {
              setViewMode((m) => (m === 'spread' ? 'single' : 'spread'));
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            disabled={zoomActive}
            style={{ ...iconBtn, opacity: zoomActive ? 0.35 : 1 }}
            title={viewMode === 'spread' ? 'Ver una página' : 'Ver dos páginas'}
          >
            {viewMode === 'spread' ? <FileText size={16} /> : <BookOpen size={16} />}
          </button>
          <span style={divider} />
          <button type="button" onClick={prev} disabled={page <= 0} style={iconBtn}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ color: '#8b949e', fontSize: '12px', minWidth: '72px', textAlign: 'center' }}>{pageLabel}</span>
          <button type="button" onClick={next} disabled={page >= maxPageIndex} style={iconBtn}>
            <ChevronRight size={16} />
          </button>
          <span style={divider} />
          <button type="button" onClick={toggleFs} style={iconBtn} aria-label="Pantalla completa">
            {isFs ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </header>

      <div style={{ padding: '8px 16px', background: 'rgba(22,27,34,0.6)', flexShrink: 0 }}>
        <input
          type="range"
          min={0}
          max={maxPageIndex}
          value={page}
          onChange={(e) => goToIndex(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#58a6ff' }}
        />
      </div>

      <div ref={contentRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', isolation: 'isolate' }}>
        {zoomActive && pages.length > 0 && (
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={endMouseDrag}
            onMouseLeave={endMouseDrag}
            style={{
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '16px',
              cursor: grabbing ? 'grabbing' : 'grab',
            }}
          >
            <div style={{ flexShrink: 0, margin: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pages[page]}
                alt={`Página ${page + 1}`}
                draggable={false}
                style={{ display: 'block', height: fitHeight ? fitHeight * zoom : undefined, width: 'auto', maxWidth: 'none' }}
              />
            </div>
          </div>
        )}

        {!zoomActive && viewMode === 'spread' && pages.length > 0 && (
          <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
            <HTMLFlipBook
              ref={flipBookRef}
              width={420}
              height={595}
              size="stretch"
              minWidth={300}
              maxWidth={1400}
              minHeight={400}
              maxHeight={1800}
              showCover={false}
              flippingTime={700}
              usePortrait={false}
              autoSize
              maxShadowOpacity={0.5}
              drawShadow
              useMouseEvents
              mobileScrollSupport={false}
              onFlip={(e: { data: number }) => setPage(e.data)}
              startPage={page}
              className=""
              style={{}}
              startZIndex={0}
              clickEventForward
              swipeDistance={30}
              showPageCorners
              disableFlipByClick={false}
            >
              {pages.map((img, i) => (
                <FlipPage key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </FlipPage>
              ))}
              <FlipPage>
                <div
                  style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #9ea2a2, #003b5c)',
                    color: '#fff',
                    textAlign: 'center',
                    padding: '32px',
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: '22px', marginBottom: '8px' }}>Fin del libro</p>
                  <p style={{ opacity: 0.85, fontSize: '13px' }}>Solo lectura · Academia IMCYC</p>
                </div>
              </FlipPage>
            </HTMLFlipBook>
          </div>
        )}

        {!zoomActive && viewMode === 'single' && pages.length > 0 && (
          <div style={{ height: '100%', position: 'relative' }}>
            <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={page}
                src={pages[page]}
                alt={`Página ${page + 1}`}
                draggable={false}
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  borderRadius: '6px',
                }}
              />
            </div>
            {page > 0 && (
              <button type="button" onClick={prev} style={{ ...navZone, left: 0, justifyContent: 'flex-start' }} aria-label="Anterior">
                <ChevronLeft size={40} color="#fff" />
              </button>
            )}
            {page < maxPageIndex && (
              <button type="button" onClick={next} style={{ ...navZone, right: 0, justifyContent: 'flex-end' }} aria-label="Siguiente">
                <ChevronRight size={40} color="#fff" />
              </button>
            )}
          </div>
        )}
      </div>

      <p style={{ margin: 0, padding: '6px', fontSize: '10px', color: '#64748B', textAlign: 'center', background: '#0f172a' }}>
        Solo lectura dentro de la plataforma · ← → para navegar · Esc para cerrar
      </p>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  background: '#0d1117',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const topBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 16px',
  background: 'rgba(22,27,34,0.95)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  color: '#c9d1d9',
  fontWeight: 600,
  fontSize: '14px',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  borderRadius: '6px',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const zoomLabel: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '12px',
  minWidth: '44px',
  cursor: 'pointer',
};

const divider: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'rgba(255,255,255,0.1)',
  margin: '0 4px',
};

const loadingBox: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const spinner: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid rgba(88,166,255,0.2)',
  borderTopColor: '#58a6ff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const progressTrack: React.CSSProperties = {
  width: 'min(300px, 70vw)',
  height: 4,
  background: '#21262d',
  borderRadius: 2,
  overflow: 'hidden',
};

const progressBar: React.CSSProperties = {
  height: '100%',
  background: '#58a6ff',
  borderRadius: 2,
  transition: 'width 0.2s',
};

const mobileTop: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 30,
  background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)',
  padding: '8px 12px 24px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'opacity 0.3s',
};

const mobileBottom: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  background: 'linear-gradient(0deg, rgba(0,0,0,0.7), transparent)',
  padding: '24px 16px 16px',
  transition: 'opacity 0.3s',
};

const mobileStage: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  position: 'relative',
};

const navZone: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '18%',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 0.2s',
};
