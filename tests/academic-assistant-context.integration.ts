/** Sólo consulta contexto y datos sintéticos en MySQL *_qa; nunca llama proveedores de IA. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mysql, { type ResultSetHeader } from 'mysql2/promise';

const enabled = process.env.ASSISTANT_CONTEXT_QA === '1';

test('contexto académico respeta inscripciones, privacidad, notas, reintentos y liberación', { skip: !enabled }, async () => {
  assert.ok(process.env.DB_NAME?.endsWith('_qa') && ['127.0.0.1', 'localhost'].includes(process.env.DB_HOST || ''));
  assert.equal(process.env.DB_AUTO_INIT, '0');
  assert.equal(process.env.ACADEMIA_SKIP_DB_INIT, '1');
  // Importar después de las guardas impide inicializar una base por defecto al omitir QA.
  const [{ default: pool }, { buildAcademicAssistantContext }] = await Promise.all([
    import('../src/lib/db'), import('../src/lib/academic-assistant-context'),
  ]);
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const suffix = randomUUID();
  const users: number[] = [];
  const courses: number[] = [];
  let groupId = 0;
  try {
    for (const [role, name] of [[2, 'Docente QA contexto'], [3, 'Alumno QA contexto'], [3, 'Otra alumna QA contexto']] as const) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO usuarios (role_id,email,password,nombre) VALUES (?,?,?,?)', [role, `${users.length}-${suffix}@example.test`, 'unused', name]);
      users.push(result.insertId);
    }
    const [teacher, student, otherStudent] = users;
    for (const [label, state] of [['Directa', 'aprobado'], ['Grupo', 'aprobado'], ['Oculta', 'oculto'], ['Ajena', 'aprobado']] as const) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO cursos (nombre,creado_por_id,estado) VALUES (?,?,?)', [`${label} QA ${suffix}`, teacher, state]);
      courses.push(result.insertId);
    }
    const [direct, cohort, hidden, foreign] = courses;
    await db.execute('INSERT INTO curso_estudiantes (curso_id,estudiante_id) VALUES (?,?), (?,?)', [direct, student, hidden, student]);
    const [group] = await db.execute<ResultSetHeader>('INSERT INTO grupos_cohortes (nombre,codigo,creador_id) VALUES (?,?,?)', [`Cohorte QA ${suffix}`, suffix, teacher]);
    groupId = group.insertId;
    await db.execute('UPDATE usuarios SET grupo_cohorte=? WHERE id=?', [`Cohorte QA ${suffix}`, student]);
    await db.execute('INSERT INTO curso_grupos (curso_id,grupo_id) VALUES (?,?)', [cohort, groupId]);
    const classes: number[] = [];
    for (const course of courses) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO clases (curso_id,titulo,requiere_tarea,secciones) VALUES (?,?,1,?)', [course, `Clase QA ${course}`, JSON.stringify([{ id: 'qa', nombre: 'Recursos', color: '#0073A5', orden: 0, items: [{ tipo: 'video', titulo: 'Video de apoyo QA', url: '/uploads/context-qa.mp4' }, { tipo: 'archivo', nombre: 'Apuntes QA', url: '/uploads/context-qa.pdf' }] }])]);
      classes.push(result.insertId);
    }
    const [task, groupClass, hiddenClass, foreignClass] = classes;
    async function createExam(title: string, course = direct, mode = 'abierto', requirement: number | null = null) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO examenes (curso_id,titulo,modo_liberacion,clase_requisito_id) VALUES (?,?,?,?)', [course, `${title} QA`, mode, requirement]);
      return result.insertId;
    }
    const opened = await createExam('Apertura sin nota');
    const zero = await createExam('Nota cero');
    const retry = await createExam('Nuevo intento');
    const locked = await createExam('Cerrado', direct, 'bloqueado');
    const afterTask = await createExam('Después de tarea', direct, 'tarea_entregada', task);
    const foreignRequirement = await createExam('Requisito ajeno', direct, 'tarea_entregada', foreignClass);
    const completedLocked = await createExam('Resultado cerrado', direct, 'bloqueado');
    const foreignExam = await createExam('Examen ajeno', foreign);
    const hiddenExam = await createExam('Examen oculto', hidden);
    await db.execute('INSERT INTO intentos_examenes (examen_id,usuario_id,calificacion,permite_reintento) VALUES (?,?,NULL,0),(?,?,0,0),(?,?,85,1),(?,?,70,0)', [opened, student, zero, student, retry, student, completedLocked, student]);
    const keyMarker = `DO_NOT_INCLUDE_EXAM_KEY_${suffix}`;
    const [question] = await db.execute<ResultSetHeader>("INSERT INTO preguntas (examen_id,pregunta,tipo) VALUES (?,?,'opcion_multiple')", [opened, keyMarker]);
    await db.execute('INSERT INTO opciones (pregunta_id,texto,es_correcta) VALUES (?,?,1)', [question.insertId, keyMarker]);
    await db.execute('UPDATE intentos_examenes SET preguntas_ids=?, respuestas=?, historial=?, finalizado_at=finalizado_at WHERE examen_id=? AND usuario_id=?', [JSON.stringify([question.insertId]), JSON.stringify({ [question.insertId]: 123 }), JSON.stringify([{ calificacion: 50, respuestas: { privateKey: keyMarker } }]), opened, student]);
    // Entregas de otra persona y de otra materia no abren la evaluación del alumno.
    await db.execute("INSERT INTO entregas_tareas (clase_id,usuario_id,archivo_nombre,archivo_url) VALUES (?,?,'QA','/uploads/context-qa.txt'), (?,?,'QA','/uploads/context-qa.txt')", [task, otherStudent, foreignClass, student]);
    let context = await buildAcademicAssistantContext(student, task);
    assert.deepEqual(context.courses.map(course => course.id).sort((a,b) => a-b), [direct, cohort].sort((a,b) => a-b));
    assert.equal(context.currentClass?.id, task);
    assert.deepEqual(context.currentClass?.sections[0].resources, ['Video de apoyo QA', 'Apuntes QA']);
    assert.ok(context.courses.some(course => course.classes.some(item => item.id === groupClass)), 'La inscripción por grupo también está disponible.');
    const exam = (id: number) => context.courses.flatMap(course => course.exams).find(item => item.id === id)!;
    assert.equal(exam(opened).status, 'pending', 'Abrir no equivale a entregar.');
    assert.equal(exam(zero).status, 'completed');
    assert.equal(exam(retry).status, 'pending'); assert.equal(exam(retry).retryEnabled, true);
    assert.equal(exam(locked).status, 'blocked');
    assert.equal(exam(afterTask).status, 'blocked');
    assert.equal(exam(foreignRequirement).status, 'blocked');
    assert.equal(exam(completedLocked).status, 'completed', 'Cerrar conserva la consulta de la nota entregada.');
    assert.deepEqual(context.pendingExams.map(item => item.examId).sort((a,b) => a-b), [opened, retry].sort((a,b) => a-b));
    assert.ok(!context.actions.some(action => [`exam:${locked}`, `exam:${afterTask}`, `exam:${foreignRequirement}`, `exam:${foreignExam}`, `exam:${hiddenExam}`, `class:${hiddenClass}`, `class:${foreignClass}`].includes(action.id)));
    assert.ok(!JSON.stringify(context).includes(keyMarker), 'No enviar preguntas, claves ni historial de respuestas al proveedor.');
    assert.equal((await buildAcademicAssistantContext(student, foreignClass)).currentClass, null);
    assert.equal((await buildAcademicAssistantContext(student, hiddenClass)).currentClass, null);
    await db.execute("INSERT INTO entregas_tareas (clase_id,usuario_id,archivo_nombre,archivo_url) VALUES (?,?,'QA','/uploads/context-qa.txt')", [task, student]);
    context = await buildAcademicAssistantContext(student, task);
    assert.equal(exam(afterTask).status, 'pending', 'La entrega propia habilita sin exigir nota de la tarea.');
    assert.ok(context.pendingExams.some(item => item.examId === afterTask));
    assert.ok(context.actions.some(action => action.id === `exam:${afterTask}`));
    await db.execute('UPDATE clases SET requiere_tarea=0 WHERE id=?', [task]);
    context = await buildAcademicAssistantContext(student);
    assert.equal(exam(afterTask).status, 'blocked', 'Una tarea desactivada falla cerrada.');
  } finally {
    for (const course of courses) await db.execute('DELETE FROM cursos WHERE id=?', [course]);
    if (groupId) await db.execute('DELETE FROM grupos_cohortes WHERE id=?', [groupId]);
    for (const id of users) await db.execute('DELETE FROM usuarios WHERE id=?', [id]);
    await db.end();
    await pool.end();
  }
});
