import pool from '@/lib/db';

async function runSafely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err: unknown) {
    const e = err as { errno?: number; code?: string; message?: string };
    if (e.errno === 1091 || e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.errno === 1054) return;
    console.warn(`[migrateCursoDirecto] ${label}:`, e.message || err);
  }
}

async function dropFkOnColumn(table: string, column: string) {
  const db = process.env.DB_NAME || 'academia_imcyc';
  const [rows] = (await pool.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [db, table, column]
  )) as any[];

  for (const row of rows) {
    await pool.execute(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
  }
}

/** ponytail: migración one-shot; idempotente. Elimina modulos y cuelga clases/examenes/foro de curso. */
export async function migrateCursoDirecto(addColumnSafely: (name: string, sql: string) => Promise<void>) {
  await addColumnSafely('imagen', `ALTER TABLE cursos ADD COLUMN imagen VARCHAR(500) DEFAULT NULL`);
  await addColumnSafely('curso_id_clases', `ALTER TABLE clases ADD COLUMN curso_id INT DEFAULT NULL`);
  await addColumnSafely('curso_id_examenes', `ALTER TABLE examenes ADD COLUMN curso_id INT DEFAULT NULL`);
  await addColumnSafely('curso_id_foro', `ALTER TABLE foro_posts ADD COLUMN curso_id INT DEFAULT NULL`);

  const [modTable] = (await pool.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'modulos'`,
    [process.env.DB_NAME || 'academia_imcyc']
  )) as any;

  if (modTable.length > 0) {
    await runSafely('backfill clases', async () => {
      await pool.execute(
        `UPDATE clases c INNER JOIN modulos m ON c.modulo_id = m.id SET c.curso_id = m.curso_id WHERE c.curso_id IS NULL`
      );
    });
    await runSafely('backfill examenes', async () => {
      await pool.execute(
        `UPDATE examenes e INNER JOIN modulos m ON e.modulo_id = m.id SET e.curso_id = m.curso_id WHERE e.curso_id IS NULL`
      );
    });
    await runSafely('backfill foro', async () => {
      await pool.execute(
        `UPDATE foro_posts f INNER JOIN modulos m ON f.modulo_id = m.id SET f.curso_id = m.curso_id WHERE f.curso_id IS NULL`
      );
    });

    for (const table of ['clases', 'examenes', 'foro_posts']) {
      await runSafely(`drop fk modulo_id ${table}`, () => dropFkOnColumn(table, 'modulo_id'));
      await runSafely(`drop modulo_id ${table}`, async () => {
        await pool.execute(`ALTER TABLE \`${table}\` DROP COLUMN modulo_id`);
      });
    }

    await runSafely('drop modulos', async () => {
      await pool.execute('DROP TABLE IF EXISTS modulos');
    });
  }

  const db = process.env.DB_NAME || 'academia_imcyc';
  for (const table of ['clases', 'examenes', 'foro_posts']) {
    const [existing] = (await pool.execute(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'curso_id' AND REFERENCED_TABLE_NAME = 'cursos'`,
      [db, table]
    )) as any;
    if (existing.length === 0) {
      await runSafely(`fk curso_id ${table}`, async () => {
        await pool.execute(
          `ALTER TABLE \`${table}\` ADD CONSTRAINT fk_${table}_curso_id FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE`
        );
      });
    }
  }
}
