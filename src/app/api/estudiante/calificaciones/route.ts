import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [cursos] = (await pool.execute(
      `SELECT DISTINCT c.id, c.nombre, c.descripcion
       FROM cursos c
       WHERE c.estado = 'aprobado'
         AND (
           c.id IN (SELECT ce.curso_id FROM curso_estudiantes ce WHERE ce.estudiante_id = ?)
           OR c.id IN (
             SELECT cg.curso_id FROM curso_grupos cg
             INNER JOIN grupos_cohortes g ON g.id = cg.grupo_id
             INNER JOIN usuarios est ON est.grupo_cohorte = g.nombre AND est.id = ?
           )
         )
       ORDER BY c.nombre ASC`,
      [session.userId, session.userId]
    )) as any[];

    if (cursos.length === 0) {
      return NextResponse.json({ cursos: [] });
    }

    const cursoIds = cursos.map((c: { id: number }) => c.id);
    const ph = cursoIds.map(() => '?').join(',');

    const [clases] = (await pool.execute(
      `SELECT c.id, c.curso_id, c.titulo, c.requiere_tarea,
              e.id as entrega_id, e.estado as entrega_estado, e.calificacion as tarea_calificacion,
              e.comentarios as tarea_comentarios, e.fecha_entrega
       FROM clases c
       LEFT JOIN entregas_tareas e ON c.id = e.clase_id AND e.usuario_id = ?
       WHERE c.curso_id IN (${ph}) AND c.requiere_tarea = 1
       ORDER BY c.curso_id, c.orden ASC`,
      [session.userId, ...cursoIds]
    )) as any[];

    const [examenes] = (await pool.execute(
      `SELECT ex.id, ex.curso_id, ex.titulo,
              ie.id as intento_id, ie.calificacion as examen_calificacion, ie.finalizado_at as examen_fecha
       FROM examenes ex
       LEFT JOIN intentos_examenes ie ON ex.id = ie.examen_id AND ie.usuario_id = ?
       WHERE ex.curso_id IN (${ph})
       ORDER BY ex.curso_id, ex.created_at ASC`,
      [session.userId, ...cursoIds]
    )) as any[];

    const cursosEstructurados = cursos.map((curso: { id: number; nombre: string; descripcion: string }) => {
      const cursoClases = clases.filter((c: { curso_id: number }) => c.curso_id === curso.id);
      const cursoExamenes = examenes.filter((e: { curso_id: number }) => e.curso_id === curso.id);

      const tareasCalificadas = cursoClases.filter((t: { tarea_calificacion: number | null }) => t.tarea_calificacion != null);
      const promedioTareas = tareasCalificadas.length > 0
        ? tareasCalificadas.reduce((a: number, t: { tarea_calificacion: number }) => a + Number(t.tarea_calificacion), 0) / tareasCalificadas.length
        : null;

      const examenesRealizados = cursoExamenes.filter((e: { examen_calificacion: number | null }) => e.examen_calificacion != null);
      const promedioExamenes = examenesRealizados.length > 0
        ? examenesRealizados.reduce((a: number, e: { examen_calificacion: number }) => a + Number(e.examen_calificacion), 0) / examenesRealizados.length
        : null;

      let promedioGeneral: number | null = null;
      if (promedioTareas != null && promedioExamenes != null) promedioGeneral = (promedioTareas + promedioExamenes) / 2;
      else if (promedioTareas != null) promedioGeneral = promedioTareas;
      else if (promedioExamenes != null) promedioGeneral = promedioExamenes;

      return {
        id: curso.id,
        nombre: curso.nombre,
        descripcion: curso.descripcion,
        tareas: cursoClases.map((t: any) => ({
          id: t.id,
          titulo: t.titulo,
          entregada: t.entrega_id != null,
          estado: t.entrega_estado || 'pendiente',
          calificacion: t.tarea_calificacion,
          comentarios: t.tarea_comentarios,
          fecha_entrega: t.fecha_entrega,
        })),
        examenes: cursoExamenes.map((e: any) => ({
          id: e.id,
          titulo: e.titulo,
          completado: e.intento_id != null,
          calificacion: e.examen_calificacion,
          fecha: e.examen_fecha,
        })),
        promedioGeneral: promedioGeneral != null ? Math.round(promedioGeneral * 10) / 10 : null,
      };
    });

    return NextResponse.json({ cursos: cursosEstructurados });
  } catch (error: unknown) {
    console.error('Error al obtener calificaciones del estudiante:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
