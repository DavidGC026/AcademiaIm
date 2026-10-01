'use client';

import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Save, Download, RotateCcw, Search } from 'lucide-react';
import { toAssetUrl } from '@/lib/assetUrl';

interface Submission {
  id: number;
  clase_id: number;
  usuario_id: number;
  archivo_nombre: string;
  archivo_url: string;
  estado: 'entregado' | 'calificado';
  fecha_entrega: string;
  calificacion: number | null;
  comentarios: string | null;
  permite_reenvio?: number;
  estudiante_nombre: string;
  clase_titulo: string;
  curso_nombre: string;
}

export default function GradeSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | Submission['estado']>('entregado');
  const [courseFilter, setCourseFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Estados del formulario de calificación
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [calificacion, setCalificacion] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reenvioLoadingId, setReenvioLoadingId] = useState<number | null>(null);

  const fetchSubmissions = () => fetch('/api/tareas')
    .then(async response => {
      if (!response.ok) throw new Error('No se pudieron cargar las entregas. Intenta de nuevo.');
      return response.json();
    })
    .then(result => {
        setSubmissions(result.submissions);
        setError('');
    })
    .catch(error => setError(error instanceof Error ? error.message : 'No se pudieron cargar las entregas. Intenta de nuevo.'))
    .finally(() => setLoading(false));

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const startGrading = (sub: Submission) => {
    setSelectedSubId(sub.id);
    setCalificacion(sub.calificacion !== null ? sub.calificacion.toString() : '');
    setComentarios(sub.comentarios || '');
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSubId === null || !calificacion) return;
    setSubmitLoading(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/tareas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSubId,
          calificacion: parseFloat(calificacion),
          comentarios
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'No se pudo guardar la calificación.');
      }
      if (res.ok) {
        setSelectedSubId(null);
        setCalificacion('');
        setComentarios('');
        setNotice('Calificación guardada correctamente.');
        fetchSubmissions();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar la calificación. Revisa tu conexión.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const pendingCount = submissions.filter(submission => submission.estado === 'entregado').length;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const filteredSubmissions = submissions.filter(submission =>
    (statusFilter === 'todos' || submission.estado === statusFilter) &&
    (!courseFilter || submission.curso_nombre === courseFilter) &&
    normalize(`${submission.estudiante_nombre} ${submission.clase_titulo} ${submission.curso_nombre}`).includes(normalize(search))
  );
  const courseNames = [...new Set(submissions.map(submission => submission.curso_nombre))];

  const handleAllowResubmit = async (subId: number) => {
    if (!confirm('¿Permitir que el alumno vuelva a subir su entrega? Se mantendrá la calificación actual hasta que entregue de nuevo.')) return;
    setReenvioLoadingId(subId);
    try {
      const res = await fetch('/api/tareas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subId, permite_reenvio: true }),
      });
      if (res.ok) {
        fetchSubmissions();
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo habilitar el reenvío');
      }
    } catch (error) {
      console.error('Error al habilitar reenvío:', error);
    } finally {
      setReenvioLoadingId(null);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Cargando entregas de tareas...</div>;
  }

  return (
    <div className="teacher-workspace">
      <div className="teacher-page-heading">
        <div><p className="teacher-eyebrow">Panel de maestros</p>
        <h1>Tareas por calificar</h1>
        <p className="teacher-page-description">{pendingCount === 1 ? 'Tienes 1 entrega pendiente de revisión.' : `Tienes ${pendingCount} entregas pendientes de revisión.`} Busca por alumno, clase o módulo.</p></div>
      </div>

      {notice && <div className="teacher-alert" role="status">{notice}</div>}
      {error && <div className="teacher-alert teacher-alert--error" role="alert"><span>{error}</span><button type="button" className="btn btn-secondary" onClick={fetchSubmissions}>Reintentar</button></div>}
      <div className="card teacher-grading-toolbar">
        <div className="teacher-grading-controls">
          <label className="teacher-search"><Search size={18} /><span className="sr-only">Buscar entregas</span><input type="search" placeholder="Alumno, clase o módulo" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label className="form-label" htmlFor="grading-course">Módulo<select id="grading-course" className="form-input" value={courseFilter} onChange={event => setCourseFilter(event.target.value)}><option value="">Todos los módulos</option>{courseNames.map(name => <option key={name}>{name}</option>)}</select></label>
        </div>
        <div className="teacher-filters" role="group" aria-label="Filtrar entregas por estado">
          <button type="button" aria-pressed={statusFilter === 'entregado'} onClick={() => setStatusFilter('entregado')}>Pendientes <span>{pendingCount}</span></button>
          <button type="button" aria-pressed={statusFilter === 'calificado'} onClick={() => setStatusFilter('calificado')}>Calificadas <span>{submissions.length - pendingCount}</span></button>
          <button type="button" aria-pressed={statusFilter === 'todos'} onClick={() => setStatusFilter('todos')}>Todas <span>{submissions.length}</span></button>
        </div>
        <p className="teacher-result-count" role="status">{filteredSubmissions.length} entrega{filteredSubmissions.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={styles.main}>
        {filteredSubmissions.length === 0 && !error ? (
          <div className="card" style={styles.emptyCard}>
            <CheckCircle2 size={48} color="var(--success)" />
            <h2>{search || courseFilter ? 'No hay entregas con estos filtros' : statusFilter === 'entregado' ? 'Sin tareas pendientes' : 'Aún no hay entregas en esta vista'}</h2>
            <p>{search || courseFilter ? 'Cambia la búsqueda o selecciona otro módulo.' : 'Las entregas de tus alumnos aparecerán aquí para revisarlas.'}</p>
            {(search || courseFilter) && <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setCourseFilter(''); }}>Limpiar filtros</button>}
          </div>
        ) : (
          <div className="teacher-grading-list">
            {filteredSubmissions.map((sub) => {
              const isEditing = selectedSubId === sub.id;
              return (
                <div key={sub.id} className="card" style={styles.subItem}>
                  <div className="teacher-submission-header">
                    <div>
                      <h4 style={styles.studentName}>{sub.estudiante_nombre}</h4>
                      <p style={styles.classContext}>
                        {sub.curso_nombre} &gt; <strong>{sub.clase_titulo}</strong>
                      </p>
                    </div>
                    <span className={`badge badge-${sub.estado}`} style={styles.badge}>
                      {sub.estado === 'entregado' ? 'Pendiente de calificar' : 'Calificada'}
                      {Number(sub.permite_reenvio) === 1 && ' · reenvío habilitado'}
                    </span>
                  </div>

                  <div className="teacher-submission-file">
                    <FileText size={20} color="#64748B" />
                    <div style={styles.fileInfo}>
                      <div style={styles.fileName}>{sub.archivo_nombre}</div>
                      <div style={styles.fileDate}>
                        Entregado el:{' '}
                        {new Date(sub.fecha_entrega).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <a
                      href={toAssetUrl(sub.archivo_url)}
                      download
                      target="_blank"
                      rel="noreferrer"
                      style={styles.downloadBtn}
                      className="btn btn-secondary"
                    >
                      <Download size={14} /> Descargar
                    </a>
                  </div>

                  {/* Formulario de Calificación */}
                  {isEditing ? (
                    <form onSubmit={handleGradeSubmit} style={styles.gradeForm}>
                      <div style={styles.formRow}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label" htmlFor={`grade-${sub.id}`}>Calificación (0 - 100)</label>
                          <input
                            id={`grade-${sub.id}`}
                            autoFocus
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="form-input"
                            value={calificacion}
                            onChange={(e) => setCalificacion(e.target.value)}
                            placeholder="Ej. 95"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor={`feedback-${sub.id}`}>Comentarios para el alumno</label>
                        <textarea
                          id={`feedback-${sub.id}`}
                          className="form-textarea"
                          rows={3}
                          value={comentarios}
                          onChange={(e) => setComentarios(e.target.value)}
                          placeholder="Añade observaciones sobre el trabajo de concreto presentado..."
                        />
                      </div>

                      <div style={styles.formActions}>
                        <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                          <Save size={16} /> {submitLoading ? 'Guardando...' : 'Guardar calificación'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-neutral"
                          disabled={submitLoading}
                          onClick={() => setSelectedSubId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={styles.gradeDisplay}>
                      {sub.estado === 'calificado' ? (
                        <div style={styles.resultBox}>
                          <div style={styles.resultHeader}>
                            <strong>Nota Evaluada:</strong>
                            <span style={styles.gradeVal}>{sub.calificacion} / 100</span>
                          </div>
                          {sub.comentarios && (
                            <div style={styles.feedbackText}>
                              <em>Retroalimentación:</em> &quot;{sub.comentarios}&quot;
                            </div>
                          )}
                          <button
                            onClick={() => startGrading(sub)}
                            style={styles.editBtn}
                            className="btn btn-secondary"
                          >
                            Modificar Calificación
                          </button>
                          {Number(sub.permite_reenvio) !== 1 && (
                            <button
                              type="button"
                              onClick={() => handleAllowResubmit(sub.id)}
                              className="btn btn-secondary"
                              style={{ ...styles.editBtn, marginLeft: '8px' }}
                              disabled={reenvioLoadingId === sub.id}
                            >
                              <RotateCcw size={14} style={{ marginRight: '4px' }} />
                              {reenvioLoadingId === sub.id ? 'Habilitando...' : 'Permitir reenvío'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                          <button
                            onClick={() => startGrading(sub)}
                            className="btn btn-primary"
                          >
                            Calificar Trabajo
                          </button>
                          {Number(sub.permite_reenvio) !== 1 && (
                            <button
                              type="button"
                              onClick={() => handleAllowResubmit(sub.id)}
                              className="btn btn-secondary"
                              disabled={reenvioLoadingId === sub.id}
                            >
                              <RotateCcw size={14} style={{ marginRight: '4px' }} />
                              {reenvioLoadingId === sub.id ? 'Habilitando...' : 'Permitir reenvío'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '28px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
  },
  emptyCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '40px',
    gap: '16px',
    color: '#64748B',
    minHeight: '300px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  subItem: {
    border: '1px solid var(--border)',
    transition: 'var(--transition)',
  },
  subHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  studentName: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  classContext: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
  },
  badge: {
    fontSize: '10px',
  },
  fileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  fileDate: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '2px',
  },
  downloadBtn: {
    fontSize: '12px',
    padding: '6px 12px',
  },
  gradeForm: {
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
    marginTop: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
  gradeDisplay: {
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  resultBox: {
    backgroundColor: 'rgba(0, 115, 165, 0.03)',
    border: '1px solid rgba(0, 115, 165, 0.1)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
  },
  gradeVal: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0073A5',
  },
  feedbackText: {
    marginTop: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  editBtn: {
    marginTop: '12px',
    fontSize: '12px',
    padding: '6px 12px',
  },
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
