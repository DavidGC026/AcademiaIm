import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendLiveClassNotificationEmail } from '@/lib/mailer';
import { maestroPuedeGestionarEvento, maestroTieneGrupo } from '@/lib/grupoMaestros';

// GET: Obtener eventos de calendario
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.roleName === 'estudiante') {
      // 1. Obtener la cohorte/grupo del estudiante
      const [userRows] = await pool.execute(
        'SELECT grupo_cohorte FROM usuarios WHERE id = ?',
        [session.userId]
      ) as any[];

      const grupoCohorte = userRows[0]?.grupo_cohorte || null;
      if (!grupoCohorte) {
        return NextResponse.json({ eventos: [] });
      }

      // 2. Obtener el id del grupo
      const [grupoRows] = await pool.execute(
        'SELECT id FROM grupos_cohortes WHERE nombre = ?',
        [grupoCohorte]
      ) as any[];

      if (grupoRows.length === 0) {
        return NextResponse.json({ eventos: [] });
      }

      const grupoId = grupoRows[0].id;

      // 3. Obtener eventos de este grupo
      const [eventos] = await pool.execute(
        `SELECT e.*, u.nombre as creador_nombre 
         FROM calendario_eventos e
         JOIN usuarios u ON e.creador_id = u.id
         WHERE e.grupo_id = ?
         ORDER BY e.fecha_hora ASC`,
        [grupoId]
      );

      return NextResponse.json({ eventos });
    } else if (session.roleName === 'maestro') {
      // Obtener eventos programados para los grupos creados por este maestro
      const [eventos] = await pool.execute(
        `SELECT e.*, g.nombre as grupo_nombre, u.nombre as creador_nombre
         FROM calendario_eventos e
         JOIN grupos_cohortes g ON e.grupo_id = g.id
         JOIN grupo_maestros gm ON gm.grupo_id = g.id AND gm.maestro_id = ?
         JOIN usuarios u ON e.creador_id = u.id
         ORDER BY e.fecha_hora ASC`,
        [session.userId]
      );

      return NextResponse.json({ eventos });
    } else if (session.roleName === 'administrador') {
      // El administrador puede ver todos los eventos
      const [eventos] = await pool.execute(
        `SELECT e.*, g.nombre as grupo_nombre, u.nombre as creador_nombre
         FROM calendario_eventos e
         JOIN grupos_cohortes g ON e.grupo_id = g.id
         JOIN usuarios u ON e.creador_id = u.id
         ORDER BY e.fecha_hora ASC`
      );

      return NextResponse.json({ eventos });
    }

    return NextResponse.json({ error: 'Rol no soportado' }, { status: 403 });
  } catch (error: any) {
    console.error('Error al obtener eventos de calendario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST: Crear evento de calendario
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { grupo_id, titulo, descripcion, fecha_hora, enlace_clase } = await request.json();

    if (!grupo_id || !titulo || !fecha_hora) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Validar que el grupo pertenece al maestro (si no es admin)
    if (session.roleName === 'maestro') {
      if (!(await maestroTieneGrupo(session.userId, parseInt(String(grupo_id), 10)))) {
        return NextResponse.json({ error: 'El grupo no pertenece a este profesor o no existe' }, { status: 403 });
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO calendario_eventos (grupo_id, creador_id, titulo, descripcion, fecha_hora, enlace_clase)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [grupo_id, session.userId, titulo, descripcion || '', fecha_hora, enlace_clase || null]
    ) as any[];

    // Notificar a los alumnos
    try {
      const [grupoRows] = await pool.execute(
        'SELECT nombre FROM grupos_cohortes WHERE id = ?',
        [grupo_id]
      ) as any[];

      if (grupoRows.length > 0) {
        const grupoNombre = grupoRows[0].nombre;

        // Obtener estudiantes en este grupo
        const [estudiantes] = await pool.execute(
          'SELECT id, nombre, email FROM usuarios WHERE role_id = 3 AND grupo_cohorte = ?',
          [grupoNombre]
        ) as any[];

        const formattedDate = new Date(fecha_hora).toLocaleString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        for (const est of estudiantes) {
          // 1. Notificación interna de plataforma
          await pool.execute(
            `INSERT INTO notificaciones (usuario_id, titulo, mensaje)
             VALUES (?, ?, ?)`,
            [
              est.id,
              'Nueva Clase en Vivo Programada',
              `Tu profesor ha programado la clase "${titulo}" para el día ${formattedDate} hrs.`
            ]
          );

          // 2. Correo electrónico
          try {
            await sendLiveClassNotificationEmail(
              est.email,
              est.nombre,
              titulo,
              fecha_hora,
              enlace_clase || null,
              grupoNombre
            );
          } catch (mailErr) {
            console.error(`Error al notificar por correo a ${est.email}:`, mailErr);
          }
        }
      }
    } catch (notifErr) {
      console.error('Error al generar notificaciones para evento:', notifErr);
    }

    return NextResponse.json({
      success: true,
      evento: {
        id: result.insertId,
        grupo_id,
        creador_id: session.userId,
        titulo,
        descripcion,
        fecha_hora,
        enlace_clase,
      }
    });
  } catch (error: any) {
    console.error('Error al crear evento de calendario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// DELETE: Eliminar evento de calendario
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el id del evento' }, { status: 400 });
    }

    const eventoId = parseInt(id, 10);

    // Validar pertenencia del evento al creador/maestro (si no es admin)
    if (session.roleName === 'maestro') {
      if (!(await maestroPuedeGestionarEvento(session.userId, eventoId))) {
        return NextResponse.json({ error: 'No tienes permiso para eliminar este evento' }, { status: 403 });
      }
    }

    await pool.execute('DELETE FROM calendario_eventos WHERE id = ?', [eventoId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar evento de calendario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
