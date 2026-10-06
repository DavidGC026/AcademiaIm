import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureExamAttemptSchema } from '@/lib/examSchema';

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

    await ensureExamAttemptSchema();
    const [rows] = await pool.execute(
      `SELECT e.*, i.calificacion as mi_calificacion, i.finalizado_at as intento_fecha,
              COALESCE(i.permite_reintento, 0) AS permite_reintento
       FROM examenes e
       LEFT JOIN intentos_examenes i ON e.id = i.examen_id AND i.usuario_id = ?
       WHERE e.curso_id = ?
       ORDER BY e.created_at ASC`,
      [session.userId, cursoId]
    );

    return NextResponse.json({ exams: rows });
  } catch (error: unknown) {
    console.error('Error al obtener exámenes:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { curso_id, titulo, descripcion, limite_tiempo, preguntas } = await request.json();

    if (!curso_id || !titulo || !preguntas || !Array.isArray(preguntas)) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [examResult] = await connection.execute(
      `INSERT INTO examenes (curso_id, titulo, descripcion, limite_tiempo) VALUES (?, ?, ?, ?)`,
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

    return NextResponse.json({ success: true, examenId });
  } catch (error: unknown) {
    await connection.rollback();
    console.error('Error al crear examen:', error);
    return NextResponse.json({ error: 'Error del servidor al crear examen' }, { status: 500 });
  } finally {
    connection.release();
  }
}
export const runtime = 'nodejs';
