import { NextResponse } from 'next/server';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { basename, extname, join } from 'path';
import { getSession } from '@/lib/auth';
import { parseByteRange } from '@/lib/httpRange';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};

/** Sirve archivos de public/uploads vía API (Turbopack dev a veces no expone /uploads nuevos). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref || !ref.startsWith('/uploads/') || ref.includes('..')) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  }

  const filePath = join(process.cwd(), 'public', 'uploads', basename(ref));

  try {
    const file = await stat(filePath);
    if (!file.isFile()) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    const range = parseByteRange(request.method === 'HEAD' ? null : request.headers.get('Range'), file.size);
    if (range === 'invalid') {
      return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${file.size}`, 'Accept-Ranges': 'bytes' } });
    }
    const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    const body = request.method === 'HEAD' || file.size === 0
      ? null
      : Readable.toWeb(createReadStream(filePath, range || undefined)) as ReadableStream<Uint8Array>;
    return new NextResponse(body, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(range ? range.end - range.start + 1 : file.size),
        ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${file.size}` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
}

export const HEAD = GET;
