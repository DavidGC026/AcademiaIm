import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import * as xlsx from 'xlsx';

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cursoIdRaw = formData.get('curso_id');
    const titulo = formData.get('titulo') || 'Evaluación Importada';
    const descripcion = formData.get('descripcion') || '';
    const limiteTiempoRaw = formData.get('limite_tiempo');

    if (!file || !cursoIdRaw) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (archivo y materia)' }, { status: 400 });
    }

    const cursoId = parseInt(String(cursoIdRaw), 10);
    const limiteTiempo = parseInt(String(limiteTiempoRaw || '0'), 10);

    if (Number.isNaN(cursoId)) {
      return NextResponse.json({ error: 'ID de materia inválido' }, { status: 400 });
    }

    // 1. Leer buffer del archivo Excel en memoria
    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(new Uint8Array(bytes), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Obtener las filas como JSON
    const filas: any[] = xlsx.utils.sheet_to_json(sheet);

    if (!filas || filas.length === 0) {
      return NextResponse.json({ error: 'La plantilla de Excel está vacía o es inválida' }, { status: 400 });
    }

    // Iniciar Transacción de base de datos
    await connection.beginTransaction();

    // 2. Insertar cabecera del examen
    const [examResult] = await connection.execute(
      `INSERT INTO examenes (curso_id, titulo, descripcion, limite_tiempo) VALUES (?, ?, ?, ?)`,
      [cursoId, String(titulo).trim(), String(descripcion).trim(), Number.isNaN(limiteTiempo) ? 0 : limiteTiempo]
    ) as any[];

    const examenId = examResult.insertId;

    // 3. Procesar las preguntas del Excel
    let insertedQuestions = 0;

    for (const fila of filas) {
      // Mapear campos con tolerancia a mayúsculas/minúsculas
      const preguntaTexto = fila.Pregunta || fila.pregunta || fila.PREGUNTA;
      const opA = fila.Opcion_A || fila.opcion_a || fila.OPCION_A || fila.OpcionA || fila.opcionA;
      const opB = fila.Opcion_B || fila.opcion_b || fila.OPCION_B || fila.OpcionB || fila.opcionB;
      const opC = fila.Opcion_C || fila.opcion_c || fila.OPCION_C || fila.OpcionC || fila.opcionC;
      const opD = fila.Opcion_D || fila.opcion_d || fila.OPCION_D || fila.OpcionD || fila.opcionD;
      const correctaRaw = fila.Respuesta_Correcta || fila.respuesta_correcta || fila.RESPUESTA_CORRECTA || fila.RespuestaCorrecta || fila.respuestaCorrecta;

      if (!preguntaTexto || !opA || !opB || !correctaRaw) {
        // Ignorar filas incompletas
        continue;
      }

      const correcta = String(correctaRaw).trim().toUpperCase();

      // Insertar pregunta
      const [qResult] = await connection.execute(
        `INSERT INTO preguntas (examen_id, pregunta, tipo) VALUES (?, ?, ?)`,
        [examenId, String(preguntaTexto).trim(), 'opcion_multiple']
      ) as any[];

      const preguntaId = qResult.insertId;

      // Armar las opciones
      const opciones = [
        { texto: opA, esCorrecta: correcta === 'A' || correcta === '1' || correcta === String(opA).trim() },
        { texto: opB, esCorrecta: correcta === 'B' || correcta === '2' || correcta === String(opB).trim() },
      ];

      if (opC) {
        opciones.push({ texto: opC, esCorrecta: correcta === 'C' || correcta === '3' || correcta === String(opC).trim() });
      }
      if (opD) {
        opciones.push({ texto: opD, esCorrecta: correcta === 'D' || correcta === '4' || correcta === String(opD).trim() });
      }

      // Validar si al menos una opción fue marcada como correcta.
      // Si no, por defecto la primera es la correcta para evitar que el examen no tenga respuesta.
      const tieneCorrecta = opciones.some(o => o.esCorrecta);
      if (!tieneCorrecta && opciones.length > 0) {
        opciones[0].esCorrecta = true;
      }

      // Insertar opciones
      for (const opt of opciones) {
        await connection.execute(
          `INSERT INTO opciones (pregunta_id, texto, es_correcta) VALUES (?, ?, ?)`,
          [preguntaId, String(opt.texto).trim(), opt.esCorrecta ? 1 : 0]
        );
      }

      insertedQuestions++;
    }

    if (insertedQuestions === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'No se encontraron preguntas válidas en el archivo' }, { status: 400 });
    }

    // Confirmar cambios
    await connection.commit();

    return NextResponse.json({
      success: true,
      examenId,
      totalPreguntas: insertedQuestions,
      message: `Examen importado correctamente con ${insertedQuestions} preguntas.`
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al importar examen desde Excel:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar el archivo Excel' }, { status: 500 });
  } finally {
    connection.release();
  }
}

export const runtime = 'nodejs';
