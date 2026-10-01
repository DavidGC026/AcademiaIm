import pool from '@/lib/db';

/** ponytail: N maestros por grupo vía grupo_maestros; creador_id queda como quien creó el grupo. */
export async function maestroTieneGrupo(maestroId: number, grupoId: number): Promise<boolean> {
  const [rows] = (await pool.execute(
    `SELECT 1 FROM grupo_maestros WHERE grupo_id = ? AND maestro_id = ? LIMIT 1`,
    [grupoId, maestroId]
  )) as { length: number }[];
  return rows.length > 0;
}

export async function agregarMaestroAGrupo(grupoId: number, maestroId: number): Promise<void> {
  await pool.execute(
    `INSERT IGNORE INTO grupo_maestros (grupo_id, maestro_id) VALUES (?, ?)`,
    [grupoId, maestroId]
  );
}

export async function listarMaestrosDeGrupo(grupoId: number) {
  const [rows] = (await pool.execute(
    `SELECT u.id, u.nombre, u.email
     FROM grupo_maestros gm
     JOIN usuarios u ON u.id = gm.maestro_id
     WHERE gm.grupo_id = ?
     ORDER BY u.nombre ASC`,
    [grupoId]
  )) as [{ id: number; nombre: string; email: string }[], unknown];
  return rows;
}

export async function maestroPuedeGestionarEvento(maestroId: number, eventoId: number): Promise<boolean> {
  const [rows] = (await pool.execute(
    `SELECT 1 FROM calendario_eventos e
     JOIN grupo_maestros gm ON gm.grupo_id = e.grupo_id AND gm.maestro_id = ?
     WHERE e.id = ? LIMIT 1`,
    [maestroId, eventoId]
  )) as { length: number }[];
  return rows.length > 0;
}
