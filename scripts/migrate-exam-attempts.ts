import pool from '../src/lib/db';
import { ensureExamAttemptSchema, ensureExamReleaseSchema } from '../src/lib/examSchema';

ensureExamAttemptSchema()
  .then(() => ensureExamReleaseSchema())
  .then(() => console.log('Esquema de intentos y liberación de exámenes actualizado.'))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
