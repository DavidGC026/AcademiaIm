/** Dos apps locales con bases *_qa: jamás usa cuentas ni contraseñas reales. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mysql, { type ResultSetHeader } from 'mysql2/promise';
import { getSessionCookieName } from '../src/lib/sessionConfig';

const directory = process.env.CAMPUS_QA_DIR;

test('login, perfil y cierre conservan sesiones independientes en ambos campus', { skip: !directory, timeout: 90_000 }, async () => {
  const cookies = new Map<string, string>();
  const fixtures = [];
  const suffix = randomUUID();
  const password = `QA-${randomUUID()}`;
  const hash = await bcrypt.hash(password, 10);
  try {
    for (const [campus, port, basePath] of [['academia', 3198, '/Academia'], ['ruadiplo', 3199, '/ruadiplo']] as const) {
      const env = JSON.parse(await readFile(join(directory!, `${campus}.env.json`), 'utf8'));
      assert.ok(env.DB_NAME.endsWith('_qa') && env.DB_HOST === '127.0.0.1' && env.DB_PORT === '3398');
      const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME });
      const email = `${campus}-${suffix}@example.test`;
      const [user] = await db.execute<ResultSetHeader>('INSERT INTO usuarios (role_id, email, password, nombre) VALUES (3, ?, ?, ?)', [email, hash, `Alumno QA ${campus}`]);
      const fixture = { db, id: user.insertId, base: `http://127.0.0.1:${port}${basePath}`, name: getSessionCookieName(basePath), basePath };
      fixtures.push(fixture);
      const response = await fetch(`${fixture.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie')!;
      assert.ok(cookie.includes(`${fixture.name}=`) && cookie.includes(`Path=${basePath}`));
      cookies.set(fixture.name, cookie.split(';')[0].slice(fixture.name.length + 1));
    }
    const headers = () => ({ Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), 'Content-Type': 'application/json' });
    for (const fixture of fixtures) {
      let response = await fetch(`${fixture.base}/api/auth/session`, { headers: headers() });
      assert.equal((await response.json()).session.userId, fixture.id);
      response = await fetch(`${fixture.base}/api/perfil`, { method: 'PUT', headers: headers(), body: JSON.stringify({ nombre: 'Nombre QA actualizado' }) });
      assert.equal(response.status, 200, 'Cambiar nombre debe renovar la sesión sin duplicar claims JWT.');
      const cookie = response.headers.get('set-cookie')!;
      assert.ok(cookie.includes(`${fixture.name}=`));
      cookies.set(fixture.name, cookie.split(';')[0].slice(fixture.name.length + 1));
      response = await fetch(`${fixture.base}/api/auth/session`, { headers: headers() });
      assert.equal((await response.json()).session.nombre, 'Nombre QA actualizado');
      response = await fetch(`${fixture.base}/api/perfil`, { method: 'PUT', headers: headers(), body: JSON.stringify({ password: 'Cambio-ficticio-1', currentPassword: 'incorrecta' }) });
      assert.equal(response.status, 400);
      response = await fetch(`${fixture.base}/api/perfil`, { method: 'PUT', headers: headers(), body: JSON.stringify({ password: 'Cambio-ficticio-1', currentPassword: password }) });
      assert.equal(response.status, 200);
      response = await fetch(`${fixture.base}/api/admin/config`, { headers: headers() });
      assert.equal(response.status, 401, 'Un alumno no puede consultar configuración de IA.');
    }
    const [academy, rua] = fixtures;
    const wrongAudience = await fetch(`${rua.base}/api/auth/session`, { headers: { Cookie: `${rua.name}=${cookies.get(academy.name)}` } });
    assert.equal((await wrongAudience.json()).session, null);
    const logout = await fetch(`${academy.base}/api/auth/logout`, { method: 'POST', headers: headers() });
    const removed = logout.headers.get('set-cookie')!;
    assert.ok(removed.startsWith(`${academy.name}=`) && removed.includes(`Path=${academy.basePath}`));
    cookies.delete(academy.name);
    assert.equal((await (await fetch(`${academy.base}/api/auth/session`, { headers: headers() })).json()).session, null);
    assert.equal((await (await fetch(`${rua.base}/api/auth/session`, { headers: headers() })).json()).session.userId, rua.id);
  } finally {
    for (const fixture of fixtures) {
      await fixture.db.execute('DELETE FROM logs_accesos WHERE usuario_id = ?', [fixture.id]);
      await fixture.db.execute('DELETE FROM usuarios WHERE id = ?', [fixture.id]);
      await fixture.db.end();
    }
  }
});
