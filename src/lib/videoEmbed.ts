import { toAssetUrl } from '@/lib/assetUrl';

export type VideoSourceType = 'youtube' | 'drive' | 'direct';

export function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('drive.google.com')) return null;
    const fromPath = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (fromPath) return fromPath;
    const fromQuery = u.searchParams.get('id');
    if (fromQuery) return fromQuery;
  } catch {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
  }
  return null;
}

export function getYoutubeEmbedUrl(url: string): string | null {
  try {
    if (url.includes('youtube.com/watch')) {
      const id = new URL(url).searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.includes('youtube.com/embed/')) return url;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveVideoSource(url: string): {
  type: VideoSourceType;
  youtubeEmbed?: string;
  driveId?: string;
  directUrl?: string;
} {
  const yt = getYoutubeEmbedUrl(url);
  if (yt) return { type: 'youtube', youtubeEmbed: yt };
  const driveId = extractDriveFileId(url);
  if (driveId) return { type: 'drive', driveId };
  return { type: 'direct', directUrl: url };
}

/** Reproduce Drive vía API propia; evita iframe que dispara login 403 de Google. */
export function getDriveProxyUrl(fileId: string): string {
  return toAssetUrl(`/api/video/drive?id=${encodeURIComponent(fileId)}`);
}
