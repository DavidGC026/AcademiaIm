'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Play,
  FileText,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import ForoPanel from '@/components/ForoPanel';
import BiografiasPanel from '@/components/BiografiasPanel';
import { toAssetUrl } from '@/lib/assetUrl';

interface ClassItem {
  id: number;
  titulo: string;
  descripcion: string;
  requiere_tarea?: number;
  entrega_id?: number | null;
  entrega_estado: 'entregado' | 'calificado' | null;
  calificacion: number | null;
}

interface ExamItem {
  id: number;
  titulo: string;
  mi_calificacion: number | null;
  intento_fecha: string | null;
  permite_reintento: number;
  disponible: boolean;
  motivo_bloqueo: string | null;
}

interface CursoDetail {
  id: number;
  nombre: string;
  descripcion: string;
  imagen: string | null;
}

function ProgressBar({ pct, done, total }: { pct: number; done: number; total: number }) {
  const barColor = pct === 100 ? '#10B981' : '#0073A5';
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Progreso</span>
        <span style={{ fontSize: '13px', fontWeight: 800, color: barColor }}>
          {pct}% <span style={{ fontWeight: 500, color: '#94A3B8' }}>({done}/{total})</span>
        </span>
      </div>
      <div style={{ height: 10, backgroundColor: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export default function MateriaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const cursoId = Number(id);

  const [curso, setCurso] = useState<CursoDetail | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [progreso, setProgreso] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cursoId) return;
    (async () => {
      try {
        const res = await fetch(`/api/estudiante/clases?curso_id=${cursoId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'No se pudo cargar la materia');
        }
        const data = await res.json();
        setCurso(data.curso);
        setClasses(data.classes || []);
        setExams(data.exams || []);
        setPendientes(data.pendientes ?? 0);
        setProgreso(data.progreso || { done: 0, total: 0 });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        setLoading(false);
      }
    })();
  }, [cursoId]);

  if (loading) {
    return <div style={styles.loading}>Cargando materia...</div>;
  }

  if (error || !curso) {
    return (
      <div style={styles.container}>
        <Link href="/estudiante" style={styles.backLink}><ArrowLeft size={16} /> Volver</Link>
        <div className="card" style={styles.emptyState}>{error || 'Materia no encontrada'}</div>
      </div>
    );
  }

  const pct = progreso.total > 0 ? Math.round((progreso.done / progreso.total) * 100) : 0;

  return (
    <div style={styles.container}>
      <Link href="/estudiante" style={styles.backLink}>
        <ArrowLeft size={16} /> Volver a mis materias
      </Link>

      <div className="card" style={styles.headerCard}>
        {curso.imagen ? (
          <img src={toAssetUrl(curso.imagen)} alt="" style={styles.headerImage} />
        ) : (
          <div style={styles.headerImagePlaceholder}>
            <BookOpen size={40} color="#0073A5" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={styles.title}>{curso.nombre}</h1>
          {curso.descripcion && <p style={styles.desc}>{curso.descripcion}</p>}
          <div style={{ marginTop: '16px', maxWidth: '420px' }}>
            <ProgressBar pct={pct} done={progreso.done} total={progreso.total} />
          </div>
          {pendientes > 0 && (
            <span style={styles.pendientesBadge}>
              <AlertCircle size={14} /> {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={styles.sectionTitle}><Play size={16} /> Clases</h2>
        {classes.length === 0 ? (
          <p style={styles.emptySection}>Aún no hay clases publicadas.</p>
        ) : (
          <div style={styles.list}>
            {classes.map((c, idx) => {
              const done = c.requiere_tarea
                ? c.entrega_estado === 'entregado' || c.entrega_estado === 'calificado'
                : true;
              const pending = c.requiere_tarea && !c.entrega_id;
              return (
                <div
                  key={c.id}
                  style={styles.row}
                  onClick={() => router.push(`/estudiante/clases/${c.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/estudiante/clases/${c.id}`)}
                >
                  <span style={styles.orderBadge}>{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.rowTitle}>{c.titulo}</div>
                    {c.descripcion && <div style={styles.rowDesc}>{c.descripcion}</div>}
                  </div>
                  {pending ? (
                    <span style={styles.badgePending}>Tarea pendiente</span>
                  ) : done ? (
                    <CheckCircle size={18} color="#10B981" />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={styles.sectionTitle}><FileText size={16} /> Exámenes</h2>
        {exams.length === 0 ? (
          <p style={styles.emptySection}>Sin exámenes asignados.</p>
        ) : (
          <div style={styles.list}>
            {exams.map((ex) => {
              const done = !ex.permite_reintento && (ex.intento_fecha != null || ex.mi_calificacion != null);
              return (
                <div
                  key={ex.id}
                  style={styles.row}
                  onClick={() => router.push(`/estudiante/examenes/${ex.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/estudiante/examenes/${ex.id}`)}
                >
                  <FileText size={16} color="#0073A5" />
                  <div style={{ flex: 1 }}>
                    <div style={styles.rowTitle}>{ex.titulo}</div>
                    {!done && !ex.disponible && <div style={styles.rowDesc}>{ex.motivo_bloqueo}</div>}
                    {ex.mi_calificacion != null && (
                      <div style={styles.rowDesc}>{ex.permite_reintento ? 'Calificación anterior' : 'Calificación'}: {ex.mi_calificacion}%</div>
                    )}
                  </div>
                  {done ? (
                    <CheckCircle size={18} color="#10B981" />
                  ) : (
                    <span style={styles.badgePending}>{!ex.disponible ? 'Bloqueado' : ex.permite_reintento ? 'Nuevo intento habilitado' : 'Disponible'}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={styles.sectionTitle}><MessageSquare size={16} /> Foro de presentación</h2>
        <ForoPanel cursoId={cursoId} variant="student" />
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <BiografiasPanel cursoId={cursoId} variant="student" />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '900px', margin: '0 auto' },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0073A5',
    marginBottom: '20px',
  },
  loading: { textAlign: 'center', padding: '60px', color: '#0073A5', fontWeight: 600 },
  emptyState: { padding: '40px', textAlign: 'center', color: '#64748B' },
  headerCard: {
    display: 'flex',
    gap: '24px',
    padding: '24px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  headerImage: {
    width: '160px',
    height: '120px',
    objectFit: 'cover',
    borderRadius: '12px',
    flexShrink: 0,
  },
  headerImagePlaceholder: {
    width: '160px',
    height: '120px',
    borderRadius: '12px',
    backgroundColor: 'rgba(0,115,165,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: '24px', fontWeight: '800', color: '#0073A5', margin: '0 0 8px' },
  desc: { fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 },
  pendientesBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#D97706',
    fontSize: '12px',
    fontWeight: 700,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '16px',
    color: 'var(--text-primary)',
  },
  emptySection: { color: '#94A3B8', fontSize: '13px', margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    backgroundColor: '#F8FAFC',
    cursor: 'pointer',
  },
  orderBadge: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#0073A5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  rowTitle: { fontWeight: 600, fontSize: '14px' },
  rowDesc: { fontSize: '12px', color: '#64748B', marginTop: '2px' },
  badgePending: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#D97706',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: '4px 8px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
  },
};
