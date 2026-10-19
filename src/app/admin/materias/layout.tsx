import CourseManagement from '@/components/CourseManagement';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import '@/app/maestro/teacher.css';

export default async function MateriasLayout() {
  const session = await getSession();
  if (!session) redirect('/');
  return <CourseManagement role="administrador" userId={session.userId} />;
}
