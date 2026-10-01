export type CourseSection = 'clases' | 'examenes' | 'alumnos' | 'datos' | 'biografias';

export interface CourseRoute {
  kind: 'catalog' | 'new' | 'course' | 'invalid';
  courseId: number | null;
  section: CourseSection;
  editor: 'class' | 'exam' | 'import' | null;
  classId: number | null;
}

export function parseCourseRoute(segments: string[]): CourseRoute {
  const route: CourseRoute = { kind: 'invalid', courseId: null, section: 'clases', editor: null, classId: null };
  if (!segments.length) return { ...route, kind: 'catalog' };
  if (segments.length === 1 && segments[0] === 'nueva') return { ...route, kind: 'new' };
  if (!/^[1-9]\d*$/.test(segments[0]) || !Number.isSafeInteger(Number(segments[0]))) return route;
  const [id, section, action, edit] = segments;
  if (!['clases', 'examenes', 'alumnos', 'datos', 'biografias'].includes(section)) return route;
  const course = { ...route, kind: 'course' as const, courseId: Number(id), section: section as CourseSection };
  if (segments.length === 2) return course;
  if (segments.length === 3 && section === 'clases' && action === 'nueva') return { ...course, editor: 'class' };
  if (segments.length === 4 && section === 'clases' && /^[1-9]\d*$/.test(action) && Number.isSafeInteger(Number(action)) && edit === 'editar') return { ...course, editor: 'class', classId: Number(action) };
  if (segments.length === 3 && section === 'examenes' && ['nuevo', 'importar'].includes(action)) return { ...course, editor: action === 'nuevo' ? 'exam' : 'import' };
  return route;
}

export function coursePath(basePath: string, courseId: number, section: CourseSection = 'clases') {
  return `${basePath}/${courseId}/${section}`;
}
