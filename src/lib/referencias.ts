import pool from '@/lib/db';

export type ReferenciaRaw =
  | { tipo: 'biblioteca'; libro_id: number }
  | { tipo: 'archivo'; titulo: string; archivo_url: string; archivo_nombre: string };

export function parseReferencias(raw: unknown): ReferenciaRaw[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return parseReferencias(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as ReferenciaRaw[]) : [];
}

export async function enrichReferencias(
  raw: unknown,
  comprados: number[] = [],
  accesoGratuito = false
) {
  const refs = parseReferencias(raw);
  const enriched: Record<string, unknown>[] = [];

  for (const ref of refs) {
    if (ref.tipo === 'biblioteca' && ref.libro_id) {
      const [rows] = (await pool.execute('SELECT * FROM biblioteca_libros WHERE id = ?', [ref.libro_id])) as any[];
      if (rows[0]) {
        const comprado = comprados.includes(rows[0].id);
        enriched.push({
          tipo: 'biblioteca',
          ...rows[0],
          comprado,
          puede_leer: accesoGratuito || comprado,
        });
      }
    } else if (ref.tipo === 'archivo' && ref.archivo_url) {
      enriched.push(ref);
    }
  }

  return enriched;
}
