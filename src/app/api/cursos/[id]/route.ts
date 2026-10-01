import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

async function verificarAcceso(cursoId: number, session: { userId: number; roleName: string }) {
  if (session.roleName === 'administrador') {
    const [rows] = (await pool.execute('SELECT * FROM cursos WHERE id = ?', [cursoId])) as any[];
    return rows[0] ?? null;
  }
  if (session.roleName === 'maestro') {
    const [rows] = (await pool.execute(
      'SELECT * FROM cursos WHERE id = ? AND creado_por_id = ?',
      [cursoId, session.userId]
    )) as any[];
    return rows[0] ?? null;
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const cursoId = parseInt(id, 10);
    const curso = await verificarAcceso(cursoId, session);

    if (!curso && session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 });
    }

    if (session.roleName === 'estudiante') {
      const { estudiantePuedeAccederCurso } = await import('@/lib/cursoGrupos');
      const puede = await estudiantePuedeAccederCurso(session.userId, cursoId);
      if (!puede) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      const [rows] = (await pool.execute(
        'SELECT c.*, u.nombre as creador_nombre FROM cursos c JOIN usuarios u ON c.creado_por_id = u.id WHERE c.id = ?',
        [cursoId]
      )) as any[];
      return NextResponse.json({ curso: rows[0] });
    }

    return NextResponse.json({ curso });
  } catch (error: unknown) {
    console.error('Error al obtener curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const cursoId = parseInt(id, 10);
    const curso = await verificarAcceso(cursoId, session);
    if (!curso) {
      return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.descripcion !== undefined) {
      updates.push('descripcion = ?');
      values.push(body.descripcion);
    }
    if (body.imagen !== undefined) {
      updates.push('imagen = ?');
      values.push(body.imagen || null);
    }
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
      }
      updates.push('nombre = ?');
      values.push(nombre);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    values.push(cursoId);
    await pool.execute(`UPDATE cursos SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = (await pool.execute('SELECT * FROM cursos WHERE id = ?', [cursoId])) as any[];
    return NextResponse.json({ success: true, curso: rows[0] });
  } catch (error: unknown) {
    console.error('Error al actualizar curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
