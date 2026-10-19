import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTutorialProgress, saveTutorialProgress, TUTORIAL_STEPS } from '@/lib/tutorial';

export async function GET() {
  const session = await getSession();
  if (!session || (session.roleName !== 'administrador' && session.roleName !== 'maestro' && session.roleName !== 'estudiante')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json(await getTutorialProgress(session.userId, session.roleName), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar tu tutorial.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || (session.roleName !== 'administrador' && session.roleName !== 'maestro' && session.roleName !== 'estudiante')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const progress = await request.json().catch(() => null);
  if (!progress || !Number.isInteger(progress.step) || progress.step < 0 || progress.step >= TUTORIAL_STEPS ||
      !['pendiente', 'completado', 'omitido'].includes(progress.status)) {
    return NextResponse.json({ error: 'El avance del tutorial no es válido.' }, { status: 400 });
  }
  try {
    await saveTutorialProgress(session.userId, session.roleName, progress.step, progress.status);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar tu avance. Inténtalo de nuevo.' }, { status: 500 });
  }
}
