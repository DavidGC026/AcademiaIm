/** Regresión real del temporizador. Requiere agent-browser y una app local con base *_qa. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { getSessionAudience, getSessionCookieName } from '../src/lib/sessionConfig';

const base = process.env.EXAM_QA_URL;

test('el temporizador entrega el borrador sin esperar ningún alert del navegador', { skip: !base, timeout: 90_000 }, async () => {
  const url = new URL(base!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port && url.port !== '3005');
  assert.ok(process.env.DB_NAME?.endsWith('_qa') && process.env.JWT_SECRET && ['127.0.0.1', 'localhost'].includes(process.env.DB_HOST || ''));
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const suffix = randomUUID();
  const session = `exam-timer-${suffix}`;
  const directory = mkdtempSync(join(tmpdir(), 'exam-timer-'));
  const users: number[] = [];
  let courseId = 0;
  const browser = (...args: string[]) => {
    const result = spawnSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 35_000 });
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    return result.stdout;
  };
  try {
    for (const [role, name] of [[2, 'Docente QA temporizador'], [3, 'Alumno QA temporizador']] as const) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO usuarios (role_id, email, password, nombre) VALUES (?, ?, ?, ?)', [role, `${users.length}-${suffix}@example.test`, 'unused', name]);
      users.push(result.insertId);
    }
    const [teacherId, studentId] = users;
    const [course] = await db.execute<ResultSetHeader>("INSERT INTO cursos (nombre, creado_por_id, estado) VALUES (?, ?, 'aprobado')", [`Temporizador QA ${suffix}`, teacherId]);
    courseId = course.insertId;
    await db.execute('INSERT INTO curso_estudiantes (curso_id, estudiante_id) VALUES (?, ?)', [courseId, studentId]);
    const [exam] = await db.execute<ResultSetHeader>("INSERT INTO examenes (curso_id, titulo, limite_tiempo, preguntas_mostrar, modo_liberacion) VALUES (?, 'Entrega automática QA', 1, 1, 'abierto')", [courseId]);
    const [question] = await db.execute<ResultSetHeader>("INSERT INTO preguntas (examen_id, pregunta, tipo) VALUES (?, 'Selecciona la primera opción', 'opcion_multiple')", [exam.insertId]);
    await db.execute("INSERT INTO opciones (pregunta_id, texto, es_correcta) VALUES (?, 'Respuesta correcta', 1), (?, 'Otra respuesta', 0)", [question.insertId, question.insertId]);
    await db.execute("INSERT INTO tutorial_progreso (usuario_id, rol, version, paso, estado) VALUES (?, 'estudiante', 2, 3, 'completado')", [studentId]);
    const token = jwt.sign({ userId: studentId, nombre: 'Alumno QA temporizador', email: `${studentId}@example.test`, roleId: 3, roleName: 'estudiante', grupo_cohorte: null }, process.env.JWT_SECRET!, { expiresIn: '10m', audience: getSessionAudience(url.pathname) });
    const statePath = join(directory, 'browser-state.json');
    writeFileSync(statePath, JSON.stringify({ cookies: [{ name: getSessionCookieName(url.pathname), value: token, domain: url.hostname, path: url.pathname || '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] }), { mode: 0o600 });
    const page = `${base}/estudiante/examenes/${exam.insertId}`;
    browser('--no-auto-dialog', 'open', base!);
    browser('state', 'load', statePath);
    browser('open', page);
    browser('wait', '--text', 'Selecciona la primera opción');
    browser('find', 'first', 'input[type=radio]', 'click');
    const [rows] = await db.execute<RowDataPacket[]>('SELECT intento_en_curso FROM intentos_examenes WHERE examen_id = ? AND usuario_id = ?', [exam.insertId, studentId]);
    const active = typeof rows[0].intento_en_curso === 'string' ? JSON.parse(rows[0].intento_en_curso) : rows[0].intento_en_curso;
    active.vence_at = new Date(Date.now() + 2_000).toISOString();
    await db.execute('UPDATE intentos_examenes SET intento_en_curso = ?, finalizado_at = finalizado_at WHERE examen_id = ? AND usuario_id = ?', [JSON.stringify(active), exam.insertId, studentId]);
    browser('open', page);
    let grade: number | null = null;
    for (let index = 0; index < 60; index++) {
      const [attempts] = await db.execute<RowDataPacket[]>('SELECT calificacion FROM intentos_examenes WHERE examen_id = ? AND usuario_id = ?', [exam.insertId, studentId]);
      if (attempts[0].calificacion != null) { grade = Number(attempts[0].calificacion); break; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.equal(grade, 100, 'La entrega debe completarse automáticamente sin cerrar diálogos y conservar la respuesta elegida.');
    browser('wait', '--text', 'Examen Completado');
  } catch (error) {
    try { console.error(browser('get', 'url')); console.error(browser('snapshot', '-i')); } catch {}
    throw error;
  } finally {
    spawnSync('agent-browser', ['--session', session, 'close'], { encoding: 'utf8', timeout: 10_000 });
    rmSync(directory, { recursive: true, force: true });
    if (courseId) await db.execute('DELETE FROM cursos WHERE id = ?', [courseId]);
    for (const id of users) {
      await db.execute('DELETE FROM tutorial_progreso WHERE usuario_id = ?', [id]);
      await db.execute('DELETE FROM usuarios WHERE id = ?', [id]);
    }
    await db.end();
  }
});
