import type { ExamAvailability, ExamReleaseConfig } from './examTypes';

/** La tarea debe seguir existiendo y pertenecer a la materia del examen. */
export function examAvailability(
  config: ExamReleaseConfig,
  task: { titulo: string; entregada: boolean } | null,
): ExamAvailability {
  if (config.modo_liberacion === 'abierto') return { disponible: true, motivo_bloqueo: null };
  if (config.modo_liberacion === 'tarea_entregada') {
    if (!config.clase_requisito_id || !task) {
      return { disponible: false, motivo_bloqueo: 'El maestro debe configurar la tarea final de este examen.' };
    }
    return task.entregada
      ? { disponible: true, motivo_bloqueo: null }
      : { disponible: false, motivo_bloqueo: `Entrega la tarea final de «${task.titulo}» para habilitar el examen.` };
  }
  return { disponible: false, motivo_bloqueo: 'El maestro habilitará el examen al terminar la clase.' };
}

export function parseExamRelease(value: unknown): ExamReleaseConfig | null {
  if (!value || typeof value !== 'object') return null;
  const { modo_liberacion, clase_requisito_id } = value as Record<string, unknown>;
  if (typeof modo_liberacion !== 'string' || !['abierto', 'bloqueado', 'tarea_entregada'].includes(modo_liberacion)) return null;
  if (modo_liberacion === 'tarea_entregada' &&
      (typeof clase_requisito_id !== 'number' || !Number.isSafeInteger(clase_requisito_id) || clase_requisito_id < 1)) return null;
  return {
    modo_liberacion: modo_liberacion as ExamReleaseConfig['modo_liberacion'],
    clase_requisito_id: modo_liberacion === 'tarea_entregada' ? clase_requisito_id as number : null,
  };
}
