import { NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canManageExam, getExam } from '@/lib/examAccess';
import { estudiantePuedeAccederCurso } from '@/lib/cursoGrupos';
import { ensureExamAttemptSchema } from '@/lib/examSchema';
import { readExamJson } from '@/lib/examGrading';
import { getExamAvailability } from '@/lib/examAvailability';
import type { ExamAttemptSnapshot } from '@/lib/examTypes';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    const session = await getSession();
    if (!session || !['maestro', 'administrador'].includes(session.roleName)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const id = Number((await params).id);
    const { alumno_id, numero_intento } = await request.json();
    if (![id, alumno_id, numero_intento].every(value => Number.isSafeInteger(value) && value > 0)) {
      return NextResponse.json({ error: 'Examen, alumno o intento inválido' }, { status: 400 });
    }
    const exam = await getExam(id);
    if (!exam) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    if (!canManageExam(exam, session)) return NextResponse.json({ error: 'No tienes permiso para habilitar este examen' }, { status: 403 });
    if (!(await estudiantePuedeAccederCurso(alumno_id, exam.curso_id))) {
      return NextResponse.json({ error: 'El alumno ya no tiene acceso a esta materia.' }, { status: 409 });
    }
    await ensureExamAttemptSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    await connection.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [alumno_id]);
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, calificacion, historial FROM intentos_examenes WHERE examen_id = ? AND usuario_id = ? FOR UPDATE', [id, alumno_id]
    );
    const attempt = rows[0];
    if (!attempt || attempt.calificacion == null || readExamJson<ExamAttemptSnapshot[]>(attempt.historial, []).length + 1 !== numero_intento) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ error: 'El intento cambió o el alumno todavía no ha entregado el examen. Actualiza los resultados.' }, { status: 409 });
    }
    // La fecha de entrega tiene ON UPDATE; conservarla al habilitar otro intento.
    await connection.execute('UPDATE intentos_examenes SET permite_reintento = 1, finalizado_at = finalizado_at WHERE id = ?', [attempt.id]);
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json({ success: true, ...await getExamAvailability(exam, alumno_id), message: 'Nuevo intento autorizado. La calificación anterior se conservará en el historial.' });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    console.error('Error al habilitar examen:', error);
    return NextResponse.json({ error: 'No se pudo habilitar el nuevo intento' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export const runtime = 'nodejs';
