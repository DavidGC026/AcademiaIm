import pool from '../src/lib/db';
import { ensureExamAttemptSchema } from '../src/lib/examSchema';

ensureExamAttemptSchema()
  .then(() => console.log('Esquema de intentos de examen actualizado.'))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
