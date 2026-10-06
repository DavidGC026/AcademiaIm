import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { mkdir, unlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isVideoFile, MAX_VIDEO_SIZE_BYTES, MAX_VIDEO_SIZE_MB, validateVideoFile } from '@/lib/videoFiles';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const videoRequested = new URL(request.url).searchParams.get('tipo') === 'video';
    if (videoRequested && Number(request.headers.get('Content-Length')) > MAX_VIDEO_SIZE_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: `El video supera los ${MAX_VIDEO_SIZE_MB} MB.` }, { status: 413 });
    }
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }

    if (videoRequested || isVideoFile(file.name) || file.type.startsWith('video/')) {
      const error = validateVideoFile(file);
      if (error) return NextResponse.json({ error }, { status: file.size > MAX_VIDEO_SIZE_BYTES ? 413 : 400 });
    }

    // Asegurar directorio public/uploads
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Nombre único
    const extension = extname(file.name).toLowerCase();
    const uniqueFileName = `recurso-${randomUUID()}${/^\.[a-z0-9]+$/.test(extension) ? extension : ''}`;
    const filePath = join(uploadDir, uniqueFileName);

    try {
      await pipeline(Readable.fromWeb(file.stream() as import('node:stream/web').ReadableStream), createWriteStream(filePath, { flags: 'wx' }));
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }

    const fileUrl = `/uploads/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      name: file.name,
      url: fileUrl,
    });
  } catch (error) {
    console.error('Error al subir recurso:', error);
    return NextResponse.json({ error: 'Error del servidor al subir el archivo' }, { status: 500 });
  }
}
export const runtime = 'nodejs';
