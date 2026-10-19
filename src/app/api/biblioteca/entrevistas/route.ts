import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.execute('SELECT * FROM biblioteca_entrevistas ORDER BY created_at DESC, id ASC');
    return NextResponse.json({ entrevistas: rows });
  } catch (error) {
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

    if (
      typeof titulo !== 'string' || !titulo.trim() ||
      typeof experto !== 'string' || !experto.trim() ||
      typeof video_url !== 'string' || !video_url.trim()
    ) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO biblioteca_entrevistas (titulo, experto, cargo, video_url, duracion, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        titulo.trim(),
        experto.trim(),
        typeof cargo === 'string' ? cargo.trim() : '',
        video_url.trim(),
        typeof duracion === 'string' ? duracion.trim() : '',
        typeof descripcion === 'string' ? descripcion : ''
      ]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error) {
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

    if (
      typeof titulo !== 'string' || !titulo.trim() ||
      typeof experto !== 'string' || !experto.trim() ||
      typeof video_url !== 'string' || !video_url.trim()
    ) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE biblioteca_entrevistas 
       SET titulo = ?, experto = ?, cargo = ?, video_url = ?, duracion = ?, descripcion = ?
       WHERE id = ?`,
      [
        titulo.trim(),
        experto.trim(),
        typeof cargo === 'string' ? cargo.trim() : '',
        video_url.trim(),
        typeof duracion === 'string' ? duracion.trim() : '',
        typeof descripcion === 'string' ? descripcion : '',
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
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
  } catch (error) {
    console.error('Error al eliminar entrevista:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
