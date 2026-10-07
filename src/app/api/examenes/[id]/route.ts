import { NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { estudiantePuedeAccederCurso } from '@/lib/cursoGrupos';
import { canManageExam, getExam, getExamQuestions } from '@/lib/examAccess';
import { getExamAvailability } from '@/lib/examAvailability';
import { ensureExamAttemptSchema } from '@/lib/examSchema';
import { attemptSnapshot, ExamValidationError, gradeExam, readExamJson } from '@/lib/examGrading';
import type { ExamAttemptSnapshot, ExamReleaseConfig } from '@/lib/examTypes';

type AttemptRow = RowDataPacket & {
  id: number;
  calificacion: number | null;
  finalizado_at: Date;
  respuestas: unknown;
  historial: unknown;
  permite_reintento: number;
};

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const examenId = Number((await params).id);
    if (!Number.isSafeInteger(examenId) || examenId < 1) return NextResponse.json({ error: 'Examen inválido' }, { status: 400 });
    const exam = await getExam(examenId);
    if (!exam) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    const isStudent = session.roleName === 'estudiante';
    if (isStudent ? !(await estudiantePuedeAccederCurso(session.userId, exam.curso_id)) : !canManageExam(exam, session)) {
      return NextResponse.json({ error: 'No tienes acceso a este examen' }, { status: 403 });
    }
    await ensureExamAttemptSchema();
    if (!isStudent) {
      const [questions, [classes]] = await Promise.all([
        getExamQuestions(examenId),
        pool.execute<RowDataPacket[]>('SELECT id, titulo FROM clases WHERE curso_id = ? AND requiere_tarea = 1 ORDER BY orden, id', [exam.curso_id]),
      ]);
      return NextResponse.json({ exam, preguntas: questions, clases_con_tarea: classes });
    }

    const [attempts] = await pool.execute<AttemptRow[]>(
      'SELECT * FROM intentos_examenes WHERE examen_id = ? AND usuario_id = ?', [examenId, session.userId]
    );
    const attempt = attempts[0];
    const completed = attempt?.calificacion != null && !attempt.permite_reintento;
    const snapshot = attempt ? attemptSnapshot(attempt) : null;
    const availability = await getExamAvailability(exam, session.userId);
    const questions = availability.disponible || completed ? await getExamQuestions(examenId) : [];
    return NextResponse.json({
      exam,
      ...availability,
      preguntas: questions.map(question => ({
        ...question,
        opciones: question.opciones.map(option => ({ id: option.id, pregunta_id: option.pregunta_id, texto: option.texto })),
      })),
      mi_intento: snapshot ? { ...snapshot, respuestas: completed ? snapshot.respuestas : null, permite_reintento: Boolean(attempt.permite_reintento) } : null,
      respuestasCorrectas: completed ? Object.fromEntries(questions.map(question => [question.id, question.opciones.find(option => option.es_correcta === 1)?.id])) : {},
    });
  } catch (error) {
    console.error('Error al obtener examen:', error);
    return NextResponse.json({ error: 'Error al cargar el examen' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Context) {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const examenId = Number((await params).id);
    if (!Number.isSafeInteger(examenId) || examenId < 1) return NextResponse.json({ error: 'Examen inválido' }, { status: 400 });
    const exam = await getExam(examenId);
    if (!exam || !(await estudiantePuedeAccederCurso(session.userId, exam.curso_id))) {
      return NextResponse.json({ error: 'No tienes acceso a este examen' }, { status: 403 });
    }
    const { respuestas } = await request.json();
    await ensureExamAttemptSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    // Serializar también el primer envío, cuando todavía no existe un intento.
    await connection.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [session.userId]);
    const [attempts] = await connection.execute<AttemptRow[]>(
      'SELECT * FROM intentos_examenes WHERE examen_id = ? AND usuario_id = ? FOR UPDATE', [examenId, session.userId]
    );
    const previous = attempts[0];
    if (previous?.calificacion != null && !previous.permite_reintento) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ error: 'Ya entregaste este examen. Tu maestro debe habilitar un nuevo intento.' }, { status: 409 });
    }
    // Compartir el bloqueo permite entregas simultáneas y ordena los cambios del maestro.
    const [releaseRows] = await connection.execute<(RowDataPacket & ExamReleaseConfig)[]>(
      'SELECT modo_liberacion, clase_requisito_id FROM examenes WHERE id = ? LOCK IN SHARE MODE', [examenId],
    );
    if (!releaseRows.length) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    }
    const availability = await getExamAvailability({ ...releaseRows[0], curso_id: exam.curso_id }, session.userId, connection);
    if (!availability.disponible) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ error: availability.motivo_bloqueo }, { status: 403 });
    }
    const graded = gradeExam(await getExamQuestions(examenId, connection), respuestas);
    const history = readExamJson<ExamAttemptSnapshot[]>(previous?.historial, []);
    const snapshot = previous ? attemptSnapshot(previous) : null;
    if (snapshot) history.push(snapshot);
    if (previous) {
      await connection.execute(
        `UPDATE intentos_examenes SET calificacion = ?, respuestas = ?, historial = ?, permite_reintento = 0,
         iniciado_at = CURRENT_TIMESTAMP, finalizado_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [graded.calificacion, JSON.stringify(graded.respuestas), JSON.stringify(history), previous.id]
      );
    } else {
      await connection.execute(
        'INSERT INTO intentos_examenes (examen_id, usuario_id, calificacion, respuestas, historial) VALUES (?, ?, ?, ?, ?)',
        [examenId, session.userId, graded.calificacion, JSON.stringify(graded.respuestas), '[]']
      );
    }
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json({ success: true, calificacion: graded.calificacion, respuestasCorrectas: graded.respuestasCorrectas });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    if (error instanceof ExamValidationError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error instanceof ExamValidationError ? error.message : 'Formato de respuestas inválido' }, { status: 400 });
    }
    console.error('Error al calificar examen:', error);
    return NextResponse.json({ error: 'Error al guardar el examen. Inténtalo de nuevo.' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export const runtime = 'nodejs';
