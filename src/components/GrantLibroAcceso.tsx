'use client';

import { useState } from 'react';
import { UserPlus, UserMinus } from 'lucide-react';

interface GrantLibroAccesoProps {
  libroId: number;
  titulo: string;
}

export default function GrantLibroAcceso({ libroId, titulo }: GrantLibroAccesoProps) {
  const [idEstudiante, setIdEstudiante] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const runAction = async (method: 'POST' | 'DELETE') => {
    const id = idEstudiante.trim();
    if (!id) return;

    setLoading(true);
    setFeedback('');
    try {
      const res = await fetch('/api/biblioteca/libros/acceso', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libro_id: libroId, id_estudiante: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || 'No se pudo completar la acción');
        return;
      }
      setFeedback(data.message || (method === 'POST' ? 'Acceso otorgado' : 'Acceso retirado'));
    } catch {
      setFeedback('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px dashed var(--border)',
        backgroundColor: '#fff',
      }}
      aria-label={`Gestionar acceso a ${titulo}`}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>
        Gestionar acceso de alumno
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="ID alumno (ej. EST-0001)"
          value={idEstudiante}
          onChange={(e) => setIdEstudiante(e.target.value)}
          disabled={loading}
          style={{ flex: 1, minWidth: '140px', fontSize: '12px', padding: '8px 10px' }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || !idEstudiante.trim()}
          onClick={() => runAction('POST')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
        >
          <UserPlus size={14} />
          Dar acceso
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || !idEstudiante.trim()}
          onClick={() => runAction('DELETE')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
        >
          <UserMinus size={14} />
          Quitar acceso
        </button>
      </div>
      {feedback && (
        <p
          style={{
            fontSize: '11px',
            margin: '8px 0 0',
            color:
              feedback.includes('Error') ||
              feedback.includes('No se') ||
              feedback.includes('no tiene')
                ? '#EF4444'
                : '#10B981',
          }}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
