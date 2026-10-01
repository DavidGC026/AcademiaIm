import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession, setSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';

// GET: Obtener datos de perfil
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, role_id, email, nombre, foto_perfil, grupo_cohorte, id_estudiante, apellido_paterno, apellido_materno, fecha_nacimiento 
       FROM usuarios 
       WHERE id = ?`,
      [session.userId]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Formatear la fecha de nacimiento a YYYY-MM-DD para el input tipo date
    const user = userRows[0];
    if (user.fecha_nacimiento) {
      const d = new Date(user.fecha_nacimiento);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      user.fecha_nacimiento = `${year}-${month}-${day}`;
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error('Error al obtener perfil:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PUT: Actualizar datos de perfil y/o contraseña
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const {
      nombre,
      id_estudiante,
      apellido_paterno,
      apellido_materno,
      fecha_nacimiento,
      foto_perfil,
      password, // Nueva contraseña opcional
      currentPassword,
    } = await request.json();

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
        return NextResponse.json({ error: 'La nueva contraseña debe tener entre 6 y 128 caracteres.' }, { status: 400 });
      }
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return NextResponse.json({ error: 'Ingresa tu contraseña actual.' }, { status: 400 });
      }
      const [users] = await pool.execute<RowDataPacket[]>(
        'SELECT password FROM usuarios WHERE id = ?', [session.userId]
      );
      if (!users.length || !await bcrypt.compare(currentPassword, users[0].password)) {
        return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 400 });
      }
      await pool.execute('UPDATE usuarios SET password = ? WHERE id = ?', [await bcrypt.hash(password, 10), session.userId]);
      return NextResponse.json({ success: true, message: 'Contraseña actualizada.' });
    }

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    // 1. Actualizar datos básicos
    const updates = [
      'nombre = ?',
      'id_estudiante = ?',
      'apellido_paterno = ?',
      'apellido_materno = ?',
      'fecha_nacimiento = ?',
    ];
    const values: (string | null | number)[] = [
      nombre,
      id_estudiante || null,
      apellido_paterno || null,
      apellido_materno || null,
      fecha_nacimiento || null,
    ];
    if (foto_perfil !== undefined) {
      updates.push('foto_perfil = ?');
      values.push(foto_perfil || null);
    }
    values.push(session.userId);
    await pool.execute(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // 3. Actualizar la cookie de sesión con el nuevo nombre si cambió
    if (nombre !== session.nombre) {
      await setSessionCookie({
        ...session,
        nombre: nombre,
      });
    }

    return NextResponse.json({ success: true, message: 'Perfil actualizado exitosamente' });
  } catch (error: unknown) {
    console.error('Error al actualizar perfil:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
