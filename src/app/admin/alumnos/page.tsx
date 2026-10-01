'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus, Pencil, Trash2, GraduationCap, X, Check, Search } from 'lucide-react';

interface Estudiante {
  id: number;
  nombre: string;
  email: string;
  grupo_cohorte: string | null;
  created_at: string;
  id_estudiante?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  fecha_nacimiento?: string | null;
  acceso_biblioteca_prioritario?: number;
}

function nombresDeEstudiante(u: Estudiante): string {
  let nombre = (u.nombre || '').trim();
  const pat = (u.apellido_paterno || '').trim();
  const mat = (u.apellido_materno || '').trim();
  if (pat && mat) {
    const suffix = `${pat} ${mat}`;
    if (nombre.endsWith(suffix)) return nombre.slice(0, -suffix.length).trim();
  }
  if (mat && nombre.endsWith(mat)) nombre = nombre.slice(0, -mat.length).trim();
  if (pat && nombre.endsWith(pat)) nombre = nombre.slice(0, -pat.length).trim();
  return nombre;
}

function fechaDeEstudiante(u: Estudiante): string {
  if (!u.fecha_nacimiento) return '';
  return String(u.fecha_nacimiento).slice(0, 10);
}

export default function AlumnosManagementPage() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');

  const [email, setEmail] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [grupoCohorte, setGrupoCohorte] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [grupoSavingId, setGrupoSavingId] = useState<number | null>(null);
  const [grupoAviso, setGrupoAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    nombre: string;
    email: string;
    idEstudiante: string;
    contrasena: string;
    emailSent: boolean;
    simulatedEmail: boolean;
    emailError?: string | null;
  } | null>(null);

  const fetchEstudiantes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroNombre.trim()) params.set('q', filtroNombre.trim());
      if (filtroGrupo) params.set('grupo', filtroGrupo);
      const res = await fetch(`/api/admin/estudiantes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEstudiantes(data.estudiantes || []);
        setGrupos(data.grupos || []);
      }
    } catch (error) {
      console.error('Error al cargar alumnos:', error);
    } finally {
      setLoading(false);
    }
  }, [filtroNombre, filtroGrupo]);

  useEffect(() => {
    const t = setTimeout(fetchEstudiantes, filtroNombre ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchEstudiantes, filtroNombre]);

  const resetForm = () => {
    setEmail('');
    setNombres('');
    setApellidoPaterno('');
    setApellidoMaterno('');
    setFechaNacimiento('');
    setGrupoCohorte('');
    setEditingId(null);
  };

  const startEdit = (u: Estudiante) => {
    setFormError('');
    setFormSuccess('');
    setGeneratedCredentials(null);
    setEditingId(u.id);
    setEmail(u.email);
    setNombres(nombresDeEstudiante(u));
    setApellidoPaterno(u.apellido_paterno || '');
    setApellidoMaterno(u.apellido_materno || '');
    setFechaNacimiento(fechaDeEstudiante(u));
    setGrupoCohorte(u.grupo_cohorte || '');
    document.getElementById('alumno-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setGeneratedCredentials(null);
    setFormLoading(true);

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/users/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            nombres,
            apellido_paterno: apellidoPaterno,
            apellido_materno: apellidoMaterno,
            fecha_nacimiento: fechaNacimiento,
            grupo_cohorte: grupoCohorte,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el alumno');
        setFormSuccess('Alumno actualizado.');
        resetForm();
        fetchEstudiantes();
        return;
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: 3,
          email,
          nombres,
          apellido_paterno: apellidoPaterno,
          apellido_materno: apellidoMaterno,
          fecha_nacimiento: fechaNacimiento,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el alumno');

      if (data.generatedPassword) {
        setGeneratedCredentials({
          nombre: data.user.nombre,
          email: data.user.email,
          idEstudiante: data.user.id_estudiante,
          contrasena: data.generatedPassword,
          emailSent: !!data.emailSent,
          simulatedEmail: !!data.simulatedEmail,
          emailError: data.emailError,
        });
        setFormSuccess(
          data.emailSent
            ? 'Alumno creado. Se envió el correo con sus credenciales.'
            : 'Alumno creado correctamente.'
        );
      }

      resetForm();
      fetchEstudiantes();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : editingId ? 'Error al actualizar alumno' : 'Error al crear alumno');
    } finally {
      setFormLoading(false);
    }
  };

  const cambiarGrupo = async (u: Estudiante, nuevoGrupo: string) => {
    const anterior = u.grupo_cohorte ?? '';
    if (nuevoGrupo === anterior) return;

    setGrupoAviso(null);
    setGrupoSavingId(u.id);
    setEstudiantes((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, grupo_cohorte: nuevoGrupo || null } : x))
    );

    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo_cohorte: nuevoGrupo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar el grupo');

      const guardado: string | null = data.user?.grupo_cohorte ?? (nuevoGrupo || null);
      setEstudiantes((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, grupo_cohorte: guardado } : x))
      );
      if (editingId === u.id) setGrupoCohorte(guardado || '');
      setGrupoAviso({
        tipo: 'ok',
        texto: guardado
          ? `${u.nombre} ahora pertenece a "${guardado}".`
          : `${u.nombre} quedó sin grupo.`,
      });
      // El filtro por grupo deja de coincidir con el alumno movido: recargar la lista.
      if (filtroGrupo) fetchEstudiantes();
    } catch (error: unknown) {
      setEstudiantes((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, grupo_cohorte: u.grupo_cohorte } : x))
      );
      setGrupoAviso({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'No se pudo cambiar el grupo.',
      });
    } finally {
      setGrupoSavingId(null);
    }
  };

  const toggleAcceso = async (u: Estudiante) => {
    const nuevo = u.acceso_biblioteca_prioritario ? 0 : 1;
    setEstudiantes((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, acceso_biblioteca_prioritario: nuevo } : x))
    );
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceso_biblioteca_prioritario: nuevo }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEstudiantes((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, acceso_biblioteca_prioritario: u.acceso_biblioteca_prioritario } : x
        )
      );
      alert('No se pudo actualizar el acceso a la biblioteca.');
    }
  };

  const handleDelete = async (id: number, userName: string) => {
    if (!confirm(`¿Eliminar al alumno "${userName}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      fetchEstudiantes();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error al eliminar');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestión de Alumnos</h1>
        <p style={styles.subtitle}>
          Consulta, edita o elimina alumnos; cambia su grupo desde la tabla, filtra por nombre o grupo y administra accesos.{' '}
          <Link href="/admin/users" style={{ color: '#0073A5', fontWeight: 600 }}>
            Maestros y staff →
          </Link>
        </p>
      </div>

      <div style={styles.grid}>
        <div className="card" id="alumno-form" style={{ height: 'fit-content' }}>
          <div style={styles.formHeader}>
            {editingId ? <Pencil size={20} color="#0073A5" /> : <UserPlus size={20} color="#0073A5" />}
            <h3 style={styles.cardTitle}>{editingId ? 'Editar alumno' : 'Registrar alumno'}</h3>
          </div>

          {formError && <div style={{ ...styles.alert, color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' }}>{formError}</div>}
          {formSuccess && <div style={{ ...styles.alert, color: 'var(--success)', backgroundColor: 'rgba(16,185,129,0.1)' }}>{formSuccess}</div>}

          {generatedCredentials && (
            <div style={styles.credentialsBox}>
              <button type="button" onClick={() => setGeneratedCredentials(null)} style={styles.closeCredBtn}>
                <X size={16} />
              </button>
              <h4 style={styles.credentialsTitle}>
                <Check size={16} /> Credenciales generadas
              </h4>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Alumno:</strong> {generatedCredentials.nombre}</div>
                <div><strong>Email:</strong> {generatedCredentials.email}</div>
                <div><strong>ID:</strong> <code style={styles.idCode}>{generatedCredentials.idEstudiante}</code></div>
                <div>
                  <strong>Contraseña:</strong>{' '}
                  <code style={styles.passCode}>{generatedCredentials.contrasena}</code>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {editingId ? (
              <p style={styles.formHint}>
                Actualiza nombre, correo, grupo u otros datos. El ID de estudiante no cambia.
              </p>
            ) : (
              <p style={styles.formHint}>
                El ID (EST-XXXX) y la contraseña se generan al guardar. El alumno se une al grupo con código GRP-XXXX.
              </p>
            )}
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre(s)</label>
              <input type="text" className="form-input" value={nombres} onChange={(e) => setNombres(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido paterno</label>
              <input type="text" className="form-input" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} required={!editingId} />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido materno</label>
              <input type="text" className="form-input" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} required={!editingId} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de nacimiento</label>
              <input type="date" className="form-input" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} required={!editingId} />
            </div>
            {editingId && (
              <div className="form-group">
                <label className="form-label">Grupo</label>
                <select
                  className="form-select"
                  value={grupoCohorte}
                  onChange={(e) => setGrupoCohorte(e.target.value)}
                >
                  <option value="">Sin grupo</option>
                  {grupoCohorte && !grupos.includes(grupoCohorte) && (
                    <option value={grupoCohorte}>{grupoCohorte}</option>
                  )}
                  {grupos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={styles.formActions}>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={formLoading} style={{ flex: 1 }}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn-primary" style={{ flex: 1, width: editingId ? undefined : '100%' }} disabled={formLoading}>
                {formLoading ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear alumno'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div style={styles.listHeader}>
            <div style={styles.formHeader}>
              <GraduationCap size={20} color="#0073A5" />
              <h3 style={styles.cardTitle}>Alumnos registrados</h3>
            </div>
            <p style={styles.cardSubtitle}>
              {loading ? 'Cargando…' : `${estudiantes.length} alumno(s) encontrado(s)`}
            </p>
          </div>

          {grupoAviso && (
            <div
              style={{
                ...styles.alert,
                ...(grupoAviso.tipo === 'ok'
                  ? { color: 'var(--success)', backgroundColor: 'rgba(16,185,129,0.1)' }
                  : { color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' }),
              }}
            >
              {grupoAviso.texto}
            </div>
          )}

          <div style={styles.filters}>
            <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
              <Search size={16} color="#94A3B8" style={styles.searchIcon} />
              <input
                type="search"
                className="form-input"
                placeholder="Buscar por nombre, email o ID…"
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
                style={{ paddingLeft: '36px', fontSize: '13px' }}
              />
            </div>
            <select
              className="form-select"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              style={{ minWidth: '200px', fontSize: '13px' }}
            >
              <option value="">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID estudiante</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Grupo</th>
                  <th style={styles.th}>Biblioteca</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!loading && estudiantes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#64748B' }}>
                      No hay alumnos que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {estudiantes.map((u) => (
                  <tr key={u.id} style={{ ...styles.tr, ...(editingId === u.id ? styles.trEditing : {}) }}>
                    <td style={styles.td}>
                      {u.id_estudiante ? (
                        <code style={styles.idBadge}>{u.id_estudiante}</code>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '12px' }}>Sin ID</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{u.email}</div>
                    </td>
                    <td style={styles.td}>
                      <select
                        className="form-select"
                        style={{
                          ...styles.grupoSelect,
                          ...(u.grupo_cohorte ? {} : { color: '#94A3B8' }),
                        }}
                        value={u.grupo_cohorte || ''}
                        onChange={(e) => cambiarGrupo(u, e.target.value)}
                        disabled={grupoSavingId === u.id}
                        aria-label={`Grupo de ${u.nombre}`}
                        title="Cambiar el grupo del alumno"
                      >
                        <option value="">Sin grupo</option>
                        {u.grupo_cohorte && !grupos.includes(u.grupo_cohorte) && (
                          <option value={u.grupo_cohorte}>{u.grupo_cohorte}</option>
                        )}
                        {grupos.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => toggleAcceso(u)}
                        style={{
                          ...styles.accesoToggle,
                          ...(u.acceso_biblioteca_prioritario
                            ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981' }
                            : { backgroundColor: 'rgba(176,179,181,0.15)', color: '#64748B' }),
                        }}
                        title="Acceso prioritario a todos los libros"
                      >
                        {u.acceso_biblioteca_prioritario ? 'Prioritario' : 'De pago'}
                      </button>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={styles.rowActions}>
                        <button type="button" onClick={() => startEdit(u)} style={styles.editBtn} title="Editar" aria-label={`Editar a ${u.nombre}`}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => handleDelete(u.id, u.nombre)} style={styles.deleteBtn} title="Eliminar" aria-label={`Eliminar a ${u.nombre}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '1200px', margin: '0 auto' },
  header: { marginBottom: '28px' },
  title: { fontSize: '28px', fontWeight: 800, color: '#0073A5', marginBottom: '6px' },
  subtitle: { fontSize: '14px', color: '#64748B' },
  grid: { display: 'grid', gridTemplateColumns: '4fr 6fr', gap: '24px' },
  formHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
  cardTitle: { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' },
  cardSubtitle: { fontSize: '13px', color: '#64748B', margin: 0 },
  listHeader: { marginBottom: '16px' },
  form: { width: '100%' },
  formActions: { display: 'flex', gap: '10px', marginTop: '4px' },
  formHint: { fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5 },
  alert: { padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', textAlign: 'center' },
  credentialsBox: {
    border: '1px solid #10B981',
    background: 'rgba(16, 185, 129, 0.04)',
    marginBottom: '20px',
    padding: '16px',
    position: 'relative',
    borderRadius: '12px',
  },
  closeCredBtn: { position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' },
  credentialsTitle: { color: 'var(--success)', fontWeight: 700, fontSize: '15px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' },
  idCode: { backgroundColor: 'rgba(0,115,165,0.1)', color: '#0073A5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontFamily: 'monospace' },
  passCode: { backgroundColor: 'rgba(244,63,94,0.1)', color: '#E11D48', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace' },
  filters: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
  searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid var(--border)', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid var(--border)' },
  trEditing: { backgroundColor: 'rgba(0, 115, 165, 0.06)' },
  td: { padding: '14px 16px', fontSize: '14px', verticalAlign: 'middle' },
  idBadge: {
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: 800,
    fontFamily: 'monospace',
    color: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.1)',
    padding: '4px 10px',
    borderRadius: '6px',
  },
  grupoSelect: {
    fontSize: '13px',
    padding: '6px 10px',
    minWidth: '190px',
    minHeight: '38px',
  },
  cohortBadge: {
    fontSize: '12px',
    color: '#334155',
    backgroundColor: 'rgba(176, 179, 181, 0.15)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  accesoToggle: { border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  rowActions: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  editBtn: {
    border: 'none',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    color: '#0073A5',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deleteBtn: {
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    color: '#EF4444',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};
