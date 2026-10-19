import { randomInt } from 'node:crypto';
import type { ExamQuestion } from './examTypes';

/** 0 conserva todas las preguntas; los bancos antiguos pueden haberse reducido. */
export function normalizePreguntasMostrar(raw: unknown, totalPreguntas: number): number {
  const count = Number(raw ?? 0);
  if (!Number.isSafeInteger(count) || count <= 0) return 0;
  return Math.min(count, totalPreguntas);
}

export function validatePreguntasMostrar(raw: unknown, totalPreguntas: number): number {
  const count = Number(raw ?? 0);
  if (!Number.isSafeInteger(count) || count < 0 || count > totalPreguntas) {
    throw new Error(`Indica cuántas preguntas mostrar: un entero entre 0 y ${totalPreguntas} (0 muestra todas).`);
  }
  return count;
}

export function parsePreguntasIds(raw: unknown): number[] | null {
  if (raw == null) return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(value) || !value.length || value.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(value).size !== value.length) return null;
    return value;
  } catch { return null; }
}

export function pickRandomIds(allIds: number[], count: number): number[] {
  if (count <= 0 || count >= allIds.length) return [...allIds];
  const shuffled = [...allIds];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = randomInt(index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  // Conservar el orden del banco hace legibles los resultados y las revisiones.
  const picked = new Set(shuffled.slice(0, count));
  return allIds.filter(id => picked.has(id));
}

export function questionsForIds(questions: ExamQuestion[], ids: number[] | null): ExamQuestion[] {
  if (!ids) return questions;
  const byId = new Map(questions.map(question => [question.id, question]));
  return ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}
