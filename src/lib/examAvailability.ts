import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from './db';
import { examAvailability } from './examRelease';
import { ensureExamAttemptSchema, ensureExamReleaseSchema } from './examSchema';
import type { ExamAvailability, ExamDetails, ExamReleaseConfig } from './examTypes';

type Database = Pick<PoolConnection, 'execute'>;

export async function getExamAvailability(exam: ExamReleaseConfig & { curso_id: number }, userId: number, db: Database = pool): Promise<ExamAvailability> {
  if (exam.modo_liberacion !== 'tarea_entregada' || !exam.clase_requisito_id) return examAvailability(exam, null);
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.titulo, t.id AS entrega_id FROM clases c
     LEFT JOIN entregas_tareas t ON t.clase_id = c.id AND t.usuario_id = ?
     WHERE c.id = ? AND c.curso_id = ? AND c.requiere_tarea = 1`,
    [userId, exam.clase_requisito_id, exam.curso_id],
  );
  return examAvailability(exam, rows[0] ? { titulo: rows[0].titulo, entregada: rows[0].entrega_id != null } : null);
}

export async function getCourseExams(courseId: number, userId: number) {
  await Promise.all([ensureExamAttemptSchema(), ensureExamReleaseSchema()]);
  const [rows] = await pool.execute<(RowDataPacket & Omit<ExamDetails, 'curso_nombre'> & {
    mi_calificacion: number | null; intento_fecha: Date | null; permite_reintento: number; entrega_requisito_id: number | null;
  })[]>(
    `SELECT e.*, i.calificacion AS mi_calificacion, i.finalizado_at AS intento_fecha,
            COALESCE(i.permite_reintento, 0) AS permite_reintento,
            c.titulo AS clase_requisito_titulo, t.id AS entrega_requisito_id
     FROM examenes e
     LEFT JOIN intentos_examenes i ON i.examen_id = e.id AND i.usuario_id = ?
     LEFT JOIN clases c ON c.id = e.clase_requisito_id AND c.curso_id = e.curso_id AND c.requiere_tarea = 1
     LEFT JOIN entregas_tareas t ON t.clase_id = c.id AND t.usuario_id = ?
     WHERE e.curso_id = ? ORDER BY e.created_at ASC`, [userId, userId, courseId],
  );
  return rows.map(({ entrega_requisito_id, ...exam }) => ({
    ...exam,
    ...examAvailability(exam, exam.clase_requisito_titulo !== null ? {
      titulo: exam.clase_requisito_titulo, entregada: entrega_requisito_id != null,
    } : null),
  }));
}
