import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { maestroTieneGrupo } from '@/lib/grupoMaestros';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const grupoIdStr = searchParams.get('grupo_id');

    if (!grupoIdStr) {
      return NextResponse.json({ error: 'Falta el grupo_id' }, { status: 400 });
    }

    const grupoId = parseInt(grupoIdStr, 10);

    const [grupoRows] = (await pool.execute(
      'SELECT id, nombre, codigo, creador_id FROM grupos_cohortes WHERE id = ?',
      [grupoId]
    )) as any[];

    if (grupoRows.length === 0) {
      return NextResponse.json({ error: 'El grupo no existe' }, { status: 404 });
    }

    const grupo = grupoRows[0];
    if (session.roleName === 'maestro' && !(await maestroTieneGrupo(session.userId, grupoId))) {
      return NextResponse.json({ error: 'No tienes permiso para ver calificaciones de este grupo' }, { status: 403 });
    }

    const [alumnos] = (await pool.execute(
      `SELECT id, nombre, email, id_estudiante, grupo_cohorte FROM usuarios
       WHERE role_id = 3 AND grupo_cohorte = ? ORDER BY nombre ASC`,
      [grupo.nombre]
    )) as any[];

    if (alumnos.length === 0) {
      return NextResponse.json({ grupo, cursos: [] });
    }

    const alumnoIds = alumnos.map((a: { id: number }) => a.id);
    const alumnoPlaceholders = alumnoIds.map(() => '?').join(',');

    const [cursos] = (await pool.execute(
      `SELECT c.id, c.nombre FROM curso_grupos cg
       INNER JOIN cursos c ON c.id = cg.curso_id
       WHERE cg.grupo_id = ? AND c.estado = 'aprobado'`,
      [grupoId]
    )) as any[];

    if (cursos.length === 0) {
      return NextResponse.json({ grupo, cursos: [] });
    }

    const cursoIds = cursos.map((c: { id: number }) => c.id);
    const cursoPlaceholders = cursoIds.map(() => '?').join(',');

    const [clases] = (await pool.execute(
      `SELECT id, curso_id, titulo, orden FROM clases
       WHERE curso_id IN (${cursoPlaceholders}) AND requiere_tarea = 1
       ORDER BY curso_id, orden ASC`,
      [...cursoIds]
    )) as any[];

    const [examenes] = (await pool.execute(
      `SELECT id, curso_id, titulo FROM examenes
       WHERE curso_id IN (${cursoPlaceholders}) ORDER BY curso_id, created_at ASC`,
      [...cursoIds]
    )) as any[];

    let entregas: { clase_id: number; usuario_id: number; calificacion: number | null }[] = [];
    if (clases.length > 0) {
      const claseIds = clases.map((c: { id: number }) => c.id);
      const clasePlaceholders = claseIds.map(() => '?').join(',');
      const [entregaRows] = (await pool.execute(
        `SELECT clase_id, usuario_id, calificacion FROM entregas_tareas
         WHERE usuario_id IN (${alumnoPlaceholders}) AND clase_id IN (${clasePlaceholders})`,
        [...alumnoIds, ...claseIds]
      )) as any[];
      entregas = entregaRows;
    }

    let intentos: { examen_id: number; usuario_id: number; calificacion: number | null }[] = [];
    if (examenes.length > 0) {
      const examenIds = examenes.map((e: { id: number }) => e.id);
      const examenPlaceholders = examenIds.map(() => '?').join(',');
      const [intentoRows] = (await pool.execute(
        `SELECT examen_id, usuario_id, calificacion FROM intentos_examenes
         WHERE usuario_id IN (${alumnoPlaceholders}) AND examen_id IN (${examenPlaceholders})`,
        [...alumnoIds, ...examenIds]
      )) as any[];
      intentos = intentoRows;
    }

    const cursosReporte = cursos.map((curso: { id: number; nombre: string }) => {
      const cursoClases = clases.filter((c: { curso_id: number }) => c.curso_id === curso.id);
      const cursoExamenes = examenes.filter((e: { curso_id: number }) => e.curso_id === curso.id);

      const actividades: { id: string; tipo: string; relId: number; titulo: string }[] = [];
      cursoClases.forEach((c: { id: number; titulo: string }) => {
        actividades.push({ id: `t_${c.id}`, tipo: 'tarea', relId: c.id, titulo: c.titulo });
      });
      cursoExamenes.forEach((e: { id: number; titulo: string }) => {
        actividades.push({ id: `e_${e.id}`, tipo: 'examen', relId: e.id, titulo: e.titulo });
      });

      const alumnosConNotas = alumnos.map((alumno: { id: number; nombre: string; email: string; id_estudiante: string }) => {
        const calificaciones: Record<string, number | null> = {};
        actividades.forEach((act) => { calificaciones[act.id] = null; });

        entregas.filter((ent) => ent.usuario_id === alumno.id).forEach((ent) => {
          const actId = `t_${ent.clase_id}`;
          if (actId in calificaciones) calificaciones[actId] = ent.calificacion != null ? Number(ent.calificacion) : null;
        });

        intentos.filter((int) => int.usuario_id === alumno.id).forEach((int) => {
          const actId = `e_${int.examen_id}`;
          if (actId in calificaciones) calificaciones[actId] = int.calificacion != null ? Number(int.calificacion) : null;
        });

        const notas = Object.values(calificaciones).filter((n) => n !== null) as number[];
        const promedioGeneral = notas.length > 0 ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;

        return { id: alumno.id, nombre: alumno.nombre, email: alumno.email, id_estudiante: alumno.id_estudiante, calificaciones, promedioGeneral };
      });

      return { id: curso.id, nombre: curso.nombre, actividades, alumnos: alumnosConNotas };
    });

    return NextResponse.json({ grupo, cursos: cursosReporte });
  } catch (error: unknown) {
    console.error('Error al obtener calificaciones para maestro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
