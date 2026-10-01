import pool from '@/lib/db';

/** Obtiene el ID del grupo al que pertenece el estudiante (por nombre de cohorte). */
export async function getGrupoIdForEstudiante(userId: number): Promise<number | null> {
  const [rows] = (await pool.execute(
    `SELECT g.id FROM grupos_cohortes g
     INNER JOIN usuarios u ON u.grupo_cohorte = g.nombre
     WHERE u.id = ?`,
    [userId]
  )) as any[];

  return rows[0]?.id ?? null;
}

/** Verifica si el estudiante puede ver un curso aprobado (inscripción directa o por grupo). */
export async function estudiantePuedeAccederCurso(
  userId: number,
  cursoId: number
): Promise<boolean> {
  const [directRows] = (await pool.execute(
    `SELECT 1 FROM curso_estudiantes ce
     INNER JOIN cursos c ON c.id = ce.curso_id
     WHERE ce.estudiante_id = ? AND ce.curso_id = ? AND c.estado = 'aprobado'
     LIMIT 1`,
    [userId, cursoId]
  )) as any[];

  if (directRows.length > 0) return true;

  const grupoId = await getGrupoIdForEstudiante(userId);
  if (!grupoId) return false;

  const [rows] = (await pool.execute(
    `SELECT 1 FROM curso_grupos cg
     INNER JOIN cursos c ON c.id = cg.curso_id
     WHERE cg.grupo_id = ? AND cg.curso_id = ? AND c.estado = 'aprobado'
     LIMIT 1`,
    [grupoId, cursoId]
  )) as any[];

  return rows.length > 0;
}

export async function getCursoIdFromClase(claseId: number): Promise<number | null> {
  const [rows] = (await pool.execute('SELECT curso_id FROM clases WHERE id = ?', [claseId])) as any[];
  return rows[0]?.curso_id ?? null;
}

export async function getCursoIdFromExamen(examenId: number): Promise<number | null> {
  const [rows] = (await pool.execute('SELECT curso_id FROM examenes WHERE id = ?', [examenId])) as any[];
  return rows[0]?.curso_id ?? null;
}
