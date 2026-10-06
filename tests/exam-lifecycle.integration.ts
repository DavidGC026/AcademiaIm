/** Requiere una app local con la misma base *_qa y JWT_SECRET; nunca usar producción. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import type { ExamQuestion, ExamStudentResult } from '../src/lib/examTypes';

const base = process.env.EXAM_QA_URL;

test('examen: permisos, revisión, reintento individual, historial y entregas concurrentes', { skip: !base }, async () => {
  const url = new URL(base!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port && url.port !== '3005', 'Solo se permite una app local de pruebas.');
  assert.ok(process.env.DB_NAME?.endsWith('_qa') && process.env.JWT_SECRET, 'Se requiere una base *_qa y JWT_SECRET de pruebas.');
  assert.ok(['127.0.0.1', 'localhost'].includes(process.env.DB_HOST || ''));
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const suffix = randomUUID();
  const users: number[] = [];
  let courseId = 0;
  let groupId = 0;
  const cookie = (id: number, roleName: string) => `auth_token=${jwt.sign({ userId: id, roleName }, process.env.JWT_SECRET!, { expiresIn: '10m' })}`;
  async function api(path: string, auth: string | null, body?: unknown) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(auth ? { Cookie: auth } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  try {
    for (const [roleId, nombre] of [[1, 'Admin'], [2, 'Maestro'], [2, 'Otro maestro'], [3, 'Alumno directo'], [3, 'Alumna grupo'], [3, 'Sin acceso']] as const) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO usuarios (role_id,email,password,nombre) VALUES (?, ?, ?, ?)', [roleId, `${users.length}-${suffix}@example.test`, 'unused', nombre]);
      users.push(result.insertId);
    }
    const [adminId, teacherId, otherId, studentId, cohortId, outsiderId] = users;
    const [course] = await db.execute<ResultSetHeader>('INSERT INTO cursos (nombre,creado_por_id,estado) VALUES (?, ?, ?)', [`QA ${suffix}`, teacherId, 'aprobado']);
    courseId = course.insertId;
    await db.execute('INSERT INTO curso_estudiantes (curso_id,estudiante_id) VALUES (?, ?)', [courseId, studentId]);
    const [group] = await db.execute<ResultSetHeader>('INSERT INTO grupos_cohortes (nombre,codigo,creador_id) VALUES (?, ?, ?)', [`QA ${suffix}`, suffix, teacherId]);
    groupId = group.insertId;
    await db.execute('UPDATE usuarios SET grupo_cohorte = ? WHERE id = ?', [`QA ${suffix}`, cohortId]);
    await db.execute('INSERT INTO curso_grupos (curso_id,grupo_id) VALUES (?, ?)', [courseId, groupId]);
    const teacher = cookie(teacherId, 'maestro');
    const student = cookie(studentId, 'estudiante');
    const cohort = cookie(cohortId, 'estudiante');
    const admin = cookie(adminId, 'administrador');
    const other = cookie(otherId, 'maestro');
    const form = new FormData();
    form.set('file', new Blob([readFileSync(new URL('../docs/referencias/examenes/M1-EXA Cementos hidráulicos.xlsx', import.meta.url))]), 'M1.xlsx');
    form.set('curso_id', String(courseId)); form.set('titulo', 'M1-C1 QA');
    const imported = await fetch(base + '/api/examenes/importar', { method: 'POST', headers: { Cookie: teacher }, body: form });
    assert.equal(imported.status, 200, await imported.clone().text());
    const { examenId } = await imported.json();
    const path = `/api/examenes/${examenId}`;
    assert.equal((await api(path, null)).status, 401);
    assert.equal((await api(path, other)).status, 403);
    assert.equal((await api(path + '/resultados', other)).status, 403);
    assert.equal((await api(path + '/resultados', student)).status, 401);
    assert.equal((await api(path, cookie(outsiderId, 'estudiante'))).status, 403);
    const { data: detail } = await api(path, teacher);
    const questions = detail.preguntas as ExamQuestion[];
    assert.equal(questions.length, 10);
    const correct = Object.fromEntries(questions.map(q => [q.id, q.opciones.find(o => o.es_correcta === 1)!.id]));
    const wrong = Object.fromEntries(questions.map(q => [q.id, q.opciones.find(o => o.es_correcta === 0)!.id]));
    const roster = (await api(path + '/resultados', teacher)).data.alumnos as ExamStudentResult[];
    assert.deepEqual(roster.map(row => row.alumno_id).sort((a,b) => a-b), [studentId, cohortId].sort((a,b) => a-b));
    const before = (await api(path, student)).data;
    assert.equal(before.mi_intento, null);
    assert.deepEqual(before.respuestasCorrectas, {});
    assert.ok(before.preguntas.every((q: ExamQuestion) => q.opciones.every(o => !('es_correcta' in o))));
    const duplicate = await Promise.all([api(path, student, { respuestas: correct }), api(path, student, { respuestas: correct })]);
    assert.deepEqual(duplicate.map(result => result.status).sort(), [200, 409]);
    const completed = (await api(path, student)).data;
    assert.equal(completed.mi_intento.calificacion, 100);
    assert.deepEqual(completed.mi_intento.respuestas, correct);
    assert.deepEqual(completed.respuestasCorrectas, correct);
    assert.equal((await api(path, student, { respuestas: wrong })).status, 409);
    const reset = { alumno_id: studentId, numero_intento: 1 };
    assert.equal((await api(path + '/rehabilitar', other, reset)).status, 403);
    assert.equal((await api(path + '/rehabilitar', student, reset)).status, 401);
    assert.equal((await api(path + '/rehabilitar', teacher, { alumno_id: cohortId, numero_intento: 1 })).status, 409);
    await db.execute("UPDATE intentos_examenes SET finalizado_at = '2026-01-01 12:00:00' WHERE examen_id = ? AND usuario_id = ?", [examenId, studentId]);
    const oldDate = (await api(path, student)).data.mi_intento.fecha;
    assert.equal((await api(path + '/rehabilitar', teacher, reset)).status, 200);
    assert.equal((await api(path + '/rehabilitar', teacher, reset)).status, 200);
    const reopened = (await api(path, student)).data;
    assert.equal(reopened.mi_intento.permite_reintento, true);
    assert.equal(reopened.mi_intento.calificacion, 100);
    assert.equal(reopened.mi_intento.fecha, oldDate);
    assert.equal(reopened.mi_intento.respuestas, null);
    assert.deepEqual(reopened.respuestasCorrectas, {});
    const courseList = (await api(`/api/estudiante/clases?curso_id=${courseId}`, student)).data;
    assert.equal(courseList.exams[0].permite_reintento, 1);
    assert.equal(courseList.pendientes, 1);
    assert.equal(courseList.progreso.done, 0);
    assert.equal((await api(path, student, { respuestas: { 999999: 1 } })).status, 400);
    assert.equal((await api(path, student)).data.mi_intento.permite_reintento, true);
    const second = await Promise.all([api(path, student, { respuestas: wrong }), api(path, student, { respuestas: wrong })]);
    assert.deepEqual(second.map(result => result.status).sort(), [200, 409]);
    const results = (await api(path + '/resultados', teacher)).data.alumnos as ExamStudentResult[];
    const row = results.find(row => row.alumno_id === studentId)!;
    assert.equal(row.intento?.calificacion, 0);
    assert.deepEqual(row.intento?.respuestas, wrong);
    assert.equal(row.historial.length, 1);
    assert.equal(row.historial[0].calificacion, 100);
    assert.equal(row.historial[0].fecha, oldDate);
    assert.deepEqual(row.historial[0].respuestas, correct);
    assert.equal(row.permite_reintento, false);
    assert.equal(results.find(row => row.alumno_id === cohortId)?.intento, null);
    assert.equal((await api(path + '/rehabilitar', teacher, reset)).status, 409);
    assert.equal((await api(path + '/rehabilitar', admin, { alumno_id: studentId, numero_intento: 2 })).status, 200);
    // Intento anterior a la función: nota existente, sin respuestas registradas.
    await db.execute('INSERT INTO intentos_examenes (examen_id,usuario_id,calificacion) VALUES (?, ?, 65)', [examenId, cohortId]);
    assert.equal((await api(path, cohort)).data.mi_intento.respuestas, null);
    assert.equal((await api(path, cohort, { respuestas: correct })).status, 409);
    assert.equal((await api(path + '/rehabilitar', teacher, { alumno_id: cohortId, numero_intento: 1 })).status, 200);
    assert.equal((await api(path, cohort, { respuestas: correct })).status, 200);
    const legacy = ((await api(path + '/resultados', teacher)).data.alumnos as ExamStudentResult[]).find(row => row.alumno_id === cohortId)!;
    assert.equal(legacy.historial[0].calificacion, 65);
    assert.equal(legacy.historial[0].respuestas, null);
    const [count] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM intentos_examenes WHERE examen_id = ?', [examenId]);
    assert.equal(count[0].n, 2);
  } finally {
    if (courseId) await db.execute('DELETE FROM cursos WHERE id = ?', [courseId]);
    if (groupId) await db.execute('DELETE FROM grupos_cohortes WHERE id = ?', [groupId]);
    for (const userId of users) await db.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
    await db.end();
  }
});
