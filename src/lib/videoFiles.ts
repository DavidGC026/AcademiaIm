export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv'] as const;
export const VIDEO_ACCEPT = VIDEO_EXTENSIONS.map((extension) => `.${extension}`).join(',');
export const MAX_VIDEO_SIZE_MB = 250;
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

export function isVideoFile(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.some((allowed) => allowed === extension);
}

export function validateVideoFile(file: { name: string; size: number }): string | null {
  if (!isVideoFile(file.name)) return 'Usa un video MP4, WebM u OGV.';
  if (file.size === 0) return 'El video está vacío.';
  if (file.size > MAX_VIDEO_SIZE_BYTES) return `El video supera los ${MAX_VIDEO_SIZE_MB} MB. Puedes agregarlo mediante un enlace de YouTube o Google Drive.`;
  return null;
}
