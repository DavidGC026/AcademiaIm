import pool from './db';
import type { RowDataPacket, PoolConnection } from 'mysql2/promise';
import type { JWTPayload } from './auth';
import type { ExamDetails, ExamOption, ExamQuestion } from './examTypes';

export interface ExamRow extends ExamDetails, RowDataPacket {
  creado_por_id: number;
  curso_estado: string;
}

export async function getExam(id: number) {
  const [rows] = await pool.execute<ExamRow[]>(
    `SELECT e.*, c.nombre AS curso_nombre, c.creado_por_id, c.estado AS curso_estado
     FROM examenes e JOIN cursos c ON c.id = e.curso_id WHERE e.id = ?`, [id]
  );
  return rows[0] ?? null;
}

export function canManageExam(exam: ExamRow, session: JWTPayload) {
  return session.roleName === 'administrador' || (session.roleName === 'maestro' && exam.creado_por_id === session.userId);
}

export async function getExamQuestions(id: number, db: Pick<PoolConnection, 'execute'> = pool): Promise<ExamQuestion[]> {
  const [questions] = await db.execute<(RowDataPacket & Omit<ExamQuestion, 'opciones'>)[]>(
    'SELECT id, pregunta, tipo FROM preguntas WHERE examen_id = ? ORDER BY id', [id]
  );
  const [options] = await db.execute<(RowDataPacket & ExamOption)[]>(
    `SELECT o.id, o.pregunta_id, o.texto, o.es_correcta FROM opciones o
     JOIN preguntas p ON p.id = o.pregunta_id WHERE p.examen_id = ? ORDER BY o.id`, [id]
  );
  return questions.map(question => ({ ...question, opciones: options.filter(option => option.pregunta_id === question.id) }));
}
