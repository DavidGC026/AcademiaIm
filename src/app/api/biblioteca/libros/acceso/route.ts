import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  esStaffBiblioteca,
  otorgarAccesoLibro,
  revocarAccesoOtorgadoLibro,
  maestroPuedeOtorgarAccesoAlumno,
} from '@/lib/bibliotecaAcceso';

async function resolverEstudiante(idInput: string) {
  const q = idInput.trim();
  if (!q) return null;
  const usuarioIdNum = /^\d+$/.test(q) ? parseInt(q, 10) : -1;
  const [estudiantes] = (await pool.execute(
    `SELECT u.id, u.nombre, u.id_estudiante
     FROM usuarios u
     JOIN roles r ON u.role_id = r.id
     WHERE r.nombre = 'estudiante' AND (u.id_estudiante = ? OR u.id = ?)
     LIMIT 1`,
    [q, usuarioIdNum]
  )) as any[];
  return estudiantes[0] ?? null;
}

async function validarStaffParaAlumno(
  session: { userId: number; roleName: string },
  estudianteId: number
) {
  if (
    session.roleName === 'maestro' &&
    !(await maestroPuedeOtorgarAccesoAlumno(session.userId, estudianteId))
  ) {
    return NextResponse.json(
      { error: 'Solo puedes gestionar acceso de alumnos de tus grupos' },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !esStaffBiblioteca(session.roleName)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { libro_id, id_estudiante } = await request.json();
    if (!libro_id || !id_estudiante || typeof id_estudiante !== 'string') {
      return NextResponse.json({ error: 'Libro e ID de alumno son obligatorios' }, { status: 400 });
    }

    const [libros] = (await pool.execute(
      `SELECT id, titulo FROM biblioteca_libros WHERE id = ?`,
      [libro_id]
    )) as any[];
    if (!libros[0]) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    const estudiante = await resolverEstudiante(id_estudiante);
    if (!estudiante) {
      return NextResponse.json({ error: 'No se encontró un alumno con ese ID' }, { status: 404 });
    }

    const denied = await validarStaffParaAlumno(session, estudiante.id);
    if (denied) return denied;

    const result = await otorgarAccesoLibro(estudiante.id, Number(libro_id));
    if (result === 'ya_tiene') {
      return NextResponse.json({
        success: true,
        ya_tiene: true,
        message: `${estudiante.nombre} ya tiene acceso a este libro`,
        estudiante: {
          id: estudiante.id,
          nombre: estudiante.nombre,
          id_estudiante: estudiante.id_estudiante,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Acceso otorgado a ${estudiante.nombre}`,
      estudiante: {
        id: estudiante.id,
        nombre: estudiante.nombre,
        id_estudiante: estudiante.id_estudiante,
      },
    });
  } catch (error: unknown) {
    console.error('Error al otorgar acceso al libro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || !esStaffBiblioteca(session.roleName)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { libro_id, id_estudiante } = await request.json();
    if (!libro_id || !id_estudiante || typeof id_estudiante !== 'string') {
      return NextResponse.json({ error: 'Libro e ID de alumno son obligatorios' }, { status: 400 });
    }

    const [libros] = (await pool.execute(`SELECT id FROM biblioteca_libros WHERE id = ?`, [libro_id])) as any[];
    if (!libros[0]) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    const estudiante = await resolverEstudiante(id_estudiante);
    if (!estudiante) {
      return NextResponse.json({ error: 'No se encontró un alumno con ese ID' }, { status: 404 });
    }

    const denied = await validarStaffParaAlumno(session, estudiante.id);
    if (denied) return denied;

    const result = await revocarAccesoOtorgadoLibro(estudiante.id, Number(libro_id));

    if (result === 'sin_otorgado') {
      return NextResponse.json({
        error: 'Este alumno no tiene acceso otorgado a este libro (puede tener compra o acceso prioritario)',
      }, { status: 400 });
    }

    if (result === 'sigue_con_acceso') {
      return NextResponse.json({
        success: true,
        message: `Acceso otorgado retirado, pero ${estudiante.nombre} aún tiene acceso (compra o acceso prioritario)`,
        estudiante: {
          id: estudiante.id,
          nombre: estudiante.nombre,
          id_estudiante: estudiante.id_estudiante,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Acceso retirado a ${estudiante.nombre}`,
      estudiante: {
        id: estudiante.id,
        nombre: estudiante.nombre,
        id_estudiante: estudiante.id_estudiante,
      },
    });
  } catch (error: unknown) {
    console.error('Error al revocar acceso al libro:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
