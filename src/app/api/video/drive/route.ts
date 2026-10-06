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

  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (!id || !ID_RE.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  const resourceKey = params.get('resourcekey');
  if (resourceKey && !/^[a-zA-Z0-9_-]+$/.test(resourceKey)) {
    return NextResponse.json({ error: 'Clave de recurso inválida' }, { status: 400 });
  }
  const range = request.headers.get('Range');

  const candidates = [
    `https://drive.google.com/uc?export=download&confirm=t&id=${id}`,
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
  ];

  for (const driveUrl of candidates) {
    try {
      const url = new URL(driveUrl);
      if (resourceKey) url.searchParams.set('resourcekey', resourceKey);
      const res = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        signal: request.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AcademiaIMCYC/1.0)',
          ...(range ? { Range: range } : {}),
        },
      });
      const ct = res.headers.get('Content-Type') || '';
      if (res.status === 416 && res.headers.has('Content-Range')) {
        await res.body?.cancel();
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': res.headers.get('Content-Range')! } });
      }
      if (!res.ok || ct.includes('text/html')) {
        await res.body?.cancel();
        continue;
      }

      const headers: Record<string, string> = {
        'Content-Type': ct.includes('video') || ct.includes('octet') ? ct : 'video/mp4',
        'Cache-Control': 'private, max-age=3600',
      };
      const len = res.headers.get('Content-Length');
      if (len) headers['Content-Length'] = len;
      const acceptRanges = res.headers.get('Accept-Ranges');
      if (acceptRanges) headers['Accept-Ranges'] = acceptRanges;
      const contentRange = res.headers.get('Content-Range');
      if (contentRange) headers['Content-Range'] = contentRange;

      return new NextResponse(res.body, { status: res.status, headers });
    } catch {
      if (request.signal.aborted) break;
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
