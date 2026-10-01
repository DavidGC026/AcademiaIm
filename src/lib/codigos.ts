import pool from '@/lib/db';

/** Genera un código de materia único con formato MAT-0001, MAT-0002, etc. */
export async function generateCourseCode(): Promise<string> {
  const [rows] = (await pool.execute(
    `SELECT codigo FROM cursos
     WHERE codigo IS NOT NULL AND codigo REGEXP '^MAT-[0-9]+$'`
  )) as any[];

  let maxNum = 0;
  for (const row of rows) {
    const match = row.codigo.match(/^MAT-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  const candidate = `MAT-${String(maxNum + 1).padStart(4, '0')}`;
  const [existing] = (await pool.execute(
    'SELECT id FROM cursos WHERE codigo = ?',
    [candidate]
  )) as any[];

  if (existing.length > 0) {
    return `MAT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
  return candidate;
}

/** Backfill códigos para cursos existentes sin código. */
export async function backfillCourseCodes(): Promise<void> {
  const [rows] = (await pool.execute(
    'SELECT id FROM cursos WHERE codigo IS NULL OR codigo = ""'
  )) as any[];

  for (const row of rows) {
    const codigo = await generateCourseCode();
    await pool.execute('UPDATE cursos SET codigo = ? WHERE id = ?', [codigo, row.id]);
  }
}
