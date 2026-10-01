import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { sendConfirmationEmail } from '@/lib/mailer';

/** Genera un ID único con formato EST-0001, EST-0002, etc. */
async function generateStudentId(): Promise<string> {
  const [rows] = (await pool.execute(
    `SELECT id_estudiante FROM usuarios
     WHERE id_estudiante IS NOT NULL AND id_estudiante REGEXP '^EST-[0-9]+$'`
  )) as any[];

  let maxNum = 0;
  for (const row of rows) {
    const match = row.id_estudiante.match(/^EST-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  const candidate = `EST-${String(maxNum + 1).padStart(4, '0')}`;
  const [existing] = (await pool.execute(
    'SELECT id FROM usuarios WHERE id_estudiante = ?',
    [candidate]
  )) as any[];

  if (existing.length > 0) {
    return `EST-${Date.now()}`;
  }
  return candidate;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.nombre, u.email, u.role_id, u.grupo_cohorte, u.created_at, r.nombre as role_name,
              u.id_estudiante, u.apellido_paterno, u.apellido_materno, u.fecha_nacimiento,
              u.acceso_biblioteca_prioritario
       FROM usuarios u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );

    return NextResponse.json({ users: rows });
  } catch (error: any) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { role_id, email } = body;

    if (!role_id || !email) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Verificar si el usuario ya existe
    const [existing] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]) as any[];
    if (existing.length > 0) {
      return NextResponse.json({ error: 'El correo electrónico ya está registrado' }, { status: 400 });
    }

    let password = '';
    let nombre = '';
    let id_estudiante = null;
    let apellido_paterno = null;
    let apellido_materno = null;
    let fecha_nacimiento = null;
    let grupo_cohorte: string | null = null;

    if (role_id === 3) {
      // Estudiante: ID y contraseña generados automáticamente
      const {
        nombres,
        apellido_paterno: pat,
        apellido_materno: mat,
        fecha_nacimiento: fNac,
      } = body;

      if (!nombres || !pat || !mat || !fNac) {
        return NextResponse.json({
          error: 'Faltan campos obligatorios del estudiante (nombres, apellido paterno, apellido materno o fecha de nacimiento)',
        }, { status: 400 });
      }

      nombre = `${nombres} ${pat} ${mat}`.trim();
      id_estudiante = await generateStudentId();
      apellido_paterno = pat.trim();
      apellido_materno = mat.trim();
      fecha_nacimiento = fNac; // YYYY-MM-DD

      // Generar contraseña automática:
      // 1. 2 caracteres del ID de estudiante: el primero y el último
      const cleanId = id_estudiante.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
      const idPart = cleanId.length >= 2 ? cleanId[0] + cleanId[cleanId.length - 1] : cleanId;

      // 2. Las 2 primeras letras del apellido del alumno (paterno)
      const cleanPaterno = apellido_paterno.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
      const patPart = cleanPaterno.substring(0, 2);

      // 3. Las 2 primeras letras del apellido materno
      const cleanMaterno = apellido_materno.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
      const matPart = cleanMaterno.substring(0, 2);

      // 4. Las 2 primeras letras de su nombre (primer nombre)
      const cleanNombres = nombres.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
      const firstName = cleanNombres.split(' ')[0];
      const nombrePart = firstName.substring(0, 2);

      // 5. Por último su día de nacimiento solamente (2 dígitos)
      const dayPart = fNac.split('-')[2] || '01';

      // Combinar todo
      password = `${idPart}${patPart}${matPart}${nombrePart}${dayPart}`;
    } else {
      // Maestro/Admin: contraseña manual
      nombre = body.nombre;
      password = body.password;

      if (!nombre || !password) {
        return NextResponse.json({ error: 'Faltan campos obligatorios (nombre o contraseña)' }, { status: 400 });
      }
    }

    // Encriptar contraseña para base de datos
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO usuarios (role_id, email, password, nombre, grupo_cohorte, id_estudiante, apellido_paterno, apellido_materno, fecha_nacimiento) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        role_id,
        email,
        hashedPassword,
        nombre,
        grupo_cohorte,
        id_estudiante,
        apellido_paterno,
        apellido_materno,
        fecha_nacimiento
      ]
    ) as any[];

    // Enviar correo de confirmación para estudiante
    let emailSent = false;
    let simulatedEmail = false;
    let emailError: string | null = null;

    if (Number(role_id) === 3 && id_estudiante) {
      try {
        const mailRes = await sendConfirmationEmail(
          email,
          nombre,
          id_estudiante,
          password,
          grupo_cohorte
        );
        emailSent = mailRes.success && !mailRes.simulated;
        simulatedEmail = mailRes.simulated;
        emailError = mailRes.error || null;
      } catch (mailErr: unknown) {
        const message = mailErr instanceof Error ? mailErr.message : 'Error desconocido';
        console.error('Error al enviar correo de confirmación:', mailErr);
        emailError = message;
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: result.insertId,
        nombre,
        email,
        role_id,
        grupo_cohorte,
        id_estudiante,
      },
      generatedPassword: Number(role_id) === 3 ? password : null,
      emailSent,
      simulatedEmail,
      emailError,
    });
  } catch (error: any) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
