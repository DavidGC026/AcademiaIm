import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canManageExam, getExam } from '@/lib/examAccess';
import { ensureExamAttemptSchema } from '@/lib/examSchema';
import { attemptSnapshot, readExamJson } from '@/lib/examGrading';
import { examAvailability } from '@/lib/examRelease';
import type { ExamAttemptSnapshot } from '@/lib/examTypes';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !['maestro', 'administrador'].includes(session.roleName)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Examen inválido' }, { status: 400 });
    const exam = await getExam(id);
    if (!exam) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    if (!canManageExam(exam, session)) return NextResponse.json({ error: 'No tienes acceso a los resultados de este examen' }, { status: 403 });
    await ensureExamAttemptSchema();
    const [rows] = await pool.execute<(RowDataPacket & {
      alumno_id: number; nombre: string; email: string; inscrito: number;
      calificacion: number | null; finalizado_at: Date; respuestas: unknown; historial: unknown; permite_reintento: number;
      entrega_requisito_id: number | null;
    })[]>(
      `SELECT resultados.* FROM (
        SELECT u.id AS alumno_id, u.nombre, u.email, i.id AS intento_id,
          i.calificacion, i.finalizado_at, i.respuestas, i.historial, i.permite_reintento, t.id AS entrega_requisito_id,
          (EXISTS (SELECT 1 FROM curso_estudiantes ce WHERE ce.curso_id = ? AND ce.estudiante_id = u.id)
           OR EXISTS (SELECT 1 FROM curso_grupos cg JOIN grupos_cohortes g ON g.id = cg.grupo_id
                      WHERE cg.curso_id = ? AND g.nombre = u.grupo_cohorte)) AS inscrito
        FROM usuarios u LEFT JOIN intentos_examenes i ON i.usuario_id = u.id AND i.examen_id = ?
        LEFT JOIN entregas_tareas t ON t.usuario_id = u.id AND t.clase_id = ?
        WHERE u.role_id = 3
      ) resultados WHERE inscrito = 1 OR intento_id IS NOT NULL ORDER BY nombre, alumno_id`,
      [exam.curso_id, exam.curso_id, id, exam.clase_requisito_id]
    );
    return NextResponse.json({ alumnos: rows.map(row => ({
      ...examAvailability(exam, exam.clase_requisito_titulo !== null ? { titulo: exam.clase_requisito_titulo, entregada: row.entrega_requisito_id != null } : null),
      alumno_id: row.alumno_id, nombre: row.nombre, email: row.email,
      inscrito: Boolean(row.inscrito) && exam.curso_estado === 'aprobado',
      permite_reintento: Boolean(row.permite_reintento),
      intento: attemptSnapshot(row), historial: readExamJson<ExamAttemptSnapshot[]>(row.historial, []),
    })) });
  } catch (error) {
    console.error('Error al consultar resultados:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los resultados del examen' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
