export interface TareaRecurso {
  archivo_url: string;
  archivo_nombre: string;
  titulo?: string;
}

export function parseTareaRecursos(
  raw: unknown,
  legacyNombre?: string | null,
  legacyUrl?: string | null
): TareaRecurso[] {
  let list: TareaRecurso[] = [];

  if (raw) {
    if (typeof raw === 'string') {
      try {
        return parseTareaRecursos(JSON.parse(raw));
      } catch {
        list = [];
      }
    } else if (Array.isArray(raw)) {
      list = raw
        .filter((r: { archivo_url?: string }) => r?.archivo_url)
        .map((r: { archivo_url: string; archivo_nombre?: string; titulo?: string }) => ({
          archivo_url: r.archivo_url,
          archivo_nombre: r.archivo_nombre || r.titulo || 'Recurso',
          titulo: r.titulo,
        }));
    }
  }

  if (list.length === 0 && legacyUrl) {
    list = [{ archivo_url: legacyUrl, archivo_nombre: legacyNombre || 'Recurso' }];
  }

  return list;
}

export function normalizeTareaRecursos(raw: unknown): TareaRecurso[] {
  return parseTareaRecursos(raw).map((r) => ({
    archivo_url: r.archivo_url,
    archivo_nombre: r.archivo_nombre,
    ...(r.titulo ? { titulo: r.titulo } : {}),
  }));
}
