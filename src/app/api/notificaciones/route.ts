import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [rows] = await pool.execute(
      'SELECT id, titulo, mensaje, leida, created_at FROM notificaciones WHERE usuario_id = ? ORDER BY created_at DESC',
      [session.userId]
    );

    return NextResponse.json({ notificaciones: rows });
  } catch (error: any) {
    console.error('Error al obtener notificaciones:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de notificación requerido' }, { status: 400 });
    }

    await pool.execute(
      'UPDATE notificaciones SET leida = TRUE WHERE id = ? AND usuario_id = ?',
      [id, session.userId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar notificación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
