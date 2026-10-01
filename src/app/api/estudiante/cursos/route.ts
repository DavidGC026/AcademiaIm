import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/estudiante/cursos — Inscribirse a una materia con código MAT-XXXX
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { codigo } = await request.json();
    if (!codigo) {
      return NextResponse.json({ error: 'Código de materia requerido' }, { status: 400 });
    }

    const cleanCodigo = codigo.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    const [cursos] = (await pool.execute(
      `SELECT id, nombre, codigo, estado FROM cursos WHERE codigo = ?`,
      [cleanCodigo]
    )) as any[];

    if (cursos.length === 0) {
      return NextResponse.json({ error: 'El código de materia no existe o es inválido' }, { status: 404 });
    }

    const curso = cursos[0];

    if (curso.estado !== 'aprobado') {
      return NextResponse.json(
        { error: 'Esta materia aún no está disponible para inscripción' },
        { status: 400 }
      );
    }

    const [existing] = (await pool.execute(
      'SELECT id FROM curso_estudiantes WHERE curso_id = ? AND estudiante_id = ?',
      [curso.id, session.userId]
    )) as any[];

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ya estás inscrito en esta materia' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO curso_estudiantes (curso_id, estudiante_id, inscrito_por_id) VALUES (?, ?, ?)',
      [curso.id, session.userId, session.userId]
    );

    return NextResponse.json({
      success: true,
      mensaje: `Te inscribiste en "${curso.nombre}"`,
      curso: { id: curso.id, nombre: curso.nombre, codigo: curso.codigo },
    });
  } catch (error: unknown) {
    console.error('Error al inscribirse a materia:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
