/** Migración aditiva: no siembra, elimina ni modifica usuarios, contenidos o notas. */
process.env.ACADEMIA_SKIP_DB_INIT = '1';
process.env.DB_AUTO_INIT = '0';

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Indica --apply después de respaldar la base.');
  if (!process.env.DB_NAME || !/^[a-zA-Z0-9_]+$/.test(process.env.DB_NAME)) throw new Error('DB_NAME debe identificar explícitamente la base del campus.');
  const { default: pool } = await import('../src/lib/db');
  try {
    const { ensureExamAttemptSchema, ensureExamReleaseSchema } = await import('../src/lib/examSchema');
    const { ensureTutorialTable } = await import('../src/lib/tutorial');
    await ensureExamAttemptSchema();
    await ensureExamReleaseSchema();
    await ensureTutorialTable();
    const [columns] = await pool.query('SHOW COLUMNS FROM cursos') as [{ Field: string }[], unknown];
    for (const column of ['color', 'color_lecturas']) {
      if (!columns.some((entry) => entry.Field === column)) {
        await pool.query(`ALTER TABLE cursos ADD COLUMN ${column} VARCHAR(30) DEFAULT NULL`);
      }
    }
    console.log('Esquema del campus actualizado sin modificar sus registros.');
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo actualizar el esquema.');
  process.exitCode = 1;
});
