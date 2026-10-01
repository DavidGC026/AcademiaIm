import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { estudiantePuedeAccederCurso, getCursoIdFromClase } from '@/lib/cursoGrupos';
import { enrichReferencias, parseReferencias } from '@/lib/referencias';
import { parseTareaRecursos } from '@/lib/tareaRecursos';
import { resolveSecciones, type ClaseSeccion } from '@/lib/claseSecciones';
import { tieneAccesoBibliotecaPrioritario, librosComprados } from '@/lib/bibliotecaAcceso';

async function enrichSeccionesClase(
  seccionesRaw: unknown,
  materiales: unknown,
  referenciasRaw: unknown,
  colorLecturas: string | null | undefined,
  comprados: number[],
  accesoPrioritario: boolean
): Promise<ClaseSeccion[]> {
  const base = resolveSecciones(seccionesRaw, materiales, referenciasRaw, colorLecturas);
  const out: ClaseSeccion[] = [];
  for (const sec of base) {
    const items: ClaseSeccion['items'] = [];
    for (const item of sec.items) {
      if (item.tipo === 'biblioteca') {
        const refs = await enrichReferencias(
          [{ tipo: 'biblioteca', libro_id: item.libro_id }],
          comprados,
          accesoPrioritario
        );
        if (refs[0]) {
          items.push({ tipo: 'biblioteca', libro_id: item.libro_id, ...(refs[0] as object) } as ClaseSeccion['items'][number]);
        }
      } else {
        items.push(item);
      }
    }
    out.push({ ...sec, items });
  }
  return out;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const claseId = parseInt(id, 10);

    const [claseRows] = (await pool.execute(
      `SELECT c.*, cur.id as curso_id, cur.nombre as curso_nombre, cur.imagen as curso_imagen,
              cur.color as curso_color, cur.color_lecturas as curso_color_lecturas
       FROM clases c
       JOIN cursos cur ON c.curso_id = cur.id
       WHERE c.id = ?`,
      [claseId]
    )) as any[];

    if (claseRows.length === 0) {
      return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
    }

    const clase = claseRows[0];
    clase.materiales = typeof clase.materiales === 'string' ? JSON.parse(clase.materiales) : clase.materiales || [];
    clase.videos = typeof clase.videos === 'string' ? JSON.parse(clase.videos) : clase.videos || [];
    if ((!clase.videos || clase.videos.length === 0) && clase.video_url) {
      clase.videos = [{ titulo: '', url: clase.video_url }];
    }
    const comprados = await librosComprados(session.userId);
    const acceso_prioritario = await tieneAccesoBibliotecaPrioritario(session.userId, session.roleName);
    const referenciasRaw = clase.referencias;
    clase.secciones = await enrichSeccionesClase(
      clase.secciones,
      clase.materiales,
      referenciasRaw,
      clase.curso_color_lecturas,
      comprados,
      acceso_prioritario
    );
    clase.referencias = await enrichReferencias(referenciasRaw, comprados, acceso_prioritario);
    clase.tarea_recursos = parseTareaRecursos(
      clase.tarea_recursos,
      clase.tarea_recurso_nombre,
      clase.tarea_recurso_url
    );

    if (session.roleName === 'estudiante') {
      const cursoId = await getCursoIdFromClase(claseId);
      if (!cursoId || !(await estudiantePuedeAccederCurso(session.userId, cursoId))) {
        return NextResponse.json({ error: 'No tienes acceso a esta clase' }, { status: 403 });
      }
    }

    const [entregaRows] = (await pool.execute(
      `SELECT * FROM entregas_tareas WHERE clase_id = ? AND usuario_id = ?`,
      [claseId, session.userId]
    )) as any[];

    const entrega = entregaRows.length > 0 ? entregaRows[0] : null;

    return NextResponse.json({
      clase,
      entrega,
      acceso_prioritario,
    });
  } catch (error: unknown) {
    console.error('Error al obtener detalle de clase:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
