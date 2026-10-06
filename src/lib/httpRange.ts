export type ByteRange = { start: number; end: number };

/** Un solo rango es suficiente para reproducción y búsqueda de video. */
export function parseByteRange(header: string | null, size: number): ByteRange | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || size <= 0 || (!match[1] && !match[2])) return 'invalid';

  if (!match[1]) {
    const suffix = Number(match[2]);
    return Number.isSafeInteger(suffix) && suffix > 0
      ? { start: Math.max(0, size - suffix), end: size - 1 }
      : 'invalid';
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}
