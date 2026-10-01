import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { tieneAccesoLibro } from '@/lib/bibliotecaAcceso';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, basename, extname } from 'path';

export const runtime = 'nodejs';

const privateDir = () => join(process.cwd(), 'storage', 'biblioteca');

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Sube un archivo de libro a almacenamiento privado (fuera de /public).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.roleName !== 'administrador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });

  const dir = privateDir();
  await mkdir(dir, { recursive: true });
  const ext = extname(file.name).toLowerCase();
  const ref = `libro-${Date.now()}${ext}`;
  await writeFile(join(dir, ref), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ success: true, ref, name: file.name });
}

// Sirve el contenido del libro solo a usuarios con acceso (lectura en plataforma).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'Falta ref' }, { status: 400 });

  // Localizar el libro por su archivo para validar acceso.
  const [libros] = (await pool.execute(
    `SELECT id FROM biblioteca_libros WHERE archivo_url = ?`,
    [ref]
  )) as any[];
  const libroId = libros[0]?.id as number | undefined;

  if (!libroId) {
    return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
  }

  if (!(await tieneAccesoLibro(session.userId, session.roleName, libroId))) {
    return NextResponse.json({ error: 'Sin acceso a este libro' }, { status: 403 });
  }

  // Resolver ruta: refs nuevas viven en storage privado; refs legacy (/uploads/...) en public.
  let filePath: string;
  if (ref.startsWith('/uploads/') && !ref.includes('..')) {
    filePath = join(process.cwd(), 'public', 'uploads', basename(ref));
  } else {
    filePath = join(privateDir(), basename(ref)); // basename evita path traversal
  }

  try {
    const buffer = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mime,
        // inline para lectura en plataforma. ponytail: no es DRM real; un usuario
        // decidido aún puede guardar el archivo desde el visor del navegador.
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
}
