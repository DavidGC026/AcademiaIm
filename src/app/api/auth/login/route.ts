import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    // Buscar usuario y su rol
    const [rows] = await pool.execute(
      `SELECT u.*, r.nombre as role_name 
       FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    ) as any[];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const user = rows[0];

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Registrar log de acceso
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    await pool.execute(
      `INSERT INTO logs_accesos (usuario_id, ip_address, user_agent) VALUES (?, ?, ?)`,
      [user.id, ip, userAgent]
    );

    // Preparar sesión
    const payload = {
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      roleId: user.role_id,
      roleName: user.role_name,
      grupo_cohorte: user.grupo_cohorte,
    };

    // Guardar cookie de sesión
    await setSessionCookie(payload);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.role_name,
        grupo_cohorte: user.grupo_cohorte,
      },
    });
  } catch (error: any) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error en el servidor' },
      { status: 500 }
    );
  }
}
