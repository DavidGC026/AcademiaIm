'use client';

import { useState } from 'react';
import { ExternalLink, Video } from 'lucide-react';
import { getDriveProxyUrl, resolveVideoSource } from '@/lib/videoEmbed';

interface VideoEmbedProps {
  url: string;
  title?: string;
  allowDownload?: boolean;
  iframeStyle?: React.CSSProperties;
  videoStyle?: React.CSSProperties;
  fallbackStyle?: React.CSSProperties;
}

export default function VideoEmbed({ url, title = 'Video de la clase', allowDownload = true, iframeStyle, videoStyle, fallbackStyle }: VideoEmbedProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = resolveVideoSource(url);
  const failed = failedUrl === url;

  if (source.type === 'youtube' || (source.type === 'drive' && failed)) {
    const preview = source.type === 'drive' ? new URL(`https://drive.google.com/file/d/${source.driveId}/preview`) : null;
    if (preview && source.driveResourceKey) preview.searchParams.set('resourcekey', source.driveResourceKey);
    return (
      <iframe
        key={url}
        src={source.youtubeEmbed || preview!.toString()}
        style={{ width: '100%', height: '100%', border: 0, ...iframeStyle }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        title={title}
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
          Prueba abrirlo en una pestaña nueva o revisa que el archivo sea un video compatible.
        </p>
        <a href={source.directUrl || url} target="_blank" rel="noreferrer" style={openLink}>
          <ExternalLink size={14} />
          Abrir video
        </a>
      </div>
    );
  }

  const src = source.type === 'drive' ? getDriveProxyUrl(source.driveId!, source.driveResourceKey) : source.directUrl!;

  return (
    <video
      key={src}
      src={src}
      controls
      controlsList={allowDownload ? undefined : 'nodownload'}
      preload="metadata"
      playsInline
      aria-label={title}
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', ...videoStyle }}
      onError={() => setFailedUrl(url)}
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
