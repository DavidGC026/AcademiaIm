import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { esStaffBiblioteca, tieneAccesoBibliotecaPrioritario, librosComprados } from '@/lib/bibliotecaAcceso';

export async function GET() {
  try {
    const session = await getSession();
    const [rows] = await pool.execute('SELECT * FROM biblioteca_libros ORDER BY created_at DESC') as any[];
    const acceso_prioritario = session
      ? await tieneAccesoBibliotecaPrioritario(session.userId, session.roleName)
      : false;
    const comprados = session ? await librosComprados(session.userId) : [];
    const libros = rows.map((l: any) => ({
      ...l,
      comprado: comprados.includes(l.id),
      puede_leer: acceso_prioritario || comprados.includes(l.id),
    }));
    const acceso_staff = esStaffBiblioteca(session?.roleName);
    return NextResponse.json({ libros, acceso_prioritario, acceso_staff, comprados });
  } catch (error: any) {
    console.error('Error al obtener libros:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { titulo, autor, descripcion, precio, imagen, paginas, tienda_url, archivo_url, archivo_nombre } = await request.json();

    if (!titulo || !autor || precio === undefined) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const [result] = await pool.execute(
      `INSERT INTO biblioteca_libros (titulo, autor, descripcion, precio, imagen, paginas, tienda_url, archivo_url, archivo_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titulo,
        autor,
        descripcion || '',
        precio,
        imagen || '/libro_concreto.png',
        paginas || 0,
        tienda_url || null,
        archivo_url || null,
        archivo_nombre || null,
      ]
    ) as any[];

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    console.error('Error al crear libro:', error);
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
      return NextResponse.json({ error: 'ID de libro requerido' }, { status: 400 });
    }

    const { titulo, autor, descripcion, precio, imagen, paginas, tienda_url, archivo_url, archivo_nombre } = await request.json();

    if (!titulo || !autor || precio === undefined) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE biblioteca_libros 
       SET titulo = ?, autor = ?, descripcion = ?, precio = ?, imagen = ?, paginas = ?, tienda_url = ?, archivo_url = ?, archivo_nombre = ?
       WHERE id = ?`,
      [
        titulo,
        autor,
        descripcion || '',
        precio,
        imagen || '/libro_concreto.png',
        paginas || 0,
        tienda_url || null,
        archivo_url || null,
        archivo_nombre || null,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar libro:', error);
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
      return NextResponse.json({ error: 'ID de libro requerido' }, { status: 400 });
    }

    const { archivo_url, archivo_nombre } = await request.json();
    if (!archivo_url) {
      return NextResponse.json({ error: 'Falta archivo_url' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE biblioteca_libros SET archivo_url = ?, archivo_nombre = ? WHERE id = ?`,
      [archivo_url, archivo_nombre || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al vincular PDF del libro:', error);
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
      return NextResponse.json({ error: 'ID de libro requerido' }, { status: 400 });
    }

    await pool.execute('DELETE FROM biblioteca_libros WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar libro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
