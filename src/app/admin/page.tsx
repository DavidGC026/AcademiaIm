'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Users, 
  Clock, 
  Activity, 
  Check, 
  X, 
  Plus
} from 'lucide-react';

interface DashboardData {
  stats: {
    total_cursos: number;
    total_pendientes: number;
    total_estudiantes: number;
    total_logs: number;
  };
  pendientes: { id: number; nombre: string; descripcion: string; creador_nombre: string; created_at: string }[];
  logs: { id: number; usuario_nombre: string; rol_nombre: string; usuario_email: string; ip_address: string; fecha_acceso: string }[];
  tareas: { id: number; estudiante_nombre: string; clase_titulo: string; curso_nombre: string; archivo_url: string; archivo_nombre: string; fecha_entrega: string; estado: string }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDashboardData = () => fetch('/api/admin/dashboard')
    .then(async response => {
      if (!response.ok) throw new Error('No se pudo cargar el panel.');
      return response.json();
    })
    .then(setData)
    .catch(error => console.error('Error al cargar el panel:', error))
    .finally(() => setLoading(false));

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleApprove = async (courseId: number, approve: boolean) => {
    setActionLoading(courseId);
    try {
      const res = await fetch(`/api/cursos/${courseId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: approve ? 'aprobado' : 'rechazado' }),
      });

      if (res.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error al actualizar curso:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Cargando panel de control...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel de Control del Administrador</h1>
        <p style={styles.subtitle}>Supervisión de cursos, accesos y analíticas académicas</p>
      </div>

      <section className="card" style={{ marginBottom: '24px' }}>
        <h2 style={styles.cardTitle}>Materias y contenido</h2>
        <p style={styles.cardSubtitle}>Da de alta materias, edita sus descripciones y administra clases, exámenes y alumnos.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Link href="/admin/materias/nueva" className="btn btn-primary"><Plus size={18} /> Nueva materia</Link>
          <Link href="/admin/materias" className="btn btn-secondary"><Layers size={18} /> Ver y editar materias</Link>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '32px' }}>
        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(0, 115, 165, 0.08)', color: '#0073A5' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={styles.kpiValue}>{data?.stats.total_cursos}</div>
            <div style={styles.kpiLabel}>Cursos Totales</div>
          </div>
        </div>

        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning)' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={styles.kpiValue}>{data?.stats.total_pendientes}</div>
            <div style={styles.kpiLabel}>Pendientes de Aprobación</div>
          </div>
        </div>

        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={styles.kpiValue}>{data?.stats.total_estudiantes}</div>
            <div style={styles.kpiLabel}>Alumnos Activos</div>
          </div>
        </div>

        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(176, 179, 181, 0.15)', color: '#64748B' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={styles.kpiValue}>{data?.stats.total_logs}</div>
            <div style={styles.kpiLabel}>Accesos Registrados</div>
          </div>
        </div>
      </div>

      <div style={styles.mainGrid}>
        {/* Left Column */}
        <div style={styles.leftCol}>
          {/* Pending Approval Section */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={styles.cardTitle}>Solicitudes de Cursos Pendientes</h3>
            <p style={styles.cardSubtitle}>Cursos propuestos por maestros que requieren autorización</p>
            
            {data?.pendientes && data.pendientes.length === 0 ? (
              <div style={styles.emptyState}>No hay solicitudes de cursos pendientes en este momento.</div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Curso</th>
                      <th style={styles.th}>Creador</th>
                      <th style={styles.th}>Fecha de Solicitud</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.pendientes.map((course) => (
                      <tr key={course.id} style={styles.tr}>
                        <td style={styles.td}>
                          <Link href={`/admin/materias/${course.id}/datos`} style={{ ...styles.courseName, textDecoration: 'underline' }}>{course.nombre}</Link>
                          <div style={styles.courseDesc}>{course.descripcion}</div>
                        </td>
                        <td style={styles.td}>{course.creador_nombre}</td>
                        <td style={styles.td}>
                          {new Date(course.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={styles.actionButtons}>
                            <button
                              onClick={() => handleApprove(course.id, true)}
                              style={{ ...styles.actionBtn, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}
                              disabled={actionLoading === course.id}
                              title="Aprobar Curso"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleApprove(course.id, false)}
                              style={{ ...styles.actionBtn, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)' }}
                              disabled={actionLoading === course.id}
                              title="Rechazar Curso"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Submissions */}
          <div className="card">
            <h3 style={styles.cardTitle}>Entregas de Tareas Recientes</h3>
            <p style={styles.cardSubtitle}>Últimos trabajos enviados por los alumnos</p>
            {data?.tareas && data.tareas.length === 0 ? (
              <div style={styles.emptyState}>Aún no hay tareas entregadas por los alumnos.</div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Estudiante</th>
                      <th style={styles.th}>Clase / Curso</th>
                      <th style={styles.th}>Archivo</th>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.tareas.map((task) => (
                      <tr key={task.id} style={styles.tr}>
                        <td style={styles.td}>{task.estudiante_nombre}</td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '500' }}>{task.clase_titulo}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{task.curso_nombre}</div>
                        </td>
                        <td style={styles.td}>
                          <a href={task.archivo_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                            {task.archivo_nombre}
                          </a>
                        </td>
                        <td style={styles.td}>
                          {new Date(task.fecha_entrega).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </td>
                        <td style={styles.td}>
                          <span className={`badge badge-${task.estado}`}>
                            {task.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Access Logs */}
        <div style={styles.rightCol}>
          <div className="card" style={{ height: '100%' }}>
            <h3 style={styles.cardTitle}>Registro de Accesos Recientes</h3>
            <p style={styles.cardSubtitle}>Logs de ingresos de usuarios a la plataforma</p>
            <div style={styles.logList}>
              {data?.logs.map((log) => (
                <div key={log.id} style={styles.logItem}>
                  <div style={styles.logIcon}>
                    <Activity size={14} color="#0073A5" />
                  </div>
                  <div style={styles.logContent}>
                    <div style={styles.logUser}>
                      <strong>{log.usuario_nombre}</strong> ({log.rol_nombre})
                    </div>
                    <div style={styles.logEmail}>{log.usuario_email}</div>
                    <div style={styles.logMeta}>
                      <span style={{ marginRight: '8px' }}>IP: {log.ip_address}</span>
                      <span>
                        {new Date(log.fecha_acceso).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
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
  kpiCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
  },
  kpiIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: '1.1',
  },
  kpiLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748B',
    marginTop: '2px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '7fr 3fr',
    gap: '24px',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  cardSubtitle: {
    fontSize: '13px',
    color: '#64748B',
    marginBottom: '20px',
  },
  emptyState: {
    padding: '30px',
    textAlign: 'center',
    color: '#64748B',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '2px solid var(--border)',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid var(--border)',
    transition: 'var(--transition)',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    verticalAlign: 'middle',
  },
  courseName: {
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  courseDesc: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  logItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border)',
  },
  logIcon: {
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    borderRadius: '50%',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logContent: {
    flex: 1,
  },
  logUser: {
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  logEmail: {
    fontSize: '11px',
    color: '#64748B',
  },
  logMeta: {
    fontSize: '11px',
    color: '#94A3B8',
    marginTop: '2px',
    display: 'flex',
    justifyContent: 'space-between',
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
