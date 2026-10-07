import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getSession } from '@/lib/auth';
import { ensureExamReleaseSchema } from '@/lib/examSchema';
import { getCourseExams } from '@/lib/examAvailability';
import { estudiantePuedeAccederCurso } from '@/lib/cursoGrupos';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursoId = searchParams.get('curso_id');

    if (!cursoId) {
      return NextResponse.json({ error: 'Falta curso_id' }, { status: 400 });
    }

    const courseId = Number(cursoId);
    if (!Number.isSafeInteger(courseId) || courseId < 1) return NextResponse.json({ error: 'Materia inválida' }, { status: 400 });
    const [courses] = await pool.execute<RowDataPacket[]>('SELECT creado_por_id FROM cursos WHERE id = ?', [courseId]);
    const allowed = courses[0] && (session.roleName === 'administrador' ||
      (session.roleName === 'maestro' && courses[0].creado_por_id === session.userId) ||
      (session.roleName === 'estudiante' && await estudiantePuedeAccederCurso(session.userId, courseId))
    );
    if (!allowed) return NextResponse.json({ error: 'No tienes acceso a esta materia' }, { status: 403 });
    return NextResponse.json({ exams: await getCourseExams(courseId, session.userId) });
  } catch (error: unknown) {
    console.error('Error al obtener exámenes:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { curso_id, titulo, descripcion, limite_tiempo, preguntas } = await request.json();

    if (!curso_id || !titulo || !preguntas || !Array.isArray(preguntas)) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const [courses] = await pool.execute<RowDataPacket[]>(
      'SELECT creado_por_id FROM cursos WHERE id = ?', [curso_id],
    );
    if (!courses[0] || (session.roleName !== 'administrador' && courses[0].creado_por_id !== session.userId)) {
      return NextResponse.json({ error: 'No tienes permiso para crear exámenes en esta materia' }, { status: 403 });
    }
    await ensureExamReleaseSchema();

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [examResult] = await connection.execute(
      `INSERT INTO examenes (curso_id, titulo, descripcion, limite_tiempo, modo_liberacion) VALUES (?, ?, ?, ?, 'bloqueado')`,
      [curso_id, titulo, descripcion || '', limite_tiempo || 0]
    ) as any[];

    const examenId = examResult.insertId;

    for (const q of preguntas) {
      const [qResult] = await connection.execute(
        `INSERT INTO preguntas (examen_id, pregunta, tipo) VALUES (?, ?, ?)`,
        [examenId, q.pregunta, q.tipo || 'opcion_multiple']
      ) as any[];

      const preguntaId = qResult.insertId;

      if (q.opciones && Array.isArray(q.opciones)) {
        for (const opt of q.opciones) {
          await connection.execute(
            `INSERT INTO opciones (pregunta_id, texto, es_correcta) VALUES (?, ?, ?)`,
            [preguntaId, opt.texto, opt.es_correcta ? 1 : 0]
          );
        }
      }
    }

    await connection.commit();
    transactionStarted = false;

    return NextResponse.json({ success: true, examenId });
  } catch (error: unknown) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('Error al crear examen:', error);
    return NextResponse.json({ error: 'Error del servidor al crear examen' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
export const runtime = 'nodejs';
