import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tieneAccesoBibliotecaPrioritario } from '@/lib/bibliotecaAcceso';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ session: null });
  }
  const acceso_prioritario = await tieneAccesoBibliotecaPrioritario(session.userId, session.roleName);
  return NextResponse.json({ session: { ...session, acceso_prioritario } });
}
