'use client';

import { useCallback, useLayoutEffect, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { BookOpen, Download, ExternalLink, FileText, Link2, X } from 'lucide-react';
import { getFileExt } from '@/components/FileResourcePreview';
import { toAbsoluteAssetUrl, toBibliotecaContenidoUrl } from '@/lib/assetUrl';
import { withAlpha } from '@/lib/colorUtils';
import type { SeccionItemEnriquecido } from '@/components/ClaseSeccionesViewer';

const SecurePdfViewer = dynamic(() => import('@/components/SecurePdfViewer'), { ssr: false });

interface Props {
  title: string;
  color: string;
  items: SeccionItemEnriquecido[];
  accesoPrioritario?: boolean;
  permiteDescarga?: boolean;
  onClose: () => void;
}

interface ResolvedItem {
  key: string;
  label: string;
  icon: 'pdf' | 'libro' | 'enlace' | 'archivo';
  pdfUrl?: string;
  linkUrl?: string;
  downloadUrl?: string;
  downloadName?: string;
}

function resolveItem(item: SeccionItemEnriquecido, idx: number, accesoPrioritario: boolean): ResolvedItem {
  if (item.tipo === 'enlace') {
    return { key: `l${idx}`, label: item.titulo, icon: 'enlace', linkUrl: item.url };
  }
  if (item.tipo === 'biblioteca') {
    const libro = item as unknown as {
      titulo?: string;
      archivo_url?: string | null;
      archivo_nombre?: string | null;
      comprado?: boolean;
      puede_leer?: boolean;
    };
    const canRead = accesoPrioritario || !!libro.comprado || !!libro.puede_leer;
    const isPdf =
      !!libro.archivo_url &&
      getFileExt(libro.archivo_nombre, libro.archivo_url) === 'pdf';
    return {
      key: `b${idx}`,
      label: libro.titulo || `Libro ${idx + 1}`,
      icon: 'libro',
      pdfUrl: canRead && isPdf && libro.archivo_url ? toBibliotecaContenidoUrl('libros', libro.archivo_url) : undefined,
      downloadUrl: canRead && libro.archivo_url ? toBibliotecaContenidoUrl('libros', libro.archivo_url) : undefined,
      downloadName: libro.archivo_nombre || libro.titulo || 'libro.pdf',
    };
  }
  const fileName = item.archivo_nombre || item.nombre;
  const isPdf = getFileExt(fileName, item.url) === 'pdf';
  const absUrl = toAbsoluteAssetUrl(item.url);
  return {
    key: `a${idx}`,
    label: item.nombre,
    icon: isPdf ? 'pdf' : 'archivo',
    pdfUrl: isPdf ? absUrl : undefined,
    linkUrl: isPdf ? undefined : absUrl,
    downloadUrl: absUrl,
    downloadName: fileName,
  };
}

export default function SeccionFullscreenGallery({
  title,
  color,
  items,
  accesoPrioritario = false,
  permiteDescarga = true,
  onClose,
}: Props) {
  const [active, setActive] = useState(0);
  const [viewerH, setViewerH] = useState(640);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const update = () => setViewerH(Math.max(280, window.innerHeight - 140));
    update();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', update);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', update);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const resolved = items.map((it, i) => resolveItem(it, i, accesoPrioritario));
  const current = resolved[active] ?? resolved[0];
  const canDownload = permiteDescarga && !!current?.downloadUrl;

  const iconFor = (icon: ResolvedItem['icon']) => {
    if (icon === 'libro') return <BookOpen size={16} />;
    if (icon === 'enlace') return <Link2 size={16} />;
    return <FileText size={16} />;
  };

  return createPortal(
    <div className="seccion-gallery" role="dialog" aria-modal="true" aria-label={`${title} en pantalla completa`}>
      <div style={{ ...header, borderBottom: `3px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748B', flexShrink: 0 }}>
            {items.length} recurso{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button type="button" onClick={onClose} style={closeBtn} aria-label="Cerrar" className="seccion-gallery-close">
          <X size={20} />
        </button>
      </div>

      {canDownload && (
        <div style={downloadBar}>
          <a
            href={current!.downloadUrl}
            download={current!.downloadName}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} />
            Descargar archivo
          </a>
        </div>
      )}

      <div className="seccion-gallery-body">
        {resolved.length > 1 && (
          <aside className="seccion-gallery-thumbs">
            {resolved.map((r, i) => {
              const isActive = i === active;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setActive(i)}
                  style={{
                    ...thumbCard,
                    borderColor: isActive ? color : 'var(--border)',
                    boxShadow: isActive ? `0 0 0 2px ${withAlpha(color, 0.35)}` : 'none',
                    background: isActive ? withAlpha(color, 0.08) : '#fff',
                  }}
                >
                  <div className="seccion-gallery-thumb-preview" style={{ ...thumbPreview, borderColor: withAlpha(color, 0.25), color }}>
                    {iconFor(r.icon)}
                    <span style={thumbNum}>{i + 1}</span>
                  </div>
                  <span style={{ ...thumbLabel, color: isActive ? color : '#334155' }}>{r.label}</span>
                </button>
              );
            })}
          </aside>
        )}

        <main className="seccion-gallery-main">
          {current?.pdfUrl ? (
            <SecurePdfViewer
              key={current.key}
              fileUrl={current.pdfUrl}
              title={current.label}
              maxHeight={viewerH}
              showSideNav
            />
          ) : current?.linkUrl ? (
            <div style={fallbackCard}>
              <ExternalLink size={40} color={color} />
              <p style={{ margin: '12px 0 4px', fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>{current.label}</p>
              <a href={current.linkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '8px' }}>
                Abrir recurso
              </a>
            </div>
          ) : (
            <div style={fallbackCard}>
              <FileText size={40} color="#94A3B8" />
              <p style={{ margin: '12px 0 0', color: '#64748B', fontWeight: 600 }}>
                Este recurso requiere acceso o no tiene vista previa disponible.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>,
    document.body
  );
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 20px',
  background: '#fff',
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  border: 'none',
  background: '#f1f5f9',
  borderRadius: '8px',
  width: '44px',
  height: '44px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#334155',
  flexShrink: 0,
  touchAction: 'manipulation',
};

const downloadBar: React.CSSProperties = {
  padding: '10px 20px',
  background: '#fff',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const thumbCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '10px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  textAlign: 'left',
  touchAction: 'manipulation',
};

const thumbPreview: React.CSSProperties = {
  position: 'relative',
  height: '96px',
  borderRadius: '6px',
  border: '1px solid',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const thumbNum: React.CSSProperties = {
  position: 'absolute',
  top: '6px',
  left: '6px',
  fontSize: '11px',
  fontWeight: 800,
  color: '#94A3B8',
};

const thumbLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const fallbackCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: '240px',
  background: '#fff',
  borderRadius: '12px',
  border: '1px dashed var(--border)',
  padding: '40px',
  textAlign: 'center',
};
