import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { estado } = await request.json();

    if (!['aprobado', 'pendiente', 'rechazado'].includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE cursos SET estado = ? WHERE id = ?`,
      [estado, id]
    );

    return NextResponse.json({ success: true, estado });
  } catch (error: any) {
    console.error('Error al actualizar estado del curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
