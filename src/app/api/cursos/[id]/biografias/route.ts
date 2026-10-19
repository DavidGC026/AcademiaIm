import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { estudiantePuedeAccederCurso } from '@/lib/cursoGrupos';
import { cleanText, cleanTextOrNull } from '@/lib/sanitize';

async function puedeEditarCurso(cursoId: number, session: { userId: number; roleName: string }) {
  if (session.roleName === 'administrador') return true;
  if (session.roleName !== 'maestro') return false;
  const [rows] = (await pool.execute(
    'SELECT id FROM cursos WHERE id = ? AND creado_por_id = ?',
    [cursoId, session.userId]
  )) as any[];
  return rows.length > 0;
}

async function puedeVerCurso(cursoId: number, session: { userId: number; roleName: string }) {
  if (session.roleName === 'administrador') return true;
  if (session.roleName === 'maestro') return puedeEditarCurso(cursoId, session);
  if (session.roleName === 'estudiante') {
    return estudiantePuedeAccederCurso(session.userId, cursoId);
  }
  return false;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const cursoId = parseInt((await params).id, 10);
    if (!cursoId || Number.isNaN(cursoId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    if (!(await puedeVerCurso(cursoId, session))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const [rows] = await pool.execute(
      `SELECT id, curso_id, nombre, cargo, foto_url, biografia, orden, created_at
       FROM curso_biografias WHERE curso_id = ? ORDER BY orden ASC, id ASC`,
      [cursoId]
    );

    return NextResponse.json({ biografias: rows });
  } catch (error: unknown) {
    console.error('Error al listar biografías:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const cursoId = parseInt((await params).id, 10);
    if (!(await puedeEditarCurso(cursoId, session))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const nombreVal = cleanText(body.nombre, 150);
    const biografiaVal = cleanText(body.biografia, 5000);
    if (!nombreVal || !biografiaVal) {
      return NextResponse.json({ error: 'Nombre y biografía son obligatorios' }, { status: 400 });
    }

    const [result] = (await pool.execute(
      `INSERT INTO curso_biografias (curso_id, nombre, cargo, foto_url, biografia, orden)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cursoId,
        nombreVal,
        cleanTextOrNull(body.cargo, 150),
        cleanTextOrNull(body.foto_url, 2000),
        biografiaVal,
        Number(body.orden) || 0,
      ]
    )) as any[];

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: unknown) {
    console.error('Error al crear biografía:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const cursoId = parseInt((await params).id, 10);
    if (!(await puedeEditarCurso(cursoId, session))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const bioId = new URL(request.url).searchParams.get('bio_id');
    if (!bioId) return NextResponse.json({ error: 'bio_id requerido' }, { status: 400 });

    const body = await request.json();
    const nombreVal = cleanText(body.nombre, 150);
    const biografiaVal = cleanText(body.biografia, 5000);
    if (!nombreVal || !biografiaVal) {
      return NextResponse.json({ error: 'Nombre y biografía son obligatorios' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE curso_biografias
       SET nombre = ?, cargo = ?, foto_url = ?, biografia = ?, orden = ?
       WHERE id = ? AND curso_id = ?`,
      [
        nombreVal,
        cleanTextOrNull(body.cargo, 150),
        cleanTextOrNull(body.foto_url, 2000),
        biografiaVal,
        Number(body.orden) || 0,
        bioId,
        cursoId,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al actualizar biografía:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const cursoId = parseInt((await params).id, 10);
    if (!(await puedeEditarCurso(cursoId, session))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const bioId = new URL(request.url).searchParams.get('bio_id');
    if (!bioId) return NextResponse.json({ error: 'bio_id requerido' }, { status: 400 });

    await pool.execute('DELETE FROM curso_biografias WHERE id = ? AND curso_id = ?', [bioId, cursoId]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al eliminar biografía:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
