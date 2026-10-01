import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const [rows] = await pool.execute('SELECT * FROM biblioteca_revistas ORDER BY created_at DESC');
    return NextResponse.json({ revistas: rows });
  } catch (error: any) {
    console.error('Error al obtener revistas:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { edicion, fecha, imagen, link_descarga, descripcion, archivo_url, archivo_nombre, revista_del_mes, mes_destacado } = await request.json();

    if (!edicion || !fecha || !link_descarga) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Si se marca como revista del mes, limpiar las anteriores
    if (revista_del_mes === 1) {
      await pool.execute('UPDATE biblioteca_revistas SET revista_del_mes = 0');
    }

    const [result] = await pool.execute(
      `INSERT INTO biblioteca_revistas (edicion, fecha, imagen, link_descarga, descripcion, archivo_url, archivo_nombre, revista_del_mes, mes_destacado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        edicion,
        fecha,
        imagen || '/revista_cover.png',
        link_descarga,
        descripcion || '',
        archivo_url || null,
        archivo_nombre || null,
        revista_del_mes || 0,
        mes_destacado || null
      ]
    ) as any[];

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    console.error('Error al crear revista:', error);
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
      return NextResponse.json({ error: 'ID de revista requerido' }, { status: 400 });
    }

    const { edicion, fecha, imagen, link_descarga, descripcion, archivo_url, archivo_nombre, revista_del_mes, mes_destacado } = await request.json();

    if (!edicion || !fecha || !link_descarga) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Si se marca como revista del mes, limpiar las anteriores
    if (revista_del_mes === 1) {
      await pool.execute('UPDATE biblioteca_revistas SET revista_del_mes = 0');
    }

    await pool.execute(
      `UPDATE biblioteca_revistas 
       SET edicion = ?, fecha = ?, imagen = ?, link_descarga = ?, descripcion = ?, archivo_url = ?, archivo_nombre = ?, revista_del_mes = ?, mes_destacado = ?
       WHERE id = ?`,
      [
        edicion,
        fecha,
        imagen || '/revista_cover.png',
        link_descarga,
        descripcion || '',
        archivo_url || null,
        archivo_nombre || null,
        revista_del_mes || 0,
        mes_destacado || null,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar revista:', error);
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
    if (!id) {
      return NextResponse.json({ error: 'ID de revista requerido' }, { status: 400 });
    }

    const { archivo_url, archivo_nombre } = await request.json();
    if (!archivo_url) {
      return NextResponse.json({ error: 'Falta archivo_url' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE biblioteca_revistas SET archivo_url = ?, archivo_nombre = ? WHERE id = ?`,
      [archivo_url, archivo_nombre || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al vincular PDF de revista:', error);
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
      return NextResponse.json({ error: 'ID de revista requerido' }, { status: 400 });
    }

    await pool.execute('DELETE FROM biblioteca_revistas WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar revista:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
