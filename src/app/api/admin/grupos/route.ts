import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { agregarMaestroAGrupo, listarMaestrosDeGrupo } from '@/lib/grupoMaestros';

// GET /api/admin/grupos - Listar todos los grupos y maestros disponibles
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [grupos] = (await pool.execute(
      `SELECT g.id, g.nombre, g.codigo, g.creador_id, g.created_at,
              (SELECT COUNT(*) FROM usuarios us WHERE us.grupo_cohorte = g.nombre) as total_alumnos,
              (SELECT COUNT(*) FROM solicitudes_acceso_grupo s WHERE s.grupo_id = g.id AND s.estado = 'pendiente') as solicitudes_pendientes
       FROM grupos_cohortes g
       ORDER BY g.created_at DESC`
    )) as any[];

    const [asignaciones] = (await pool.execute(
      `SELECT gm.grupo_id, u.id, u.nombre, u.email
       FROM grupo_maestros gm
       JOIN usuarios u ON u.id = gm.maestro_id
       ORDER BY u.nombre ASC`
    )) as any[];

    const maestrosPorGrupo: Record<number, { id: number; nombre: string; email: string }[]> = {};
    for (const row of asignaciones) {
      if (!maestrosPorGrupo[row.grupo_id]) maestrosPorGrupo[row.grupo_id] = [];
      maestrosPorGrupo[row.grupo_id].push({ id: row.id, nombre: row.nombre, email: row.email });
    }

    const gruposConMaestros = (grupos as { id: number }[]).map((g) => ({
      ...g,
      maestros: maestrosPorGrupo[g.id] || [],
    }));

    const [maestros] = await pool.execute(
      `SELECT u.id, u.nombre, u.email
       FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE r.nombre = 'maestro'
       ORDER BY u.nombre ASC`
    );

    return NextResponse.json({ grupos: gruposConMaestros, maestros });
  } catch (error: unknown) {
    console.error('Error al obtener grupos (admin):', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PATCH { grupo_id, accion: 'agregar'|'quitar', maestro_id }
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const grupoId = parseInt(String(body.grupo_id), 10);
    const maestroId = parseInt(String(body.maestro_id), 10);
    const accion = body.accion as string;

    if (!grupoId || Number.isNaN(grupoId) || !maestroId || Number.isNaN(maestroId)) {
      return NextResponse.json({ error: 'grupo_id y maestro_id requeridos' }, { status: 400 });
    }

    if (accion !== 'agregar' && accion !== 'quitar') {
      return NextResponse.json({ error: 'accion debe ser agregar o quitar' }, { status: 400 });
    }

    const [grupoRows] = (await pool.execute(
      'SELECT id FROM grupos_cohortes WHERE id = ?',
      [grupoId]
    )) as any[];

    if (grupoRows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    const [maestroRows] = (await pool.execute(
      `SELECT u.id FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND r.nombre = 'maestro'`,
      [maestroId]
    )) as any[];

    if (maestroRows.length === 0) {
      return NextResponse.json({ error: 'El usuario seleccionado no es un maestro' }, { status: 400 });
    }

    if (accion === 'agregar') {
      await agregarMaestroAGrupo(grupoId, maestroId);
    } else {
      await pool.execute(
        'DELETE FROM grupo_maestros WHERE grupo_id = ? AND maestro_id = ?',
        [grupoId, maestroId]
      );
    }

    const maestros = await listarMaestrosDeGrupo(grupoId);

    return NextResponse.json({
      success: true,
      grupo: { id: grupoId, maestros },
    });
  } catch (error: unknown) {
    console.error('Error al actualizar asignación de grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
