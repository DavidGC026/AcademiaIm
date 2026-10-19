import type { ExamQuestion } from './examTypes';
import { normalizePreguntasMostrar, parsePreguntasIds, pickRandomIds, questionsForIds } from './examenPreguntas';

export interface ActiveExamAttempt {
  preguntas: ExamQuestion[];
  iniciado_at: string;
  limite_tiempo: number;
  vence_at: string | null;
}

export function readActiveAttempt(raw: unknown): ActiveExamAttempt | null {
  if (raw == null) return null;
  const value = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ActiveExamAttempt;
  if (!Array.isArray(value.preguntas) || !value.preguntas.length || !Number.isFinite(new Date(value.iniciado_at).getTime()) || !Number.isSafeInteger(value.limite_tiempo) || value.limite_tiempo < 0) throw new Error('Intento en curso inválido');
  return value;
}

export function createActiveAttempt(questions: ExamQuestion[], count: unknown, limitMinutes: number, now = new Date(), legacy?: { preguntas_ids: unknown; iniciado_at: Date | string }): ActiveExamAttempt {
  const storedIds = legacy ? parsePreguntasIds(legacy.preguntas_ids) : null;
  if (legacy?.preguntas_ids != null && !storedIds) throw new Error('La selección guardada no es válida. Consulta a tu maestro.');
  const selectedIds = storedIds || pickRandomIds(questions.map(question => question.id), normalizePreguntasMostrar(count, questions.length));
  const selected = questionsForIds(questions, selectedIds);
  if (!selected.length || selected.length !== selectedIds.length) throw new Error('El banco cambió durante este intento. Consulta a tu maestro.');
  return {
    preguntas: selected,
    iniciado_at: legacy ? new Date(legacy.iniciado_at).toISOString() : now.toISOString(),
    limite_tiempo: Math.max(0, Number(limitMinutes) || 0),
    // Las aperturas de RUA previas al reloj conservan su fecha y reciben tiempo completo al migrar.
    vence_at: limitMinutes > 0 ? new Date(now.getTime() + limitMinutes * 60_000).toISOString() : null,
  };
}

export function remainingSeconds(attempt: ActiveExamAttempt, now = new Date()): number | null {
  if (!attempt.limite_tiempo) return null;
  return Math.max(0, Math.ceil(((attempt.vence_at ? new Date(attempt.vence_at).getTime() : new Date(attempt.iniciado_at).getTime() + attempt.limite_tiempo * 60_000) - now.getTime()) / 1000));
}

export const EXAM_SUBMISSION_GRACE_MS = 30_000;

/** Margen de red para la entrega automática que ocurre al llegar a cero. */
export function submissionExpired(attempt: ActiveExamAttempt, now = new Date()): boolean {
  return attempt.limite_tiempo > 0 && now.getTime() > (attempt.vence_at ? new Date(attempt.vence_at).getTime() : new Date(attempt.iniciado_at).getTime() + attempt.limite_tiempo * 60_000) + EXAM_SUBMISSION_GRACE_MS;
}
