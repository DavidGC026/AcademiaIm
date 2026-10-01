import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateGroupCode } from '@/lib/grupos';
import { agregarMaestroAGrupo } from '@/lib/grupoMaestros';

// GET /api/maestro/grupos - Obtener los grupos del maestro
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'maestro') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [rows] = await pool.execute(
      `SELECT g.id, g.nombre, g.codigo, g.creador_id, g.created_at,
              (SELECT COUNT(*) FROM usuarios u WHERE u.grupo_cohorte = g.nombre) as total_alumnos,
              (SELECT COUNT(*) FROM solicitudes_acceso_grupo s WHERE s.grupo_id = g.id AND s.estado = 'pendiente') as solicitudes_pendientes
       FROM grupos_cohortes g
       INNER JOIN grupo_maestros gm ON gm.grupo_id = g.id AND gm.maestro_id = ?
       ORDER BY g.created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ grupos: rows });
  } catch (error: unknown) {
    console.error('Error al obtener grupos:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST /api/maestro/grupos - Crear grupo (código generado automáticamente)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'maestro') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { nombre } = await request.json();

    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: 'El nombre del grupo es obligatorio' }, { status: 400 });
    }

    const cleanCodigo = await generateGroupCode();
    const nombreTrim = String(nombre).trim();

    const [result] = await pool.execute(
      'INSERT INTO grupos_cohortes (nombre, codigo, creador_id) VALUES (?, ?, ?)',
      [nombreTrim, cleanCodigo, session.userId]
    ) as any[];

    const insertId = result.insertId;

    await agregarMaestroAGrupo(insertId, session.userId);

    return NextResponse.json({
      success: true,
      grupo: {
        id: insertId,
        nombre: nombreTrim,
        codigo: cleanCodigo,
      },
    });
  } catch (error: unknown) {
    console.error('Error al crear grupo:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
