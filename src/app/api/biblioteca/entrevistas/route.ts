import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const [rows] = await pool.execute('SELECT * FROM biblioteca_entrevistas ORDER BY created_at DESC');
    return NextResponse.json({ entrevistas: rows });
  } catch (error: any) {
    console.error('Error al obtener entrevistas:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { titulo, experto, cargo, video_url, duracion, descripcion } = await request.json();

    if (!titulo || !experto || !cargo || !video_url) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const [result] = await pool.execute(
      `INSERT INTO biblioteca_entrevistas (titulo, experto, cargo, video_url, duracion, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        titulo,
        experto,
        cargo,
        video_url,
        duracion || '10:00 min',
        descripcion || ''
      ]
    ) as any[];

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    console.error('Error al crear entrevista:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de entrevista requerido' }, { status: 400 });
    }

    const { titulo, experto, cargo, video_url, duracion, descripcion } = await request.json();

    if (!titulo || !experto || !cargo || !video_url) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE biblioteca_entrevistas 
       SET titulo = ?, experto = ?, cargo = ?, video_url = ?, duracion = ?, descripcion = ?
       WHERE id = ?`,
      [
        titulo,
        experto,
        cargo,
        video_url,
        duracion || '10:00 min',
        descripcion || '',
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar entrevista:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de entrevista requerido' }, { status: 400 });
    }

    await pool.execute('DELETE FROM biblioteca_entrevistas WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar entrevista:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
