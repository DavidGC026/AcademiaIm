import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursoId = searchParams.get('curso_id');

    if (!cursoId) {
      return NextResponse.json({ error: 'Falta curso_id' }, { status: 400 });
    }

    const [rows] = await pool.execute(
      `SELECT f.*, u.nombre as usuario_nombre, r.nombre as rol_nombre
       FROM foro_posts f
       JOIN usuarios u ON f.usuario_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE f.curso_id = ?
       ORDER BY f.created_at ASC`,
      [cursoId]
    );

    return NextResponse.json({ posts: rows });
  } catch (error: unknown) {
    console.error('Error al obtener posts del foro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { curso_id, contenido, post_padre_id } = await request.json();

    if (!curso_id || !contenido) {
      return NextResponse.json({ error: 'Contenido y curso_id son obligatorios' }, { status: 400 });
    }

    const [result] = await pool.execute(
      `INSERT INTO foro_posts (curso_id, usuario_id, post_padre_id, contenido) 
       VALUES (?, ?, ?, ?)`,
      [curso_id, session.userId, post_padre_id || null, contenido]
    ) as any[];

    return NextResponse.json({
      success: true,
      post: {
        id: result.insertId,
        curso_id,
        usuario_id: session.userId,
        usuario_nombre: session.nombre,
        rol_nombre: session.roleName,
        post_padre_id: post_padre_id || null,
        contenido,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error al crear post en foro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
