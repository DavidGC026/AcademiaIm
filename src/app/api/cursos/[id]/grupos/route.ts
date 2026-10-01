import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

async function verificarAccesoCurso(cursoId: number, session: { userId: number; roleName: string }, connection?: PoolConnection) {
  const isAdmin = session.roleName === 'administrador';
  const [rows] = await (connection ?? pool).execute<RowDataPacket[]>(
    `SELECT id, nombre, estado FROM cursos WHERE id = ?${isAdmin ? '' : ' AND creado_por_id = ?'}${connection ? ' FOR UPDATE' : ''}`,
    isAdmin ? [cursoId] : [cursoId, session.userId]
  );
  return rows[0] ?? null;
}

// GET — Grupos disponibles para el usuario y cuáles están asignados a la materia.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !['maestro', 'administrador'].includes(session.roleName)) {
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

    const isAdmin = session.roleName === 'administrador';
    const [grupos] = await pool.execute(
      `SELECT g.id, g.nombre, g.codigo,
              CASE WHEN cg.id IS NOT NULL THEN 1 ELSE 0 END as asignado
       FROM grupos_cohortes g
       ${isAdmin ? '' : 'INNER JOIN grupo_maestros gm ON gm.grupo_id = g.id AND gm.maestro_id = ?'}
       LEFT JOIN curso_grupos cg ON cg.grupo_id = g.id AND cg.curso_id = ?
       ORDER BY g.nombre ASC`,
      isAdmin ? [cursoId] : [session.userId, cursoId]
    );

    const [asignados] = await pool.execute(
      `SELECT g.id, g.nombre, g.codigo
       FROM curso_grupos cg
       JOIN grupos_cohortes g ON g.id = cg.grupo_id
       WHERE cg.curso_id = ?`,
      [cursoId]
    );

    return NextResponse.json({
      curso,
      grupos,
      asignados,
    });
  } catch (error: unknown) {
    console.error('Error al obtener grupos del curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PUT — Reemplazar asignación de grupos al curso { grupo_ids: number[] }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection: PoolConnection | undefined;
  try {
    const session = await getSession();
    if (!session || !['maestro', 'administrador'].includes(session.roleName)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const cursoId = Number(id);
    if (!Number.isSafeInteger(cursoId) || cursoId <= 0) {
      return NextResponse.json({ error: 'ID de curso inválido' }, { status: 400 });
    }

    const body = await request.json();
    if (!Array.isArray(body?.grupo_ids) || body.grupo_ids.some((id: unknown) => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)) {
      return NextResponse.json({ error: 'Selecciona grupos válidos antes de guardar' }, { status: 400 });
    }
    const grupoIds = [...new Set<number>(body.grupo_ids)];
    const isAdmin = session.roleName === 'administrador';

    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Bloquear la materia evita que dos guardados mezclen sus asignaciones.
    const curso = await verificarAccesoCurso(cursoId, session, connection);
    if (!curso) {
      await connection.rollback();
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    if (curso.estado !== 'aprobado') {
      await connection.rollback();
      return NextResponse.json(
        { error: 'Solo puedes asignar grupos a cursos ya aprobados por el administrador' },
        { status: 400 }
      );
    }

    if (grupoIds.length > 0) {
      const placeholders = grupoIds.map(() => '?').join(',');
      const [valid] = await connection.execute<RowDataPacket[]>(
        `SELECT g.id FROM grupos_cohortes g
         ${isAdmin ? '' : 'INNER JOIN grupo_maestros gm ON gm.grupo_id = g.id AND gm.maestro_id = ?'}
         WHERE g.id IN (${placeholders})`,
        isAdmin ? grupoIds : [session.userId, ...grupoIds]
      );

      if (valid.length !== grupoIds.length) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'Uno o más grupos no te pertenecen o no existen' },
          { status: 400 }
        );
      }
    }

    if (isAdmin) {
      await connection.execute('DELETE FROM curso_grupos WHERE curso_id = ?', [cursoId]);
    } else {
      // El maestro modifica los grupos que puede ver; conserva los asignados por administración a otros docentes.
      await connection.execute(
        `DELETE cg FROM curso_grupos cg
         INNER JOIN grupo_maestros gm ON gm.grupo_id = cg.grupo_id AND gm.maestro_id = ?
         WHERE cg.curso_id = ?`,
        [session.userId, cursoId]
      );
    }

    for (const grupoId of grupoIds) {
      await connection.execute(
        'INSERT INTO curso_grupos (curso_id, grupo_id) VALUES (?, ?)',
        [cursoId, grupoId]
      );
    }

    const [asignados] = await connection.execute(
      `SELECT g.id, g.nombre, g.codigo
       FROM curso_grupos cg
       JOIN grupos_cohortes g ON g.id = cg.grupo_id
       WHERE cg.curso_id = ?`,
      [cursoId]
    );

    await connection.commit();
    return NextResponse.json({ success: true, asignados });
  } catch (error: unknown) {
    await connection?.rollback();
    console.error('Error al asignar grupos al curso:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
