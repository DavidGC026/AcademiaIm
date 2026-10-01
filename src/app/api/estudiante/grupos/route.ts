import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/estudiante/grupos - Obtener el grupo actual y las solicitudes del alumno
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener cohorte actual del usuario
    const [userRows] = await pool.execute(
      'SELECT grupo_cohorte FROM usuarios WHERE id = ?',
      [session.userId]
    ) as any[];
    
    const grupo_cohorte = userRows[0]?.grupo_cohorte || null;

    // Obtener solicitudes enviadas por el alumno
    const [solicitudes] = await pool.execute(
      `SELECT s.id, s.estado, s.created_at, g.nombre as grupo_nombre, g.codigo as grupo_codigo
       FROM solicitudes_acceso_grupo s
       JOIN grupos_cohortes g ON s.grupo_id = g.id
       WHERE s.estudiante_id = ?
       ORDER BY s.created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ grupo_cohorte, solicitudes });
  } catch (error: any) {
    console.error('Error al obtener solicitudes de grupo del estudiante:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST /api/estudiante/grupos - Solicitar acceso a un grupo con código
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { codigo } = await request.json();

    if (!codigo) {
      return NextResponse.json({ error: 'Código de grupo requerido' }, { status: 400 });
    }

    const cleanCodigo = codigo.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    // Código de materia (MAT-XXXX): inscripción directa
    if (cleanCodigo.startsWith('MAT-')) {
      const [cursos] = (await pool.execute(
        'SELECT id, nombre, codigo, estado FROM cursos WHERE codigo = ?',
        [cleanCodigo]
      )) as any[];

      if (cursos.length === 0) {
        return NextResponse.json({ error: 'El código de materia no existe o es inválido' }, { status: 404 });
      }

      const curso = cursos[0];
      if (curso.estado !== 'aprobado') {
        return NextResponse.json(
          { error: 'Esta materia aún no está disponible para inscripción' },
          { status: 400 }
        );
      }

      const [existingMat] = (await pool.execute(
        'SELECT id FROM curso_estudiantes WHERE curso_id = ? AND estudiante_id = ?',
        [curso.id, session.userId]
      )) as any[];

      if (existingMat.length > 0) {
        return NextResponse.json({ error: 'Ya estás inscrito en esta materia' }, { status: 400 });
      }

      await pool.execute(
        'INSERT INTO curso_estudiantes (curso_id, estudiante_id, inscrito_por_id) VALUES (?, ?, ?)',
        [curso.id, session.userId, session.userId]
      );

      return NextResponse.json({
        success: true,
        tipo: 'materia',
        mensaje: `Te inscribiste en "${curso.nombre}"`,
        curso: { id: curso.id, nombre: curso.nombre },
      });
    }

    // Código de grupo (GRP-XXXX): solicitud de acceso
    const [grupos] = await pool.execute(
      'SELECT id, nombre FROM grupos_cohortes WHERE codigo = ?',
      [cleanCodigo]
    ) as any[];

    if (grupos.length === 0) {
      return NextResponse.json({ error: 'El código de grupo no existe o es inválido' }, { status: 404 });
    }

    const grupo = grupos[0];

    // 2. Verificar si ya tiene una solicitud pendiente o aprobada para este grupo
    const [existing] = await pool.execute(
      'SELECT id, estado FROM solicitudes_acceso_grupo WHERE estudiante_id = ? AND grupo_id = ?',
      [session.userId, grupo.id]
    ) as any[];

    if (existing.length > 0) {
      const sol = existing[0];
      if (sol.estado === 'pendiente') {
        return NextResponse.json({ error: 'Ya tienes una solicitud pendiente para este grupo' }, { status: 400 });
      } else if (sol.estado === 'aprobado') {
        return NextResponse.json({ error: 'Ya eres miembro de este grupo' }, { status: 400 });
      } else {
        // Si fue rechazada, permitir volver a solicitar (actualizar a pendiente)
        await pool.execute(
          `UPDATE solicitudes_acceso_grupo SET estado = 'pendiente', created_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [sol.id]
        );
        return NextResponse.json({ success: true, mensaje: 'Solicitud enviada nuevamente' });
      }
    }

    // 3. Crear la solicitud de acceso
    await pool.execute(
      'INSERT INTO solicitudes_acceso_grupo (estudiante_id, grupo_id) VALUES (?, ?)',
      [session.userId, grupo.id]
    );

    return NextResponse.json({ success: true, mensaje: 'Solicitud enviada con éxito' });
  } catch (error: any) {
    console.error('Error al solicitar acceso a grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
