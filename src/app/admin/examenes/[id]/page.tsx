import ExamManagement from '@/components/ExamManagement';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExamManagement examId={(await params).id} role="administrador" />;
}
