/** HTTP de configuración con claves ficticias y restauración exacta; nunca llama una API de IA. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { getSessionAudience, getSessionCookieName } from '../src/lib/sessionConfig';

const base = process.env.ASSISTANT_CONFIG_QA_URL;

test('configuración IA oculta claves y exige una clave distinta al cambiar de proveedor', { skip: !base }, async () => {
  const url = new URL(base!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port && url.port !== '3005');
  assert.ok(process.env.DB_NAME?.endsWith('_qa') && process.env.JWT_SECRET && ['127.0.0.1', 'localhost'].includes(process.env.DB_HOST || ''));
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const keys = ['ia_provider', 'ia_api_key', 'ia_model'];
  const users: number[] = [];
  const [original] = await db.execute<RowDataPacket[]>("SELECT clave,valor,updated_at FROM configuracion WHERE clave IN ('ia_provider','ia_api_key','ia_model') ORDER BY clave");
  const suffix = randomUUID();
  const readConfig = async () => (await db.execute<RowDataPacket[]>("SELECT clave,valor,updated_at FROM configuracion WHERE clave IN ('ia_provider','ia_api_key','ia_model') ORDER BY clave"))[0];
  const cookie = (id: number, roleName: string) => `${getSessionCookieName(url.pathname)}=${jwt.sign({ userId: id, roleName }, process.env.JWT_SECRET!, { expiresIn: '10m', audience: getSessionAudience(url.pathname) })}`;
  async function api(auth: string | null, body?: unknown) {
    const response = await fetch(`${base}/api/admin/config`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(auth ? { Cookie: auth } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  try {
    for (const [role, name] of [[1, 'Admin QA configuración'], [3, 'Alumno QA configuración']] as const) {
      const [result] = await db.execute<ResultSetHeader>('INSERT INTO usuarios (role_id,email,password,nombre) VALUES (?,?,?,?)', [role, `${users.length}-${suffix}@example.test`, 'unused', name]);
      users.push(result.insertId);
    }
    const admin = cookie(users[0], 'administrador');
    const student = cookie(users[1], 'estudiante');
    const openaiKey = `qa-openai-${suffix}`;
    const geminiKey = `qa-gemini-${suffix}`;
    // Establecer sólo configuración ficticia. Los valores originales se restauran con su timestamp.
    for (const [key, value] of [['ia_provider', 'openai'], ['ia_api_key', openaiKey], ['ia_model', 'gpt-5.6-luna']]) {
      await db.execute('INSERT INTO configuracion (clave,valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)', [key, value]);
    }
    assert.equal((await api(null)).status, 401);
    assert.equal((await api(student)).status, 401);
    assert.equal((await api(student, { provider: 'gemini', apiKey: geminiKey })).status, 401);
    const before = await readConfig();
    const detail = await api(admin);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.managedByEnvironment, false, 'Esta prueba requiere un servidor QA sin clave en el entorno.');
    assert.equal(detail.data.apiKey, '••••••••'); assert.equal(detail.data.hasKey, true);
    assert.ok(!JSON.stringify(detail.data).includes(openaiKey), 'La API administrativa no devuelve la clave ni fragmentos.');
    for (const apiKey of ['', '••••••••', 'abc...xyz']) {
      assert.equal((await api(admin, { provider: 'gemini', apiKey })).status, 400);
      assert.ok(JSON.stringify(await readConfig()) === JSON.stringify(before), 'Un cambio de proveedor sin clave nueva no modifica ninguna fila ni timestamp.');
    }
    const changed = await api(admin, { provider: 'gemini', apiKey: geminiKey });
    assert.equal(changed.status, 200);
    const after = Object.fromEntries((await readConfig()).map(row => [row.clave, row.valor]));
    assert.equal(after.ia_provider, 'gemini'); assert.equal(after.ia_api_key, geminiKey);
    const masked = await api(admin);
    assert.equal(masked.data.provider, 'gemini'); assert.equal(masked.data.apiKey, '••••••••');
    assert.ok(!JSON.stringify(masked.data).includes(geminiKey));
    const geminiBefore = await readConfig();
    assert.equal((await api(admin, { provider: 'openai', model: 'gpt-5.6-luna', apiKey: '' })).status, 400);
    assert.ok(JSON.stringify(await readConfig()) === JSON.stringify(geminiBefore));
    assert.equal((await api(admin, { provider: 'gemini', apiKey: '' })).status, 200, 'Guardar el mismo proveedor conserva su propia clave.');
    assert.equal(Object.fromEntries((await readConfig()).map(row => [row.clave, row.valor])).ia_api_key, geminiKey);
  } finally {
    try {
      await db.beginTransaction();
      const existed = new Set(original.map(row => row.clave));
      for (const key of keys) if (!existed.has(key)) await db.execute('DELETE FROM configuracion WHERE clave=?', [key]);
      for (const row of original) await db.execute('INSERT INTO configuracion (clave,valor,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor), updated_at=VALUES(updated_at)', [row.clave, row.valor, row.updated_at]);
      await db.commit();
    } catch (error) { await db.rollback(); throw error; }
    finally {
      for (const id of users) await db.execute('DELETE FROM usuarios WHERE id=?', [id]);
      await db.end();
    }
  }
});
