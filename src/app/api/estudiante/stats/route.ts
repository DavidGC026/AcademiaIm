import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calculateAcademicAverage } from '@/lib/academicAverage';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. Cursos activos: inscripción directa o por grupo
    const [cursosCountResult] = (await pool.execute(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM cursos c
       WHERE c.estado = 'aprobado'
         AND (
           c.id IN (SELECT ce.curso_id FROM curso_estudiantes ce WHERE ce.estudiante_id = ?)
           OR c.id IN (
             SELECT cg.curso_id FROM curso_grupos cg
             INNER JOIN grupos_cohortes g ON g.id = cg.grupo_id
             INNER JOIN usuarios est ON est.grupo_cohorte = g.nombre AND est.id = ?
           )
         )`,
      [session.userId, session.userId]
    )) as any[];
    const cursosActivos = cursosCountResult[0]?.count || 0;

    // 2. Tareas entregadas por el estudiante
    const [tareasCountResult] = await pool.execute(
      `SELECT COUNT(*) as count FROM entregas_tareas WHERE usuario_id = ?`,
      [session.userId]
    ) as any[];
    const tareasEntregadas = tareasCountResult[0]?.count || 0;

    // 3. Calcular promedio global
    // Obtener promedio de tareas
    const [tareasGradeResult] = await pool.execute(
      `SELECT AVG(calificacion) as avg_grade, COUNT(calificacion) as count_grade 
       FROM entregas_tareas 
       WHERE usuario_id = ? AND calificacion IS NOT NULL`,
      [session.userId]
    ) as any[];

    // Obtener promedio de exámenes
    const [examenesGradeResult] = await pool.execute(
      `SELECT AVG(calificacion) as avg_grade, COUNT(calificacion) as count_grade 
       FROM intentos_examenes 
       WHERE usuario_id = ? AND calificacion IS NOT NULL`,
      [session.userId]
    ) as any[];

    const promedio = calculateAcademicAverage(tareasGradeResult[0], examenesGradeResult[0]);

    return NextResponse.json({
      cursosActivos,
      tareasEntregadas,
      promedio
    });
  } catch (error: any) {
    console.error('Error al obtener estadísticas del estudiante:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
