/** Resuelve rutas de /public y /uploads con basePath (p. ej. /Academia en producción). */
export function toAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  let p = path.trim();
  if (!p.startsWith('/')) {
    // ponytail: a veces queda solo el nombre (recurso-123.png) sin /uploads/
    p = p.startsWith('uploads/') ? `/${p}` : `/uploads/${p}`;
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // /uploads/* siempre vía API (auth, Turbopack dev, mismo criterio que PDFs)
  if (p.includes('/uploads/')) {
    const ref = p.slice(p.indexOf('/uploads/'));
    return `${base}/api/uploads/file?ref=${encodeURIComponent(ref)}`;
  }

  return `${base}${p}`;
}

export function toAbsoluteAssetUrl(path: string): string {
  if (path.startsWith('http')) return path;

  const normalized = toAssetUrl(path);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin ? `${origin}${normalized}` : normalized;
}

export function toBibliotecaContenidoUrl(
  tipo: 'libros' | 'revistas' | 'investigacion',
  ref: string
): string {
  return `/api/biblioteca/${tipo}/contenido?ref=${encodeURIComponent(ref)}`;
}

export function toClasePresentacionUrl(ref: string): string {
  return `/api/clases/presentacion?ref=${encodeURIComponent(ref)}`;
}

/** URL de lectura para presentación (storage privado o legacy /uploads). */
export function resolvePresentacionFileUrl(ref: string): string {
  if (ref.startsWith('/uploads/') || ref.startsWith('uploads/')) {
    return toAbsoluteAssetUrl(ref.startsWith('/') ? ref : `/${ref}`);
  }
  return toClasePresentacionUrl(ref);
}
