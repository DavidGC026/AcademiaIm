import pool from '@/lib/db';

export function esStaffBiblioteca(roleName?: string): boolean {
  return roleName === 'administrador' || roleName === 'maestro';
}

/** Acceso prioritario gratuito: lo otorga el admin por alumno (flag en BD).
 *  Admin y maestros siempre tienen acceso. */
export async function tieneAccesoBibliotecaPrioritario(
  userId: number,
  roleName?: string
): Promise<boolean> {
  if (esStaffBiblioteca(roleName)) return true;

  const [rows] = (await pool.execute(
    `SELECT acceso_biblioteca_prioritario FROM usuarios WHERE id = ?`,
    [userId]
  )) as any[];

  return rows[0]?.acceso_biblioteca_prioritario === 1;
}

/** IDs de libros que el usuario ya pagó (compra completada). */
export async function librosComprados(userId: number): Promise<number[]> {
  const [rows] = (await pool.execute(
    `SELECT DISTINCT libro_id FROM compras_libros WHERE usuario_id = ? AND estado = 'pagado'`,
    [userId]
  )) as any[];
  return rows.map((r: any) => r.libro_id);
}

/** Puede leer un libro dentro de la plataforma: admin/maestro, alumno con
 *  acceso prioritario, o alumno que ya compró ese título. */
export async function tieneAccesoLibro(
  userId: number,
  roleName: string | undefined,
  libroId: number
): Promise<boolean> {
  if (await tieneAccesoBibliotecaPrioritario(userId, roleName)) return true;

  const [rows] = (await pool.execute(
    `SELECT 1 FROM compras_libros WHERE usuario_id = ? AND libro_id = ? AND estado = 'pagado' LIMIT 1`,
    [userId, libroId]
  )) as any[];
  return rows.length > 0;
}

/** Registra acceso gratuito a un libro (maestro/admin). Reutiliza compras_libros. */
export async function otorgarAccesoLibro(
  usuarioId: number,
  libroId: number
): Promise<'ok' | 'ya_tiene'> {
  if (await tieneAccesoLibro(usuarioId, 'estudiante', libroId)) return 'ya_tiene';

  await pool.execute(
    `INSERT INTO compras_libros (usuario_id, libro_id, openpay_charge_id, monto, metodo, estado)
     VALUES (?, ?, NULL, 0, 'otorgado', 'pagado')`,
    [usuarioId, libroId]
  );
  return 'ok';
}

/** Quita acceso otorgado por staff. No revoca compras pagadas ni acceso prioritario global. */
export async function revocarAccesoOtorgadoLibro(
  usuarioId: number,
  libroId: number
): Promise<'ok' | 'sin_otorgado' | 'sigue_con_acceso'> {
  const [otorgados] = (await pool.execute(
    `SELECT id FROM compras_libros
     WHERE usuario_id = ? AND libro_id = ? AND metodo = 'otorgado' AND estado = 'pagado'`,
    [usuarioId, libroId]
  )) as any[];

  if (otorgados.length === 0) return 'sin_otorgado';

  await pool.execute(
    `DELETE FROM compras_libros WHERE usuario_id = ? AND libro_id = ? AND metodo = 'otorgado'`,
    [usuarioId, libroId]
  );

  if (await tieneAccesoLibro(usuarioId, 'estudiante', libroId)) {
    return 'sigue_con_acceso';
  }
  return 'ok';
}

/** Maestro solo puede otorgar a alumnos de sus grupos. */
export async function maestroPuedeOtorgarAccesoAlumno(
  maestroId: number,
  estudianteId: number
): Promise<boolean> {
  const [rows] = (await pool.execute(
    `SELECT 1 FROM usuarios u
     INNER JOIN grupos_cohortes g ON g.nombre = u.grupo_cohorte
     INNER JOIN grupo_maestros gm ON gm.grupo_id = g.id AND gm.maestro_id = ?
     WHERE u.id = ? AND u.role_id = 3
     LIMIT 1`,
    [maestroId, estudianteId]
  )) as any[];
  return rows.length > 0;
}
