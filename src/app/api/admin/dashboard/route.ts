import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. KPIs
    const [[{ total_cursos }]] = await pool.execute('SELECT COUNT(*) as total_cursos FROM cursos') as any[];
    const [[{ total_pendientes }]] = await pool.execute("SELECT COUNT(*) as total_pendientes FROM cursos WHERE estado = 'pendiente'") as any[];
    const [[{ total_estudiantes }]] = await pool.execute('SELECT COUNT(*) as total_estudiantes FROM usuarios WHERE role_id = 3') as any[];
    const [[{ total_logs }]] = await pool.execute('SELECT COUNT(*) as total_logs FROM logs_accesos') as any[];

    // 2. Cursos pendientes
    const [pendientes] = await pool.execute(
      `SELECT c.*, u.nombre as creador_nombre 
       FROM cursos c 
       JOIN usuarios u ON c.creado_por_id = u.id 
       WHERE c.estado = 'pendiente' 
       ORDER BY c.created_at DESC`
    ) as any[];

    // 3. Logs de acceso recientes
    const [logs] = await pool.execute(
      `SELECT l.*, u.nombre as usuario_nombre, u.email as usuario_email, r.nombre as rol_nombre 
       FROM logs_accesos l 
       JOIN usuarios u ON l.usuario_id = u.id 
       JOIN roles r ON u.role_id = r.id 
       ORDER BY l.fecha_acceso DESC 
       LIMIT 8`
    ) as any[];

    // 4. Entregas de tareas recientes
    const [tareas] = await pool.execute(
      `SELECT e.*, u.nombre as estudiante_nombre, c.titulo as clase_titulo, cur.nombre as curso_nombre
       FROM entregas_tareas e
       JOIN usuarios u ON e.usuario_id = u.id
       JOIN clases c ON e.clase_id = c.id
       JOIN cursos cur ON c.curso_id = cur.id
       ORDER BY e.fecha_entrega DESC
       LIMIT 5`
    ) as any[];

    return NextResponse.json({
      stats: {
        total_cursos,
        total_pendientes,
        total_estudiantes,
        total_logs
      },
      pendientes,
      logs,
      tareas
    });
  } catch (error: any) {
    console.error('Error en API dashboard admin:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
