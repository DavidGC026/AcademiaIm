import { NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureGrupoCohorteExists } from '@/lib/grupos';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatFechaNacimiento(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const isoDay = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const userIdToDelete = parseInt(id, 10);

    if (session.userId === userIdToDelete) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 });
    }

    await pool.execute('DELETE FROM usuarios WHERE id = ?', [userIdToDelete]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al eliminar usuario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT id, role_id, email, nombre, apellido_paterno, apellido_materno,
              fecha_nacimiento, grupo_cohorte, acceso_biblioteca_prioritario
       FROM usuarios WHERE id = ?`,
      [userId]
    );
    if (users.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const current = users[0];
    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if ('acceso_biblioteca_prioritario' in body) {
      updates.push('acceso_biblioteca_prioritario = ?');
      values.push(body.acceso_biblioteca_prioritario ? 1 : 0);
    }

    if ('email' in body) {
      const email = asTrimmedString(body.email).toLowerCase();
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'El correo electrónico no es válido' }, { status: 400 });
      }
      const [taken] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (taken.length > 0) {
        return NextResponse.json({ error: 'El correo electrónico ya está registrado' }, { status: 400 });
      }
      updates.push('email = ?');
      values.push(email);
    }

    const editingName =
      'nombres' in body || 'apellido_paterno' in body || 'apellido_materno' in body;
    if (editingName) {
      const nombres = asTrimmedString(body.nombres);
      if (!nombres) {
        return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
      }
      const apellidoPaterno = asTrimmedString(body.apellido_paterno);
      const apellidoMaterno = asTrimmedString(body.apellido_materno);
      const nombreCompleto = [nombres, apellidoPaterno, apellidoMaterno]
        .filter(Boolean)
        .join(' ')
        .trim();

      updates.push('nombre = ?', 'apellido_paterno = ?', 'apellido_materno = ?');
      values.push(nombreCompleto, apellidoPaterno || null, apellidoMaterno || null);
    }

    if ('fecha_nacimiento' in body) {
      const fecha = asTrimmedString(body.fecha_nacimiento);
      if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return NextResponse.json({ error: 'La fecha de nacimiento no es válida' }, { status: 400 });
      }
      updates.push('fecha_nacimiento = ?');
      values.push(fecha || null);
    }

    let grupoAsignado: { id: number; nombre: string } | null = null;
    let quitarGrupo = false;
    if ('grupo_cohorte' in body) {
      const grupoNombre = asTrimmedString(body.grupo_cohorte);
      if (!grupoNombre) {
        updates.push('grupo_cohorte = ?');
        values.push(null);
        quitarGrupo = true;
      } else {
        const grupoId = await ensureGrupoCohorteExists(grupoNombre);
        const [grupoRows] = await pool.execute<RowDataPacket[]>(
          'SELECT id, nombre FROM grupos_cohortes WHERE id = ?',
          [grupoId]
        );
        grupoAsignado = { id: grupoRows[0].id, nombre: grupoRows[0].nombre };
        updates.push('grupo_cohorte = ?');
        values.push(grupoAsignado.nombre);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
      [...values, userId]
    );

    if (grupoAsignado && Number(current.role_id) === 3) {
      await pool.execute(
        `INSERT INTO solicitudes_acceso_grupo (estudiante_id, grupo_id, estado)
         VALUES (?, ?, 'aprobado')
         ON DUPLICATE KEY UPDATE estado = 'aprobado'`,
        [userId, grupoAsignado.id]
      );
    }

    const [updatedRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, nombre, email, grupo_cohorte, created_at,
              id_estudiante, apellido_paterno, apellido_materno, fecha_nacimiento,
              acceso_biblioteca_prioritario
       FROM usuarios WHERE id = ?`,
      [userId]
    );
    const updated = updatedRows[0];
    if (updated) {
      updated.fecha_nacimiento = formatFechaNacimiento(updated.fecha_nacimiento);
    }

    return NextResponse.json({
      success: true,
      user: updated,
      grupoQuitado: quitarGrupo,
    });
  } catch (error: unknown) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
