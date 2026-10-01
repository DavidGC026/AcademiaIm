'use client';

import { useState } from 'react';
import { ShoppingBag, Lock, Eye } from 'lucide-react';
import FileResourcePreview from '@/components/FileResourcePreview';
import { getFileExt } from '@/components/FileResourcePreview';
import { toAssetUrl, toBibliotecaContenidoUrl } from '@/lib/assetUrl';
import { resolveColor, withAlpha } from '@/lib/colorUtils';
import FullPagePdfReader from '@/components/FullPagePdfReader';

export interface ReferenciaArchivo {
  tipo: 'archivo';
  titulo: string;
  archivo_url: string;
  archivo_nombre: string;
}

export interface ReferenciaBiblioteca {
  tipo: 'biblioteca';
  id: number;
  titulo: string;
  autor: string;
  precio?: number;
  tienda_url?: string;
  imagen?: string;
  descripcion?: string;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  comprado?: boolean;
  puede_leer?: boolean;
}

export type ReferenciaItem = ReferenciaArchivo | ReferenciaBiblioteca;

interface ReferenciaViewerProps {
  referencia: ReferenciaItem;
  showBuyButton?: boolean;
  compact?: boolean;
  accesoPrioritario?: boolean;
  /** Maestro o administrador: lectura sin compra. */
  accesoStaff?: boolean;
  canRead?: boolean;
  /** Color de acento para tarjetas de lectura (desde el módulo). */
  accentColor?: string;
  onComprar?: (libro: ReferenciaBiblioteca) => void;
  /** inline: preview embebido (biblioteca). fullPage: botón + visor pantalla completa (clases). */
  pdfDisplay?: 'inline' | 'fullPage';
}

function contenidoUrl(ref: string): string {
  return toBibliotecaContenidoUrl('libros', ref);
}

export default function ReferenciaViewer({
  referencia,
  showBuyButton = true,
  compact = false,
  accesoPrioritario = false,
  accesoStaff = false,
  canRead = false,
  onComprar,
  pdfDisplay = 'inline',
  accentColor,
}: ReferenciaViewerProps) {
  const [readerOpen, setReaderOpen] = useState(false);
  const accent = resolveColor(accentColor, '#7C3AED');
  const cardAccent: React.CSSProperties = accentColor
    ? {
        borderColor: withAlpha(accent, 0.35),
        backgroundColor: withAlpha(accent, 0.06),
        borderLeftWidth: '3px',
        borderLeftColor: accent,
      }
    : {};

  if (referencia.tipo === 'archivo') {
    const fileName = referencia.archivo_nombre || referencia.titulo;
    const isPdf = getFileExt(fileName, referencia.archivo_url) === 'pdf';

    if (pdfDisplay === 'fullPage') {
      return (
        <>
          <div style={{ ...cardStyle, ...cardAccent }}>
            <div style={{ fontWeight: 700, fontSize: compact ? '13px' : '15px', marginBottom: '10px', color: accentColor ? accent : undefined }}>{referencia.titulo}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isPdf ? (
                <button type="button" className="btn btn-primary" style={actionBtn} onClick={() => setReaderOpen(true)}>
                  <Eye size={14} /> Leer documento
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#64748B' }}>Solo lectura PDF en plataforma.</span>
              )}
            </div>
          </div>
          {isPdf && (
            <FullPagePdfReader
              open={readerOpen}
              onClose={() => setReaderOpen(false)}
              title={referencia.titulo}
              fileUrl={referencia.archivo_url}
              fileName={fileName}
            />
          )}
        </>
      );
    }

    return (
      <div style={{ ...cardStyle, ...cardAccent }}>
        <div style={{ fontWeight: 700, fontSize: compact ? '13px' : '15px', marginBottom: '8px', color: accentColor ? accent : undefined }}>{referencia.titulo}</div>
        <FileResourcePreview fileName={fileName} fileUrl={referencia.archivo_url} maxHeight={compact ? 280 : 420} />
      </div>
    );
  }

  const libro = referencia;
  const previewName = libro.archivo_nombre || libro.archivo_url || libro.titulo;
  const comprado = !!libro.comprado;
  const lecturaPermitida = canRead || !!libro.puede_leer || accesoStaff;
  const hasPdf = !!(libro.archivo_url && getFileExt(libro.archivo_nombre, libro.archivo_url, previewName) === 'pdf');
  const readUrl = libro.archivo_url ? contenidoUrl(libro.archivo_url) : '';

  const renderLibroAction = () => {
    if (lecturaPermitida && hasPdf) {
      return (
        <button
          type="button"
          className="btn btn-primary"
          style={{ ...actionBtn, width: '100%', justifyContent: 'center' }}
          onClick={() => setReaderOpen(true)}
        >
          <Eye size={14} /> Leer en plataforma
        </button>
      );
    }
    if (lecturaPermitida && !libro.archivo_url) {
      return (
        <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
          Consulta digital no disponible aún para este título.
        </p>
      );
    }
    if (lecturaPermitida && !hasPdf) {
      return (
        <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
          La lectura protegida requiere el libro en formato PDF.
        </p>
      );
    }
    if (showBuyButton && libro.precio != null) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#0073A5' }}>${Number(libro.precio).toFixed(0)} MXN</span>
          <button type="button" className="btn btn-primary" style={actionBtn} onClick={() => onComprar?.(libro)}>
            <ShoppingBag size={14} /> Comprar y leer
          </button>
        </div>
      );
    }
    return (
      <p style={{ fontSize: '12px', color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Lock size={14} /> Compra este libro para leerlo dentro de la plataforma.
      </p>
    );
  };

  return (
    <>
      <div style={{ ...cardStyle, ...cardAccent }}>
        <div style={{ display: 'flex', gap: compact ? '12px' : '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {libro.imagen && (
            <img
              src={toAssetUrl(libro.imagen)}
              alt={libro.titulo}
              style={{ width: compact ? 64 : 90, height: compact ? 90 : 120, objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          )}
          <div style={{ flex: 1, minWidth: '180px' }}>
            {comprado ? (
              <span style={{ ...priorityBadge, color: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)' }}>Adquirido</span>
            ) : accesoStaff ? (
              <span style={priorityBadge}>Acceso completo</span>
            ) : accesoPrioritario ? (
              <span style={priorityBadge}>Acceso prioritario</span>
            ) : null}
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>{libro.autor}</div>
            <div style={{ fontWeight: 700, fontSize: compact ? '14px' : '16px', marginTop: '4px', color: accentColor ? accent : undefined }}>{libro.titulo}</div>
            {!compact && libro.descripcion && (
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.5 }}>{libro.descripcion}</p>
            )}
            {showBuyButton && lecturaPermitida && accesoPrioritario && libro.tienda_url && (
              <div style={{ marginTop: '10px' }}>
                <a href={libro.tienda_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={actionBtn}>
                  <ShoppingBag size={14} /> Comprar copia física
                </a>
              </div>
            )}
          </div>
        </div>

        {renderLibroAction()}
      </div>

      {hasPdf && lecturaPermitida && (
        <FullPagePdfReader
          open={readerOpen}
          onClose={() => setReaderOpen(false)}
          title={libro.titulo}
          fileUrl={readUrl}
          fileName={previewName}
          secure
        />
      )}
    </>
  );
}

const cardStyle: React.CSSProperties = {
  padding: '14px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  backgroundColor: '#FAFBFD',
  marginBottom: '12px',
};

const actionBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  fontSize: '12px',
};

const priorityBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: 700,
  color: '#0073A5',
  backgroundColor: 'rgba(0,115,165,0.1)',
  padding: '3px 8px',
  borderRadius: '4px',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
