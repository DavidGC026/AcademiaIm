'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserCircle, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { toAssetUrl } from '@/lib/assetUrl';

interface Biografia {
  id: number;
  nombre: string;
  cargo: string | null;
  foto_url: string | null;
  biografia: string;
  orden: number;
}

interface BiografiasPanelProps {
  cursoId: number | null;
  variant?: 'student' | 'teacher';
}

const emptyForm = { nombre: '', cargo: '', biografia: '', foto_url: '', orden: 0 };

export default function BiografiasPanel({ cursoId, variant = 'student' }: BiografiasPanelProps) {
  const [items, setItems] = useState<Biografia[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const isTeacher = variant === 'teacher';

  const fetchBiografias = useCallback(async () => {
    if (!cursoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cursos/${cursoId}/biografias`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.biografias || []);
      }
    } catch (error) {
      console.error('Error al cargar biografías:', error);
    } finally {
      setLoading(false);
    }
  }, [cursoId]);

  useEffect(() => {
    fetchBiografias();
  }, [fetchBiografias]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleFotoUpload = async (file: File) => {
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir foto');
      setForm((prev) => ({ ...prev, foto_url: data.url }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al subir foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoId || !form.nombre.trim() || !form.biografia.trim()) return;
    setSaving(true);
    try {
      const url = editingId
        ? `/api/cursos/${cursoId}/biografias?bio_id=${editingId}`
        : `/api/cursos/${cursoId}/biografias`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      resetForm();
      fetchBiografias();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (bio: Biografia) => {
    setEditingId(bio.id);
    setForm({
      nombre: bio.nombre,
      cargo: bio.cargo || '',
      biografia: bio.biografia,
      foto_url: bio.foto_url || '',
      orden: bio.orden,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!cursoId || !confirm('¿Eliminar esta biografía?')) return;
    try {
      const res = await fetch(`/api/cursos/${cursoId}/biografias?bio_id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchBiografias();
    } catch {
      alert('No se pudo eliminar la biografía');
    }
  };

  if (!cursoId) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
        <UserCircle size={36} color="#B0B3B5" style={{ marginBottom: '8px' }} />
        <p>Selecciona una materia para ver biografías.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h3 style={styles.sectionTitle}>Biografías</h3>
          <p style={styles.subtitle}>
            {isTeacher
              ? 'Perfiles de expertos y docentes relacionados con este módulo.'
              : 'Conoce a los expertos y docentes de este módulo.'}
          </p>
        </div>
        {isTeacher && !showForm && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Plus size={16} /> Agregar
          </button>
        )}
      </div>

      {isTeacher && showForm && (
        <form onSubmit={handleSubmit} style={{ ...styles.formBox, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ color: '#0073A5' }}>{editingId ? 'Editar biografía' : 'Nueva biografía'}</strong>
            <button type="button" onClick={resetForm} style={styles.iconBtn}><X size={16} /></button>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Cargo / título</label>
            <input className="form-input" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ej. Dr. en Ingeniería Estructural" />
          </div>
          <div className="form-group">
            <label className="form-label">Foto (opcional)</label>
            <input type="file" accept="image/*" disabled={uploadingFoto} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFotoUpload(f); e.target.value = ''; }} style={{ fontSize: '12px' }} />
            {form.foto_url && <img src={toAssetUrl(form.foto_url)} alt="" style={{ marginTop: '8px', width: 72, height: 72, objectFit: 'cover', borderRadius: '50%' }} />}
          </div>
          <div className="form-group">
            <label className="form-label">Biografía</label>
            <textarea className="form-input" rows={4} value={form.biografia} onChange={(e) => setForm({ ...form, biografia: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: '#64748B', fontSize: '14px' }}>Cargando biografías…</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          {isTeacher ? 'Aún no hay biografías. Agrega perfiles de expertos o docentes.' : 'No hay biografías publicadas en este módulo.'}
        </div>
      ) : (
        <div style={styles.list}>
          {items.map((bio) => (
            <div key={bio.id} style={styles.card}>
              {isTeacher && (
                <div style={styles.actions}>
                  <button type="button" onClick={() => handleEdit(bio)} style={styles.iconBtn} title="Editar"><Pencil size={14} /></button>
                  <button type="button" onClick={() => handleDelete(bio.id)} style={{ ...styles.iconBtn, color: '#EF4444' }} title="Eliminar"><Trash2 size={14} /></button>
                </div>
              )}
              <div style={styles.cardInner}>
                {bio.foto_url ? (
                  <img src={toAssetUrl(bio.foto_url)} alt={bio.nombre} style={styles.avatar} />
                ) : (
                  <div style={styles.avatarPlaceholder}><UserCircle size={32} color="#0073A5" /></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.name}>{bio.nombre}</div>
                  {bio.cargo && <div style={styles.cargo}>{bio.cargo}</div>}
                  <p style={styles.bioText}>{bio.biografia}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' },
  subtitle: { fontSize: '13px', color: '#64748B', margin: 0 },
  formBox: { padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: '#F8FAFC' },
  empty: { padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { position: 'relative', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: '#fff' },
  cardInner: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  avatar: { width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: '50%', backgroundColor: 'rgba(0,115,165,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontWeight: 700, fontSize: '16px', color: '#0073A5' },
  cargo: { fontSize: '13px', color: '#64748B', fontWeight: 600, marginTop: '2px' },
  bioText: { fontSize: '14px', color: '#334155', lineHeight: 1.6, margin: '8px 0 0', whiteSpace: 'pre-wrap' },
  actions: { position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' },
  iconBtn: { border: 'none', background: 'rgba(176,179,181,0.15)', borderRadius: '6px', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' },
};
