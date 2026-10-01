import pool from '@/lib/db';

/** Genera un código de acceso único con formato GRP-0001, GRP-0002, etc. */
export async function generateGroupCode(): Promise<string> {
  const [rows] = (await pool.execute(
    `SELECT codigo FROM grupos_cohortes
     WHERE codigo REGEXP '^GRP-[0-9]+$'`
  )) as any[];

  let maxNum = 0;
  for (const row of rows) {
    const match = row.codigo.match(/^GRP-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  const candidate = `GRP-${String(maxNum + 1).padStart(4, '0')}`;
  const [existing] = (await pool.execute(
    'SELECT id FROM grupos_cohortes WHERE codigo = ?',
    [candidate]
  )) as any[];

  if (existing.length > 0) {
    return `GRP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
  return candidate;
}

/** Crea el grupo en grupos_cohortes si un alumno tiene grupo_cohorte pero no existe la fila. */
export async function ensureGrupoCohorteExists(
  nombre: string,
  creadorId: number | null = null
): Promise<number> {
  const trimmed = nombre.trim();
  if (!trimmed) {
    throw new Error('Nombre de grupo vacío');
  }

  const [rows] = (await pool.execute(
    'SELECT id FROM grupos_cohortes WHERE nombre = ?',
    [trimmed]
  )) as any[];

  if (rows.length > 0) {
    return rows[0].id;
  }

  const codigo = await generateGroupCode();
  const [result] = (await pool.execute(
    'INSERT INTO grupos_cohortes (nombre, codigo, creador_id) VALUES (?, ?, ?)',
    [trimmed, codigo, creadorId]
  )) as any[];

  return result.insertId as number;
}

/** ponytail: escaneo O(n) de cohortes huérfanas; upgrade path: trigger al asignar grupo_cohorte */
export async function syncGruposFromAlumnos(): Promise<string[]> {
  const [orphans] = (await pool.execute(
    `SELECT DISTINCT u.grupo_cohorte AS nombre
     FROM usuarios u
     WHERE u.role_id = 3
       AND u.grupo_cohorte IS NOT NULL
       AND TRIM(u.grupo_cohorte) != ''
       AND NOT EXISTS (
         SELECT 1 FROM grupos_cohortes g WHERE g.nombre = u.grupo_cohorte
       )`
  )) as any[];

  const creados: string[] = [];
  for (const row of orphans) {
    await ensureGrupoCohorteExists(row.nombre);
    creados.push(row.nombre);
  }
  return creados;
}
