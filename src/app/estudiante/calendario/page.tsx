'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Video, 
  Info,
  ExternalLink
} from 'lucide-react';

interface Evento {
  id: number;
  grupo_id: number;
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

export default function EstudianteCalendario() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  // Fecha del calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEventos = async () => {
    try {
      const res = await fetch('/api/calendario');
      if (res.ok) {
        const data = await res.json();
        setEventos(data.eventos || []);
      }
    } catch (err) {
      console.error('Error al cargar calendario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, []);

  const registrarAsistencia = async (eventoId: number, enlace: string) => {
    try {
      await fetch('/api/calendario/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento_id: eventoId })
      });
    } catch (err) {
      console.error('Error al registrar asistencia:', err);
    }
    window.open(enlace, '_blank', 'noopener,noreferrer');
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

  // Días a mostrar en el grid (incluyendo celdas vacías del mes anterior)
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null); // celda vacía
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  // Filtrar eventos por fecha
  const getEventosDeFecha = (date: Date) => {
    return eventos.filter(ev => {
      const evDate = new Date(ev.fecha_hora);
      return evDate.getDate() === date.getDate() &&
             evDate.getMonth() === date.getMonth() &&
             evDate.getFullYear() === date.getFullYear();
    });
  };

  const selectedDateEvents = selectedDate ? getEventosDeFecha(selectedDate) : [];
  const upcomingEvents = eventos.filter(ev => new Date(ev.fecha_hora) >= new Date());

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(0,115,165,0.08)', color: '#0073A5' }}>
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 style={styles.title}>Calendario Académico</h1>
            <p style={styles.subtitle}>Horarios y accesos a tus clases en vivo programadas</p>
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Columna Izquierda: Calendario mensual */}
        <div style={styles.leftCol}>
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

            {/* Encabezados de días */}
            <div style={styles.weekHeaders}>
              {DIAS_SEMANA.map(day => (
                <div key={day} style={styles.weekHeader}>{day}</div>
              ))}
            </div>

            {/* Grid de días */}
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
                        {dayEvents.length > 2 && <span style={styles.moreIndicator}>+</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalle de eventos del día seleccionado */}
          <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
            <h3 style={styles.sectionTitle}>
              Sesiones del {selectedDate?.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            {selectedDateEvents.length === 0 ? (
              <div style={styles.emptyEvents}>
                <Info size={24} color="#B0B3B5" />
                <p>No tienes clases en vivo programadas para este día.</p>
              </div>
            ) : (
              <div style={styles.eventsList}>
                {selectedDateEvents.map(ev => (
                  <div key={ev.id} style={styles.eventCard}>
                    <div style={styles.eventCardHeader}>
                      <h4 style={styles.eventCardTitle}>{ev.titulo}</h4>
                      <span style={styles.instructorTag}>Prof. {ev.creador_nombre}</span>
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
                        <button 
                          onClick={() => registrarAsistencia(ev.id, ev.enlace_clase!)}
                          style={{ ...styles.liveBtn, border: 'none', cursor: 'pointer' }}
                        >
                          <Video size={16} />
                          <span>Entrar a Clase</span>
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Listado de próximas clases */}
        <div style={styles.rightCol}>
          <div className="card" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ ...styles.sectionTitle, marginBottom: '6px' }}>Próximas Sesiones</h3>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '20px' }}>Todas tus clases en vivo ordenadas cronológicamente</p>

            {loading ? (
              <div style={styles.inlineLoading}>Cargando horarios de clases...</div>
            ) : upcomingEvents.length === 0 ? (
              <div style={styles.emptyUpcoming}>
                <CalendarIcon size={36} color="#B0B3B5" style={{ marginBottom: '12px' }} />
                <h4>Sin clases futuras</h4>
                <p>Tu profesor no ha programado nuevas sesiones en vivo por el momento.</p>
              </div>
            ) : (
              <div style={styles.upcomingList}>
                {upcomingEvents.map(ev => {
                  const evDate = new Date(ev.fecha_hora);
                  return (
                    <div key={ev.id} style={styles.upcomingItem}>
                      <div style={styles.upcomingDateBlock}>
                        <span style={styles.upcomingDay}>{evDate.getDate()}</span>
                        <span style={styles.upcomingMonth}>{NOMBRES_MESES[evDate.getMonth()].substring(0, 3)}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={styles.upcomingTitle}>{ev.titulo}</h4>
                        <div style={styles.upcomingMeta}>
                          <Clock size={12} />
                          <span>
                            {evDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs
                          </span>
                        </div>
                        {ev.enlace_clase && (
                          <button 
                            onClick={() => registrarAsistencia(ev.id, ev.enlace_clase!)}
                            style={{ ...styles.upcomingLink, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: 0 }}
                          >
                            <Video size={12} /> Enlace de Clase
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
    gridTemplateColumns: '7fr 5fr',
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
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  navButtons: {
    display: 'flex',
    gap: '8px',
  },
  navBtn: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'var(--transition)',
  },
  weekHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '13px',
    color: '#64748B',
    marginBottom: '10px',
  },
  weekHeader: {
    padding: '8px 0',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
  },
  emptyDayCell: {
    aspectRatio: '1',
  },
  dayCell: {
    aspectRatio: '1',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '8px',
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
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  eventsIndicator: {
    display: 'flex',
    gap: '3px',
    marginTop: '4px',
    alignSelf: 'center',
  },
  eventDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  moreIndicator: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#64748B',
    lineHeight: '1',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '16px',
  },
  emptyEvents: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
    color: '#64748B',
    textAlign: 'center',
    gap: '8px',
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  eventCard: {
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '16px',
    backgroundColor: '#F8FAFC',
  },
  eventCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '8px',
  },
  eventCardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  instructorTag: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.08)',
    padding: '2px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  eventCardDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: '1.4',
    marginBottom: '14px',
  },
  eventCardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  liveBtn: {
    fontSize: '12px',
    fontWeight: '700',
    padding: '8px 14px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textDecoration: 'none',
  },
  inlineLoading: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#64748B',
    fontSize: '14px',
  },
  emptyUpcoming: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#64748B',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  upcomingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    maxHeight: '480px',
    paddingRight: '4px',
  },
  upcomingItem: {
    display: 'flex',
    gap: '14px',
    padding: '14px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    transition: 'var(--transition)',
  },
  upcomingDateBlock: {
    backgroundColor: 'rgba(0,115,165,0.08)',
    color: '#0073A5',
    width: '46px',
    height: '46px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  upcomingDay: {
    fontSize: '16px',
    fontWeight: '800',
    lineHeight: '1',
  },
  upcomingMonth: {
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  upcomingTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: '1.3',
    marginBottom: '4px',
  },
  upcomingMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#64748B',
    marginBottom: '6px',
  },
  upcomingLink: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#EF4444',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    textDecoration: 'none',
  }
};
