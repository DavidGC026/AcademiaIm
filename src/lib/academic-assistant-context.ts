import pool from '@/lib/db';
import { parseSecciones } from '@/lib/claseSecciones';
import { examAvailability } from '@/lib/examRelease';
import { ensureExamAttemptSchema, ensureExamReleaseSchema } from '@/lib/examSchema';
import type { ExamReleaseConfig } from '@/lib/examTypes';
import type { AssistantAction } from '@/lib/assistant-actions';
import type { RowDataPacket } from 'mysql2';

interface AssistantCourse {
  id: number;
  name: string;
  description: string;
}

interface AssistantClass {
  id: number;
  courseId: number;
  title: string;
  description: string;
  order: number;
  requiresActivity: boolean;
  activityStatus: 'pending' | 'submitted' | 'graded' | 'not_required';
  presentationRef: string | null;
  presentationName: string | null;
  sections: Array<{ name: string; resources: string[] }>;
}

interface AssistantExam {
  id: number;
  courseId: number;
  title: string;
  status: 'pending' | 'completed' | 'blocked';
  blockedReason: string | null;
  retryEnabled: boolean;
}

interface AssistantCalendarEvent {
  id: number;
  title: string;
  description: string;
  startsAt: string;
}

interface CourseRow extends RowDataPacket {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface ClassRow extends RowDataPacket {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string | null;
  orden: number | null;
  requiere_tarea: number;
  presentacion_url: string | null;
  presentacion_nombre: string | null;
  secciones: unknown;
  entrega_id: number | null;
  entrega_estado: string | null;
}

interface ExamRow extends RowDataPacket, ExamReleaseConfig {
  id: number;
  curso_id: number;
  titulo: string;
  calificacion: number | null;
  permite_reintento: number;
  requisito_titulo: string | null;
  entrega_requisito_id: number | null;
}

interface CalendarEventRow extends RowDataPacket {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha_hora: Date | string;
}

export interface AcademicAssistantContext {
  generatedAt: string;
  currentClass: AssistantClass | null;
  courses: Array<AssistantCourse & { classes: AssistantClass[]; exams: AssistantExam[] }>;
  pendingActivities: Array<{ classId: number; classTitle: string; courseName: string }>;
  pendingExams: Array<{ examId: number; examTitle: string; courseName: string }>;
  upcomingEvents: AssistantCalendarEvent[];
  actions: AssistantAction[];
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function summarizeDescription(value: unknown, limit = 700): string {
  const description = String(value || '').replace(/\s+/g, ' ').trim();
  return description.length > limit ? `${description.slice(0, limit)}…` : description;
}

function buildSections(rawSections: unknown): AssistantClass['sections'] {
  return parseSecciones(parseJson(rawSections)).map((section) => ({
    name: section.nombre,
    resources: section.items.map((item) => {
      if (item.tipo === 'biblioteca') return `Libro de biblioteca #${item.libro_id}`;
      if (item.tipo === 'enlace' || item.tipo === 'video') return item.titulo;
      return item.nombre || item.archivo_nombre || 'Archivo';
    }),
  }));
}

export async function buildAcademicAssistantContext(
  userId: number,
  currentClassId?: number | null
): Promise<AcademicAssistantContext> {
  const [courseRows] = await pool.execute<CourseRow[]>(
    `SELECT c.id, c.nombre, c.descripcion
     FROM cursos c
     WHERE c.estado = 'aprobado'
       AND (
         EXISTS (
           SELECT 1 FROM curso_estudiantes ce
           WHERE ce.curso_id = c.id AND ce.estudiante_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM curso_grupos cg
           JOIN grupos_cohortes g ON g.id = cg.grupo_id
           JOIN usuarios u ON u.grupo_cohorte = g.nombre
           WHERE cg.curso_id = c.id AND u.id = ?
         )
       )
     ORDER BY c.created_at ASC`,
    [userId, userId]
  );

  const courseIds = courseRows.map((course) => Number(course.id));
  let classRows: ClassRow[] = [];
  let examRows: ExamRow[] = [];

  if (courseIds.length > 0) {
    await Promise.all([ensureExamAttemptSchema(), ensureExamReleaseSchema()]);
    const placeholders = courseIds.map(() => '?').join(', ');
    [classRows] = await pool.execute<ClassRow[]>(
      `SELECT c.id, c.curso_id, c.titulo, c.descripcion, c.orden, c.requiere_tarea,
              c.presentacion_url, c.presentacion_nombre, c.secciones,
              e.id AS entrega_id, e.estado AS entrega_estado
       FROM clases c
       LEFT JOIN entregas_tareas e ON e.clase_id = c.id AND e.usuario_id = ?
       WHERE c.curso_id IN (${placeholders})
       ORDER BY c.curso_id ASC, c.orden ASC, c.created_at ASC
       LIMIT 200`,
      [userId, ...courseIds]
    );

    [examRows] = await pool.execute<ExamRow[]>(
      `SELECT ex.id, ex.curso_id, ex.titulo, ie.calificacion,
              COALESCE(ie.permite_reintento, 0) AS permite_reintento,
              ex.modo_liberacion, ex.clase_requisito_id,
              requisito.titulo AS requisito_titulo, entrega.id AS entrega_requisito_id
       FROM examenes ex
       LEFT JOIN intentos_examenes ie ON ie.examen_id = ex.id AND ie.usuario_id = ?
       LEFT JOIN clases requisito ON requisito.id = ex.clase_requisito_id
         AND requisito.curso_id = ex.curso_id AND requisito.requiere_tarea = 1
       LEFT JOIN entregas_tareas entrega ON entrega.clase_id = requisito.id AND entrega.usuario_id = ?
       WHERE ex.curso_id IN (${placeholders})
       ORDER BY ex.curso_id ASC, ex.created_at ASC
       LIMIT 100`,
      [userId, userId, ...courseIds]
    );
  }

  const classes: AssistantClass[] = classRows.map((classRow) => {
    const requiresActivity = Number(classRow.requiere_tarea) === 1;
    const activityStatus: AssistantClass['activityStatus'] = !requiresActivity
      ? 'not_required'
      : classRow.entrega_id
        ? classRow.entrega_estado === 'calificado' ? 'graded' : 'submitted'
        : 'pending';

    return {
      id: Number(classRow.id),
      courseId: Number(classRow.curso_id),
      title: String(classRow.titulo),
      description: summarizeDescription(classRow.descripcion),
      order: Number(classRow.orden || 0),
      requiresActivity,
      activityStatus,
      presentationRef: classRow.presentacion_url || null,
      presentationName: classRow.presentacion_nombre || null,
      sections: buildSections(classRow.secciones),
    };
  });

  const exams: AssistantExam[] = examRows.map((examRow) => {
    const availability = examAvailability(examRow, examRow.requisito_titulo !== null ? {
      titulo: examRow.requisito_titulo,
      entregada: examRow.entrega_requisito_id != null,
    } : null);
    const completed = examRow.calificacion != null && !examRow.permite_reintento;
    return {
      id: Number(examRow.id),
      courseId: Number(examRow.curso_id),
      title: String(examRow.titulo),
      status: completed ? 'completed' : availability.disponible ? 'pending' : 'blocked',
      blockedReason: completed ? null : availability.motivo_bloqueo,
      retryEnabled: Boolean(examRow.permite_reintento),
    };
  });

  const courses = courseRows.map((courseRow) => ({
    id: Number(courseRow.id),
    name: String(courseRow.nombre),
    description: summarizeDescription(courseRow.descripcion, 400),
    classes: classes.filter((classItem) => classItem.courseId === Number(courseRow.id)),
    exams: exams.filter((exam) => exam.courseId === Number(courseRow.id)),
  }));

  const [eventRows] = await pool.execute<CalendarEventRow[]>(
    `SELECT e.id, e.titulo, e.descripcion, e.fecha_hora
     FROM calendario_eventos e
     JOIN grupos_cohortes g ON g.id = e.grupo_id
     JOIN usuarios u ON u.grupo_cohorte = g.nombre
     WHERE u.id = ? AND e.fecha_hora >= NOW()
     ORDER BY e.fecha_hora ASC
     LIMIT 10`,
    [userId]
  );

  const upcomingEvents: AssistantCalendarEvent[] = eventRows.map((eventRow) => ({
    id: Number(eventRow.id),
    title: String(eventRow.titulo),
    description: summarizeDescription(eventRow.descripcion, 300),
    startsAt: new Date(eventRow.fecha_hora).toISOString(),
  }));

  const actions: AssistantAction[] = [
    { id: 'home', label: 'Ir a mis materias', href: '/estudiante' },
    { id: 'calendar', label: 'Abrir calendario', href: '/estudiante/calendario' },
    { id: 'grades', label: 'Ver calificaciones', href: '/estudiante/calificaciones' },
  ];

  for (const course of courses) {
    actions.push({
      id: `course:${course.id}`,
      label: `Abrir ${course.name}`,
      href: `/estudiante/materias/${course.id}`,
    });
    for (const classItem of course.classes) {
      actions.push({
        id: `class:${classItem.id}`,
        label: `Ir a ${classItem.title}`,
        href: `/estudiante/clases/${classItem.id}`,
      });
    }
    for (const exam of course.exams) {
      if (exam.status === 'blocked') continue;
      actions.push({
        id: `exam:${exam.id}`,
        label: `Abrir ${exam.title}`,
        href: `/estudiante/examenes/${exam.id}`,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    currentClass: currentClassId
      ? classes.find((classItem) => classItem.id === currentClassId) || null
      : null,
    courses,
    pendingActivities: classes
      .filter((classItem) => classItem.activityStatus === 'pending')
      .map((classItem) => ({
        classId: classItem.id,
        classTitle: classItem.title,
        courseName: courses.find((course) => course.id === classItem.courseId)?.name || '',
      })),
    pendingExams: exams
      .filter((exam) => exam.status === 'pending')
      .map((exam) => ({
        examId: exam.id,
        examTitle: exam.title,
        courseName: courses.find((course) => course.id === exam.courseId)?.name || '',
      })),
    upcomingEvents,
    actions,
  };
}
