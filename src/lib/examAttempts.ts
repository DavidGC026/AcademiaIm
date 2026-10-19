import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createActiveAttempt, readActiveAttempt } from './examAttemptState';
import { getExamQuestions } from './examAccess';
import type { ExamDetails } from './examTypes';

export type AttemptRow = RowDataPacket & {
  id: number;
  calificacion: number | null;
  iniciado_at: Date;
  finalizado_at: Date;
  respuestas: unknown;
  historial: unknown;
  preguntas_ids: unknown;
  preguntas_snapshot: unknown;
  intento_en_curso: unknown;
  permite_reintento: number;
};

/** Requiere el bloqueo del usuario; también serializa las primeras aperturas. */
export async function getOrStartAttempt(connection: PoolConnection, exam: ExamDetails, userId: number, previous?: AttemptRow) {
  const active = readActiveAttempt(previous?.intento_en_curso);
  if (active) return { active, attemptId: previous!.id };
  const questions = await getExamQuestions(exam.id, connection);
  const started = createActiveAttempt(questions, exam.preguntas_mostrar, exam.limite_tiempo, new Date(),
    previous && previous.calificacion == null ? previous : undefined);
  if (previous) {
    // No modificar la última entrega ni sus fechas al abrir un reintento.
    await connection.execute(
      'UPDATE intentos_examenes SET intento_en_curso = ?, finalizado_at = finalizado_at WHERE id = ?',
      [JSON.stringify(started), previous.id],
    );
    return { active: started, attemptId: previous.id };
  }
  const [result] = await connection.execute<ResultSetHeader>(
    'INSERT INTO intentos_examenes (examen_id, usuario_id, preguntas_ids, intento_en_curso) VALUES (?, ?, ?, ?)',
    [exam.id, userId, JSON.stringify(started.preguntas.map(question => question.id)), JSON.stringify(started)],
  );
  return { active: started, attemptId: result.insertId };
}
