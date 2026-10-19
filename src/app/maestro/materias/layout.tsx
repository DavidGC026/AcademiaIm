import CourseManagement from '@/components/CourseManagement';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MateriasLayout() {
  const session = await getSession();
  if (!session) redirect('/');
  return <CourseManagement role="maestro" userId={session.userId} />;
}
