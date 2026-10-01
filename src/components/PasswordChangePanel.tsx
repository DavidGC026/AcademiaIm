'use client';

import { useId, useState } from 'react';
import { LockKeyhole, CheckCircle2, AlertCircle } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';

interface PasswordChangePanelProps {
  targetUser?: { id: number; nombre: string; email: string };
  onCancel?: () => void;
}

export default function PasswordChangePanel({ targetUser, onCancel }: PasswordChangePanelProps) {
  const formId = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ error: false, text: '' });

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage({ error: false, text: '' });
    if (password.length < 6 || password.length > 128) {
      setMessage({ error: true, text: 'Usa entre 6 y 128 caracteres para la nueva contraseña.' });
      return;
    }
    if (password !== confirmation) {
      setMessage({ error: true, text: 'Las contraseñas no coinciden. Revisa la confirmación.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(targetUser ? `/api/admin/users/${targetUser.id}/password` : '/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetUser ? { password } : { currentPassword, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la contraseña.');
      setCurrentPassword('');
      setPassword('');
      setConfirmation('');
      setMessage({ error: false, text: targetUser ? `Contraseña actualizada para ${targetUser.email}.` : 'Contraseña actualizada. Úsala la próxima vez que inicies sesión.' });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'No se pudo actualizar la contraseña. Revisa tu conexión.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card account-password-panel" aria-labelledby={`${formId}-title`}>
      <div className="account-password-heading"><LockKeyhole size={22} /><h2 id={`${formId}-title`}>{targetUser ? 'Restablecer contraseña' : 'Cambiar mi contraseña'}</h2></div>
      <p className="account-password-description">{targetUser ? <><strong>{targetUser.nombre}</strong><br />{targetUser.email}</> : 'Actualiza la contraseña con la que ingresas a Academia IMCYC.'}</p>
      <form onSubmit={savePassword}>
        {message.text && <div className={`account-message ${message.error ? 'account-message--error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span>{message.text}</span></div>}
        {!targetUser && <div className="form-group">
          <label className="form-label" htmlFor={`${formId}-current`}>Contraseña actual</label>
          <PasswordInput id={`${formId}-current`} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={saving} />
        </div>}
        <div className="form-group">
          <label className="form-label" htmlFor={`${formId}-new`}>Nueva contraseña</label>
          <PasswordInput id={`${formId}-new`} autoComplete="new-password" minLength={6} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required disabled={saving} aria-describedby={`${formId}-hint`} />
          <p id={`${formId}-hint`} className="account-password-hint">Mínimo 6 caracteres.</p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${formId}-confirm`}>Confirmar nueva contraseña</label>
          <PasswordInput id={`${formId}-confirm`} autoComplete="new-password" minLength={6} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} required disabled={saving} />
        </div>
        <div className="account-password-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}><LockKeyhole size={17} />{saving ? 'Guardando...' : 'Guardar contraseña'}</button>
          {onCancel && <button type="button" className="btn btn-neutral" onClick={onCancel} disabled={saving}>Cerrar</button>}
        </div>
      </form>
    </section>
  );
}
