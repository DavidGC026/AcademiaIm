'use client';

import { useCallback, useState } from 'react';
import { BookOpen, Download, ExternalLink, Eye, FileText, Link2, Maximize2, Paperclip, Video } from 'lucide-react';
import FileResourcePreview from '@/components/FileResourcePreview';
import ReferenciaViewer, { type ReferenciaItem } from '@/components/ReferenciaViewer';
import SeccionItemsCarousel from '@/components/SeccionItemsCarousel';
import SeccionFullscreenGallery from '@/components/SeccionFullscreenGallery';
import VideoEmbed from '@/components/VideoEmbed';
import { type ClaseSeccion, type SeccionItem } from '@/lib/claseSecciones';
import { normalizeSeccionColor } from '@/lib/claseSecciones';
import { withAlpha } from '@/lib/colorUtils';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';

export type SeccionItemEnriquecido =
  | Exclude<SeccionItem, { tipo: 'biblioteca' }>
  | ({ tipo: 'biblioteca' } & ReferenciaItem & { tipo: 'biblioteca' });

export type ClaseSeccionEnriquecida = Omit<ClaseSeccion, 'items'> & {
  items: SeccionItemEnriquecido[];
};

interface Props {
  secciones: ClaseSeccionEnriquecida[];
  accesoPrioritario?: boolean;
}

function itemLabel(item: SeccionItemEnriquecido): string {
  if (item.tipo === 'enlace' || item.tipo === 'video') return item.titulo;
  if (item.tipo === 'biblioteca') return (item as ReferenciaItem).titulo || 'Libro';
  return item.nombre;
}

function renderItemSlide(
  item: SeccionItemEnriquecido,
  idx: number,
  color: string,
  accesoPrioritario: boolean,
  permiteDescarga: boolean,
  suspendVideos: boolean
) {
  if (item.tipo === 'video') {
    return (
      <div key={idx} style={{ border: `1px solid ${withAlpha(color, 0.25)}`, borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', color, fontSize: '14px', fontWeight: 600 }}>
          <Video size={16} />
          <span style={{ flex: 1, minWidth: 0 }}>{item.titulo || 'Video'}</span>
          {permiteDescarga && item.archivo_nombre && (
            <a href={toAbsoluteAssetUrl(item.url)} download={item.archivo_nombre} aria-label={`Descargar ${item.titulo || 'video'}`} style={{ color, display: 'flex' }}>
              <Download size={16} />
            </a>
          )}
        </div>
        <div style={{ position: 'relative', aspectRatio: '16 / 9', minHeight: '200px', background: '#000' }}>
          {!suspendVideos && <VideoEmbed url={item.url} title={item.titulo || 'Video'} allowDownload={permiteDescarga} iframeStyle={{ position: 'absolute', inset: 0 }} videoStyle={{ position: 'absolute', inset: 0 }} />}
        </div>
      </div>
    );
  }
  if (item.tipo === 'biblioteca') {
    return (
      <ReferenciaViewer
        key={idx}
        referencia={item as ReferenciaItem}
        compact
        pdfDisplay="fullPage"
        accesoPrioritario={accesoPrioritario}
        canRead={accesoPrioritario || !!(item as { comprado?: boolean }).comprado}
        showBuyButton={false}
        accentColor={color}
      />
    );
  }
  if (item.tipo === 'enlace') {
    return (
      <a
        key={idx}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px',
          borderRadius: '10px',
          border: `1px solid ${withAlpha(color, 0.3)}`,
          backgroundColor: withAlpha(color, 0.06),
          textDecoration: 'none',
          color,
          fontWeight: 600,
          fontSize: '14px',
          minHeight: '80px',
        }}
      >
        <ExternalLink size={18} />
        {item.titulo}
      </a>
    );
  }
  const fileName = item.archivo_nombre || item.nombre;
  const isPdf = /\.pdf$/i.test(fileName) || /\.pdf$/i.test(item.url);
  return (
    <div
      key={idx}
      style={{
        padding: '12px 14px',
        borderRadius: '10px',
        border: `1px solid ${withAlpha(color, 0.25)}`,
        backgroundColor: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color,
          fontWeight: 600,
          fontSize: '14px',
          marginBottom: isPdf ? '12px' : 0,
        }}
      >
        <Paperclip size={16} />
        <span style={{ flex: 1, minWidth: 0 }}>{item.nombre}</span>
        {permiteDescarga && (
          <a
            href={toAbsoluteAssetUrl(item.url)}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color, display: 'flex' }}
            aria-label="Descargar"
          >
            <Download size={16} />
          </a>
        )}
      </div>
      {isPdf && (
        <FileResourcePreview
          fileName={fileName}
          fileUrl={item.url}
          maxHeight={300}
          securePdf
          showSideNav
        />
      )}
    </div>
  );
}

function MobileResourceList({
  items,
  color,
  onOpen,
}: {
  items: SeccionItemEnriquecido[];
  color: string;
  onOpen: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1px solid ${withAlpha(color, 0.2)}`,
              background: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            {item.tipo === 'biblioteca' ? <BookOpen size={16} color={color} /> : item.tipo === 'video' ? <Video size={16} color={color} /> : item.tipo === 'enlace' ? <Link2 size={16} color={color} /> : <FileText size={16} color={color} />}
            <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>{itemLabel(item)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onOpen}
        className="btn btn-primary"
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: color,
          borderColor: color,
          touchAction: 'manipulation',
        }}
      >
        <Eye size={16} />
        Ver a pantalla completa
      </button>
    </div>
  );
}

export default function ClaseSeccionesViewer({ secciones, accesoPrioritario = false }: Props) {
  const [fullscreen, setFullscreen] = useState<ClaseSeccionEnriquecida | null>(null);

  const openFullscreen = useCallback((sec: ClaseSeccionEnriquecida) => {
    setFullscreen(sec);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreen(null);
  }, []);

  if (!secciones.length) return null;

  const fullscreenColor = fullscreen ? normalizeSeccionColor(fullscreen.color, '#0073A5') : '#0073A5';
  const fullscreenDescarga = fullscreen?.permite_descarga !== false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {secciones.map((sec) => {
        const color = normalizeSeccionColor(sec.color, '#0073A5');
        const permiteDescarga = sec.permite_descarga !== false;
        if (sec.items.length === 0) return null;

        const slides = sec.items.map((item, idx) =>
          renderItemSlide(item, idx, color, accesoPrioritario, permiteDescarga, fullscreen !== null)
        );

        return (
          <div
            key={sec.id}
            className="card"
            style={{
              borderLeft: `5px solid ${color}`,
              background: `linear-gradient(135deg, ${withAlpha(color, 0.07)} 0%, #fff 50%)`,
              boxShadow: `0 4px 20px ${withAlpha(color, 0.1)}`,
              padding: '20px 22px',
              marginBottom: '4px',
            }}
          >
            <div className="mobile-stack-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <h3
                style={{
                  margin: '0 0 6px',
                  fontSize: '17px',
                  fontWeight: 800,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
                {sec.nombre}
              </h3>
              <button
                type="button"
                onClick={() => openFullscreen(sec)}
                title="Ver a pantalla completa"
                aria-label={`Ver ${sec.nombre} a pantalla completa`}
                className="seccion-desktop-only"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${withAlpha(color, 0.35)}`,
                  background: withAlpha(color, 0.08),
                  color,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  touchAction: 'manipulation',
                }}
              >
                <Maximize2 size={14} />
                Pantalla completa
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748B' }}>
              <span className="seccion-mobile-only">
                {sec.items.length} recurso{sec.items.length !== 1 ? 's' : ''} · abre el visor para leer sin desbordar la pantalla
              </span>
              <span className="seccion-desktop-only">
                Desliza o usa las flechas para ver los {sec.items.length} recurso{sec.items.length !== 1 ? 's' : ''}
              </span>
              {!permiteDescarga && ' · solo lectura en plataforma'}
            </p>

            <div className="seccion-mobile-only">
              <MobileResourceList items={sec.items} color={color} onOpen={() => openFullscreen(sec)} />
            </div>
            <div className="seccion-desktop-only">
              <SeccionItemsCarousel accentColor={color} maxHeight={420}>
                {slides}
              </SeccionItemsCarousel>
            </div>
          </div>
        );
      })}

      {fullscreen && (
        <SeccionFullscreenGallery
          title={fullscreen.nombre}
          color={fullscreenColor}
          items={fullscreen.items}
          accesoPrioritario={accesoPrioritario}
          permiteDescarga={fullscreenDescarga}
          onClose={closeFullscreen}
        />
      )}
    </div>
  );
}
