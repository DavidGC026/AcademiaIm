import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const grupo = (searchParams.get('grupo') || '').trim();

    let sql = `
      SELECT u.id, u.nombre, u.email, u.grupo_cohorte, u.created_at,
             u.id_estudiante, u.apellido_paterno, u.apellido_materno, u.fecha_nacimiento,
             u.acceso_biblioteca_prioritario
      FROM usuarios u
      WHERE u.role_id = 3
    `;
    const params: (string | number)[] = [];

    if (q) {
      const like = `%${q}%`;
      sql += ` AND (u.nombre LIKE ? OR u.email LIKE ? OR u.id_estudiante LIKE ? OR u.apellido_paterno LIKE ? OR u.apellido_materno LIKE ?)`;
      params.push(like, like, like, like, like);
    }
    if (grupo) {
      sql += ` AND u.grupo_cohorte = ?`;
      params.push(grupo);
    }
    sql += ` ORDER BY u.nombre ASC`;

    const [estudiantes] = (await pool.execute(sql, params)) as any[];

    for (const estudiante of estudiantes) {
      if (estudiante.fecha_nacimiento) {
        const d = new Date(estudiante.fecha_nacimiento);
        if (!Number.isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          estudiante.fecha_nacimiento = `${year}-${month}-${day}`;
        }
      }
    }

    const [gruposRows] = (await pool.execute(
      `SELECT nombre FROM (
         SELECT nombre FROM grupos_cohortes
         UNION
         SELECT grupo_cohorte AS nombre FROM usuarios
         WHERE role_id = 3 AND grupo_cohorte IS NOT NULL AND TRIM(grupo_cohorte) != ''
       ) g
       ORDER BY nombre ASC`
    )) as any[];

    return NextResponse.json({
      estudiantes,
      grupos: gruposRows.map((r: { nombre: string }) => r.nombre),
    });
  } catch (error: unknown) {
    console.error('Error al listar estudiantes:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
