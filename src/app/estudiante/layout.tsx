import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ChatBot from '@/components/ChatBot';

export default async function EstudianteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  if (session.roleName !== 'estudiante') {
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
        <Sidebar role="estudiante" />
        <main className="app-main app-main--student">
          {children}
          <ChatBot />
        </main>
      </div>
    </div>
  );
}
