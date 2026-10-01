import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

async function verificarAccesoCurso(
  cursoId: number,
  session: { userId: number; roleName: string }
) {
  if (session.roleName === 'administrador') {
    const [rows] = (await pool.execute(
      'SELECT id, nombre, codigo, estado, creado_por_id FROM cursos WHERE id = ?',
      [cursoId]
    )) as any[];
    return rows[0] ?? null;
  }
  if (session.roleName === 'maestro') {
    const [rows] = (await pool.execute(
      'SELECT id, nombre, codigo, estado, creado_por_id FROM cursos WHERE id = ? AND creado_por_id = ?',
      [cursoId, session.userId]
    )) as any[];
    return rows[0] ?? null;
  }
  return null;
}

// GET — Lista de estudiantes inscritos en el curso
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const cursoId = parseInt(id, 10);
    if (Number.isNaN(cursoId)) {
      return NextResponse.json({ error: 'ID de curso inválido' }, { status: 400 });
    }

    const curso = await verificarAccesoCurso(cursoId, session);
    if (!curso) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const [estudiantes] = await pool.execute(
      `SELECT u.id, u.nombre, u.email, u.id_estudiante, ce.created_at as inscrito_en
       FROM curso_estudiantes ce
       JOIN usuarios u ON u.id = ce.estudiante_id
       WHERE ce.curso_id = ?
       ORDER BY u.nombre ASC`,
      [cursoId]
    );

    return NextResponse.json({ curso, estudiantes });
  } catch (error: unknown) {
    console.error('Error al listar estudiantes del curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST — Inscribir estudiante { estudiante_id }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const cursoId = parseInt(id, 10);
    if (Number.isNaN(cursoId)) {
      return NextResponse.json({ error: 'ID de curso inválido' }, { status: 400 });
    }

    const curso = await verificarAccesoCurso(cursoId, session);
    if (!curso) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    if (curso.estado !== 'aprobado') {
      return NextResponse.json(
        { error: 'Solo puedes inscribir alumnos en materias ya aprobadas' },
        { status: 400 }
      );
    }

    const { estudiante_id } = await request.json();
    const estudianteId = parseInt(String(estudiante_id), 10);
    if (!estudianteId || Number.isNaN(estudianteId)) {
      return NextResponse.json({ error: 'ID de estudiante inválido' }, { status: 400 });
    }

    const [estRows] = (await pool.execute(
      `SELECT u.id, u.nombre, u.email FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND r.nombre = 'estudiante'`,
      [estudianteId]
    )) as any[];

    if (estRows.length === 0) {
      return NextResponse.json({ error: 'El usuario no es un estudiante' }, { status: 400 });
    }

    const [existing] = (await pool.execute(
      'SELECT id FROM curso_estudiantes WHERE curso_id = ? AND estudiante_id = ?',
      [cursoId, estudianteId]
    )) as any[];

    if (existing.length > 0) {
      return NextResponse.json({ error: 'El alumno ya está inscrito en esta materia' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO curso_estudiantes (curso_id, estudiante_id, inscrito_por_id) VALUES (?, ?, ?)',
      [cursoId, estudianteId, session.userId]
    );

    return NextResponse.json({ success: true, estudiante: estRows[0] });
  } catch (error: unknown) {
    console.error('Error al inscribir estudiante:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// DELETE — Quitar estudiante ?estudiante_id=
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const cursoId = parseInt(id, 10);
    if (Number.isNaN(cursoId)) {
      return NextResponse.json({ error: 'ID de curso inválido' }, { status: 400 });
    }

    const curso = await verificarAccesoCurso(cursoId, session);
    if (!curso) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const estudianteId = parseInt(searchParams.get('estudiante_id') || '', 10);
    if (!estudianteId || Number.isNaN(estudianteId)) {
      return NextResponse.json({ error: 'estudiante_id requerido' }, { status: 400 });
    }

    await pool.execute(
      'DELETE FROM curso_estudiantes WHERE curso_id = ? AND estudiante_id = ?',
      [cursoId, estudianteId]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al quitar estudiante del curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
