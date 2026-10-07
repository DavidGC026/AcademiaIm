export interface ExamOption {
  id: number;
  pregunta_id: number;
  texto: string;
  es_correcta?: number;
}

export interface ExamQuestion {
  id: number;
  pregunta: string;
  tipo: string;
  opciones: ExamOption[];
}

export type ExamReleaseMode = 'abierto' | 'bloqueado' | 'tarea_entregada';

export interface ExamReleaseConfig {
  modo_liberacion: ExamReleaseMode;
  clase_requisito_id: number | null;
}

export interface ExamAvailability {
  disponible: boolean;
  motivo_bloqueo: string | null;
}

export interface ExamDetails extends ExamReleaseConfig {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  limite_tiempo: number;
  curso_nombre: string;
  clase_requisito_titulo: string | null;
}

export interface ExamAttemptSnapshot {
  calificacion: number;
  fecha: string;
  respuestas: Record<number, number> | null;
}

export interface ExamStudentResult extends ExamAvailability {
  alumno_id: number;
  nombre: string;
  email: string;
  inscrito: boolean;
  permite_reintento: boolean;
  intento: ExamAttemptSnapshot | null;
  historial: ExamAttemptSnapshot[];
}
