'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';

interface OfficeFilePreviewProps {
  fileName: string;
  fileUrl?: string | null;
  localFile?: File | null;
  ext: string;
  maxHeight?: number;
}

async function loadFileBytes(fileUrl?: string | null, localFile?: File | null): Promise<ArrayBuffer> {
  if (localFile) return localFile.arrayBuffer();
  if (fileUrl) {
    const res = await fetch(toAbsoluteAssetUrl(fileUrl), { credentials: 'include' });
    if (!res.ok) throw new Error('No se pudo cargar el archivo');
    return res.arrayBuffer();
  }
  throw new Error('Sin archivo');
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

function SpreadsheetTable({ rows, maxHeight }: { rows: string[][]; maxHeight: number }) {
  return (
    <div style={{ maxHeight, overflow: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ backgroundColor: ri === 0 ? '#F1F5F9' : '#fff' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ border: '1px solid var(--border)', padding: '6px 8px', verticalAlign: 'top' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocxViewer({ bytes, fileName, maxHeight }: { bytes: ArrayBuffer; fileName: string; maxHeight: number }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');

  const adjustZoom = useCallback((delta: number) => {
    setZoom((z) => clamp(+(z + delta).toFixed(2), 0.5, 3));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el || rendering) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* ponytail: algunos navegadores bloquean fullscreen sin gesto del usuario */
    }
  }, [rendering]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

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
  }, [adjustZoom, rendering]);

  useEffect(() => {
    const el = docxRef.current;
    if (!el) return;

    setRendering(true);
    setError('');
    setContentSize({ w: 0, h: 0 });
    el.innerHTML = '';

    renderAsync(bytes, el, undefined, {
      className: 'docx-preview',
      inWrapper: true,
      breakPages: true,
    })
      .then(() => {
        setContentSize({ w: el.scrollWidth, h: el.scrollHeight });
      })
      .catch(() => setError('No se pudo mostrar la vista previa.'))
      .finally(() => setRendering(false));
  }, [bytes]);

  if (error) {
    return <div style={boxStyle}>{error}</div>;
  }

  return (
    <div
      ref={shellRef}
      className="docx-viewer-shell"
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: maxHeight,
        maxHeight,
        width: '100%',
        contain: 'layout size',
        isolation: 'isolate',
      }}
    >
      <div style={toolbar}>
        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isFullscreen ? 480 : 140 }}>
          {fileName}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" style={toolBtn} disabled={rendering} onClick={() => adjustZoom(-0.2)} aria-label="Alejar">
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: '11px', color: '#64748B', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" style={toolBtn} disabled={rendering} onClick={() => adjustZoom(0.2)} aria-label="Acercar">
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          style={toolBtn}
          disabled={rendering}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          className="docx-viewer-scroll"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-x pan-y',
            background: '#f1f5f9',
            padding: '12px',
          }}
        >
          {rendering && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                fontSize: '13px',
                color: '#64748B',
              }}
            >
              Cargando vista previa…
            </div>
          )}
          <div
            style={{
              width: contentSize.w ? Math.ceil(contentSize.w * zoom) : '100%',
              height: contentSize.h ? Math.ceil(contentSize.h * zoom) : 'auto',
              margin: '0 auto',
              visibility: rendering ? 'hidden' : 'visible',
            }}
          >
            <div
              style={{
                transform: contentSize.w ? `scale(${zoom})` : undefined,
                transformOrigin: 'top left',
                width: contentSize.w || '100%',
                height: contentSize.h || 'auto',
                background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <div ref={docxRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfficeFilePreview({ fileName, fileUrl, localFile, ext, maxHeight = 420 }: OfficeFilePreviewProps) {
  const [sheetRows, setSheetRows] = useState<string[][] | null>(null);
  const [docxBytes, setDocxBytes] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setSheetRows(null);
      setDocxBytes(null);

      if (ext === 'doc') {
        setError('Vista previa no disponible para .doc (formato antiguo). Descarga el archivo.');
        setLoading(false);
        return;
      }

      try {
        const bytes = await loadFileBytes(fileUrl, localFile);
        if (cancelled) return;

        if (ext === 'docx') {
          setDocxBytes(bytes);
        } else if (ext === 'xls' || ext === 'xlsx') {
          const workbook = XLSX.read(new Uint8Array(bytes), { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }).slice(0, 40);
          setSheetRows(rows.map((row) => row.map(String)));
        }
      } catch {
        if (!cancelled) setError('No se pudo mostrar la vista previa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [ext, fileUrl, localFile, fileName]);

  if (loading) {
    return <div style={boxStyle}>Cargando vista previa...</div>;
  }
  if (error) {
    return <div style={boxStyle}>{error}</div>;
  }
  if (sheetRows) {
    return <SpreadsheetTable rows={sheetRows} maxHeight={maxHeight} />;
  }
  if (docxBytes) {
    return <DocxViewer bytes={docxBytes} fileName={fileName} maxHeight={maxHeight} />;
  }

  return <div style={boxStyle}>Selecciona o sube un archivo para ver la vista previa.</div>;
}

const boxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '8px',
  border: '1px dashed var(--border)',
  backgroundColor: '#FAFBFD',
  fontSize: '13px',
  color: '#64748B',
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 10px',
  background: '#f8fafc',
  borderBottom: '1px solid var(--border)',
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
