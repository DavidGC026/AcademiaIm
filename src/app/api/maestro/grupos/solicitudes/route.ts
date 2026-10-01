import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { maestroTieneGrupo } from '@/lib/grupoMaestros';

// GET /api/maestro/grupos/solicitudes - Listar solicitudes pendientes de grupos del maestro
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'maestro') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [rows] = await pool.execute(
      `SELECT s.id as solicitud_id, s.estado, s.created_at,
              u.id as estudiante_id, u.nombre as estudiante_nombre, u.email as estudiante_email, u.id_estudiante,
              g.id as grupo_id, g.nombre as grupo_nombre, g.codigo as grupo_codigo
       FROM solicitudes_acceso_grupo s
       JOIN usuarios u ON s.estudiante_id = u.id
       JOIN grupos_cohortes g ON s.grupo_id = g.id
       JOIN grupo_maestros gm ON gm.grupo_id = g.id AND gm.maestro_id = ?
       WHERE s.estado = 'pendiente'
       ORDER BY s.created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ solicitudes: rows });
  } catch (error: any) {
    console.error('Error al obtener solicitudes:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PUT /api/maestro/grupos/solicitudes - Aprobar o rechazar solicitud
// Query params: ?id=SOLICITUD_ID&accion=aprobar|rechazar
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'maestro') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accion = searchParams.get('accion');

    if (!id || !accion) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Obtener datos de la solicitud y verificar propiedad del maestro
    const [solicitudes] = await pool.execute(
      `SELECT s.*, g.nombre as grupo_nombre, g.id as grupo_id_ref
       FROM solicitudes_acceso_grupo s
       JOIN grupos_cohortes g ON s.grupo_id = g.id
       WHERE s.id = ?`,
      [id]
    ) as any[];

    if (solicitudes.length === 0) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const solicitud = solicitudes[0];

    if (!(await maestroTieneGrupo(session.userId, solicitud.grupo_id))) {
      return NextResponse.json({ error: 'No autorizado para gestionar este grupo' }, { status: 403 });
    }

    const nuevoEstado = accion === 'aprobar' ? 'aprobado' : 'rechazado';

    if (nuevoEstado === 'aprobado') {
      // 1. Marcar solicitud como aprobada
      await pool.execute(
        `UPDATE solicitudes_acceso_grupo SET estado = 'aprobado' WHERE id = ?`,
        [id]
      );

      // 2. Asignar al alumno la cohorte
      await pool.execute(
        `UPDATE usuarios SET grupo_cohorte = ? WHERE id = ?`,
        [solicitud.grupo_nombre, solicitud.estudiante_id]
      );

      // 3. Crear notificación para el alumno
      await pool.execute(
        `INSERT INTO notificaciones (usuario_id, titulo, mensaje) 
         VALUES (?, ?, ?)`,
        [
          solicitud.estudiante_id,
          'Acceso a Grupo Aprobado',
          `El maestro ha aprobado tu solicitud de acceso al grupo: "${solicitud.grupo_nombre}". Ya estás inscrito.`
        ]
      );
    } else {
      // Marcar como rechazada
      await pool.execute(
        `UPDATE solicitudes_acceso_grupo SET estado = 'rechazado' WHERE id = ?`,
        [id]
      );

      // Crear notificación para el alumno
      await pool.execute(
        `INSERT INTO notificaciones (usuario_id, titulo, mensaje) 
         VALUES (?, ?, ?)`,
        [
          solicitud.estudiante_id,
          'Acceso a Grupo Rechazado',
          `Tu solicitud de acceso al grupo "${solicitud.grupo_nombre}" fue rechazada por el docente.`
        ]
      );
    }

    return NextResponse.json({ success: true, estado: nuevoEstado });
  } catch (error: any) {
    console.error('Error al resolver solicitud de grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
