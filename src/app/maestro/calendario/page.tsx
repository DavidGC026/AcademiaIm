'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Video, 
  Trash2, 
  Plus, 
  Info,
  Users,
  X,
  AlertCircle
} from 'lucide-react';

interface Grupo {
  id: number;
  nombre: string;
  codigo: string;
}

interface Evento {
  id: number;
  grupo_id: number;
  grupo_nombre: string;
  creador_id: number;
  titulo: string;
  descripcion: string;
  fecha_hora: string;
  enlace_clase: string | null;
  creador_nombre: string;
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function MaestroCalendario() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaHora, setFechaHora] = useState('');
  const [enlaceClase, setEnlaceClase] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState({ text: '', type: '' });

  // Fecha del calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Asistencia Modal State
  const [showAsistenciaModal, setShowAsistenciaModal] = useState(false);
  const [selectedAsistenciaEventId, setSelectedAsistenciaEventId] = useState<number | null>(null);
  const [selectedAsistenciaEventTitle, setSelectedAsistenciaEventTitle] = useState('');
  const [asistentes, setAsistentes] = useState<any[]>([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);
  const [asistenciaError, setAsistenciaError] = useState('');

  const openAsistenciaModal = async (eventoId: number, titulo: string) => {
    setSelectedAsistenciaEventId(eventoId);
    setSelectedAsistenciaEventTitle(titulo);
    setShowAsistenciaModal(true);
    setLoadingAsistencia(true);
    setAsistenciaError('');
    setAsistentes([]);
    
    try {
      const res = await fetch(`/api/calendario/asistencia?evento_id=${eventoId}`);
      if (res.ok) {
        const data = await res.json();
        setAsistentes(data.asistentes || []);
      } else {
        const data = await res.json();
        setAsistenciaError(data.error || 'Error al obtener la lista de asistencia');
      }
    } catch (err) {
      console.error(err);
      setAsistenciaError('Error de conexión al cargar asistencias.');
    } finally {
      setLoadingAsistencia(false);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchDatos = async () => {
    try {
      const [resEventos, resGrupos] = await Promise.all([
        fetch('/api/calendario'),
        fetch('/api/maestro/grupos')
      ]);

      if (resEventos.ok) {
        const data = await resEventos.json();
        setEventos(data.eventos || []);
      }
      if (resGrupos.ok) {
        const data = await resGrupos.json();
        const activeGrupos = data.grupos || [];
        setGrupos(activeGrupos);
        if (activeGrupos.length > 0) {
          setSelectedGrupoId(activeGrupos[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg({ text: '', type: '' });
    if (!selectedGrupoId || !titulo || !fechaHora) return;

    setFormLoading(true);
    try {
      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: Number(selectedGrupoId),
          titulo,
          descripcion,
          fecha_hora: fechaHora,
          enlace_clase: enlaceClase || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setFormMsg({ text: 'Clase en vivo programada correctamente.', type: 'success' });
        setTitulo('');
        setDescripcion('');
        setFechaHora('');
        setEnlaceClase('');
        fetchDatos();
      } else {
        setFormMsg({ text: data.error || 'Error al programar clase.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setFormMsg({ text: 'Error de conexión.', type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('¿Seguro que deseas cancelar esta clase en vivo?')) return;

    try {
      const res = await fetch(`/api/calendario?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchDatos();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  // Navegación de meses
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Lógica del calendario
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  const getEventosDeFecha = (date: Date) => {
    return eventos.filter(ev => {
      const evDate = new Date(ev.fecha_hora);
      return evDate.getDate() === date.getDate() &&
             evDate.getMonth() === date.getMonth() &&
             evDate.getFullYear() === date.getFullYear();
    });
  };

  const selectedDateEvents = selectedDate ? getEventosDeFecha(selectedDate) : [];

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(0,115,165,0.08)', color: '#0073A5' }}>
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 style={styles.title}>Gestión de Clases en Vivo</h1>
            <p style={styles.subtitle}>Programa clases virtuales y publica los enlaces para tus grupos de diplomado</p>
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Columna Izquierda: Programar nueva clase */}
        <div style={styles.leftCol}>
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ ...styles.sectionTitle, marginBottom: '6px' }}>Programar Sesión</h3>
            <p style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '20px' }}>
              Define la fecha, hora y el enlace (Zoom, Teams, Meet) para tu clase en vivo.
            </p>

            {formMsg.text && (
              <div style={{
                ...styles.alert,
                backgroundColor: formMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: formMsg.type === 'success' ? 'var(--success)' : '#EF4444',
                borderColor: formMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              }}>
                {formMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateEvent} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Grupo / Cohorte Destinatario</label>
                {grupos.length === 0 ? (
                  <input type="text" className="form-input" value="Cargando grupos..." disabled />
                ) : (
                  <select 
                    className="form-select" 
                    value={selectedGrupoId} 
                    onChange={(e) => setSelectedGrupoId(e.target.value)}
                    required
                  >
                    {grupos.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre} (Cod: {g.codigo})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Título de la Sesión</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Clase Magistral: Hidratación del Cemento"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea 
                  className="form-textarea" 
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Temas a tratar, preparación previa, etc."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fecha y Hora de Inicio</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={fechaHora}
                  onChange={(e) => setFechaHora(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">URL del Enlace de Clase (Zoom, Teams, Meet)</label>
                <input 
                  type="url" 
                  className="form-input" 
                  value={enlaceClase}
                  onChange={(e) => setEnlaceClase(e.target.value)}
                  placeholder="https://zoom.us/j/... o https://meet.google.com/..."
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={formLoading || grupos.length === 0}
              >
                <Plus size={16} /> Programar Clase en Vivo
              </button>
            </form>
          </div>

          {/* Listado de Clases programadas por día */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={styles.sectionTitle}>
              Sesiones del {selectedDate?.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            {selectedDateEvents.length === 0 ? (
              <div style={styles.emptyEvents}>
                <Info size={24} color="#B0B3B5" />
                <p>No hay clases en vivo programadas para este día.</p>
              </div>
            ) : (
              <div style={styles.eventsList}>
                {selectedDateEvents.map(ev => (
                  <div key={ev.id} style={styles.eventCard}>
                    <div style={styles.eventCardHeader}>
                      <div>
                        <h4 style={styles.eventCardTitle}>{ev.titulo}</h4>
                        <span style={styles.groupBadge}>Grupo: {ev.grupo_nombre}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteEvent(ev.id)} 
                        style={styles.deleteBtn}
                        title="Cancelar Clase"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p style={styles.eventCardDesc}>{ev.descripcion || 'Sin descripción adicional.'}</p>
                    <div style={styles.eventCardMeta}>
                      <div style={styles.metaItem}>
                        <Clock size={16} />
                        <span>
                          {new Date(ev.fecha_hora).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })} hrs
                        </span>
                      </div>
                      {ev.enlace_clase && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => openAsistenciaModal(ev.id, ev.titulo)}
                            style={styles.asistenciaBtn}
                            title="Ver listado de alumnos que ingresaron"
                          >
                            <Users size={14} />
                            <span>Ver Asistencia</span>
                          </button>
                          <div style={styles.liveIndicator}>
                            <Video size={14} /> Link configurado
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Vista de calendario mensual */}
        <div style={styles.rightCol}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={styles.calendarHeader}>
              <h2 style={styles.monthTitle}>{NOMBRES_MESES[month]} {year}</h2>
              <div style={styles.navButtons}>
                <button onClick={prevMonth} style={styles.navBtn} title="Mes anterior">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={nextMonth} style={styles.navBtn} title="Mes siguiente">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div style={styles.weekHeaders}>
              {DIAS_SEMANA.map(day => (
                <div key={day} style={styles.weekHeader}>{day}</div>
              ))}
            </div>

            <div style={styles.daysGrid}>
              {calendarCells.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} style={styles.emptyDayCell}></div>;
                }

                const dayEvents = getEventosDeFecha(date);
                const isSelected = selectedDate && 
                                   selectedDate.getDate() === date.getDate() && 
                                   selectedDate.getMonth() === date.getMonth() && 
                                   selectedDate.getFullYear() === date.getFullYear();
                const isToday = new Date().getDate() === date.getDate() && 
                                new Date().getMonth() === date.getMonth() && 
                                new Date().getFullYear() === date.getFullYear();

                return (
                  <div 
                    key={date.toISOString()} 
                    onClick={() => setSelectedDate(date)}
                    style={{
                      ...styles.dayCell,
                      ...(isToday ? styles.todayCell : {}),
                      ...(isSelected ? styles.selectedCell : {}),
                    }}
                  >
                    <span style={{
                      ...styles.dayNumber,
                      ...(isSelected ? { color: '#FFFFFF', fontWeight: '800' } : {}),
                      ...(isToday && !isSelected ? { color: '#0073A5', fontWeight: '800' } : {})
                    }}>
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <div style={styles.eventsIndicator}>
                        {dayEvents.slice(0, 2).map(ev => (
                          <span 
                            key={ev.id} 
                            style={{
                              ...styles.eventDot,
                              backgroundColor: ev.enlace_clase ? '#EF4444' : '#0073A5'
                            }}
                          ></span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Asistencia */}
      {showAsistenciaModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Reporte de Asistencia</h3>
                <p style={styles.modalSubtitle}>{selectedAsistenciaEventTitle}</p>
              </div>
              <button onClick={() => setShowAsistenciaModal(false)} style={styles.modalCloseBtn}>
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.modalBody}>
              {loadingAsistencia ? (
                <div style={styles.modalSpinnerContainer}>
                  <div style={styles.modalSpinner}></div>
                  <p>Cargando lista de asistencia...</p>
                </div>
              ) : asistenciaError ? (
                <div style={styles.modalError}>
                  <AlertCircle size={20} />
                  <span>{asistenciaError}</span>
                </div>
              ) : asistentes.length === 0 ? (
                <div style={styles.modalEmpty}>
                  <Users size={32} color="#94A3B8" />
                  <p>Ningún estudiante ha ingresado a esta clase aún.</p>
                </div>
              ) : (
                <div style={styles.modalTableWrapper}>
                  <table style={styles.modalTable}>
                    <thead>
                      <tr>
                        <th style={styles.modalTh}>Estudiante</th>
                        <th style={styles.modalTh}>ID / Matrícula</th>
                        <th style={styles.modalTh}>Grupo</th>
                        <th style={styles.modalTh}>Hora de Acceso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistentes.map((a) => (
                        <tr key={a.id} style={styles.modalTr}>
                          <td style={styles.modalTd}>
                            <div style={styles.studentCell}>
                              <span style={styles.studentName}>{a.nombre}</span>
                              <span style={styles.studentEmail}>{a.email}</span>
                            </div>
                          </td>
                          <td style={styles.modalTd}>{a.id_estudiante || '-'}</td>
                          <td style={styles.modalTd}>{a.grupo_cohorte || '-'}</td>
                          <td style={styles.modalTd}>
                            {new Date(a.fecha_registro).toLocaleString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              day: '2-digit',
                              month: 'short',
                            })} hrs
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
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingBottom: '40px',
  },
  headerRow: {
    marginBottom: '28px',
  },
  iconWrapper: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '6fr 6fr',
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
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  monthTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  navButtons: {
    display: 'flex',
    gap: '6px',
  },
  navBtn: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
  weekHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '12px',
    color: '#64748B',
    marginBottom: '8px',
  },
  weekHeader: {
    padding: '6px 0',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '6px',
  },
  emptyDayCell: {
    aspectRatio: '1',
  },
  dayCell: {
    aspectRatio: '1',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    cursor: 'pointer',
    backgroundColor: '#FFFFFF',
    transition: 'var(--transition)',
    position: 'relative',
  },
  todayCell: {
    borderColor: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.02)',
  },
  selectedCell: {
    backgroundColor: '#0073A5',
    borderColor: '#0073A5',
  },
  dayNumber: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  eventsIndicator: {
    display: 'flex',
    gap: '2px',
    marginTop: '2px',
    alignSelf: 'center',
  },
  eventDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '16px',
  },
  alert: {
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  emptyEvents: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 0',
    color: '#64748B',
    textAlign: 'center',
    gap: '8px',
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  eventCard: {
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px',
    backgroundColor: '#F8FAFC',
  },
  eventCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '6px',
  },
  eventCardTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  groupBadge: {
    fontSize: '10px',
    color: '#64748B',
    display: 'inline-block',
    marginTop: '2px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'var(--transition)',
  },
  eventCardDesc: {
    fontSize: '12.5px',
    color: '#64748B',
    lineHeight: '1.4',
    marginBottom: '10px',
  },
  eventCardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  liveIndicator: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#EF4444',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  asistenciaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#0073A5',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '650px',
    maxHeight: '85vh',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #E2E8F0',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #E2E8F0',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '13px',
    color: '#64748B',
    marginTop: '2px',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalSpinnerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
    color: '#64748B',
    gap: '12px',
  },
  modalSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(0, 115, 165, 0.1)',
    borderTop: '3px solid #0073A5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  modalError: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
  },
  modalEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
    color: '#64748B',
    textAlign: 'center',
    gap: '8px',
    fontSize: '13.5px',
  },
  modalTableWrapper: {
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  modalTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  modalTh: {
    backgroundColor: '#F8FAFC',
    color: '#475569',
    fontWeight: '700',
    padding: '10px 14px',
    borderBottom: '1px solid #E2E8F0',
  },
  modalTr: {
    borderBottom: '1px solid #F1F5F9',
  },
  modalTd: {
    padding: '12px 14px',
    color: '#334155',
  },
  studentCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  studentName: {
    fontWeight: '700',
    color: '#0F172A',
  },
  studentEmail: {
    fontSize: '11px',
    color: '#64748B',
  },
};
