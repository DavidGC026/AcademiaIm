import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, basename, extname } from 'path';

export const runtime = 'nodejs';

const privateDir = () => join(process.cwd(), 'storage', 'biblioteca', 'revistas');

// Sube PDF de revista a almacenamiento privado.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.roleName !== 'administrador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
  if (extname(file.name).toLowerCase() !== '.pdf') {
    return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
  }

  const dir = privateDir();
  await mkdir(dir, { recursive: true });
  const ref = `revista-${Date.now()}.pdf`;
  await writeFile(join(dir, ref), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ success: true, ref, name: file.name });
}

// Sirve la revista solo a usuarios autenticados (lectura en plataforma).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'Falta ref' }, { status: 400 });

  const [rows] = (await pool.execute(
    `SELECT id FROM biblioteca_revistas WHERE archivo_url = ?`,
    [ref]
  )) as any[];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Revista no encontrada' }, { status: 404 });
  }

  let filePath: string;
  if (ref.startsWith('/uploads/') && !ref.includes('..')) {
    filePath = join(process.cwd(), 'public', 'uploads', basename(ref));
  } else {
    filePath = join(privateDir(), basename(ref));
  }

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
}
