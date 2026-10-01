'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, KeyRound } from 'lucide-react';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import PasswordChangePanel from '@/components/PasswordChangePanel';

interface UserItem {
  id: number;
  nombre: string;
  email: string;
  role_id: number;
  role_name: string;
  grupo_cohorte: string | null;
  created_at: string;
  id_estudiante?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  fecha_nacimiento?: string | null;
  acceso_biblioteca_prioritario?: number;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordUserId, setPasswordUserId] = useState('');

  // Form State
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId] = useState('2');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchUsers = () => fetch('/api/admin/users')
    .then(async response => {
      if (!response.ok) throw new Error('No se pudieron cargar los usuarios. Intenta de nuevo.');
      return response.json();
    })
    .then(result => {
        setUsers(result.users);
    })
    .catch(error => setFormError(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios. Intenta de nuevo.'))
    .finally(() => setLoading(false));

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: parseInt(roleId, 10),
          email,
          nombre,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el usuario');
      }

      setFormSuccess('Usuario creado exitosamente.');

      setNombre('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, userName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar usuario');
      }

      fetchUsers();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'No se pudo eliminar el usuario.');
    }
  };

  const staffUsers = users.filter((u) => u.role_id !== 3);
  const passwordUser = users.find(user => String(user.id) === passwordUserId);

  if (loading) {
    return <div style={styles.loading}>Cargando usuarios...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Usuarios y contraseñas</h1>
        <p style={styles.subtitle}>
          Registra maestros y personal.{' '}
          <Link href="/admin/alumnos" style={{ color: '#0073A5', fontWeight: 600 }}>
            Gestión de alumnos →
          </Link>
        </p>
      </div>

      <section id="user-passwords" className="card admin-password-management">
        <h2><KeyRound size={21} /> Contraseñas de usuarios</h2>
        <p>Restablece la contraseña de un maestro, estudiante o administrador.</p>
        <label className="form-label" htmlFor="password-user">Selecciona una cuenta</label>
        <select className="form-input" id="password-user" value={passwordUserId} onChange={event => setPasswordUserId(event.target.value)}>
          <option value="">Buscar cuenta en la lista</option>
          {users.map(user => <option key={user.id} value={user.id}>{user.nombre} · {user.email} ({user.role_name})</option>)}
        </select>
        {passwordUser && <PasswordChangePanel key={passwordUser.id} targetUser={passwordUser} onCancel={() => setPasswordUserId('')} />}
      </section>

      <div className="admin-users-grid">
        {/* Formulario (Columna Izquierda) */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={styles.formHeader}>
            <UserPlus size={20} color="#0073A5" />
            <h3 style={styles.cardTitle}>Registrar maestro o staff</h3>
          </div>

          {formError && <div style={{ ...styles.alert, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>{formError}</div>}
          {formSuccess && <div style={{ ...styles.alert, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>{formSuccess}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="roleSelect">Rol</label>
              <select
                id="roleSelect"
                className="form-select"
                value={roleId}
                disabled
              >
                <option value="2">Maestro / Profesor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="emailInput">Correo electrónico</label>
              <input
                type="email"
                id="emailInput"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maestro@imcyc.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="nameInput">Nombre completo</label>
              <input
                type="text"
                id="nameInput"
                className="form-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Ing. Carlos Rodríguez"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="passwordInput">Contraseña</label>
              <PasswordInput
                id="passwordInput"
                autoComplete="new-password"
                minLength={6}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>


            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '10px' }}
              disabled={formLoading}
            >
              {formLoading ? 'Guardando...' : 'Crear Usuario'}
            </button>
          </form>
        </div>

        {/* Tabla de Usuarios (Columna Derecha) */}
        <div className="card">
          <h3 style={styles.cardTitle}>Staff registrado</h3>
          <p style={styles.cardSubtitle}>Total: {staffUsers.length} usuario(s)</p>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Rol</th>
                  <th style={styles.th}>Grupo / Cohorte</th>
                  <th style={styles.th}>Acceso biblioteca</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((u) => (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: '600' }}>{u.nombre}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{u.email}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.roleBadge}>
                        {u.role_name}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {u.grupo_cohorte ? (
                        <span style={styles.cohortBadge}>
                          {u.grupo_cohorte}
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '13px' }}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: '#94A3B8', fontSize: '13px' }}>—</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', minHeight: '44px', marginBottom: '8px' }} onClick={() => { setPasswordUserId(String(u.id)); document.getElementById('user-passwords')?.scrollIntoView({ block: 'start' }); }}>
                        <KeyRound size={16} /> Contraseña
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.nombre)}
                        style={styles.deleteBtn}
                        title="Eliminar Usuario"
                        aria-label={`Eliminar a ${u.nombre}`}
                      >
                        <Trash2 size={16} />
                      </button>
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
  grid: {
    display: 'grid',
    gridTemplateColumns: '4fr 6fr',
    gap: '24px',
  },
  formHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  cardSubtitle: {
    fontSize: '13px',
    color: '#64748B',
    marginBottom: '20px',
  },
  form: {
    width: '100%',
  },
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
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    verticalAlign: 'middle',
  },
  roleBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.06)',
    padding: '4px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    display: 'inline-block',
  },
  cohortBadge: {
    fontSize: '12px',
    color: '#334155',
    backgroundColor: 'rgba(176, 179, 181, 0.15)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '500',
    display: 'inline-block',
  },
  accesoToggle: {
    border: 'none',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'var(--transition)',
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
    transition: 'var(--transition)',
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
