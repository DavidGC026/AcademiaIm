import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { maestroPuedeGestionarEvento } from '@/lib/grupoMaestros';

// GET: Obtener lista de asistentes para un evento (Solo Maestros y Admins)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.roleName !== 'maestro' && session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eventoIdStr = searchParams.get('evento_id');

    if (!eventoIdStr) {
      return NextResponse.json({ error: 'Falta el evento_id' }, { status: 400 });
    }

    const eventoId = parseInt(eventoIdStr, 10);

    // Si es maestro, verificar que sea el creador del evento o tenga acceso
    if (session.roleName === 'maestro') {
      if (!(await maestroPuedeGestionarEvento(session.userId, eventoId))) {
        return NextResponse.json({ error: 'No tienes permisos para ver la asistencia de este evento' }, { status: 403 });
      }
    }

    // Obtener los asistentes
    const [asistentes] = await pool.execute(
      `SELECT a.id, a.fecha_registro, u.nombre, u.email, u.id_estudiante, u.grupo_cohorte
       FROM asistencias_clases a
       JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.evento_id = ?
       ORDER BY a.fecha_registro ASC`,
      [eventoId]
    );

    return NextResponse.json({ asistentes });
  } catch (error: any) {
    console.error('Error al obtener asistencias:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST: Registrar asistencia (Estudiantes)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { evento_id } = await request.json();

    if (!evento_id) {
      return NextResponse.json({ error: 'Falta el evento_id' }, { status: 400 });
    }

    // Registrar la asistencia (usando INSERT IGNORE o ON DUPLICATE KEY UPDATE)
    await pool.execute(
      `INSERT INTO asistencias_clases (evento_id, usuario_id) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE fecha_registro = CURRENT_TIMESTAMP`,
      [evento_id, session.userId]
    );

    return NextResponse.json({ success: true, message: 'Asistencia registrada con éxito' });
  } catch (error: any) {
    console.error('Error al registrar asistencia:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
