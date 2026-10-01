'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Video } from 'lucide-react';
import { getDriveProxyUrl, resolveVideoSource } from '@/lib/videoEmbed';

interface VideoEmbedProps {
  url: string;
  iframeStyle?: React.CSSProperties;
  videoStyle?: React.CSSProperties;
  fallbackStyle?: React.CSSProperties;
}

export default function VideoEmbed({ url, iframeStyle, videoStyle, fallbackStyle }: VideoEmbedProps) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => resolveVideoSource(url), [url]);

  if (source.type === 'youtube') {
    return (
      <iframe
        src={source.youtubeEmbed}
        style={iframeStyle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video de la clase"
      />
    );
  }

  if (failed) {
    return (
      <div style={{ ...fallbackBox, ...fallbackStyle }}>
        <Video size={36} color="#64748B" />
        <p style={{ fontWeight: 600, margin: '8px 0 4px', color: 'var(--text-primary)', fontSize: '14px' }}>
          No se pudo reproducir el video aquí
        </p>
        <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 12px', lineHeight: 1.4, maxWidth: '320px', textAlign: 'center' }}>
          {source.type === 'drive'
            ? 'El archivo en Google Drive debe estar compartido como "Cualquier persona con el enlace".'
            : 'Prueba abrirlo en una pestaña nueva.'}
        </p>
        <a href={url} target="_blank" rel="noreferrer" style={openLink}>
          <ExternalLink size={14} />
          Abrir video
        </a>
      </div>
    );
  }

  const src = source.type === 'drive' ? getDriveProxyUrl(source.driveId!) : source.directUrl!;

  return (
    <video
      key={src}
      src={src}
      controls
      playsInline
      style={videoStyle}
      onError={() => setFailed(true)}
    />
  );
}

const fallbackBox: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  backgroundColor: '#EAEDF1',
  color: '#64748B',
};

const openLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '6px',
  backgroundColor: '#0073A5',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'none',
};
