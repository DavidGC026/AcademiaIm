import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let rows;
    if (session.roleName === 'administrador') {
      [rows] = await pool.execute(
        `SELECT e.*, u.nombre as estudiante_nombre, c.titulo as clase_titulo, cur.nombre as curso_nombre
         FROM entregas_tareas e
         JOIN usuarios u ON e.usuario_id = u.id
         JOIN clases c ON e.clase_id = c.id
         JOIN cursos cur ON c.curso_id = cur.id
         ORDER BY e.fecha_entrega DESC`
      );
    } else {
      [rows] = await pool.execute(
        `SELECT e.*, u.nombre as estudiante_nombre, c.titulo as clase_titulo, cur.nombre as curso_nombre
         FROM entregas_tareas e
         JOIN usuarios u ON e.usuario_id = u.id
         JOIN clases c ON e.clase_id = c.id
         JOIN cursos cur ON c.curso_id = cur.id
         WHERE cur.creado_por_id = ?
         ORDER BY e.fecha_entrega DESC`,
        [session.userId]
      );
    }

    return NextResponse.json({ submissions: rows });
  } catch (error: unknown) {
    console.error('Error al obtener entregas:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, calificacion, comentarios, permite_reenvio } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta el id de la entrega' }, { status: 400 });
    }

    if (permite_reenvio === true) {
      if (session.roleName === 'maestro') {
        const [rows] = (await pool.execute(
          `SELECT e.id FROM entregas_tareas e
           JOIN clases c ON e.clase_id = c.id
           JOIN cursos cur ON c.curso_id = cur.id
           WHERE e.id = ? AND cur.creado_por_id = ?`,
          [id, session.userId]
        )) as any[];
        if (rows.length === 0) {
          return NextResponse.json({ error: 'Entrega no encontrada o sin permiso' }, { status: 403 });
        }
      }

      await pool.execute(
        `UPDATE entregas_tareas SET permite_reenvio = 1 WHERE id = ?`,
        [id]
      );
      return NextResponse.json({ success: true, message: 'Reenvío habilitado para el alumno' });
    }

    if (calificacion === undefined) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE entregas_tareas SET calificacion = ?, comentarios = ?, estado = 'calificado', permite_reenvio = 0 WHERE id = ?`,
      [calificacion, comentarios || '', id]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al calificar tarea:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
