'use client';

import { toAssetUrl } from '@/lib/assetUrl';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  Play, 
  CheckCircle, 
  Layers,
  Users,
  FileText,
  Bell,
  Mail,
  Send,
  X,
  Check,
  GraduationCap,
  UserPlus,
  Award,
} from 'lucide-react';

interface Course {
  id: number;
  nombre: string;
  descripcion: string;
  imagen?: string | null;
  creador_nombre: string;
  created_at: string;
}

interface ClassItem {
  id: number;
  titulo: string;
  descripcion: string;
  video_url: string;
  requiere_tarea?: number | boolean;
  entrega_estado: 'entregado' | 'calificado' | null;
  calificacion: number | null;
}

interface ProgressStats {
  done: number;
  total: number;
  pct: number;
}

function computeProgress(classes: ClassItem[], exams: ExamItem[]): ProgressStats {
  let done = 0;
  let total = 0;

  for (const c of classes) {
    if (Number(c.requiere_tarea) === 1) {
      total += 1;
      if (c.entrega_estado === 'entregado' || c.entrega_estado === 'calificado') {
        done += 1;
      }
    }
  }

  for (const ex of exams) {
    total += 1;
    if (!ex.permite_reintento && ex.mi_calificacion !== null && ex.mi_calificacion !== undefined) {
      done += 1;
    }
  }

  if (total === 0 && classes.length > 0) {
    return { done: 0, total: classes.length, pct: 0 };
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

function ProgressBar({
  pct,
  done,
  total,
  compact = false,
  label = 'Progreso',
}: {
  pct: number;
  done: number;
  total: number;
  compact?: boolean;
  label?: string;
}) {
  const barColor = pct === 100 ? '#10B981' : '#0073A5';
  const showLabel = label.length > 0;
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: showLabel ? 'space-between' : 'flex-end',
          alignItems: 'center',
          marginBottom: compact ? '4px' : '6px',
          gap: '8px',
        }}
      >
        {showLabel && (
          <span style={{ fontSize: compact ? '11px' : '12px', color: '#64748B', fontWeight: 600 }}>
            {label}
          </span>
        )}
        <span style={{ fontSize: compact ? '11px' : '13px', fontWeight: 800, color: barColor }}>
          {pct}%
          <span style={{ fontWeight: 500, color: '#94A3B8', marginLeft: '4px' }}>
            ({done}/{total})
          </span>
        </span>
      </div>
      <div
        style={{
          height: compact ? 6 : 10,
          backgroundColor: '#E2E8F0',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, pct))}%`,
            backgroundColor: barColor,
            borderRadius: 999,
            transition: 'width 0.45s ease',
          }}
        />
      </div>
    </div>
  );
}

interface ExamItem {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  limite_tiempo: number;
  mi_calificacion: number | null;
  intento_fecha: string | null;
  permite_reintento: number;
}

export default function StudentDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [courseContent, setCourseContent] = useState<Record<number, {
    pendientes: number;
    progreso: { done: number; total: number };
  }>>({});
  const [syllabusLoading, setSyllabusLoading] = useState(false);

  // Estados de Notificaciones
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  // Estados de Mensajería con Profesores
  const [maestros, setMaestros] = useState<any[]>([]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({
    maestro_id: '',
    asunto: '',
    mensaje: ''
  });
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState(false);

  // Estadísticas Académicas (KPIs)
  const [stats, setStats] = useState({
    cursosActivos: 0,
    tareasEntregadas: 0,
    promedio: '94.5'
  });

  // Estados de unirse a un grupo / cohorte
  const [grupoCohorte, setGrupoCohorte] = useState<string | null>(null);
  const [solicitudesGrupo, setSolicitudesGrupo] = useState<any[]>([]);
  const [codigoGrupo, setCodigoGrupo] = useState('');
  const [grupoLoading, setGrupoLoading] = useState(true);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/cursos');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses);
      }
    } catch (error) {
      console.error('Error al cargar cursos para estudiantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/estudiante/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          cursosActivos: data.cursosActivos,
          tareasEntregadas: data.tareasEntregadas,
          promedio: data.promedio
        });
      }
    } catch (err) {
      console.error('Error al cargar estadísticas del estudiante:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notificaciones');
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(data.notificaciones || []);
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    }
  };

  const fetchMaestros = async () => {
    try {
      const res = await fetch('/api/mensajes');
      if (res.ok) {
        const data = await res.json();
        setMaestros(data.maestros || []);
        if (data.maestros && data.maestros.length > 0) {
          setMessageForm(prev => ({ ...prev, maestro_id: data.maestros[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error('Error al cargar maestros:', err);
    }
  };

  useEffect(() => {
    if (!grupoCohorte || courses.length === 0) return;

    let cancelled = false;

    const loadAllSyllabus = async () => {
      setSyllabusLoading(true);
      try {
        const entries = await Promise.all(
          courses.map(async (course) => {
            const res = await fetch(`/api/estudiante/clases?curso_id=${course.id}`);
            if (!res.ok) return [course.id, null] as const;
            const data = await res.json();
            return [course.id, {
              pendientes: data.pendientes ?? 0,
              progreso: data.progreso || { done: 0, total: 0 },
            }] as const;
          })
        );

        if (cancelled) return;

        const next: typeof courseContent = {};
        for (const [id, content] of entries) {
          if (content) next[id] = content;
        }
        setCourseContent(next);
      } catch (error) {
        console.error('Error al cargar materias del grupo:', error);
      } finally {
        if (!cancelled) setSyllabusLoading(false);
      }
    };

    loadAllSyllabus();
    return () => { cancelled = true; };
  }, [courses, grupoCohorte]);

  const materiaCards = courses.map((course) => {
    const content = courseContent[course.id];
    const prog = content?.progreso || { done: 0, total: 0 };
    const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
    return {
      course,
      pendientes: content?.pendientes ?? 0,
      progress: { ...prog, pct },
    };
  });

  const overallProgress = materiaCards.reduce(
    (acc, item) => ({
      done: acc.done + item.progress.done,
      total: acc.total + item.progress.total,
    }),
    { done: 0, total: 0 }
  );
  const overallPct = overallProgress.total > 0
    ? Math.round((overallProgress.done / overallProgress.total) * 100)
    : 0;

  const markNotifAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notificaciones?id=${id}`, { method: 'PUT' });
      if (res.ok) {
        setNotificaciones(prev => 
          prev.map(n => n.id === id ? { ...n, leida: 1 } : n)
        );
      }
    } catch (err) {
      console.error('Error al marcar notificación como leída:', err);
    }
  };

  const markAllNotifsAsRead = async () => {
    try {
      const unread = notificaciones.filter(n => !n.leida);
      await Promise.all(unread.map(n => fetch(`/api/notificaciones?id=${n.id}`, { method: 'PUT' })));
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: 1 })));
    } catch (err) {
      console.error('Error al leer todas las notificaciones:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageForm.maestro_id || !messageForm.asunto || !messageForm.mensaje) return;

    setMessageLoading(true);
    try {
      const res = await fetch('/api/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maestro_id: Number(messageForm.maestro_id),
          asunto: messageForm.asunto,
          mensaje: messageForm.mensaje
        })
      });

      if (res.ok) {
        setMessageSuccess(true);
        setMessageForm(prev => ({ ...prev, asunto: '', mensaje: '' }));
      } else {
        alert('Error al enviar el mensaje');
      }
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      alert('Error de conexión');
    } finally {
      setMessageLoading(false);
    }
  };

  const fetchStudentGroup = async () => {
    try {
      const res = await fetch('/api/estudiante/grupos');
      if (res.ok) {
        const data = await res.json();
        setGrupoCohorte(data.grupo_cohorte);
        setSolicitudesGrupo(data.solicitudes || []);
      }
    } catch (err) {
      console.error('Error al cargar grupo del estudiante:', err);
    } finally {
      setGrupoLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    if (!codigoGrupo) return;

    try {
      const res = await fetch('/api/estudiante/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoGrupo }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al solicitar acceso');
      }

      setJoinSuccess(
        data.tipo === 'materia'
          ? data.mensaje || 'Te inscribiste en la materia correctamente.'
          : data.mensaje || 'Solicitud enviada con éxito. Esperando aprobación del docente.'
      );
      setCodigoGrupo('');
      fetchStudentGroup();
      if (data.tipo === 'materia') fetchCourses();
    } catch (err: any) {
      setJoinError(err.message);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchStats();
    fetchStudentGroup();
    fetchNotifications();
    fetchMaestros();
  }, []);

  const unreadNotifCount = notificaciones.filter(n => !n.leida).length;

  const getStatusBadge = (status: string | null, grade: number | null) => {
    if (status === 'calificado') {
      return (
        <span className="badge badge-approved" style={styles.badge}>
          <Award size={10} style={{ marginRight: '4px' }} />
          Nota: {grade}
        </span>
      );
    } else if (status === 'entregado') {
      return (
        <span className="badge badge-pending" style={styles.badge}>
          Entregado
        </span>
      );
    } else {
      return (
        <span className="badge badge-neutral" style={{ ...styles.badge, backgroundColor: 'rgba(176,179,181,0.15)', color: '#64748B' }}>
          Pendiente
        </span>
      );
    }
  };

  if (loading) {
    return <div style={styles.loading}>Cargando tus módulos...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header and Controls */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Mis Módulos</h1>
          <p style={styles.subtitle}>
            {grupoCohorte
              ? `Grupo: ${grupoCohorte} — accede directamente a tus clases y evaluaciones`
              : 'Progreso en tus módulos asignados'}
          </p>
        </div>
        <div style={styles.headerControls}>
          <button 
            onClick={() => setShowMessageModal(true)} 
            style={styles.messageTeacherBtn}
            title="Enviar mensaje a un profesor"
          >
            <Mail size={16} /> Contactar Maestro
          </button>
          
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotifDrawer(!showNotifDrawer)} 
              style={styles.notifBellBtn}
              title="Notificaciones"
            >
              <Bell size={20} />
              {unreadNotifCount > 0 && (
                <span style={styles.notifBadge}>{unreadNotifCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards / Statistics Grid */}
      <div className="grid-3" style={{ gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(0,115,165,0.08)', color: '#0073A5' }}>
            <GraduationCap size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.kpiValue}>{grupoCohorte ? `${overallPct}%` : stats.cursosActivos}</div>
            <div style={styles.kpiLabel}>
              {grupoCohorte ? 'Progreso general' : 'Módulos inscritos'}
            </div>
            {grupoCohorte && overallProgress.total > 0 && (
              <div style={{ marginTop: '8px' }}>
                <ProgressBar
                  pct={overallPct}
                  done={overallProgress.done}
                  total={overallProgress.total}
                  compact
                  label=""
                />
              </div>
            )}
          </div>
        </div>

        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(16,185,129,0.08)', color: 'var(--success)' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div style={styles.kpiValue}>{stats.tareasEntregadas}</div>
            <div style={styles.kpiLabel}>Tareas Entregadas</div>
          </div>
        </div>

        <div className="card" style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, backgroundColor: 'rgba(245,158,11,0.08)', color: 'var(--warning)' }}>
            <Award size={22} />
          </div>
          <div>
            <div style={styles.kpiValue}>{stats.promedio} / 100</div>
            <div style={styles.kpiLabel}>Promedio Académico</div>
          </div>
        </div>
      </div>

      {/* Course List / Syllabus Accordion or Join Group Request Screen */}
      {grupoLoading ? (
        <div style={styles.inlineLoading}>Cargando información de tu grupo...</div>
      ) : !grupoCohorte && courses.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '12px' }}>
          {/* Card para unirse */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0073A5', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <UserPlus size={20} /> Unirse con código de acceso
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', marginBottom: '20px', marginTop: '8px' }}>
              Ingresa el código de tu grupo (GRP-XXXX) o de una materia (MAT-XXXX) que te comparta tu docente.
            </p>

            {joinError && <div style={{ ...styles.alert, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '12px', fontSize: '13px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>{joinError}</div>}
            {joinSuccess && <div style={{ ...styles.alert, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)', padding: '12px', fontSize: '13px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>{joinSuccess}</div>}

            <form onSubmit={handleJoinGroup}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Código (GRP o MAT)</label>
                <input
                  type="text"
                  className="form-input"
                  value={codigoGrupo}
                  onChange={(e) => setCodigoGrupo(e.target.value)}
                  placeholder="Ej. GRP-0001 o MAT-0001"
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Unirse
              </button>
            </form>
          </div>

          {/* Historial de solicitudes */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0073A5', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <CheckCircle size={20} /> Estado de tus Solicitudes
            </h3>
            
            {solicitudesGrupo.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: '13px' }}>
                No has enviado ninguna solicitud de acceso.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {solicitudesGrupo.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{s.grupo_nombre}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontFamily: 'monospace' }}>Código: {s.grupo_codigo}</div>
                    </div>
                    <div>
                      <span className={`badge ${
                        s.estado === 'pendiente' 
                          ? 'badge-pending' 
                          : s.estado === 'aprobado' 
                            ? 'badge-approved' 
                            : 'badge-neutral'
                      }`} style={{ fontSize: '10px' }}>
                        {s.estado === 'pendiente' 
                          ? 'Pendiente' 
                          : s.estado === 'aprobado' 
                            ? 'Aprobado' 
                            : 'Rechazado'
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {grupoCohorte ? (
          <div style={styles.groupBanner}>
            <div style={styles.groupBannerIcon}>
              <Users size={20} color="#0073A5" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.groupBannerLabel}>Tu grupo / cohorte</div>
              <div style={styles.groupBannerName}>{grupoCohorte}</div>
              {!syllabusLoading && overallProgress.total > 0 && (
                <div style={{ marginTop: '12px', maxWidth: '420px' }}>
                  <ProgressBar
                    pct={overallPct}
                    done={overallProgress.done}
                    total={overallProgress.total}
                    label="Progreso del grupo"
                  />
                </div>
              )}
            </div>
            <div style={styles.groupBannerStats}>
              <span><strong>{courses.length}</strong> materia{courses.length !== 1 ? 's' : ''}</span>
              {!syllabusLoading && overallProgress.total > 0 && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: overallPct === 100 ? '#10B981' : '#0073A5', fontWeight: 700 }}>
                    {overallPct}% completado
                  </span>
                </>
              )}
            </div>
          </div>
          ) : (
            <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>¿Tienes otro código? Inscríbete a un grupo o materia:</span>
              <form onSubmit={handleJoinGroup} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
                <input type="text" className="form-input" value={codigoGrupo} onChange={(e) => setCodigoGrupo(e.target.value)} placeholder="GRP-0001 o MAT-0001" style={{ flex: 1, textTransform: 'uppercase' }} />
                <button type="submit" className="btn btn-primary">Unirse</button>
              </form>
              {joinError && <span style={{ color: '#EF4444', fontSize: '12px', width: '100%' }}>{joinError}</span>}
              {joinSuccess && <span style={{ color: 'var(--success)', fontSize: '12px', width: '100%' }}>{joinSuccess}</span>}
            </div>
          )}

          {courses.length === 0 ? (
            <div className="card" style={styles.emptyState}>
              <BookOpen size={48} color="#B0B3B5" />
              <h4>Sin materias disponibles</h4>
              <p>
                Tu maestro aún no ha asignado materias a tu grupo. Contacta a tu docente para que asigne
                las materias correspondientes a tu cohorte.
              </p>
            </div>
          ) : syllabusLoading ? (
            <div className="card" style={styles.inlineLoading}>
              Cargando materias...
            </div>
          ) : (
            <div style={styles.modulesGrid}>
              {materiaCards.map(({ course, pendientes, progress }) => (
                <div
                  key={course.id}
                  className="card"
                  style={{ ...styles.moduleCard, cursor: 'pointer' }}
                  onClick={() => router.push(`/estudiante/materias/${course.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/estudiante/materias/${course.id}`)}
                >
                  {course.imagen ? (
                    <img src={toAssetUrl(course.imagen)} alt="" style={styles.materiaImage} />
                  ) : (
                    <div style={styles.materiaImagePlaceholder}>
                      <BookOpen size={28} color="#0073A5" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, padding: '16px 20px 20px' }}>
                    <h3 style={styles.moduleCardTitle}>{course.nombre}</h3>
                    {course.descripcion && (
                      <p style={styles.moduleCardDesc}>{course.descripcion}</p>
                    )}
                    <p style={styles.moduleInstructor}>Instructor: {course.creador_nombre}</p>
                    {progress.total > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <ProgressBar
                          pct={progress.pct}
                          done={progress.done}
                          total={progress.total}
                          compact
                          label="Progreso"
                        />
                      </div>
                    )}
                    {pendientes > 0 && (
                      <span style={styles.pendientesBadge}>
                        {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {progress.total > 0 && (
                    <div style={{ ...styles.modulePctBadge, position: 'absolute', top: '12px', right: '12px' }}>{progress.pct}%</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* NOTIFICATIONS DRAWER */}
      {showNotifDrawer && (
        <div style={styles.drawerOverlay} onClick={() => setShowNotifDrawer(false)}>
          <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={20} color="#0073A5" />
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0073A5', margin: 0 }}>Notificaciones</h3>
              </div>
              <button onClick={() => setShowNotifDrawer(false)} style={styles.drawerCloseBtn}>
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.drawerActions}>
              <button onClick={markAllNotifsAsRead} style={styles.drawerActionLink}>
                Marcar todas como leídas
              </button>
            </div>

            <div style={styles.drawerBody}>
              {notificaciones.length === 0 ? (
                <div style={styles.emptyNotifs}>No tienes notificaciones en este momento.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {notificaciones.map((n) => (
                    <div 
                      key={n.id} 
                      style={{ 
                        ...styles.notifItem, 
                        ...(n.leida ? {} : styles.notifItemUnread) 
                      }}
                      onClick={() => !n.leida && markNotifAsRead(n.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: n.leida ? '#475569' : '#0073A5', margin: 0 }}>
                          {n.titulo}
                        </h4>
                        {!n.leida && <span style={styles.unreadDot}></span>}
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: '1.4', marginBottom: 0 }}>
                        {n.mensaje}
                      </p>
                      <span style={{ fontSize: '10px', color: '#B0B3B5', display: 'block', marginTop: '6px', fontWeight: '500' }}>
                        {new Date(n.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE TEACHER MODAL */}
      {showMessageModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowMessageModal(false); setMessageSuccess(false); }}>
          <div className="card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => { setShowMessageModal(false); setMessageSuccess(false); }} 
              style={styles.closeBtn}
            >
              <X size={20} />
            </button>

            {messageSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={styles.successIconWrapper}>
                  <Check size={32} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0073A5', marginBottom: '12px' }}>
                  ¡Mensaje Enviado con Éxito!
                </h3>
                <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5', maxWidth: '360px', margin: '0 auto 20px auto' }}>
                  Tu mensaje ha sido entregado en la bandeja del profesor. Recibirás una notificación en la plataforma en cuanto te responda.
                </p>
                <button 
                  onClick={() => { setShowMessageModal(false); setMessageSuccess(false); }} 
                  className="btn btn-primary"
                  style={{ width: '160px', margin: '0 auto' }}
                >
                  Cerrar Ventana
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage}>
                <h3 style={styles.modalTitle}>Enviar Mensaje a Maestro</h3>
                <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                  Selecciona al profesor de tu diplomado, escribe tu consulta o duda académica y envíasela de forma directa.
                </p>

                <div className="form-group">
                  <label className="form-label">Profesor / Maestro Destinatario</label>
                  {maestros.length === 0 ? (
                    <input 
                      type="text" 
                      className="form-input" 
                      value="Cargando profesores..." 
                      disabled 
                    />
                  ) : (
                    <select 
                      className="form-select" 
                      value={messageForm.maestro_id}
                      onChange={(e) => setMessageForm({ ...messageForm, maestro_id: e.target.value })}
                      required
                    >
                      {maestros.map(m => (
                        <option key={m.id} value={m.id}>{m.nombre} ({m.email})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Asunto / Tema</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={messageForm.asunto}
                    onChange={(e) => setMessageForm({ ...messageForm, asunto: e.target.value })}
                    placeholder="Ej. Duda sobre la dosificación de mezclas"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mensaje</label>
                  <textarea 
                    className="form-input" 
                    style={{ minHeight: '120px', resize: 'vertical' }}
                    value={messageForm.mensaje}
                    onChange={(e) => setMessageForm({ ...messageForm, mensaje: e.target.value })}
                    placeholder="Escribe de forma detallada tu consulta..."
                    required
                  />
                </div>

                <div style={styles.modalFooter}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={messageLoading || maestros.length === 0}
                  >
                    {messageLoading ? 'Enviando...' : (
                      <><Send size={16} /> Enviar Mensaje Académico</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    paddingBottom: '40px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
    gap: '20px',
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
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '6px',
  },
  messageTeacherBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(0, 115, 165, 0.15)',
    transition: 'var(--transition)',
  },
  notifBellBtn: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    color: '#64748B',
    borderRadius: '8px',
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'var(--transition)',
  },
  notifBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: '800',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #FFFFFF',
  },
  kpiCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#FFFFFF',
  },
  kpiIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kpiValue: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: '1.2',
  },
  kpiLabel: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: '600',
    marginTop: '2px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '40px',
    gap: '16px',
    color: '#64748B',
    minHeight: '200px',
  },
  groupBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '18px 22px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(0,115,165,0.15)',
    borderRadius: '12px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,115,165,0.04)',
    flexWrap: 'wrap',
  },
  groupBannerIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: 'rgba(0,115,165,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  groupBannerLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  groupBannerName: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#0073A5',
    marginTop: '2px',
  },
  groupBannerStats: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    fontSize: '13px',
    color: '#64748B',
    flexShrink: 0,
  },
  modulePctBadge: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.08)',
    padding: '8px 12px',
    borderRadius: '10px',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  modulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '20px',
  },
  moduleCard: {
    padding: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  materiaImage: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
  },
  materiaImagePlaceholder: {
    width: '100%',
    height: '140px',
    backgroundColor: 'rgba(0,115,165,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendientesBadge: {
    display: 'inline-block',
    marginTop: '10px',
    padding: '4px 10px',
    borderRadius: '999px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#D97706',
    fontSize: '11px',
    fontWeight: 700,
  },
  moduleCardHeader: {
    display: 'flex',
    gap: '14px',
    padding: '20px 20px 16px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#FAFBFD',
    alignItems: 'flex-start',
  },
  moduleCardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'rgba(0,115,165,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  courseTag: {
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    padding: '2px 8px',
    borderRadius: '4px',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  moduleCardTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: 1.3,
    margin: 0,
  },
  moduleCardDesc: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '6px',
    lineHeight: 1.45,
  },
  moduleInstructor: {
    fontSize: '11px',
    color: '#94A3B8',
    marginTop: '6px',
  },
  moduleSection: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#0073A5',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  emptySection: {
    fontSize: '12px',
    color: '#94A3B8',
    margin: 0,
  },
  classesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  noClasses: {
    fontSize: '12px',
    color: '#94A3B8',
    padding: '8px 0',
  },
  inlineLoading: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#0073A5',
    fontSize: '14px',
    fontWeight: '600',
  },
  classRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#F8FAFC',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  classRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
  },
  classNameText: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  badge: {
    fontSize: '10px',
    padding: '3px 8px',
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
  
  // DRAWER STYLES
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    width: '100%',
    maxWidth: '400px',
    height: '100vh',
    backgroundColor: '#FFFFFF',
    boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.3s ease-out',
  },
  drawerHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    outline: 'none',
  },
  drawerActions: {
    padding: '8px 24px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#F8FAFC',
    textAlign: 'right',
  },
  drawerActionLink: {
    background: 'none',
    border: 'none',
    color: '#0073A5',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
  },
  emptyNotifs: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: '13px',
    padding: '40px 0',
  },
  notifItem: {
    padding: '16px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  notifItemUnread: {
    backgroundColor: 'rgba(0,115,165,0.02)',
    borderColor: 'rgba(0,115,165,0.15)',
  },
  unreadDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#0073A5',
    flexShrink: 0,
    marginTop: '5px',
  },

  // MODAL STYLES (OVERWRITE / EXPAND)
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
  modal: {
    width: '90%',
    maxWidth: '500px',
    padding: '32px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#64748B',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '10px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
  },
  modalFooter: {
    borderTop: '1px solid var(--border)',
    paddingTop: '20px',
    marginTop: '20px',
  },
  successIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16,185,129,0.1)',
    color: 'var(--success)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
  }
};
