'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Eye, FileText, Video } from 'lucide-react';
import { getFileExt } from '@/components/FileResourcePreview';
import { resolvePresentacionFileUrl } from '@/lib/assetUrl';
import SeccionFullscreenGallery from '@/components/SeccionFullscreenGallery';
import type { SeccionItemEnriquecido } from '@/components/ClaseSeccionesViewer';

const SecurePdfViewer = dynamic(() => import('@/components/SecurePdfViewer'), { ssr: false });
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });

export interface ClaseVideoItem {
  titulo: string;
  url: string;
}

function getEmbedVideoUrl(url: string | null) {
  if (!url) return '';
  try {
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } catch {
    /* ponytail: URL mal formada → VideoEmbed maneja el resto */
  }
  return url;
}

export default function ClassContentViewer({
  videos = [],
  presentacionUrl,
  presentacionNombre,
  presentacionPermiteDescarga = true,
}: {
  videos?: ClaseVideoItem[];
  presentacionUrl?: string | null;
  presentacionNombre?: string | null;
  presentacionPermiteDescarga?: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const openViewer = useCallback(() => setViewerOpen(true), []);
  const closeViewer = useCallback(() => setViewerOpen(false), []);

  const videoList = videos.length > 0 ? videos : [];

  if (videoList.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {videoList.map((v, idx) => {
          const vEmbed = getEmbedVideoUrl(v.url);
          const isYoutube = vEmbed.includes('youtube.com/embed');
          return (
            <div key={`${v.url}-${idx}`}>
              {videoList.length > 1 && (
                <div style={headingStyle}>
                  <span style={numStyle}>{idx + 1}</span>
                  {v.titulo || `Video ${idx + 1}`}
                </div>
              )}
              <div style={videoWrapper}>
                {isYoutube ? (
                  <iframe
                    src={vEmbed}
                    style={iframeStyle}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={v.titulo || `Video ${idx + 1}`}
                  />
                ) : (
                  <VideoEmbed url={v.url} iframeStyle={iframeStyle} videoStyle={iframeStyle} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (presentacionUrl) {
    const presName = presentacionNombre || 'Presentación';
    const isPdf = getFileExt(presName || presentacionUrl) === 'pdf';
    const fileUrl = resolvePresentacionFileUrl(presentacionUrl);

    if (isPdf) {
      const galleryItem: SeccionItemEnriquecido = {
        tipo: 'archivo',
        nombre: presName,
        url: fileUrl,
        archivo_nombre: presName,
      };

      return (
        <>
          <div className="card mobile-doc-launch presentation-pdf-launch">
            <div style={{ ...headingStyle, marginBottom: '12px' }}>
              <FileText size={20} color="var(--accent)" />
              <span style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.35 }}>{presName}</span>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
              La presentación se abre en el visor integrado para una mejor lectura en el celular.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openViewer}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                touchAction: 'manipulation',
              }}
            >
              <Eye size={18} />
              Ver a pantalla completa
            </button>
          </div>

          <div className="presentation-pdf-inline">
            {presentacionNombre && (
              <div style={{ ...headingStyle, marginBottom: '12px' }}>
                <FileText size={16} color="var(--accent)" />
                {presentacionNombre}
              </div>
            )}
            <SecurePdfViewer fileUrl={fileUrl} title={presName} maxHeight={720} showSideNav />
          </div>

          {viewerOpen && (
            <SeccionFullscreenGallery
              title={presName}
              color="#0073A5"
              items={[galleryItem]}
              permiteDescarga={presentacionPermiteDescarga}
              onClose={closeViewer}
            />
          )}
        </>
      );
    }

    return (
      <div>
        {presentacionNombre && (
          <div style={{ ...headingStyle, marginBottom: '12px' }}>
            <FileText size={16} color="var(--accent)" />
            {presentacionNombre}
          </div>
        )}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} />
          Descargar presentación
        </a>
      </div>
    );
  }

  return (
    <div style={emptyBox}>
      <Video size={48} color="#B0B3B5" />
      <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Sin video ni presentación</p>
      <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '400px', margin: 0, color: '#64748B' }}>
        El docente aún no ha publicado contenido principal para esta clase. Revisa el material didáctico en la barra lateral.
      </p>
    </div>
  );
}

const headingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: '8px',
};

const numStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
};

const videoWrapper: React.CSSProperties = {
  position: 'relative',
  paddingBottom: '56.25%',
  height: 0,
  overflow: 'hidden',
  borderRadius: 'var(--radius-md)',
  backgroundColor: '#000',
  boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
};

const iframeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  border: 'none',
};

const emptyBox: React.CSSProperties = {
  backgroundColor: '#EAEDF1',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748B',
  gap: '8px',
  padding: '40px 20px',
  borderRadius: '12px',
  minHeight: '300px',
};
