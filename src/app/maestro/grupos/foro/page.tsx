'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, BookOpen, MessageSquare } from 'lucide-react';
import ForoPanel from '@/components/ForoPanel';

interface Course {
  id: number;
  nombre: string;
}

interface Grupo {
  id: number;
  nombre: string;
}

export default function MaestroForoPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<number | null>(null);
  const [cursos, setCursos] = useState<Course[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGrupos = async () => {
    try {
      const res = await fetch('/api/maestro/grupos');
      if (res.ok) {
        const data = await res.json();
        const activeGrupos = data.grupos || [];
        setGrupos(activeGrupos);
        if (activeGrupos.length > 0) {
          setSelectedGrupoId(activeGrupos[0].id);
        }
      }
    } catch (error) {
      console.error('Error al cargar grupos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCursos = async () => {
    try {
      const res = await fetch('/api/cursos');
      if (res.ok) {
        const data = await res.json();
        const activeCursos = data.courses || [];
        setCursos(activeCursos);
        if (activeCursos.length > 0) {
          setSelectedCursoId(activeCursos[0].id);
        } else {
          setSelectedCursoId(null);
        }
      }
    } catch (error) {
      console.error('Error al cargar cursos:', error);
    }
  };

  useEffect(() => {
    fetchGrupos();
  }, []);

  useEffect(() => {
    if (selectedGrupoId) {
      fetchCursos();
    }
  }, [selectedGrupoId]);

  if (loading) {
    return <div style={styles.loading}>Cargando foro...</div>;
  }

  return (
    <div style={styles.container}>
      <Link href="/maestro/grupos" style={styles.backLink}>
        <ArrowLeft size={16} /> Volver a Control de Grupos
      </Link>

      <div style={styles.header}>
        <h1 style={styles.title}>Foro de Presentación e Interacción</h1>
        <p style={styles.subtitle}>
          Visualiza presentaciones e interacciones de tus alumnos por cohorte y materia.
        </p>
      </div>

      <div style={styles.selectorsCard} className="card">
        <div style={styles.selectorsGrid}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="#0073A5" /> Grupo / Cohorte
            </label>
            <select
              className="form-input"
              value={selectedGrupoId || ''}
              onChange={(e) => setSelectedGrupoId(Number(e.target.value) || null)}
            >
              {grupos.length === 0 ? (
                <option value="">No tienes grupos creados</option>
              ) : (
                grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))
              )}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={16} color="#0073A5" /> Materia / Diplomado
            </label>
            <select
              className="form-input"
              value={selectedCursoId || ''}
              onChange={(e) => setSelectedCursoId(Number(e.target.value) || null)}
              disabled={cursos.length === 0}
            >
              {cursos.length === 0 ? (
                <option value="">Sin materias asignadas</option>
              ) : (
                cursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {selectedCursoId ? (
        <div className="card" style={{ marginTop: '24px' }}>
          <ForoPanel cursoId={selectedCursoId} variant="teacher" />
        </div>
      ) : (
        <div className="card" style={{ marginTop: '24px', textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
          <MessageSquare size={48} color="#B0B3B5" style={{ marginBottom: '12px' }} />
          <h4>Selecciona una combinación válida</h4>
          <p>Debes seleccionar un grupo y una materia para cargar el foro.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1000px', margin: '0 auto' },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0073A5',
    marginBottom: '20px',
  },
  header: { marginBottom: '24px' },
  title: { fontSize: '28px', fontWeight: '800', color: '#0073A5', marginBottom: '6px' },
  subtitle: { fontSize: '14px', color: '#64748B' },
  selectorsCard: { padding: '20px' },
  selectorsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#0073A5',
  },
};
