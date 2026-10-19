type SchemaDatabase = { query(sql: string): Promise<unknown> };

async function addMissingColumns(db: SchemaDatabase, table: string, definitions: [string, string][]) {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${table}`) as [{ Field: string }[], unknown];
  const existing = new Set(columns.map(column => column.Field));
  for (const [name, definition] of definitions) {
    if (existing.has(name)) continue;
    try { await db.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`); }
    catch (error) { if ((error as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw error; }
  }
}

export async function migrateExamAttemptSchema(db: SchemaDatabase) {
  await addMissingColumns(db, 'intentos_examenes', [
    ['permite_reintento', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['respuestas', 'JSON DEFAULT NULL'],
    ['historial', 'JSON DEFAULT NULL'],
    ['preguntas_ids', 'JSON DEFAULT NULL'],
    ['preguntas_snapshot', 'JSON DEFAULT NULL'],
    ['intento_en_curso', 'JSON DEFAULT NULL'],
  ]);
}

export async function migrateExamReleaseSchema(db: SchemaDatabase) {
  // Las evaluaciones publicadas conservan su acceso y la selección previa de RUA.
  await addMissingColumns(db, 'examenes', [
    ['modo_liberacion', "VARCHAR(32) NOT NULL DEFAULT 'abierto'"],
    ['clase_requisito_id', 'INT DEFAULT NULL'],
    ['preguntas_mostrar', 'INT NOT NULL DEFAULT 0'],
  ]);
}
