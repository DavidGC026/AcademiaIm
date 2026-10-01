import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateCourseCode } from '@/lib/codigos';

// Obtener Cursos
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let rows;
    if (session.roleName === 'administrador') {
      // Admin ve todos
      [rows] = await pool.execute(
        `SELECT c.*, u.nombre as creador_nombre 
         FROM cursos c
         JOIN usuarios u ON c.creado_por_id = u.id
         ORDER BY c.created_at DESC`
      );
    } else if (session.roleName === 'maestro') {
      [rows] = await pool.execute(
        `SELECT c.*, u.nombre as creador_nombre,
                (SELECT COUNT(*) FROM curso_grupos cg WHERE cg.curso_id = c.id) as grupos_asignados
         FROM cursos c
         JOIN usuarios u ON c.creado_por_id = u.id
         WHERE c.creado_por_id = ?
         ORDER BY c.created_at DESC`,
        [session.userId]
      );
    } else {
      // Estudiante: cursos por inscripción directa o por grupo/cohorte
      [rows] = await pool.execute(
        `SELECT DISTINCT c.*, u.nombre as creador_nombre
         FROM cursos c
         JOIN usuarios u ON c.creado_por_id = u.id
         WHERE c.estado = 'aprobado'
           AND (
             c.id IN (SELECT ce.curso_id FROM curso_estudiantes ce WHERE ce.estudiante_id = ?)
             OR c.id IN (
               SELECT cg.curso_id FROM curso_grupos cg
               INNER JOIN grupos_cohortes g ON g.id = cg.grupo_id
               INNER JOIN usuarios est ON est.grupo_cohorte = g.nombre AND est.id = ?
             )
           )
         ORDER BY c.created_at DESC`,
        [session.userId, session.userId]
      );
    }

    return NextResponse.json({ courses: rows });
  } catch (error: any) {
    console.error('Error al obtener cursos:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// Crear Curso (Maestro propone, inicia en 'pendiente')
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { nombre, descripcion, imagen } = await request.json();

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const estado = session.roleName === 'administrador' ? 'aprobado' : 'pendiente';
    const codigo = await generateCourseCode();

    const [result] = await pool.execute(
      `INSERT INTO cursos (nombre, descripcion, imagen, creado_por_id, estado, codigo) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, descripcion || '', imagen || null, session.userId, estado, codigo]
    ) as any[];

    return NextResponse.json({
      success: true,
      course: {
        id: result.insertId,
        nombre,
        descripcion,
        imagen: imagen || null,
        estado,
        codigo,
      },
    });
  } catch (error: any) {
    console.error('Error al crear curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
