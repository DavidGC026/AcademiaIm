import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/grupos/miembros?grupo_id=
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const grupoId = parseInt(searchParams.get('grupo_id') || '', 10);
    if (!grupoId || Number.isNaN(grupoId)) {
      return NextResponse.json({ error: 'grupo_id requerido' }, { status: 400 });
    }

    const [grupoRows] = (await pool.execute(
      'SELECT id, nombre FROM grupos_cohortes WHERE id = ?',
      [grupoId]
    )) as any[];

    if (grupoRows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    const grupo = grupoRows[0];

    const [miembros] = await pool.execute(
      `SELECT u.id, u.nombre, u.email, u.id_estudiante
       FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE r.nombre = 'estudiante' AND u.grupo_cohorte = ?
       ORDER BY u.nombre ASC`,
      [grupo.nombre]
    );

    return NextResponse.json({ grupo, miembros });
  } catch (error: unknown) {
    console.error('Error al listar miembros del grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST { grupo_id, estudiante_id } — Asignar alumno al grupo
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { grupo_id, estudiante_id } = await request.json();
    const grupoId = parseInt(String(grupo_id), 10);
    const estudianteId = parseInt(String(estudiante_id), 10);

    if (!grupoId || !estudianteId || Number.isNaN(grupoId) || Number.isNaN(estudianteId)) {
      return NextResponse.json({ error: 'grupo_id y estudiante_id requeridos' }, { status: 400 });
    }

    const [grupoRows] = (await pool.execute(
      'SELECT id, nombre FROM grupos_cohortes WHERE id = ?',
      [grupoId]
    )) as any[];

    if (grupoRows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    const grupo = grupoRows[0];

    const [estRows] = (await pool.execute(
      `SELECT u.id, u.nombre FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND r.nombre = 'estudiante'`,
      [estudianteId]
    )) as any[];

    if (estRows.length === 0) {
      return NextResponse.json({ error: 'El usuario no es un estudiante' }, { status: 400 });
    }

    await pool.execute('UPDATE usuarios SET grupo_cohorte = ? WHERE id = ?', [
      grupo.nombre,
      estudianteId,
    ]);

    // ponytail: marcar solicitud como aprobada si existía
    await pool.execute(
      `INSERT INTO solicitudes_acceso_grupo (estudiante_id, grupo_id, estado)
       VALUES (?, ?, 'aprobado')
       ON DUPLICATE KEY UPDATE estado = 'aprobado'`,
      [estudianteId, grupoId]
    );

    return NextResponse.json({ success: true, estudiante: estRows[0] });
  } catch (error: unknown) {
    console.error('Error al agregar miembro al grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// DELETE ?grupo_id=&estudiante_id=
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const grupoId = parseInt(searchParams.get('grupo_id') || '', 10);
    const estudianteId = parseInt(searchParams.get('estudiante_id') || '', 10);

    if (!grupoId || !estudianteId || Number.isNaN(grupoId) || Number.isNaN(estudianteId)) {
      return NextResponse.json({ error: 'grupo_id y estudiante_id requeridos' }, { status: 400 });
    }

    const [grupoRows] = (await pool.execute(
      'SELECT nombre FROM grupos_cohortes WHERE id = ?',
      [grupoId]
    )) as any[];

    if (grupoRows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    await pool.execute(
      'UPDATE usuarios SET grupo_cohorte = NULL WHERE id = ? AND grupo_cohorte = ?',
      [estudianteId, grupoRows[0].nombre]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al quitar miembro del grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
