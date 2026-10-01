'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart2, 
  BookOpen, 
  FileText, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Award
} from 'lucide-react';

interface Tarea {
  id: number;
  titulo: string;
  entregada: boolean;
  estado: 'entregado' | 'calificado' | 'pendiente';
  calificacion: number | null;
  comentarios: string | null;
  fecha_entrega: string | null;
}

interface Examen {
  id: number;
  titulo: string;
  completado: boolean;
  calificacion: number | null;
  fecha: string | null;
}

interface Curso {
  id: number;
  nombre: string;
  descripcion: string;
  tareas: Tarea[];
  examenes: Examen[];
  promedioGeneral: number | null;
}

export default function EstudianteCalificaciones() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCalificaciones() {
      try {
        const res = await fetch('/api/estudiante/calificaciones');
        if (!res.ok) {
          throw new Error('Error al obtener las calificaciones');
        }
        const data = await res.json();
        setCursos(data.cursos || []);
        if (data.cursos && data.cursos.length > 0) {
          setSelectedCursoId(data.cursos[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError('No se pudieron cargar tus calificaciones. Por favor intenta más tarde.');
      } finally {
        setLoading(false);
      }
    }
    fetchCalificaciones();
  }, []);

  const activeCurso = cursos.find(c => c.id === selectedCursoId);

  const getKPIs = () => {
    if (!activeCurso) return { tareasEntregadas: 0, tareasTotales: 0, examenesCompletados: 0, examenesTotales: 0 };

    return {
      tareasEntregadas: activeCurso.tareas.filter(t => t.entregada).length,
      tareasTotales: activeCurso.tareas.length,
      examenesCompletados: activeCurso.examenes.filter(e => e.completado).length,
      examenesTotales: activeCurso.examenes.length,
    };
  };

  const kpis = getKPIs();

  const formatNota = (nota: number | null) => {
    if (nota === null || nota === undefined) return '-';
    return `${nota.toFixed(1)} / 100`;
  };

  const getNotaColor = (nota: number | null) => {
    if (nota === null || nota === undefined) return '#94A3B8';
    if (nota >= 90) return '#10B981';
    if (nota >= 70) return '#0073A5';
    return '#F59E0B';
  };

  const getNotaBg = (nota: number | null) => {
    if (nota === null || nota === undefined) return 'rgba(148, 163, 184, 0.1)';
    if (nota >= 90) return 'rgba(16, 185, 129, 0.1)';
    if (nota >= 70) return 'rgba(0, 115, 165, 0.1)';
    return 'rgba(245, 158, 11, 0.1)';
  };

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Cargando boleta académica...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centerContainer}>
        <AlertCircle size={48} color="#EF4444" />
        <p style={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (cursos.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <Award size={64} color="#94A3B8" />
        <h2 style={styles.emptyTitle}>Sin Calificaciones Aún</h2>
        <p style={styles.emptySubtitle}>
          Aún no tienes cursos activos asignados a tu cohorte o no se han publicado calificaciones.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Boleta de Calificaciones</h1>
          <p style={styles.subtitle}>Sigue tu progreso académico y retroalimentación en tiempo real.</p>
        </div>
      </div>

      {cursos.length > 1 && (
        <div style={styles.tabContainer}>
          {cursos.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCursoId(c.id)}
              style={{
                ...styles.tabButton,
                ...(selectedCursoId === c.id ? styles.tabButtonActive : {})
              }}
            >
              <BookOpen size={16} style={{ marginRight: '8px' }} />
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {activeCurso && (
        <div style={styles.contentGrid}>
          <div style={styles.kpiRow}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiIconBgBlue}>
                <TrendingUp size={24} color="#0073A5" />
              </div>
              <div style={styles.kpiInfo}>
                <span style={styles.kpiLabel}>Promedio General</span>
                <span style={{ 
                  ...styles.kpiValue, 
                  color: getNotaColor(activeCurso.promedioGeneral) 
                }}>
                  {activeCurso.promedioGeneral !== null ? `${activeCurso.promedioGeneral.toFixed(1)}%` : 'Sin notas'}
                </span>
                <span style={styles.kpiSub}>Cálculo ponderado del curso</span>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiIconBgGreen}>
                <CheckCircle2 size={24} color="#10B981" />
              </div>
              <div style={styles.kpiInfo}>
                <span style={styles.kpiLabel}>Tareas Entregadas</span>
                <span style={styles.kpiValue}>
                  {kpis.tareasEntregadas} <span style={styles.kpiValueSlash}>/ {kpis.tareasTotales}</span>
                </span>
                <span style={styles.kpiSub}>
                  {kpis.tareasTotales > 0 
                    ? `${Math.round((kpis.tareasEntregadas / kpis.tareasTotales) * 100)}% de avance`
                    : 'Sin tareas requeridas'}
                </span>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiIconBgOrange}>
                <Clipboard size={24} color="#F59E0B" />
              </div>
              <div style={styles.kpiInfo}>
                <span style={styles.kpiLabel}>Evaluaciones</span>
                <span style={styles.kpiValue}>
                  {kpis.examenesCompletados} <span style={styles.kpiValueSlash}>/ {kpis.examenesTotales}</span>
                </span>
                <span style={styles.kpiSub}>
                  {kpis.examenesTotales > 0
                    ? `${Math.round((kpis.examenesCompletados / kpis.examenesTotales) * 100)}% de avance`
                    : 'Sin exámenes programados'}
                </span>
              </div>
            </div>
          </div>

          <div style={styles.moduleSection}>
            <h2 style={styles.sectionTitle}>Detalle de la materia</h2>

            <div style={styles.moduleCard}>
              <div style={styles.moduleContent}>
                <div style={styles.subSection}>
                  <h4 style={styles.subSectionTitle}>Tareas y Entregables</h4>
                  {activeCurso.tareas.length === 0 ? (
                    <p style={styles.noData}>No hay tareas requeridas en esta materia.</p>
                  ) : (
                    <div style={styles.tableWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Actividad / Tarea</th>
                            <th style={styles.th}>Fecha Entrega</th>
                            <th style={styles.th}>Estado</th>
                            <th style={styles.th}>Calificación</th>
                            <th style={styles.th}>Retroalimentación del Docente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeCurso.tareas.map((tarea) => (
                            <tr key={tarea.id} style={styles.tr}>
                              <td style={styles.td}>
                                <div style={styles.activityTitleRow}>
                                  <FileText size={16} color="#64748B" style={{ marginRight: '8px' }} />
                                  <span style={styles.activityTitle}>{tarea.titulo}</span>
                                </div>
                              </td>
                              <td style={styles.td}>
                                {tarea.fecha_entrega
                                  ? new Date(tarea.fecha_entrega).toLocaleDateString('es-MX', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : '-'}
                              </td>
                              <td style={styles.td}>
                                {tarea.estado === 'calificado' && (
                                  <span style={{ ...styles.statusBadge, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                                    Calificada
                                  </span>
                                )}
                                {tarea.estado === 'entregado' && (
                                  <span style={{ ...styles.statusBadge, backgroundColor: 'rgba(0, 115, 165, 0.1)', color: '#0073A5' }}>
                                    Entregada
                                  </span>
                                )}
                                {tarea.estado === 'pendiente' && (
                                  <span style={{ ...styles.statusBadge, backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                                    Pendiente
                                  </span>
                                )}
                              </td>
                              <td style={{ ...styles.td, fontWeight: '700', color: getNotaColor(tarea.calificacion) }}>
                                {formatNota(tarea.calificacion)}
                              </td>
                              <td style={{ ...styles.td, color: '#475569', fontSize: '13px', fontStyle: tarea.comentarios ? 'normal' : 'italic' }}>
                                {tarea.comentarios || 'Sin comentarios registrados.'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ ...styles.subSection, marginTop: '24px' }}>
                  <h4 style={styles.subSectionTitle}>Evaluaciones y Exámenes</h4>
                  {activeCurso.examenes.length === 0 ? (
                    <p style={styles.noData}>No hay exámenes programados en esta materia.</p>
                  ) : (
                    <div style={styles.tableWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Examen</th>
                            <th style={styles.th}>Fecha Finalización</th>
                            <th style={styles.th}>Estado</th>
                            <th style={styles.th}>Calificación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeCurso.examenes.map((examen) => (
                            <tr key={examen.id} style={styles.tr}>
                              <td style={styles.td}>
                                <div style={styles.activityTitleRow}>
                                  <Clipboard size={16} color="#64748B" style={{ marginRight: '8px' }} />
                                  <span style={styles.activityTitle}>{examen.titulo}</span>
                                </div>
                              </td>
                              <td style={styles.td}>
                                {examen.fecha
                                  ? new Date(examen.fecha).toLocaleDateString('es-MX', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '-'}
                              </td>
                              <td style={styles.td}>
                                {examen.completado ? (
                                  <span style={{ ...styles.statusBadge, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                                    Realizado
                                  </span>
                                ) : (
                                  <span style={{ ...styles.statusBadge, backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                                    Pendiente
                                  </span>
                                )}
                              </td>
                              <td style={{ ...styles.td, fontWeight: '700', color: getNotaColor(examen.calificacion) }}>
                                {formatNota(examen.calificacion)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    fontFamily: 'Outfit, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageHeader: {
    marginBottom: '32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '15px',
    color: '#64748B',
  },
  centerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(0, 115, 165, 0.1)',
    borderTop: '4px solid #0073A5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    color: '#475569',
    fontWeight: '500',
  },
  errorText: {
    fontSize: '16px',
    color: '#EF4444',
    fontWeight: '600',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px dashed #E2E8F0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#334155',
    marginTop: '16px',
    marginBottom: '8px',
  },
  emptySubtitle: {
    fontSize: '14px',
    color: '#64748B',
    maxWidth: '400px',
  },
  tabContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '12px',
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#64748B',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabButtonActive: {
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    borderColor: '#0073A5',
    boxShadow: '0 4px 6px -1px rgba(0, 115, 165, 0.2)',
  },
  contentGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    padding: '24px',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
  },
  kpiIconBgBlue: {
    padding: '12px',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    borderRadius: '12px',
  },
  kpiIconBgGreen: {
    padding: '12px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: '12px',
  },
  kpiIconBgOrange: {
    padding: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: '12px',
  },
  kpiInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  kpiLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748B',
    marginBottom: '4px',
  },
  kpiValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: '1.2',
  },
  kpiValueSlash: {
    fontSize: '16px',
    color: '#94A3B8',
    fontWeight: '500',
  },
  kpiSub: {
    fontSize: '12px',
    color: '#94A3B8',
    marginTop: '4px',
  },
  moduleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1E293B',
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
    overflow: 'hidden',
  },
  moduleHeader: {
    padding: '24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    gap: '16px',
  },
  moduleName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: '4px',
  },
  moduleDesc: {
    fontSize: '14px',
    color: '#64748B',
  },
  moduleBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700',
  },
  moduleContent: {
    padding: '24px',
  },
  subSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  subSectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '16px',
    borderLeft: '3px solid #0073A5',
    paddingLeft: '8px',
  },
  noData: {
    fontSize: '14px',
    color: '#94A3B8',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '14px',
  },
  th: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontWeight: '700',
    padding: '12px 16px',
    borderBottom: '1px solid #E2E8F0',
  },
  tr: {
    borderBottom: '1px solid #F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  td: {
    padding: '16px',
    color: '#334155',
    verticalAlign: 'middle',
  },
  activityTitleRow: {
    display: 'flex',
    alignItems: 'center',
  },
  activityTitle: {
    fontWeight: '600',
    color: '#0F172A',
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-block',
  },
};
