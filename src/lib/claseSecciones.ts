import { parseCssColor, resolveColor } from '@/lib/colorUtils';

export type SeccionItem =
  | { tipo: 'archivo'; nombre: string; url: string; archivo_nombre?: string }
  | { tipo: 'biblioteca'; libro_id: number }
  | { tipo: 'enlace'; titulo: string; url: string };

export type ClaseSeccion = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  /** Si false, los alumnos solo pueden ver en el visor (sin descarga). Por defecto true. */
  permite_descarga?: boolean;
  items: SeccionItem[];
};

export function newSeccionId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultSecciones(): ClaseSeccion[] {
  return [
    { id: newSeccionId(), nombre: 'Lecturas recomendadas', color: '#7C3AED', orden: 0, items: [] },
    { id: newSeccionId(), nombre: 'Material de apoyo', color: '#0073A5', orden: 1, items: [] },
    { id: newSeccionId(), nombre: 'Recursos adicionales', color: '#059669', orden: 2, items: [] },
  ];
}

export function normalizeSeccionColor(color: string | null | undefined, fallback: string): string {
  return resolveColor(parseCssColor(color) ? color : null, fallback);
}

export function parseSecciones(raw: unknown): ClaseSeccion[] {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((s, idx) => {
      if (!s || typeof s !== 'object') return null;
      const sec = s as Record<string, unknown>;
      const items = Array.isArray(sec.items) ? (sec.items as SeccionItem[]).filter(Boolean) : [];
      return {
        id: String(sec.id || newSeccionId()),
        nombre: String(sec.nombre || `Sección ${idx + 1}`).trim() || `Sección ${idx + 1}`,
        color: normalizeSeccionColor(sec.color as string, '#0073A5'),
        orden: typeof sec.orden === 'number' ? sec.orden : idx,
        ...(sec.permite_descarga === false ? { permite_descarga: false as const } : {}),
        items,
      } as ClaseSeccion;
    })
    .filter((s): s is ClaseSeccion => !!s)
    .sort((a, b) => a.orden - b.orden);
}

type ReferenciaLegacy =
  | { tipo: 'biblioteca'; libro_id: number }
  | { tipo: 'archivo'; titulo: string; archivo_url: string; archivo_nombre: string };

function parseReferenciasLegacy(raw: unknown): ReferenciaLegacy[] {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: ReferenciaLegacy[] = [];
  for (const r of data) {
    if (!r || typeof r !== 'object') continue;
    const ref = r as Record<string, unknown>;
    if (ref.tipo === 'biblioteca' && ref.libro_id) {
      out.push({ tipo: 'biblioteca', libro_id: Number(ref.libro_id) });
    } else if (ref.tipo === 'archivo' && ref.archivo_url) {
      out.push({
        tipo: 'archivo',
        titulo: String(ref.titulo || ref.archivo_nombre || 'Referencia'),
        archivo_url: String(ref.archivo_url),
        archivo_nombre: String(ref.archivo_nombre || ref.titulo || 'archivo'),
      });
    }
  }
  return out;
}

/** ponytail: migra materiales + referencias legacy si no hay secciones guardadas. */
export function resolveSecciones(
  seccionesRaw: unknown,
  materialesRaw: unknown,
  referenciasRaw: unknown,
  colorLecturas?: string | null
): ClaseSeccion[] {
  const parsed = parseSecciones(seccionesRaw);
  if (parsed.length > 0) return parsed;

  const lecturasColor = normalizeSeccionColor(colorLecturas, '#7C3AED');
  const out: ClaseSeccion[] = [];
  let orden = 0;

  const materiales = Array.isArray(materialesRaw) ? materialesRaw : [];
  if (materiales.length > 0) {
    out.push({
      id: newSeccionId(),
      nombre: 'Material complementario',
      color: '#0073A5',
      orden: orden++,
      items: materiales
        .filter((m: { nombre?: string; url?: string }) => m?.url)
        .map((m: { nombre?: string; url?: string }) => ({
          tipo: 'archivo' as const,
          nombre: m.nombre || 'Archivo',
          url: m.url!,
          archivo_nombre: m.nombre,
        })),
    });
  }

  const refs = parseReferenciasLegacy(referenciasRaw);
  if (refs.length > 0) {
    out.push({
      id: newSeccionId(),
      nombre: 'Lecturas recomendadas',
      color: lecturasColor,
      orden: orden++,
      items: refs.map((r) =>
        r.tipo === 'biblioteca'
          ? { tipo: 'biblioteca' as const, libro_id: r.libro_id }
          : {
              tipo: 'archivo' as const,
              nombre: r.titulo,
              url: r.archivo_url,
              archivo_nombre: r.archivo_nombre,
            }
      ),
    });
  }

  return out;
}

export function serializeSecciones(secciones: ClaseSeccion[]): ClaseSeccion[] {
  return secciones
    .map((s, idx) => ({
      ...s,
      nombre: s.nombre.trim() || `Sección ${idx + 1}`,
      color: normalizeSeccionColor(s.color, '#0073A5'),
      orden: idx,
      ...(s.permite_descarga === false ? { permite_descarga: false as const } : {}),
      items: s.items.filter((item) => {
        if (item.tipo === 'biblioteca') return !!item.libro_id;
        if (item.tipo === 'enlace') return !!item.url?.trim();
        return !!item.url?.trim();
      }),
    }))
    .filter((s) => s.nombre || s.items.length > 0);
}

export function moveSeccion(secciones: ClaseSeccion[], id: string, dir: -1 | 1): ClaseSeccion[] {
  const idx = secciones.findIndex((s) => s.id === id);
  if (idx < 0) return secciones;
  const next = idx + dir;
  if (next < 0 || next >= secciones.length) return secciones;
  const copy = [...secciones];
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  return copy.map((s, i) => ({ ...s, orden: i }));
}

/** Duplica secciones con ids nuevos (mismos archivos/enlaces/libros). */
export function cloneSecciones(source: ClaseSeccion[]): ClaseSeccion[] {
  return source.map((s, idx) => ({
    id: newSeccionId(),
    nombre: s.nombre,
    color: s.color,
    orden: idx,
    permite_descarga: s.permite_descarga,
    items: s.items.map((item) => ({ ...item })),
  }));
}

export function mergeClonedSecciones(current: ClaseSeccion[], source: ClaseSeccion[]): ClaseSeccion[] {
  const cloned = cloneSecciones(source).map((s, i) => ({ ...s, orden: current.length + i }));
  return [...current, ...cloned].map((s, i) => ({ ...s, orden: i }));
}

if (process.env.NODE_ENV === 'development') {
  const migrated = resolveSecciones(
    null,
    [{ nombre: 'A', url: '/a.pdf' }],
    [{ tipo: 'biblioteca', libro_id: 1 }]
  );
  if (migrated.length !== 2) console.warn('claseSecciones: self-check failed');
}
