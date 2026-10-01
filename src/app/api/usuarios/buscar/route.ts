import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/usuarios/buscar?q=&rol=estudiante
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const rol = searchParams.get('rol') || 'estudiante';

    if (q.length < 2) {
      return NextResponse.json({ usuarios: [] });
    }

    const like = `%${q}%`;
    const roleFilter = rol === 'estudiante' ? 'estudiante' : rol;

    const [usuarios] = await pool.execute(
      `SELECT u.id, u.nombre, u.email, u.id_estudiante, u.grupo_cohorte
       FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE r.nombre = ?
         AND (u.nombre LIKE ? OR u.email LIKE ? OR u.id_estudiante LIKE ?)
       ORDER BY u.nombre ASC
       LIMIT 20`,
      [roleFilter, like, like, like]
    );

    return NextResponse.json({ usuarios });
  } catch (error: unknown) {
    console.error('Error al buscar usuarios:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
