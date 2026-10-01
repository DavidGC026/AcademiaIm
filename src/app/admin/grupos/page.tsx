'use client';

import { useState, useEffect } from 'react';
import { Users, Hash, UserCog, X, Search, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';

interface MaestroAsignado {
  id: number;
  nombre: string;
  email: string;
}

interface GrupoAdmin {
  id: number;
  nombre: string;
  codigo: string;
  creador_id: number | null;
  maestros: MaestroAsignado[];
  total_alumnos: number;
  solicitudes_pendientes: number;
  created_at: string;
}

interface MiembroGrupo {
  id: number;
  nombre: string;
  email: string;
  id_estudiante: string | null;
}

interface EstudianteBusqueda {
  id: number;
  nombre: string;
  email: string;
  id_estudiante: string | null;
}

interface MaestroOption {
  id: number;
  nombre: string;
  email: string;
}

export default function AdminGruposPage() {
  const [grupos, setGrupos] = useState<GrupoAdmin[]>([]);
  const [maestros, setMaestros] = useState<MaestroOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedMaestro, setSelectedMaestro] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState('');
  const [expandedGrupoId, setExpandedGrupoId] = useState<number | null>(null);
  const [miembros, setMiembros] = useState<MiembroGrupo[]>([]);
  const [miembrosLoading, setMiembrosLoading] = useState(false);
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<EstudianteBusqueda[]>([]);
  const [busquedaLoading, setBusquedaLoading] = useState(false);

  const fetchData = () => fetch('/api/admin/grupos')
    .then(async response => {
      if (!response.ok) throw new Error('Error al cargar los grupos. Intenta de nuevo.');
      return response.json();
    })
    .then(result => {
      setGrupos(result.grupos || []);
      setMaestros(result.maestros || []);
    })
    .catch(error => setFeedback(error instanceof Error ? error.message : 'Error al cargar los grupos.'))
    .finally(() => setLoading(false));

  useEffect(() => {
    fetchData();
  }, []);

  const patchMaestro = async (grupoId: number, maestroId: number, accion: 'agregar' | 'quitar') => {
    setAssigningId(grupoId);
    setFeedback('');
    try {
      const res = await fetch('/api/admin/grupos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo_id: grupoId, maestro_id: maestroId, accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el grupo');
      setFeedback(
        accion === 'agregar'
          ? `Maestro agregado al grupo #${grupoId}.`
          : `Maestro removido del grupo #${grupoId}.`
      );
      setSelectedMaestro((prev) => ({ ...prev, [grupoId]: '' }));
      setGrupos((prev) => prev.map(grupo => grupo.id === grupoId ? { ...grupo, maestros: data.grupo.maestros } : grupo));
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setAssigningId(null);
    }
  };

  const fetchMiembros = async (grupoId: number) => {
    setMiembrosLoading(true);
    try {
      const res = await fetch(`/api/admin/grupos/miembros?grupo_id=${grupoId}`);
      if (res.ok) {
        const data = await res.json();
        setMiembros(data.miembros || []);
      }
    } catch (error) {
      console.error('Error al cargar miembros:', error);
    } finally {
      setMiembrosLoading(false);
    }
  };

  const toggleMiembros = (grupoId: number) => {
    if (expandedGrupoId === grupoId) {
      setExpandedGrupoId(null);
      setMiembros([]);
      setResultadosBusqueda([]);
      setBusquedaAlumno('');
    } else {
      setExpandedGrupoId(grupoId);
      setResultadosBusqueda([]);
      setBusquedaAlumno('');
      fetchMiembros(grupoId);
    }
  };

  const handleBuscarAlumno = async () => {
    if (busquedaAlumno.trim().length < 2) return;
    setBusquedaLoading(true);
    try {
      const res = await fetch(`/api/usuarios/buscar?q=${encodeURIComponent(busquedaAlumno)}&rol=estudiante`);
      if (res.ok) {
        const data = await res.json();
        const inscritos = new Set(miembros.map((m) => m.id));
        setResultadosBusqueda((data.usuarios || []).filter((u: EstudianteBusqueda) => !inscritos.has(u.id)));
      }
    } catch (error) {
      console.error('Error al buscar:', error);
    } finally {
      setBusquedaLoading(false);
    }
  };

  const handleAgregarMiembro = async (estudianteId: number) => {
    if (!expandedGrupoId) return;
    try {
      const res = await fetch('/api/admin/grupos/miembros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo_id: expandedGrupoId, estudiante_id: estudianteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback(`${data.estudiante.nombre} agregado al grupo.`);
      setResultadosBusqueda((prev) => prev.filter((u) => u.id !== estudianteId));
      fetchMiembros(expandedGrupoId);
      fetchData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleQuitarMiembro = async (estudianteId: number) => {
    if (!expandedGrupoId) return;
    try {
      await fetch(`/api/admin/grupos/miembros?grupo_id=${expandedGrupoId}&estudiante_id=${estudianteId}`, { method: 'DELETE' });
      fetchMiembros(expandedGrupoId);
      fetchData();
    } catch (error) {
      console.error('Error al quitar miembro:', error);
    }
  };

  const maestrosDisponibles = (grupo: GrupoAdmin) => {
    const asignados = new Set((grupo.maestros || []).map((m) => m.id));
    return maestros.filter((m) => !asignados.has(m.id));
  };

  if (loading) {
    return <div style={styles.loading}>Cargando grupos...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestión de Grupos y Cohortes</h1>
        <p style={styles.subtitle}>
          Asigna uno o varios maestros a cada grupo, y alumnos. Los alumnos también pueden unirse con código GRP-XXXX o inscribirse a materias con MAT-XXXX.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          style={{
            ...styles.alert,
            backgroundColor: feedback.includes('Error') || feedback.includes('no')
              ? 'rgba(239, 68, 68, 0.1)'
              : 'rgba(16, 185, 129, 0.1)',
            color: feedback.includes('Error') || feedback.includes('no') ? '#EF4444' : 'var(--success)',
          }}
        >
          {feedback}
        </div>
      )}

      <div className="card">
        <div style={styles.cardHeader}>
          <Users size={20} color="#0073A5" />
          <h3 style={styles.cardTitle}>Todos los Grupos del Sistema</h3>
        </div>
        <p style={styles.cardSubtitle}>Total: {grupos.length} grupos registrados</p>

        {grupos.length === 0 ? (
          <div style={styles.emptyState}>
            Aún no hay grupos creados. Los maestros pueden crearlos desde Control de Grupos.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID / Grupo</th>
                  <th style={styles.th}>Código acceso</th>
                  <th style={styles.th}>Maestros asignados</th>
                  <th style={styles.th}>Alumnos</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.idLine}>
                        <Hash size={12} />
                        <strong>#{g.id}</strong>
                      </div>
                      <div style={{ fontWeight: '600', marginTop: '4px' }}>{g.nombre}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(g.created_at).toLocaleDateString('es-MX')}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <code style={styles.codeBadge}>{g.codigo}</code>
                    </td>
                    <td style={styles.td}>
                      {(g.maestros || []).length === 0 ? (
                        <span style={{ color: '#94A3B8', fontSize: '13px' }}>Sin maestros</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(g.maestros || []).map((m) => (
                            <div key={m.id} style={styles.maestroChip}>
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '13px' }}>{m.nombre}</div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>{m.email}</div>
                              </div>
                              <button
                                type="button"
                                style={styles.chipRemoveBtn}
                                disabled={assigningId === g.id}
                                onClick={() => patchMaestro(g.id, m.id, 'quitar')}
                                title="Quitar maestro"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span>{g.total_alumnos}</span>
                      {g.solicitudes_pendientes > 0 && (
                        <span style={styles.pendingHint}> · {g.solicitudes_pendientes} pend.</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={styles.assignRow}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          onClick={() => toggleMiembros(g.id)}
                        >
                          <UserPlus size={14} />
                          {expandedGrupoId === g.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <select
                          className="form-select"
                          aria-label={`Maestro para ${g.nombre}`}
                          disabled={assigningId === g.id}
                          style={{ minWidth: '180px', fontSize: '13px' }}
                          value={selectedMaestro[g.id] ?? ''}
                          onChange={(e) =>
                            setSelectedMaestro((prev) => ({ ...prev, [g.id]: e.target.value }))
                          }
                        >
                          <option value="">— Agregar maestro —</option>
                          {maestrosDisponibles(g).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nombre}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '8px 12px', fontSize: '12px' }}
                          disabled={assigningId === g.id || !selectedMaestro[g.id]}
                          onClick={() => {
                            const val = selectedMaestro[g.id];
                            if (val) patchMaestro(g.id, parseInt(val, 10), 'agregar');
                          }}
                          title="Guardar asignación del maestro"
                        >
                          <UserCog size={14} /> {assigningId === g.id ? 'Guardando...' : 'Asignar maestro'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {expandedGrupoId && (
              <div style={styles.miembrosPanel}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#0073A5' }}>
                  Alumnos del grupo #{expandedGrupoId}
                </h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Buscar alumno..."
                    value={busquedaAlumno}
                    onChange={(e) => setBusquedaAlumno(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarAlumno())}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleBuscarAlumno} disabled={busquedaLoading}>
                    <Search size={16} />
                  </button>
                </div>
                {resultadosBusqueda.map((u) => (
                  <div key={u.id} style={styles.miembroRow}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{u.nombre}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email}</div>
                    </div>
                    <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleAgregarMiembro(u.id)}>
                      Agregar
                    </button>
                  </div>
                ))}
                {miembrosLoading ? (
                  <div style={styles.emptyState}>Cargando...</div>
                ) : miembros.length === 0 ? (
                  <div style={styles.emptyState}>Sin alumnos en este grupo.</div>
                ) : (
                  miembros.map((m) => (
                    <div key={m.id} style={styles.miembroRow}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.nombre}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{m.email}{m.id_estudiante ? ` · ${m.id_estudiante}` : ''}</div>
                      </div>
                      <button type="button" style={styles.removeBtn} onClick={() => handleQuitarMiembro(m.id)} title="Quitar del grupo">
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1200px', margin: '0 auto' },
  header: { marginBottom: '28px' },
  title: { fontSize: '28px', fontWeight: '800', color: '#0073A5', marginBottom: '6px' },
  subtitle: { fontSize: '14px', color: '#64748B' },
  alert: {
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '20px',
    border: '1px solid var(--border)',
    textAlign: 'center',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  cardTitle: { fontSize: '18px', fontWeight: '700', margin: 0 },
  cardSubtitle: { fontSize: '13px', color: '#64748B', marginBottom: '20px' },
  emptyState: { textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '14px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '2px solid var(--border)',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '14px 16px', fontSize: '14px', verticalAlign: 'middle' },
  idLine: { display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', color: '#0073A5', fontSize: '12px' },
  codeBadge: {
    backgroundColor: 'rgba(0,115,165,0.08)',
    color: '#0073A5',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '700',
    fontSize: '12px',
  },
  pendingHint: { fontSize: '11px', color: '#B45309' },
  assignRow: { display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' },
  maestroChip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#F8FAFC',
  },
  chipRemoveBtn: {
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  removeBtn: {
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  miembrosPanel: {
    marginTop: '20px',
    padding: '20px',
    borderTop: '2px solid var(--border)',
    backgroundColor: '#F8FAFC',
    borderRadius: '0 0 8px 8px',
  },
  miembroRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    marginBottom: '6px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#fff',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    fontSize: '16px',
    color: '#0073A5',
  },
};
