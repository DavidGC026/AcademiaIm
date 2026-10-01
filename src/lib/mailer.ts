import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

let cachedTransporter: nodemailer.Transporter | null | undefined;

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Academia IMCYC <cursos@imcyc.com>',
  };
}

/** Crea el transporte en el momento del envío para que Next.js ya haya cargado .env.local */
function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  const { host, port, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) {
    cachedTransporter = null;
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
  });

  return cachedTransporter;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

/**
 * Envía el correo de bienvenida al estudiante con sus credenciales.
 * Si SMTP no está configurado o falla, guarda una simulación en simulated_emails.log.
 */
export async function sendConfirmationEmail(
  email: string,
  nombre: string,
  idEstudiante: string,
  plainPassword: string,
  grupoCohorte?: string | null
): Promise<{ success: boolean; simulated: boolean; error?: string }> {
  const { from: smtpFrom } = getSmtpConfig();
  const appUrl = getAppUrl();
  const mailSubject = 'Bienvenido a la Academia IMCYC - Tu cuenta ha sido creada';

  const mailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #B0B3B5; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background-color: #0073A5; padding: 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Academia IMCYC</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Instituto Mexicano del Cemento y del Concreto A.C.</p>
      </div>
      
      <div style="padding: 24px; background-color: #FFFFFF; color: #334155; line-height: 1.6;">
        <h2 style="color: #0073A5; margin-top: 0; font-size: 20px;">¡Hola, ${nombre}!</h2>
        <p>Tu acceso a la plataforma digital de la <strong>Academia IMCYC</strong> ya está listo. Un administrador creó tu cuenta de estudiante.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0073A5; font-size: 16px;">Tus credenciales de acceso</h3>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B; width: 150px;">Usuario (correo):</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B;">ID de estudiante:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${idEstudiante}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B;">Contraseña temporal:</td>
              <td style="padding: 6px 0; color: #E11D48; font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 0.05em;">${plainPassword}</td>
            </tr>
            ${grupoCohorte ? `
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B;">Grupo / cohorte:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${grupoCohorte}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p>Te recomendamos cambiar tu contraseña al ingresar por primera vez.</p>
        
        <div style="text-align: center; margin: 30px 0 10px 0;">
          <a href="${appUrl}" style="background-color: #0073A5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 10px rgba(0, 115, 165, 0.2);">
            Ingresar a la Academia
          </a>
        </div>
      </div>
      
      <div style="background-color: #F1F5F9; padding: 16px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0;">
        <p style="margin: 0;">Este es un correo automático; no respondas a esta dirección.</p>
        <p style="margin: 4px 0 0 0;">Contacto: <strong>cursos@imcyc.com</strong> | Tel: <strong>(55) 53 22 57 40 Ext. 210</strong></p>
      </div>
    </div>
  `;

  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: mailSubject,
        html: mailHtml,
        text: `Hola, ${nombre}.\n\nTu acceso a la Academia IMCYC ya está listo.\n\nUsuario: ${email}\nID estudiante: ${idEstudiante}\nContraseña temporal: ${plainPassword}\n\nIngresa en: ${appUrl}`,
      });
      console.log(`[CORREO] Confirmación enviada a ${email}`);
      return { success: true, simulated: false };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CORREO] Falló el envío SMTP, recurriendo a simulación:', message);
    }
  } else {
    console.warn('[CORREO] SMTP no configurado (SMTP_HOST, SMTP_USER, SMTP_PASS). Modo simulación.');
  }

  try {
    const logPath = path.join(process.cwd(), 'simulated_emails.log');
    const logEntry = `
========================================
FECHA: ${new Date().toISOString()}
DESTINATARIO: ${email} (${nombre})
ASUNTO: ${mailSubject}
----------------------------------------
ID ESTUDIANTE: ${idEstudiante}
CONTRASENA GENERADA: ${plainPassword}
GRUPO/COHORTE: ${grupoCohorte || 'Ninguno'}
----------------------------------------
CONTENIDO (HTML):
${mailHtml}
========================================
\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
    console.log(`[SIMULACIÓN] Correo guardado en simulated_emails.log para ${email}`);
    return { success: true, simulated: true };
  } catch (fsError: unknown) {
    const message = fsError instanceof Error ? fsError.message : String(fsError);
    console.error('Error al guardar simulación de correo:', fsError);
    return { success: false, simulated: true, error: message };
  }
}

/**
 * Envía un correo al estudiante notificando sobre una nueva clase en vivo programada.
 */
export async function sendLiveClassNotificationEmail(
  email: string,
  nombre: string,
  titulo: string,
  fechaHora: string,
  enlaceClase: string | null,
  grupoNombre: string
): Promise<{ success: boolean; simulated: boolean; error?: string }> {
  const { from: smtpFrom } = getSmtpConfig();
  const appUrl = getAppUrl();
  const mailSubject = `Nueva Clase en Vivo Programada: ${titulo}`;
  
  const formattedDate = new Date(fechaHora).toLocaleString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const mailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #B0B3B5; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background-color: #0073A5; padding: 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Academia IMCYC</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Clase en Vivo Programada</p>
      </div>
      
      <div style="padding: 24px; background-color: #FFFFFF; color: #334155; line-height: 1.6;">
        <h2 style="color: #0073A5; margin-top: 0; font-size: 20px;">¡Hola, ${nombre}!</h2>
        <p>Tu profesor ha programado una nueva clase en vivo para tu grupo <strong>${grupoNombre}</strong>.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0073A5; font-size: 16px;">Detalles de la sesión</h3>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B; width: 120px;">Clase:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${titulo}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B;">Fecha y Hora:</td>
              <td style="padding: 6px 0; color: #0F172A; font-weight: 600; text-transform: capitalize;">${formattedDate} hrs</td>
            </tr>
            ${enlaceClase ? `
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #64748B;">Acceso:</td>
              <td style="padding: 6px 0; color: #EF4444; font-weight: bold;"><a href="${enlaceClase}" target="_blank" style="color: #EF4444; text-decoration: underline;">Enlace de la sesión</a></td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p>Te sugerimos ingresar a la plataforma minutos antes para validar tu conexión.</p>
        
        <div style="text-align: center; margin: 30px 0 10px 0;">
          <a href="${appUrl}/estudiante/calendario" style="background-color: #0073A5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 10px rgba(0, 115, 165, 0.2);">
            Ver en mi Calendario
          </a>
        </div>
      </div>
      
      <div style="background-color: #F1F5F9; padding: 16px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0;">
        <p style="margin: 0;">Este es un correo automático; no respondas a esta dirección.</p>
        <p style="margin: 4px 0 0 0;">Contacto: <strong>cursos@imcyc.com</strong> | Tel: <strong>(55) 53 22 57 40 Ext. 210</strong></p>
      </div>
    </div>
  `;

  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: mailSubject,
        html: mailHtml,
        text: `Hola, ${nombre}.\n\nNueva clase en vivo programada: ${titulo}\nFecha y hora: ${formattedDate} hrs\nEnlace: ${enlaceClase || 'No asignado'}\n\nVer más en: ${appUrl}/estudiante/calendario`,
      });
      console.log(`[CORREO CLASE EN VIVO] Notificación enviada a ${email}`);
      return { success: true, simulated: false };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CORREO CLASE EN VIVO] Falló el envío SMTP, recurriendo a simulación:', message);
    }
  }

  try {
    const logPath = path.join(process.cwd(), 'simulated_emails.log');
    const logEntry = `
========================================
FECHA: ${new Date().toISOString()}
DESTINATARIO: ${email} (${nombre})
ASUNTO: ${mailSubject}
----------------------------------------
TÍTULO CLASE: ${titulo}
FECHA HORA: ${formattedDate} hrs
ENLACE: ${enlaceClase || 'Ninguno'}
GRUPO: ${grupoNombre}
----------------------------------------
CONTENIDO (HTML):
${mailHtml}
========================================
\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
    console.log(`[SIMULACIÓN CLASE EN VIVO] Correo guardado en simulated_emails.log para ${email}`);
    return { success: true, simulated: true };
  } catch (fsError: unknown) {
    const message = fsError instanceof Error ? fsError.message : String(fsError);
    console.error('Error al guardar simulación de correo de clase en vivo:', fsError);
    return { success: false, simulated: true, error: message };
  }
}
