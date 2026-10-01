import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join, basename, extname } from 'path';
import { estudiantePuedeAccederCurso } from '@/lib/cursoGrupos';

export const runtime = 'nodejs';

const ALLOWED = new Set(['.pdf', '.ppt', '.pptx']);

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const privateDir = () => join(process.cwd(), 'storage', 'clases', 'presentaciones');

function refValido(ref: string) {
  return /^clase-pres-\d+\.(pdf|ppt|pptx)$/i.test(basename(ref));
}

async function puedeVerPresentacion(ref: string, session: { userId: number; roleName: string }) {
  if (!refValido(ref)) return false;

  if (session.roleName === 'administrador' || session.roleName === 'maestro') {
    try {
      await access(join(privateDir(), basename(ref)));
      return true;
    } catch {
      return false;
    }
  }

  const [rows] = (await pool.execute(
    `SELECT c.curso_id FROM clases c WHERE c.presentacion_url = ?`,
    [ref]
  )) as any[];

  if (rows.length === 0) return false;
  return estudiantePuedeAccederCurso(session.userId, rows[0].curso_id);
}

/** Sube presentación (PDF, PPT, PPTX) como artículo central de la clase. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return NextResponse.json({ error: 'Formatos permitidos: PDF, PPT, PPTX' }, { status: 400 });
  }

  const dir = privateDir();
  await mkdir(dir, { recursive: true });
  const ref = `clase-pres-${Date.now()}${ext}`;
  await writeFile(join(dir, ref), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ success: true, ref, name: file.name });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref || ref.includes('..')) return NextResponse.json({ error: 'Falta ref' }, { status: 400 });

  if (!(await puedeVerPresentacion(ref, session))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const ext = extname(ref).toLowerCase();
  const inline = ext === '.pdf';

  try {
    const buffer = await readFile(join(privateDir(), basename(ref)));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Disposition': inline ? 'inline' : `attachment; filename="${basename(ref)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
}
