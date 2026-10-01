import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { estudiantePuedeAccederCurso, getCursoIdFromExamen } from '@/lib/cursoGrupos';

// Obtener detalles del examen (Preguntas y Opciones)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const examenId = parseInt(id, 10);

    // 1. Obtener examen
    const [exams] = await pool.execute('SELECT * FROM examenes WHERE id = ?', [examenId]) as any[];
    if (exams.length === 0) {
      return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    }
    const exam = exams[0];

    if (session.roleName === 'estudiante') {
      const cursoId = await getCursoIdFromExamen(examenId);
      if (!cursoId || !(await estudiantePuedeAccederCurso(session.userId, cursoId))) {
        return NextResponse.json({ error: 'No tienes acceso a este examen' }, { status: 403 });
      }
    }

    // 2. Obtener preguntas
    const [preguntas] = await pool.execute(
      'SELECT id, pregunta, tipo FROM preguntas WHERE examen_id = ?',
      [examenId]
    ) as any[];

    if (preguntas.length === 0) {
      return NextResponse.json({ exam, preguntas: [] });
    }

    // 3. Obtener opciones por pregunta (sin filtrar es_correcta si es estudiante)
    const preguntaIds = preguntas.map((p: any) => p.id);
    const placeholders = preguntaIds.map(() => '?').join(',');

    const queryOptions = session.roleName === 'estudiante'
      ? `SELECT id, pregunta_id, texto FROM opciones WHERE pregunta_id IN (${placeholders})`
      : `SELECT id, pregunta_id, texto, es_correcta FROM opciones WHERE pregunta_id IN (${placeholders})`;

    const [opciones] = await pool.execute(queryOptions, preguntaIds) as any[];

    // Agrupar opciones por pregunta
    const opcionesPorPregunta: Record<number, any[]> = {};
    preguntaIds.forEach((pId: number) => {
      opcionesPorPregunta[pId] = [];
    });

    opciones.forEach((opt: any) => {
      opcionesPorPregunta[opt.pregunta_id].push(opt);
    });

    // Combinar en una estructura limpia
    const preguntasConOpciones = preguntas.map((p: any) => ({
      ...p,
      opciones: opcionesPorPregunta[p.id] || []
    }));

    return NextResponse.json({
      exam,
      preguntas: preguntasConOpciones
    });
  } catch (error: any) {
    console.error('Error al obtener examen:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// Enviar Respuestas para Calificación
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const examenId = parseInt(id, 10);
    const { respuestas } = await request.json();

    const cursoId = await getCursoIdFromExamen(examenId);
    if (!cursoId || !(await estudiantePuedeAccederCurso(session.userId, cursoId))) {
      return NextResponse.json({ error: 'No tienes acceso a este examen' }, { status: 403 });
    }

    if (!respuestas) {
      return NextResponse.json({ error: 'Faltan las respuestas' }, { status: 400 });
    }

    // 1. Obtener todas las opciones correctas de este examen
    const [opcionesCorrectas] = await pool.execute(
      `SELECT o.id as opcion_id, o.pregunta_id 
       FROM opciones o
       JOIN preguntas p ON o.pregunta_id = p.id
       WHERE p.examen_id = ? AND o.es_correcta = 1`,
      [examenId]
    ) as any[];

    // 2. Obtener número total de preguntas del examen
    const [[{ total_preguntas }]] = await pool.execute(
      'SELECT COUNT(*) as total_preguntas FROM preguntas WHERE examen_id = ?',
      [examenId]
    ) as any[];

    if (total_preguntas === 0) {
      return NextResponse.json({ error: 'El examen no tiene preguntas' }, { status: 400 });
    }

    // Map para comparación rápida de correctas
    const correctMap: Record<number, number> = {};
    opcionesCorrectas.forEach((opt: any) => {
      correctMap[opt.pregunta_id] = opt.opcion_id;
    });

    // 3. Evaluar respuestas del estudiante
    let correctasCount = 0;
    Object.entries(respuestas).forEach(([preguntaIdStr, opcionIdVal]) => {
      const preguntaId = parseInt(preguntaIdStr, 10);
      const opcionId = parseInt(opcionIdVal as string, 10);

      if (correctMap[preguntaId] === opcionId) {
        correctasCount++;
      }
    });

    const calificacion = Math.round((correctasCount / total_preguntas) * 100);

    // 4. Guardar intento en base de datos
    await pool.execute(
      `INSERT INTO intentos_examenes (examen_id, usuario_id, calificacion) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion), finalizado_at = CURRENT_TIMESTAMP`,
      [examenId, session.userId, calificacion]
    );

    return NextResponse.json({
      success: true,
      calificacion,
      respuestasCorrectas: correctMap // Se devuelven las correctas para revisión
    });
  } catch (error: any) {
    console.error('Error al calificar examen:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
export const runtime = 'nodejs';
