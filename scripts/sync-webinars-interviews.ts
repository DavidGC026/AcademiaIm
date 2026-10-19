export {};
/** Reemplazo deliberado del contenido de ejemplo; no forma parte de las migraciones de esquema. */
process.env.ACADEMIA_SKIP_DB_INIT = '1';
process.env.DB_AUTO_INIT = '0';

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Indica --apply después de respaldar biblioteca_entrevistas.');
  if (!process.env.DB_NAME || !/^[a-zA-Z0-9_]+$/.test(process.env.DB_NAME)) throw new Error('Indica explícitamente DB_NAME.');
  const { default: pool } = await import('../src/lib/db');
  const { syncWebinarsInterviews } = await import('../src/lib/webinarsInterviews');
  const connection = await pool.getConnection();
  const lock = `imcyc:interviews:${process.env.DB_NAME}`;
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, 10) acquired', [lock]) as [{ acquired: number }[], unknown];
    if (rows[0]?.acquired !== 1) throw new Error('Hay otra sincronización de entrevistas en curso.');
    await connection.beginTransaction();
    try {
      const result = await syncWebinarsInterviews(connection);
      await connection.commit();
      console.log(JSON.stringify(result));
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [lock]);
    connection.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudieron sincronizar las entrevistas.');
  process.exitCode = 1;
});
