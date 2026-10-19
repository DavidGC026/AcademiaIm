import assert from 'node:assert/strict';
import test from 'node:test';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { syncWebinarsInterviews, webinarsInterviews } from '../src/lib/webinarsInterviews';

test('reemplaza sólo ejemplos, conserva contenido propio y no duplica entrevistas al repetir', { skip: process.env.INTERVIEWS_QA !== '1' }, async () => {
  assert.ok(process.env.DB_NAME?.endsWith('_qa') && process.env.DB_HOST === '127.0.0.1');
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    // La tabla temporal oculta la original únicamente en esta conexión.
    const [schema] = await db.query<RowDataPacket[]>('SHOW CREATE TABLE biblioteca_entrevistas');
    await db.query(String(schema[0]['Create Table']).replace(/^CREATE TABLE /, 'CREATE TEMPORARY TABLE '));
    await db.beginTransaction();
    for (const [titulo, video] of [
      ['La Evolución del Concreto Sustentable en América Latina', 'https://www.youtube.com/embed/F429Z5dF_vU'],
      ['Patología y Durabilidad de Estructuras de Concreto', 'https://www.youtube.com/embed/2_HjZkC6H7I'],
      ['Marcador de ejemplo anterior', 'https://youtu.be/dQw4w9WgXcQ'],
      ['Entrevista propia de administración', 'https://youtu.be/abcdefghijk'],
      ['Título editado por administración', webinarsInterviews[0].video_url.replace('/embed/', '/watch?v=')],
    ]) {
      await db.execute('INSERT INTO biblioteca_entrevistas (titulo,experto,cargo,video_url,duracion,descripcion) VALUES (?, ?, ?, ?, ?, ?)', [titulo, 'Experto QA', '', video, '', 'Descripción propia']);
    }
    assert.equal(webinarsInterviews.length, 7);
    assert.deepEqual(await syncWebinarsInterviews(db), { removed: 3, added: 6, alreadyPresent: 1 });
    const [first] = await db.execute<RowDataPacket[]>('SELECT * FROM biblioteca_entrevistas ORDER BY id');
    assert.equal(first.length, 8);
    assert.equal(first.find((row) => row.titulo === 'Entrevista propia de administración')?.descripcion, 'Descripción propia');
    assert.equal(first.find((row) => row.titulo === 'Título editado por administración')?.experto, 'Experto QA');
    assert.equal(first.some((row) => row.video_url.includes('dQw4w9WgXcQ')), false);
    assert.deepEqual(await syncWebinarsInterviews(db), { removed: 0, added: 0, alreadyPresent: 7 });
    const [second] = await db.execute<RowDataPacket[]>('SELECT * FROM biblioteca_entrevistas ORDER BY id');
    assert.deepEqual(second, first);
    await assert.rejects(syncWebinarsInterviews(db, []), /catálogo/);
    const [afterRejection] = await db.execute<RowDataPacket[]>('SELECT * FROM biblioteca_entrevistas ORDER BY id');
    assert.deepEqual(afterRejection, first);
    await db.rollback();
  } finally {
    await db.execute('DROP TEMPORARY TABLE IF EXISTS biblioteca_entrevistas');
    await db.end();
  }
});
