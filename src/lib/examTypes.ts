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

export interface ExamDetails {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  limite_tiempo: number;
  curso_nombre: string;
}

export interface ExamAttemptSnapshot {
  calificacion: number;
  fecha: string;
  respuestas: Record<number, number> | null;
}

export interface ExamStudentResult {
  alumno_id: number;
  nombre: string;
  email: string;
  inscrito: boolean;
  permite_reintento: boolean;
  intento: ExamAttemptSnapshot | null;
  historial: ExamAttemptSnapshot[];
}
