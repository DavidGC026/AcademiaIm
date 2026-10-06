import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureExamAttemptSchema } from '@/lib/examSchema';
import { estudiantePuedeAccederCurso } from '@/lib/cursoGrupos';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursoId = searchParams.get('curso_id');

    if (!cursoId) {
      return NextResponse.json({ error: 'Falta curso_id' }, { status: 400 });
    }

    const cursoIdNum = parseInt(cursoId, 10);
    if (session.roleName === 'estudiante') {
      const puede = await estudiantePuedeAccederCurso(session.userId, cursoIdNum);
      if (!puede) {
        return NextResponse.json({ error: 'No tienes acceso a esta materia' }, { status: 403 });
      }
    }

    const [cursoRows] = (await pool.execute(
      'SELECT id, nombre, descripcion, imagen, codigo FROM cursos WHERE id = ?',
      [cursoIdNum]
    )) as any[];

    if (cursoRows.length === 0) {
      return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 });
    }

    const [clases] = (await pool.execute(
      `SELECT c.*, e.id as entrega_id, e.archivo_nombre, e.estado as entrega_estado,
              e.calificacion, e.comentarios, e.fecha_entrega
       FROM clases c
       LEFT JOIN entregas_tareas e ON c.id = e.clase_id AND e.usuario_id = ?
       WHERE c.curso_id = ?
       ORDER BY c.orden ASC, c.created_at ASC`,
      [session.userId, cursoIdNum]
    )) as any[];

    const classes = clases.map((cls: any) => ({
      ...cls,
      materiales: typeof cls.materiales === 'string' ? JSON.parse(cls.materiales) : cls.materiales || [],
      videos: typeof cls.videos === 'string' ? JSON.parse(cls.videos) : cls.videos || [],
    }));

    await ensureExamAttemptSchema();
    const [examenes] = (await pool.execute(
      `SELECT e.*, i.calificacion as mi_calificacion, i.finalizado_at as intento_fecha,
              COALESCE(i.permite_reintento, 0) AS permite_reintento
       FROM examenes e
       LEFT JOIN intentos_examenes i ON e.id = i.examen_id AND i.usuario_id = ?
       WHERE e.curso_id = ?
       ORDER BY e.created_at ASC`,
      [session.userId, cursoIdNum]
    )) as any[];

    let pendientes = 0;
    for (const cls of classes) {
      if (cls.requiere_tarea === 1 && !cls.entrega_id) pendientes++;
    }
    for (const ex of examenes) {
      if (ex.permite_reintento || (!ex.intento_fecha && ex.mi_calificacion == null)) pendientes++;
    }

    const totalItems = classes.length + examenes.length;
    let completados = 0;
    for (const cls of classes) {
      if (cls.requiere_tarea === 1) {
        if (cls.entrega_id) completados++;
      } else {
        completados++;
      }
    }
    for (const ex of examenes) {
      if (!ex.permite_reintento && (ex.intento_fecha || ex.mi_calificacion != null)) completados++;
    }

    return NextResponse.json({
      curso: cursoRows[0],
      classes,
      exams: examenes,
      pendientes,
      progreso: { done: completados, total: totalItems },
    });
  } catch (error: unknown) {
    console.error('Error al obtener clases para estudiante:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
