import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export const TUTORIAL_VERSION = 2;
export const TUTORIAL_STEPS = 4;
export type TutorialRole = 'administrador' | 'maestro' | 'estudiante';
export type TutorialStatus = 'pendiente' | 'completado' | 'omitido';

let tableReady: Promise<unknown> | undefined;

export function ensureTutorialTable() {
  tableReady ??= pool.execute(`CREATE TABLE IF NOT EXISTS tutorial_progreso (
    usuario_id INT NOT NULL,
    rol VARCHAR(16) NOT NULL,
    version SMALLINT UNSIGNED NOT NULL,
    paso TINYINT UNSIGNED NOT NULL DEFAULT 0,
    estado VARCHAR(16) NOT NULL DEFAULT 'pendiente',
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, rol)
  )`).catch((error) => { tableReady = undefined; throw error; });
  return tableReady;
}

export async function getTutorialProgress(userId: number, role: TutorialRole) {
  await ensureTutorialTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT paso, estado FROM tutorial_progreso WHERE usuario_id = ? AND rol = ? AND version = ?',
    [userId, role, TUTORIAL_VERSION],
  );
  return { step: rows[0]?.paso ?? 0, status: rows[0]?.estado ?? 'pendiente' };
}

export async function saveTutorialProgress(userId: number, role: TutorialRole, step: number, status: TutorialStatus) {
  await ensureTutorialTable();
  await pool.execute(
    `INSERT INTO tutorial_progreso (usuario_id, rol, version, paso, estado) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE version = VALUES(version), paso = VALUES(paso), estado = VALUES(estado)`,
    [userId, role, TUTORIAL_VERSION, step, status],
  );
}
