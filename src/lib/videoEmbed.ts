import { toAssetUrl } from '@/lib/assetUrl';
import { isVideoFile } from '@/lib/videoFiles';

export type VideoSourceType = 'youtube' | 'drive' | 'direct';

function webUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function extractDriveFileId(url: string): string | null {
  const u = webUrl(url);
  if (!u || !['drive.google.com', 'www.drive.google.com'].includes(u.hostname)) return null;
  const id = u.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]
    ?? (['/open', '/uc', '/download'].includes(u.pathname) ? u.searchParams.get('id') : null);
  return id && /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : null;
}

export function getYoutubeEmbedUrl(url: string): string | null {
  const u = webUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    id = u.pathname === '/watch'
      ? u.searchParams.get('v')
      : u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1] ?? null;
  }
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  const embed = new URL(`https://www.youtube.com/embed/${id}`);
  const time = u.searchParams.get('start') || u.searchParams.get('t') || '';
  const parts = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  const seconds = /^\d+$/.test(time) ? Number(time)
    : parts ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : 0;
  if (Number.isSafeInteger(seconds) && seconds > 0) embed.searchParams.set('start', String(seconds));
  return embed.toString();
}

export function isSupportedVideoUrl(value: string): boolean {
  if (getYoutubeEmbedUrl(value) || extractDriveFileId(value)) return true;
  const url = webUrl(value);
  if (url) return isVideoFile(url.pathname);
  return /^\/uploads\/[^/?#]+\.(mp4|webm|ogv)$/i.test(value.trim());
}

export function resolveVideoSource(url: string): {
  type: VideoSourceType;
  youtubeEmbed?: string;
  driveId?: string;
  driveResourceKey?: string;
  directUrl?: string;
} {
  const yt = getYoutubeEmbedUrl(url);
  if (yt) return { type: 'youtube', youtubeEmbed: yt };
  const driveId = extractDriveFileId(url);
  if (driveId) return { type: 'drive', driveId, driveResourceKey: webUrl(url)?.searchParams.get('resourcekey') || undefined };
  return { type: 'direct', directUrl: toAssetUrl(url.trim()) };
}

/** Reproduce Drive vía API propia; evita iframe que dispara login 403 de Google. */
export function getDriveProxyUrl(fileId: string, resourceKey?: string): string {
  const query = new URLSearchParams({ id: fileId });
  if (resourceKey) query.set('resourcekey', resourceKey);
  return toAssetUrl(`/api/video/drive?${query}`);
}
