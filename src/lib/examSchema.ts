import pool from './db';
import { migrateExamAttemptSchema, migrateExamReleaseSchema } from './examMigrations';

let ready: Promise<void> | undefined;
let releaseReady: Promise<void> | undefined;

/** Esperar la migración también evita carreras con el primer acceso tras actualizar. */
export function ensureExamAttemptSchema() {
  ready ??= migrateExamAttemptSchema(pool).catch(error => { ready = undefined; throw error; });
  return ready;
}

export function ensureExamReleaseSchema() {
  releaseReady ??= migrateExamReleaseSchema(pool).catch(error => { releaseReady = undefined; throw error; });
  return releaseReady;
}
