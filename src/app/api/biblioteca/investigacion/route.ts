import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const [rows] = await pool.execute(
      'SELECT * FROM biblioteca_investigacion ORDER BY created_at DESC'
    );
    return NextResponse.json({ investigacion: rows, acceso_gratuito: true });
  } catch (error: unknown) {
    console.error('Error al obtener material de investigación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { titulo, autor, descripcion, imagen, archivo_url, archivo_nombre } = await request.json();
    if (!titulo?.trim() || !autor?.trim()) {
      return NextResponse.json({ error: 'Título y autor son obligatorios' }, { status: 400 });
    }

    const [result] = (await pool.execute(
      `INSERT INTO biblioteca_investigacion (titulo, autor, descripcion, imagen, archivo_url, archivo_nombre)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(titulo).trim(),
        String(autor).trim(),
        descripcion?.trim() || '',
        imagen || '/libro_concreto.png',
        archivo_url || null,
        archivo_nombre || null,
      ]
    )) as any[];

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: unknown) {
    console.error('Error al crear material de investigación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { titulo, autor, descripcion, imagen, archivo_url, archivo_nombre } = await request.json();
    if (!titulo?.trim() || !autor?.trim()) {
      return NextResponse.json({ error: 'Título y autor son obligatorios' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE biblioteca_investigacion
       SET titulo = ?, autor = ?, descripcion = ?, imagen = ?, archivo_url = ?, archivo_nombre = ?
       WHERE id = ?`,
      [
        String(titulo).trim(),
        String(autor).trim(),
        descripcion?.trim() || '',
        imagen || '/libro_concreto.png',
        archivo_url || null,
        archivo_nombre || null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al actualizar material de investigación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { archivo_url, archivo_nombre } = await request.json();
    if (!archivo_url) return NextResponse.json({ error: 'Falta archivo_url' }, { status: 400 });

    await pool.execute(
      'UPDATE biblioteca_investigacion SET archivo_url = ?, archivo_nombre = ? WHERE id = ?',
      [archivo_url, archivo_nombre || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al vincular PDF de investigación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await pool.execute('DELETE FROM biblioteca_investigacion WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al eliminar material de investigación:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
