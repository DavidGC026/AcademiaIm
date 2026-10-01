import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { estudiantePuedeAccederCurso, getCursoIdFromClase } from '@/lib/cursoGrupos';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const claseIdStr = formData.get('claseId') as string | null;

    if (!file || !claseIdStr) {
      return NextResponse.json({ error: 'Falta el archivo o claseId' }, { status: 400 });
    }

    const claseId = parseInt(claseIdStr, 10);

    const cursoId = await getCursoIdFromClase(claseId);
    if (!cursoId || !(await estudiantePuedeAccederCurso(session.userId, cursoId))) {
      return NextResponse.json({ error: 'No tienes acceso a esta tarea' }, { status: 403 });
    }

    const [existingRows] = (await pool.execute(
      `SELECT id, estado, permite_reenvio FROM entregas_tareas WHERE clase_id = ? AND usuario_id = ?`,
      [claseId, session.userId]
    )) as any[];

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      const canReplace =
        existing.estado !== 'calificado' || Number(existing.permite_reenvio) === 1;
      if (!canReplace) {
        return NextResponse.json(
          { error: 'Tu entrega ya fue calificada. Pide a tu maestro que habilite un reenvío.' },
          { status: 403 }
        );
      }
    }

    // Guardar archivo en disco (public/uploads)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Crear carpeta si no existe
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Evitar sobreescrituras usando timestamp en el nombre
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${session.userId}-${claseId}-${Date.now()}.${fileExtension}`;
    const filePath = join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${uniqueFileName}`;

    // Registrar en la base de datos (con ON DUPLICATE KEY UPDATE por si ya existía una entrega previa)
    await pool.execute(
      `INSERT INTO entregas_tareas (clase_id, usuario_id, archivo_nombre, archivo_url, estado, permite_reenvio) 
       VALUES (?, ?, ?, ?, 'entregado', 0)
       ON DUPLICATE KEY UPDATE 
         archivo_nombre = VALUES(archivo_nombre), 
         archivo_url = VALUES(archivo_url), 
         estado = 'entregado', 
         calificacion = NULL, 
         comentarios = NULL,
         permite_reenvio = 0`,
      [claseId, session.userId, file.name, fileUrl]
    );

    return NextResponse.json({
      success: true,
      archivo_nombre: file.name,
      archivo_url: fileUrl,
    });
  } catch (error: any) {
    console.error('Error al entregar tarea:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
export const runtime = 'nodejs'; // Asegurar que corre en entorno Node.js para fs
