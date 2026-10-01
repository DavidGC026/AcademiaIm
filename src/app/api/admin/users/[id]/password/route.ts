import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.roleName !== 'administrador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const userId = Number(id);
    const { password } = await request.json();
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Usuario inválido.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener entre 6 y 128 caracteres.' }, { status: 400 });
    }
    const [users] = await pool.execute<RowDataPacket[]>('SELECT id FROM usuarios WHERE id = ?', [userId]);
    if (!users.length) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    await pool.execute('UPDATE usuarios SET password = ? WHERE id = ?', [await bcrypt.hash(password, 10), userId]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar la contraseña.' }, { status: 500 });
  }
}
