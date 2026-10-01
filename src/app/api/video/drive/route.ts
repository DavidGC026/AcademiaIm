import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

/** Proxy de video público en Google Drive (sin iframe de accounts.google.com). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !ID_RE.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const candidates = [
    `https://drive.google.com/uc?export=download&confirm=t&id=${id}`,
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
  ];

  for (const driveUrl of candidates) {
    try {
      const res = await fetch(driveUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AcademiaIMCYC/1.0)' },
      });
      const ct = res.headers.get('Content-Type') || '';
      if (!res.ok || ct.includes('text/html')) continue;

      const headers: Record<string, string> = {
        'Content-Type': ct.includes('video') || ct.includes('octet') ? ct : 'video/mp4',
        'Cache-Control': 'private, max-age=3600',
      };
      const len = res.headers.get('Content-Length');
      if (len) headers['Content-Length'] = len;
      const range = res.headers.get('Accept-Ranges');
      if (range) headers['Accept-Ranges'] = range;

      return new NextResponse(res.body, { headers });
    } catch {
      /* siguiente URL */
    }
  }

  return NextResponse.json(
    {
      error:
        'No se pudo acceder al video. En Google Drive compártelo como "Cualquier persona con el enlace" (solo lectura).',
    },
    { status: 502 }
  );
}
