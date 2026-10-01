'use client';

import { useState, useEffect } from 'react';
import PasswordChangePanel from '@/components/PasswordChangePanel';
import { toAssetUrl } from '@/lib/assetUrl';
import { 
  User, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Camera
} from 'lucide-react';

export default function EstudiantePerfil() {
  const [profile, setProfile] = useState({
    nombre: '',
    id_estudiante: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    email: '',
    grupo_cohorte: '',
    foto_perfil: '',
  });

  const [loading, setLoading] = useState(true);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    async function loadPerfil() {
      try {
        const res = await fetch('/api/perfil');
        if (res.ok) {
          const data = await res.json();
          setProfile({
            nombre: data.user.nombre || '',
            id_estudiante: data.user.id_estudiante || '',
            apellido_paterno: data.user.apellido_paterno || '',
            apellido_materno: data.user.apellido_materno || '',
            fecha_nacimiento: data.user.fecha_nacimiento || '',
            email: data.user.email || '',
            grupo_cohorte: data.user.grupo_cohorte || 'Sin grupo asignado',
            foto_perfil: data.user.foto_perfil || '',
          });
        }
      } catch (err) {
        console.error('Error al cargar perfil:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPerfil();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });
    setSubmittingProfile(true);

    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: profile.nombre,
          id_estudiante: profile.id_estudiante,
          apellido_paterno: profile.apellido_paterno,
          apellido_materno: profile.apellido_materno,
          fecha_nacimiento: profile.fecha_nacimiento,
          foto_perfil: profile.foto_perfil || null,
        }),
      });

      if (res.ok) {
        setProfileMessage({ type: 'success', text: 'Datos personales actualizados con éxito.' });
        // Recargar la página para refrescar el nombre en el header
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const errData = await res.json();
        setProfileMessage({ type: 'error', text: errData.error || 'Ocurrió un error al guardar los datos.' });
      }
    } catch (err) {
      console.error(err);
      setProfileMessage({ type: 'error', text: 'Error de red o conexión.' });
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setProfile((p) => ({ ...p, foto_perfil: data.url }));
      } else {
        alert(data.error || 'Error al subir foto');
      }
    } catch {
      alert('Error de conexión al subir foto');
    }
  };

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.title}>Configuración de Perfil</h1>
        <p style={styles.subtitle}>Actualiza tus datos personales y gestiona la seguridad de tu cuenta.</p>
      </div>

      <div className="account-profile-grid">
        {/* Columna Izquierda: Información de Perfil */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.iconBg}>
              <User size={20} color="#0073A5" />
            </div>
            <h2 style={styles.cardTitle}>Datos Personales</h2>
          </div>
          
          <form onSubmit={handleProfileSubmit} style={styles.form}>
            <div style={styles.photoSection}>
              {profile.foto_perfil ? (
                <img src={toAssetUrl(profile.foto_perfil)} alt="" style={styles.avatar} />
              ) : (
                <div style={styles.avatarPlaceholder}>
                  <User size={32} color="#0073A5" />
                </div>
              )}
              <div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={16} /> Cambiar foto
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </label>
                {profile.foto_perfil && (
                  <button
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, foto_perfil: '' }))}
                    style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>

            {profileMessage.text && (
              <div style={{
                ...styles.messageBanner,
                backgroundColor: profileMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: profileMessage.type === 'success' ? '#10B981' : '#EF4444',
                borderColor: profileMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
              }}>
                {profileMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Correo Electrónico (No editable)</label>
                <div style={styles.inputWrapper}>
                  <Mail size={16} style={styles.inputIcon} />
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    style={styles.inputDisabled}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Cohorte / Grupo</label>
                <div style={styles.inputWrapper}>
                  <User size={16} style={styles.inputIcon} />
                  <input
                    type="text"
                    value={profile.grupo_cohorte}
                    disabled
                    style={styles.inputDisabled}
                  />
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Matrícula / ID Estudiante</label>
                <input
                  type="text"
                  placeholder="Ej. EST-12345"
                  value={profile.id_estudiante}
                  onChange={(e) => setProfile({ ...profile, id_estudiante: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Nombre(s) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ingresa tu nombre"
                  value={profile.nombre}
                  onChange={(e) => setProfile({ ...profile, nombre: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Apellido Paterno</label>
                <input
                  type="text"
                  placeholder="Apellido Paterno"
                  value={profile.apellido_paterno}
                  onChange={(e) => setProfile({ ...profile, apellido_paterno: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Apellido Materno</label>
                <input
                  type="text"
                  placeholder="Apellido Materno"
                  value={profile.apellido_materno}
                  onChange={(e) => setProfile({ ...profile, apellido_materno: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Fecha de Nacimiento</label>
                <div style={styles.inputWrapper}>
                  <Calendar size={16} style={styles.inputIcon} />
                  <input
                    type="date"
                    value={profile.fecha_nacimiento}
                    onChange={(e) => setProfile({ ...profile, fecha_nacimiento: e.target.value })}
                    style={styles.inputWithIcon}
                  />
                </div>
              </div>
              <div style={styles.formGroup}></div>
            </div>

            <button
              type="submit"
              disabled={submittingProfile}
              style={styles.submitButton}
            >
              <Save size={18} style={{ marginRight: '8px' }} />
              {submittingProfile ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        </div>

        <PasswordChangePanel />
      </div>
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '32px',
    alignItems: 'start',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '28px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '1px solid #F1F5F9',
    paddingBottom: '16px',
  },
  iconBg: {
    padding: '8px',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    borderRadius: '10px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1E293B',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  photoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #F1F5F9',
  },
  avatar: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid rgba(0,115,165,0.15)',
  },
  avatarPlaceholder: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,115,165,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    fontFamily: 'Outfit, sans-serif',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  inputWithIcon: {
    fontFamily: 'Outfit, sans-serif',
    padding: '10px 14px 10px 38px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#94A3B8',
    pointerEvents: 'none',
  },
  inputDisabled: {
    fontFamily: 'Outfit, sans-serif',
    padding: '10px 14px 10px 38px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    fontSize: '14px',
    width: '100%',
    backgroundColor: '#F8FAFC',
    color: '#64748B',
    cursor: 'not-allowed',
  },
  submitButton: {
    fontFamily: 'Outfit, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginTop: '12px',
  },
  messageBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: '500',
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
};
