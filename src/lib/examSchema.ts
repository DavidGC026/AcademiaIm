import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

let ready: Promise<void> | undefined;
let releaseReady: Promise<void> | undefined;

async function migrate() {
  const [columns] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM intentos_examenes');
  const existing = new Set(columns.map(column => column.Field));
  for (const [name, definition] of [
    ['permite_reintento', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['respuestas', 'JSON DEFAULT NULL'],
    ['historial', 'JSON DEFAULT NULL'],
  ]) {
    if (existing.has(name)) continue;
    try {
      await pool.query(`ALTER TABLE intentos_examenes ADD COLUMN ${name} ${definition}`);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

/** Esperar la migración también evita carreras con el primer acceso tras actualizar. */
export function ensureExamAttemptSchema() {
  ready ??= migrate().catch(error => { ready = undefined; throw error; });
  return ready;
}

async function migrateRelease() {
  const [columns] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM examenes');
  const existing = new Set(columns.map(column => column.Field));
  for (const [name, definition] of [
    // Conservar el acceso de los exámenes anteriores a esta función.
    ['modo_liberacion', "VARCHAR(32) NOT NULL DEFAULT 'abierto'"],
    ['clase_requisito_id', 'INT DEFAULT NULL'],
  ]) {
    if (existing.has(name)) continue;
    try {
      await pool.query(`ALTER TABLE examenes ADD COLUMN ${name} ${definition}`);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

export function ensureExamReleaseSchema() {
  releaseReady ??= migrateRelease().catch(error => { releaseReady = undefined; throw error; });
  return releaseReady;
}
