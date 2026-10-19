import type { ExamAttemptSnapshot, ExamQuestion } from './examTypes';

export class ExamValidationError extends Error {}

export function gradeExam(questions: ExamQuestion[], input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ExamValidationError('Las respuestas deben indicar la opción elegida para cada pregunta.');
  }
  if (!questions.length || questions.some(question => question.opciones.filter(option => option.es_correcta === 1).length !== 1)) {
    throw new ExamValidationError('El examen necesita una respuesta correcta por pregunta. Consulta a tu maestro.');
  }
  const byId = new Map(questions.map(question => [question.id, question]));
  const respuestas: Record<number, number> = {};
  for (const [key, value] of Object.entries(input)) {
    const id = Number(key);
    const question = byId.get(id);
    if (!question || String(id) !== key || typeof value !== 'number' || !Number.isSafeInteger(value) || !question.opciones.some(option => option.id === value)) {
      throw new ExamValidationError('Hay una respuesta que no pertenece a este examen. Recarga la página e inténtalo de nuevo.');
    }
    respuestas[id] = value;
  }
  const respuestasCorrectas = Object.fromEntries(questions.map(question => [question.id, question.opciones.find(option => option.es_correcta === 1)!.id]));
  const aciertos = questions.filter(question => respuestas[question.id] === respuestasCorrectas[question.id]).length;
  return { respuestas, respuestasCorrectas, calificacion: Math.round(aciertos * 100 / questions.length) };
}

export function readExamJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export function attemptSnapshot(row: { calificacion: unknown; finalizado_at: Date | string; respuestas: unknown; iniciado_at?: Date | string; preguntas_ids?: unknown; preguntas_snapshot?: unknown }): ExamAttemptSnapshot | null {
  if (row.calificacion == null) return null;
  return {
    calificacion: Number(row.calificacion),
    fecha: row.finalizado_at instanceof Date ? row.finalizado_at.toISOString() : row.finalizado_at,
    respuestas: readExamJson<Record<number, number> | null>(row.respuestas, null),
    ...(row.iniciado_at ? { iniciado_at: new Date(row.iniciado_at).toISOString() } : {}),
    ...(row.preguntas_ids != null ? { preguntas_ids: readExamJson<number[] | null>(row.preguntas_ids, null) } : {}),
    ...(row.preguntas_snapshot != null ? { preguntas: readExamJson<ExamQuestion[] | null>(row.preguntas_snapshot, null) } : {}),
  };
}
