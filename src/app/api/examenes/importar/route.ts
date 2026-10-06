import { NextResponse } from 'next/server';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ExamImportError, parseExamWorkbook } from '@/lib/examImport';

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const cursoId = Number(formData.get('curso_id'));
    const titulo = String(formData.get('titulo') || 'Evaluación Importada').trim();
    const descripcion = String(formData.get('descripcion') || '').trim();
    const limiteTiempo = Number(formData.get('limite_tiempo') || '0');

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'Selecciona un archivo Excel con preguntas.' }, { status: 400 });
    }
    if (!Number.isSafeInteger(cursoId) || cursoId < 1) {
      return NextResponse.json({ error: 'ID de materia inválido' }, { status: 400 });
    }
    if (!titulo || titulo.length > 255 || !Number.isSafeInteger(limiteTiempo) || limiteTiempo < 0 || limiteTiempo > 2147483647) {
      return NextResponse.json({ error: 'Revisa el título (máximo 255 caracteres) y el límite de tiempo (minutos enteros, 0 para sin límite).' }, { status: 400 });
    }

    const preguntas = parseExamWorkbook(new Uint8Array(await file.arrayBuffer()));
    connection = await pool.getConnection();
    const [cursos] = await connection.execute<RowDataPacket[]>(
      session.roleName === 'administrador' ? 'SELECT id FROM cursos WHERE id = ?' : 'SELECT id FROM cursos WHERE id = ? AND creado_por_id = ?',
      session.roleName === 'administrador' ? [cursoId] : [cursoId, session.userId]
    );
    if (!cursos.length) {
      return NextResponse.json({ error: 'Materia no encontrada o sin permiso para importar exámenes.' }, { status: 404 });
    }

    await connection.beginTransaction();
    transactionStarted = true;
    const [examResult] = await connection.execute<ResultSetHeader>(
      'INSERT INTO examenes (curso_id, titulo, descripcion, limite_tiempo) VALUES (?, ?, ?, ?)',
      [cursoId, titulo, descripcion, limiteTiempo]
    );
    const examenId = examResult.insertId;

    for (const pregunta of preguntas) {
      const [questionResult] = await connection.execute<ResultSetHeader>(
        'INSERT INTO preguntas (examen_id, pregunta, tipo) VALUES (?, ?, ?)',
        [examenId, pregunta.pregunta, 'opcion_multiple']
      );
      for (const option of pregunta.opciones) {
        await connection.execute(
          'INSERT INTO opciones (pregunta_id, texto, es_correcta) VALUES (?, ?, ?)',
          [questionResult.insertId, option.texto, option.esCorrecta ? 1 : 0]
        );
      }
    }
    await connection.commit();
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      examenId,
      totalPreguntas: preguntas.length,
      message: `Examen importado correctamente con ${preguntas.length} preguntas.`,
    });
  } catch (error: unknown) {
    if (connection && transactionStarted) await connection.rollback();
    if (error instanceof ExamImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error al importar examen desde Excel:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar el archivo Excel' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export const runtime = 'nodejs';
