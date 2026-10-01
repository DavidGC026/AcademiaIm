'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, UserPlus, Check, X, Calendar, FolderPlus, Copy, Hash, MessageSquare } from 'lucide-react';

interface Grupo {
  id: number;
  nombre: string;
  codigo: string;
  total_alumnos: number;
  solicitudes_pendientes: number;
  created_at: string;
}

interface Solicitud {
  solicitud_id: number;
  estado: string;
  created_at: string;
  estudiante_id: number;
  estudiante_nombre: string;
  estudiante_email: string;
  id_estudiante: string;
  grupo_id: number;
  grupo_nombre: string;
  grupo_codigo: string;
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function MaestroGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchGruposAndSolicitudes = async () => {
    try {
      const [resGrupos, resSols] = await Promise.all([
        fetch('/api/maestro/grupos'),
        fetch('/api/maestro/grupos/solicitudes'),
      ]);

      if (resGrupos.ok) {
        const data = await resGrupos.json();
        setGrupos(data.grupos || []);
      }
      if (resSols.ok) {
        const data = await resSols.json();
        setSolicitudes(data.solicitudes || []);
      }
    } catch (error) {
      console.error('Error al cargar datos de grupos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGruposAndSolicitudes();
  }, []);

  const handleCopy = (key: string, value: string) => {
    copyText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);

    try {
      const res = await fetch('/api/maestro/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el grupo');
      }

      const g = data.grupo;
      setFormSuccess(
        `Grupo creado. ID del grupo: ${g.id} · Código de acceso: ${g.codigo} (compártelo con tus alumnos).`
      );
      setNombre('');
      fetchGruposAndSolicitudes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setFormError(message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleResolverSolicitud = async (solicitudId: number, accion: 'aprobar' | 'rechazar') => {
    try {
      const res = await fetch(`/api/maestro/grupos/solicitudes?id=${solicitudId}&accion=${accion}`, {
        method: 'PUT',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al resolver la solicitud');
      }

      fetchGruposAndSolicitudes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert(message);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Cargando información de grupos...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={styles.title}>Control de Grupos y Cohortes</h1>
          <p style={styles.subtitle}>
            El sistema genera el código de acceso automáticamente. Comparte el código con tus alumnos; el ID del grupo es tu referencia interna.
          </p>
        </div>
        <Link 
          href="/maestro/grupos/foro" 
          className="btn btn-primary" 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        >
          <MessageSquare size={16} /> Foro de Presentación e Interacción
        </Link>
      </div>

      <div style={styles.grid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div style={styles.cardHeader}>
              <FolderPlus size={20} color="#0073A5" />
              <h3 style={styles.cardTitle}>Crear Nuevo Grupo</h3>
            </div>

            {formError && (
              <div style={{ ...styles.alert, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div style={{ ...styles.alert, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateGrupo} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Nombre del Grupo / Cohorte</label>
                <input
                  type="text"
                  className="form-input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Diplomado Concreto 2026-B"
                  required
                />
                <small style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                  El código de acceso (GRP-XXXX) se generará automáticamente al guardar.
                </small>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={formLoading}
              >
                {formLoading ? 'Creando...' : 'Crear Grupo'}
              </button>
            </form>
          </div>

          <div className="card">
            <div style={styles.cardHeader}>
              <Users size={20} color="#0073A5" />
              <h3 style={styles.cardTitle}>Tus Grupos Activos</h3>
            </div>

            {grupos.length === 0 ? (
              <div style={styles.emptyState}>No tienes grupos creados actualmente.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {grupos.map((g) => (
                  <div key={g.id} style={styles.grupoItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {g.nombre}
                      </div>
                      <div style={styles.metaRow}>
                        <span style={styles.idBadge}>
                          <Hash size={11} /> ID grupo: {g.id}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={12} /> {g.total_alumnos} alumnos
                        </span>
                        {g.solicitudes_pendientes > 0 && (
                          <span style={styles.pendingBadge}>
                            {g.solicitudes_pendientes} solicitud(es) pendiente(s)
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {new Date(g.created_at).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                      <div style={styles.codeRow}>
                        <span style={styles.codeLabel}>Código de acceso:</span>
                        <span style={styles.codeBadge}>{g.codigo}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`codigo-${g.id}`, g.codigo)}
                          style={styles.copyBtn}
                          title="Copiar código"
                        >
                          <Copy size={14} />
                          {copiedKey === `codigo-${g.id}` ? 'Copiado' : 'Copiar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(`id-${g.id}`, String(g.id))}
                          style={styles.copyBtn}
                          title="Copiar ID"
                        >
                          <Copy size={14} />
                          {copiedKey === `id-${g.id}` ? 'ID copiado' : 'Copiar ID'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ height: 'fit-content' }}>
          <div style={styles.cardHeader}>
            <UserPlus size={20} color="#0073A5" />
            <h3 style={styles.cardTitle}>Solicitudes de Acceso de Alumnos</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
            Alumnos que ingresaron el código de uno de tus grupos y esperan aprobación.
          </p>

          {solicitudes.length === 0 ? (
            <div style={{ ...styles.emptyState, padding: '40px 0' }}>
              <Check size={36} color="var(--success)" style={{ marginBottom: '12px', opacity: 0.8 }} />
              <div>Sin solicitudes pendientes</div>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                Todas las solicitudes de acceso han sido resueltas.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {solicitudes.map((s) => (
                <div key={s.solicitud_id} style={styles.solicitudCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
                      {s.estudiante_nombre}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {s.estudiante_email}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '11px' }}>
                      <span style={{ color: '#0073A5', fontWeight: '700', backgroundColor: 'rgba(0,115,165,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                        ID alumno: {s.id_estudiante}
                      </span>
                      <span style={{ color: '#64748B', fontWeight: '600', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                        Grupo #{s.grupo_id}: {s.grupo_nombre} ({s.grupo_codigo})
                      </span>
                    </div>
                  </div>
                  <div style={styles.actionsContainer}>
                    <button
                      onClick={() => handleResolverSolicitud(s.solicitud_id, 'aprobar')}
                      style={{ ...styles.actionButton, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}
                      title="Aprobar acceso"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => handleResolverSolicitud(s.solicitud_id, 'rechazar')}
                      style={{ ...styles.actionButton, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                      title="Rechazar acceso"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1200px', margin: '0 auto' },
  header: { marginBottom: '28px' },
  title: { fontSize: '28px', fontWeight: '800', color: '#0073A5', marginBottom: '6px' },
  subtitle: { fontSize: '14px', color: '#64748B' },
  grid: { display: 'grid', gridTemplateColumns: '5fr 5fr', gap: '24px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
  cardTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
  form: { width: '100%' },
  alert: {
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '20px',
    borderWidth: '1px',
    borderStyle: 'solid',
    textAlign: 'center',
  },
  emptyState: {
    textAlign: 'center',
    padding: '30px 0',
    color: '#64748B',
    fontSize: '13px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  grupoItem: {
    padding: '14px 16px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    border: '1px solid var(--border)',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#64748B',
    alignItems: 'center',
  },
  idBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '800',
    color: '#334155',
    backgroundColor: '#E2E8F0',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '11px',
  },
  pendingBadge: {
    color: '#B45309',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '11px',
  },
  codeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
  },
  codeLabel: { fontSize: '12px', color: '#64748B', fontWeight: '600' },
  codeBadge: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.08)',
    padding: '4px 10px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#0073A5',
    background: 'none',
    border: '1px solid rgba(0,115,165,0.25)',
    borderRadius: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  solicitudCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
  },
  actionsContainer: { display: 'flex', gap: '8px' },
  actionButton: {
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
