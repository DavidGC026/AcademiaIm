import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canManageExam, getExam } from '@/lib/examAccess';
import { parseExamRelease } from '@/lib/examRelease';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !['maestro', 'administrador'].includes(session.roleName)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Examen inválido' }, { status: 400 });
    const exam = await getExam(id);
    if (!exam) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    if (!canManageExam(exam, session)) return NextResponse.json({ error: 'No tienes permiso para habilitar este examen' }, { status: 403 });
    const config = parseExamRelease(await request.json());
    if (!config) return NextResponse.json({ error: 'Elige una forma de habilitar el examen y, si corresponde, una tarea final.' }, { status: 400 });
    if (config.modo_liberacion === 'tarea_entregada') {
      const [classes] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM clases WHERE id = ? AND curso_id = ? AND requiere_tarea = 1', [config.clase_requisito_id, exam.curso_id],
      );
      if (!classes.length) return NextResponse.json({ error: 'La tarea final debe pertenecer a una clase de esta materia que requiera entrega.' }, { status: 400 });
    }
    await pool.execute('UPDATE examenes SET modo_liberacion = ?, clase_requisito_id = ? WHERE id = ?', [config.modo_liberacion, config.clase_requisito_id, id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    console.error('Error al configurar liberación del examen:', error);
    return NextResponse.json({ error: 'No se pudo guardar la disponibilidad del examen' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
