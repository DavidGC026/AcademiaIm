'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  BarChart2, 
  Printer, 
  Search, 
  AlertCircle,
  FileText,
  Clipboard,
  TrendingUp,
  Download
} from 'lucide-react';

interface Grupo {
  id: number;
  nombre: string;
  codigo: string;
}

interface Actividad {
  id: string;
  tipo: 'tarea' | 'examen';
  relId: number;
  titulo: string;
  curso_id: number;
}

interface Alumno {
  id: number;
  nombre: string;
  email: string;
  id_estudiante: string | null;
  calificaciones: Record<string, number | null>;
  promedioGeneral: number | null;
}

interface CursoReporte {
  id: number;
  nombre: string;
  actividades: Actividad[];
  alumnos: Alumno[];
}

export default function MaestroCalificaciones() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<number | null>(null);
  const [cursos, setCursos] = useState<CursoReporte[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | null>(null);
  
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [loadingCalificaciones, setLoadingCalificaciones] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Cargar grupos del maestro
  useEffect(() => {
    async function fetchGrupos() {
      try {
        const res = await fetch('/api/maestro/grupos');
        if (!res.ok) throw new Error('Error al cargar grupos');
        const data = await res.json();
        setGrupos(data.grupos || []);
        if (data.grupos && data.grupos.length > 0) {
          setSelectedGrupoId(data.grupos[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('No se pudieron cargar tus grupos de alumnos.');
      } finally {
        setLoadingGrupos(false);
      }
    }
    fetchGrupos();
  }, []);

  // 2. Cargar calificaciones del grupo seleccionado
  useEffect(() => {
    if (!selectedGrupoId) return;

    async function fetchCalificaciones() {
      setLoadingCalificaciones(true);
      setError('');
      try {
        const res = await fetch(`/api/maestro/calificaciones?grupo_id=${selectedGrupoId}`);
        if (!res.ok) throw new Error('Error al cargar calificaciones');
        const data = await res.json();
        setCursos(data.cursos || []);
        if (data.cursos && data.cursos.length > 0) {
          setSelectedCursoId(data.cursos[0].id);
        } else {
          setSelectedCursoId(null);
        }
      } catch (err) {
        console.error(err);
        setError('Error al cargar la matriz de calificaciones.');
      } finally {
        setLoadingCalificaciones(false);
      }
    }
    fetchCalificaciones();
  }, [selectedGrupoId]);

  const activeCurso = cursos.find(c => c.id === selectedCursoId);

  // Filtrar alumnos por búsqueda de nombre/correo
  const filteredAlumnos = activeCurso
    ? activeCurso.alumnos.filter(a => 
        a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.id_estudiante && a.id_estudiante.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handlePrint = () => {
    window.print();
  };

  const getNotaColor = (nota: number | null) => {
    if (nota === null || nota === undefined) return '#64748B';
    if (nota >= 90) return '#10B981';
    if (nota >= 70) return '#0073A5';
    return '#F59E0B';
  };

  const getNotaBg = (nota: number | null) => {
    if (nota === null || nota === undefined) return 'transparent';
    if (nota >= 90) return 'rgba(16, 185, 129, 0.1)';
    if (nota >= 70) return 'rgba(0, 115, 165, 0.1)';
    return 'rgba(245, 158, 11, 0.1)';
  };

  if (loadingGrupos) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Cargando grupos de alumnos...</p>
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <Users size={64} color="#94A3B8" />
        <h2 style={styles.emptyTitle}>No tienes grupos creados</h2>
        <p style={styles.emptySubtitle}>
          Ve a la sección de "Control de Grupos" para crear tu primer grupo y admitir alumnos.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Controles de Selección e Impresión (Ocultos en impresión) */}
      <div className="no-print" style={styles.controlsRow}>
        <div style={styles.selectors}>
          {/* Selector de Grupo */}
          <div style={styles.selectGroup}>
            <label style={styles.selectLabel}>Grupo / Cohorte</label>
            <select
              value={selectedGrupoId || ''}
              onChange={(e) => setSelectedGrupoId(Number(e.target.value))}
              style={styles.select}
            >
              {grupos.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </div>

          {/* Selector de Curso */}
          {cursos.length > 0 && (
            <div style={styles.selectGroup}>
              <label style={styles.selectLabel}>Curso Académico</label>
              <select
                value={selectedCursoId || ''}
                onChange={(e) => setSelectedCursoId(Number(e.target.value))}
                style={styles.select}
              >
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Acciones */}
        {activeCurso && (
          <button onClick={handlePrint} style={styles.printBtn}>
            <Printer size={18} />
            <span>Imprimir Reporte</span>
          </button>
        )}
      </div>

      {/* Título de Impresión (Solo visible al imprimir) */}
      <div className="print-only" style={styles.printHeader}>
        <h1 style={styles.printTitle}>Boleta General de Calificaciones</h1>
        <p style={styles.printSubtitle}>
          Grupo: {grupos.find(g => g.id === selectedGrupoId)?.nombre} | Curso: {activeCurso?.nombre}
        </p>
        <p style={styles.printMeta}>Generado el: {new Date().toLocaleDateString('es-MX')}</p>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loadingCalificaciones ? (
        <div style={styles.centerContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Compilando matriz de notas...</p>
        </div>
      ) : !activeCurso ? (
        <div style={styles.emptyContainer}>
          <BarChart2 size={64} color="#94A3B8" />
          <h2 style={styles.emptyTitle}>Sin Cursos Vinculados</h2>
          <p style={styles.emptySubtitle}>
            Este grupo no tiene ningún curso aprobado o asignado para evaluar.
          </p>
        </div>
      ) : (
        <div style={styles.reportCard}>
          {/* Buscador de alumnos (Oculto al imprimir) */}
          <div className="no-print" style={styles.searchBarRow}>
            <div style={styles.searchWrapper}>
              <Search size={18} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar por alumno, matrícula o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <div style={styles.statsCount}>
              Total inscritos: {activeCurso.alumnos.length}
            </div>
          </div>

          {/* Tabla de Calificaciones */}
          <div style={styles.tableContainer}>
            {filteredAlumnos.length === 0 ? (
              <p style={styles.noData}>No se encontraron alumnos que coincidan con la búsqueda.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thAlumno}>Estudiante</th>
                    <th style={styles.th}>ID Matrícula</th>
                    {activeCurso.actividades.map(act => (
                      <th key={act.id} style={styles.thActividad} title={act.titulo}>
                        <div style={styles.activityHeader}>
                          {act.tipo === 'tarea' ? <FileText size={14} color="#0073A5" /> : <Clipboard size={14} color="#F59E0B" />}
                          <span style={styles.activityNameText}>{act.titulo}</span>
                          <span style={styles.activityTypeText}>{act.tipo === 'tarea' ? 'Tarea' : 'Examen'}</span>
                        </div>
                      </th>
                    ))}
                    <th style={styles.thPromedio}>
                      <div style={styles.activityHeader}>
                        <TrendingUp size={14} color="#10B981" />
                        <span>Promedio</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlumnos.map(alumno => (
                    <tr key={alumno.id} style={styles.tr}>
                      <td style={styles.tdAlumno}>
                        <div style={styles.studentInfo}>
                          <span style={styles.studentName}>{alumno.nombre}</span>
                          <span style={styles.studentEmail}>{alumno.email}</span>
                        </div>
                      </td>
                      <td style={styles.td}>{alumno.id_estudiante || '-'}</td>
                      {activeCurso.actividades.map(act => {
                        const cal = alumno.calificaciones[act.id];
                        return (
                          <td 
                            key={act.id} 
                            style={{ 
                              ...styles.tdCalificacion,
                              backgroundColor: getNotaBg(cal),
                              color: getNotaColor(cal),
                            }}
                          >
                            {cal !== null ? cal.toFixed(1) : '-'}
                          </td>
                        );
                      })}
                      <td 
                        style={{ 
                          ...styles.tdPromedio,
                          backgroundColor: getNotaBg(alumno.promedioGeneral),
                          color: getNotaColor(alumno.promedioGeneral),
                        }}
                      >
                        {alumno.promedioGeneral !== null ? `${alumno.promedioGeneral.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Estilos CSS Globales e Inyectados para Impresión */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #FFFFFF !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background-color: #FFFFFF !important;
            height: auto !important;
            overflow: visible !important;
          }
          aside, header, footer {
            display: none !important;
          }
          /* Asegurar que las tablas no se corten mal */
          tr {
            page-break-inside: avoid;
          }
          td, th {
            border: 1px solid #CBD5E1 !important;
            padding: 8px !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    fontFamily: 'Outfit, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '28px',
    gap: '20px',
  },
  selectors: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  selectLabel: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  select: {
    fontFamily: 'Outfit, sans-serif',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1E293B',
    outline: 'none',
    minWidth: '220px',
  },
  printBtn: {
    fontFamily: 'Outfit, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 20px',
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
    overflow: 'hidden',
  },
  searchBarRow: {
    padding: '20px 24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#F8FAFC',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    maxWidth: '450px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: '#94A3B8',
  },
  searchInput: {
    fontFamily: 'Outfit, sans-serif',
    padding: '10px 14px 10px 38px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  statsCount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748B',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13.5px',
  },
  th: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontWeight: '700',
    padding: '12px 16px',
    borderBottom: '1px solid #E2E8F0',
    whiteSpace: 'nowrap',
  },
  thAlumno: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontWeight: '700',
    padding: '12px 16px',
    borderBottom: '1px solid #E2E8F0',
    position: 'sticky',
    left: 0,
    zIndex: 1,
    minWidth: '240px',
  },
  thActividad: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontWeight: '700',
    padding: '12px 16px',
    borderBottom: '1px solid #E2E8F0',
    textAlign: 'center',
    minWidth: '110px',
  },
  thPromedio: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontWeight: '700',
    padding: '12px 16px',
    borderBottom: '1px solid #E2E8F0',
    textAlign: 'center',
    minWidth: '100px',
  },
  tr: {
    borderBottom: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  td: {
    padding: '14px 16px',
    color: '#475569',
  },
  tdAlumno: {
    padding: '14px 16px',
    position: 'sticky',
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
    zIndex: 1,
  },
  studentInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  studentName: {
    fontWeight: '700',
    color: '#0F172A',
  },
  studentEmail: {
    fontSize: '11.5px',
    color: '#64748B',
    marginTop: '2px',
  },
  tdCalificacion: {
    padding: '14px 16px',
    textAlign: 'center',
    fontWeight: '700',
    borderLeft: '1px solid #F1F5F9',
  },
  tdPromedio: {
    padding: '14px 16px',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: '14px',
    borderLeft: '1px solid #CBD5E1',
  },
  activityHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  activityNameText: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activityTypeText: {
    fontSize: '9.5px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  noData: {
    padding: '40px',
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: '14px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    borderRadius: '8px',
    marginBottom: '20px',
    fontWeight: '600',
  },
  printHeader: {
    marginBottom: '24px',
    borderBottom: '2px solid #000000',
    paddingBottom: '16px',
  },
  printTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#000000',
  },
  printSubtitle: {
    fontSize: '13px',
    marginTop: '4px',
    fontWeight: '600',
  },
  printMeta: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '4px',
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
};
