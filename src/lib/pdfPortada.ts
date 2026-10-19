import { execFile } from 'child_process';
import { basename, join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SCRIPT_REL = join('scripts', 'pdf_portada.py');
const ANCHO_PX = 480;
const TIMEOUT_MS = 25_000;

/** Nombre del JPEG de portada para un archivo subido (mismo directorio, sufijo -portada). */
export function nombrePortada(nombreArchivo: string): string {
  return `${nombreArchivo.replace(/\.[^.]+$/, '')}-portada.jpg`;
}

/**
 * Genera la portada (página 1) de un PDF ya guardado en public/uploads.
 * Devuelve la URL pública (`/uploads/...-portada.jpg`) o null si no se pudo generar.
 *
 * ponytail: se ejecuta en línea dentro del POST de subida (~50-300 ms por PDF).
 * Si algún día se suben PDFs muy pesados, mover a una cola en segundo plano.
 */
export async function generarPortadaPdf(nombreArchivo: string): Promise<string | null> {
  if (basename(nombreArchivo) !== nombreArchivo || !/^[a-zA-Z0-9._-]+\.pdf$/i.test(nombreArchivo)) return null;
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  const pdfPath = join(uploadDir, nombreArchivo);
  const jpgName = nombrePortada(nombreArchivo);
  const jpgPath = join(uploadDir, jpgName);

  try {
    const { stdout } = await execFileAsync(
      'python3',
      [join(process.cwd(), SCRIPT_REL), pdfPath, jpgPath, '--ancho', String(ANCHO_PX)],
      { timeout: TIMEOUT_MS, maxBuffer: 1024 * 64 }
    );
    const salida = JSON.parse(stdout.trim() || '{}') as { ok?: boolean; error?: string };
    if (!salida.ok) {
      console.warn(`No se generó portada de ${nombreArchivo}: ${salida.error || 'sin detalle'}`);
      return null;
    }
    return `/uploads/${jpgName}`;
  } catch (error) {
    // Un fallo de portada nunca debe tumbar la subida: el recurso queda con icono genérico.
    console.warn(`No se generó portada de ${nombreArchivo}:`, error instanceof Error ? error.message : error);
    return null;
  }
}
