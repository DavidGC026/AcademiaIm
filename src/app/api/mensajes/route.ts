import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener todos los usuarios con rol de maestro (role_id = 2)
    const [rows] = await pool.execute(
      'SELECT id, nombre, email FROM usuarios WHERE role_id = 2 ORDER BY nombre ASC'
    );

    return NextResponse.json({ maestros: rows });
  } catch (error: any) {
    console.error('Error al obtener maestros:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { maestro_id, asunto, mensaje } = await request.json();

    if (!maestro_id || !asunto || !mensaje) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO mensajes_maestros (estudiante_id, maestro_id, asunto, mensaje) VALUES (?, ?, ?, ?)',
      [session.userId, maestro_id, asunto, mensaje]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al enviar mensaje al maestro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
