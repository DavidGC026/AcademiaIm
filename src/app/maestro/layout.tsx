import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import './teacher.css';

export default async function MaestroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  if (session.roleName !== 'maestro') {
    redirect(`/${session.roleName}`);
  }

  const user = {
    nombre: session.nombre,
    email: session.email,
    role: session.roleName,
    grupo_cohorte: session.grupo_cohorte,
  };

  return (
    <div className="app-shell">
      <Header user={user} />
      <div className="app-body">
        <Sidebar role="maestro" />
        <main className="app-main app-main--panel">
          {children}
        </main>
      </div>
    </div>
  );
}
