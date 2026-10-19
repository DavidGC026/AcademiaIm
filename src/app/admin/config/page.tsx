'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Sparkles, Key, AlertTriangle } from 'lucide-react';
import { toAssetUrl } from '@/lib/assetUrl';

export default function ConfigPage() {
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-5.6-luna');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [storedProvider, setStoredProvider] = useState('openai');
  const [managedByEnvironment, setManagedByEnvironment] = useState(false);
  const [modelManagedByEnvironment, setModelManagedByEnvironment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchConfig = async () => {
    try {
      const res = await fetch(toAssetUrl('/api/admin/config'));
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider);
        setStoredProvider(data.provider);
        setModel(data.model || 'gpt-5.6-luna');
        setApiKey('');
        setManagedByEnvironment(Boolean(data.managedByEnvironment));
        setModelManagedByEnvironment(Boolean(data.modelManagedByEnvironment));
        setHasKey(data.hasKey);
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La carga es asíncrona; los cambios de estado ocurren después de resolver la petición.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setSaving(true);

    try {
      const res = await fetch(toAssetUrl('/api/admin/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, apiKey }),
      });

      if (!res.ok) {
        const failure = await res.json();
        throw new Error(failure.error || 'No se pudo guardar la configuración');
      }

      setSuccessMsg('Configuración guardada correctamente.');
      void fetchConfig();
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Cargando configuraciones...</div>;
  }

  return (
    <div className="page-container" style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Configuración del Asistente de IA</h1>
        <p style={styles.subtitle}>Define el proveedor de inteligencia artificial y administra la API Key de forma segura</p>
      </div>

      <div className="responsive-two-column" style={styles.grid}>
        {/* Formulario */}
        <div className="card">
          <div style={styles.cardHeader}>
            <Settings size={20} color="#0073A5" />
            <h3 style={styles.cardTitle}>Proveedor de IA Académica</h3>
          </div>

          {successMsg && <div style={{ ...styles.alert, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}
          {errorMsg && <div style={{ ...styles.alert, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>{errorMsg}</div>}

          <form onSubmit={handleSave} style={styles.form}>
            <div style={styles.providerGrid}>
              {/* Gemini Card */}
              <button
                type="button"
                aria-pressed={provider === 'gemini'}
                disabled={managedByEnvironment}
                onClick={() => { setProvider('gemini'); setApiKey(''); }}
                style={{
                  ...styles.providerCard,
                  ...(provider === 'gemini' ? styles.activeProviderCard : {}),
                }}
              >
                <div style={{ ...styles.providerIcon, color: '#0073A5' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={styles.providerName}>Google Gemini</div>
                  <div style={styles.providerDesc}>Consulta de temas y materiales del campus</div>
                </div>
              </button>

              {/* OpenAI Card */}
              <button
                type="button"
                aria-pressed={provider === 'openai'}
                disabled={managedByEnvironment}
                onClick={() => { setProvider('openai'); setApiKey(''); }}
                style={{
                  ...styles.providerCard,
                  ...(provider === 'openai' ? styles.activeProviderCard : {}),
                }}
              >
                <div style={{ ...styles.providerIcon, color: '#10B981' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={styles.providerName}>OpenAI GPT</div>
                  <div style={styles.providerDesc}>Contexto académico, archivos y accesos directos</div>
                </div>
              </button>

              {/* Grok Card */}
              <button
                type="button"
                aria-pressed={provider === 'grok'}
                disabled={managedByEnvironment}
                onClick={() => { setProvider('grok'); setApiKey(''); }}
                style={{
                  ...styles.providerCard,
                  ...(provider === 'grok' ? styles.activeProviderCard : {}),
                }}
              >
                <div style={{ ...styles.providerIcon, color: '#000000' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={styles.providerName}>xAI Grok</div>
                  <div style={styles.providerDesc}>Conexión con la API oficial de X.AI para respuestas precisas</div>
                </div>
              </button>
            </div>

            {provider === 'openai' && (
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label" htmlFor="openai-model">Modelo de OpenAI</label>
                <select
                  id="openai-model"
                  disabled={modelManagedByEnvironment}
                  className="form-select"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  <option value="gpt-5.6-luna">GPT-5.6 Luna — menor costo y alto volumen</option>
                  <option value="gpt-5.6-terra">GPT-5.6 Terra — equilibrio de calidad y costo</option>
                  <option value="gpt-5.6-sol">GPT-5.6 Sol — máxima capacidad</option>
                </select>
                <span style={styles.inputHelp}>
                  Selecciona el modelo habilitado para la cuenta del campus.
                </span>
              </div>
            )}

            <div className="form-group" style={{ marginTop: '24px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={16} /> API Key del Proveedor Seleccionado
              </label>
              <input
                type="password"
                className="form-input"
                value={apiKey}
                disabled={managedByEnvironment}
                autoComplete="off"
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey && provider === storedProvider ? "••••••••••••••••••••••••" : "Introduce la clave de API..."}
              />
              <span style={styles.inputHelp}>
                {managedByEnvironment ? "La conexión de OpenAI se administra en el servidor. Los cambios de este formulario no reemplazan esa clave." : hasKey && provider === storedProvider
                  ? "Ya hay una clave configurada en el sistema. Escribe una nueva si deseas reemplazarla."
                  : "Por favor, introduce una clave válida para activar el chatbot del estudiante."}
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '16px', display: 'inline-flex', gap: '8px' }}
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </form>
        </div>

        {/* Información / Advertencias */}
        <div style={styles.infoCol}>
          <div className="card" style={{ backgroundColor: 'rgba(0, 115, 165, 0.03)', borderColor: 'rgba(0, 115, 165, 0.15)' }}>
            <h4 style={{ ...styles.cardTitle, color: '#0073A5', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} /> Asistente de IA Académico
            </h4>
            <p style={{ ...styles.infoText, marginTop: '12px' }}>
              El asistente se muestra en todo el panel del estudiante y utiliza únicamente la información académica a la que ese alumno tiene acceso:
            </p>
            <ul style={styles.bullets}>
              <li>Materias, clases, pendientes y próximas sesiones.</li>
              <li>Accesos directos a la clase o evaluación correspondiente.</li>
              <li>Temario y presentación de la clase que el alumno tiene abierta.</li>
              <li>Explicaciones y pistas sin resolver tareas ni exámenes.</li>
            </ul>
            <p style={styles.infoText}>
              Para que funcione correctamente, el backend realiza la petición usando la API del proveedor seleccionado, manteniendo la API Key totalmente oculta de la red del cliente.
            </p>
          </div>

          <div className="card" style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <h4 style={{ ...styles.cardTitle, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} /> Seguridad de las Llaves
            </h4>
            <p style={{ ...styles.infoText, marginTop: '12px' }}>
              La clave nunca se envía al navegador. Para mayor seguridad en producción, configura <code>OPENAI_API_KEY</code> en el entorno del servidor; la clave guardada aquí se mantiene como alternativa administrada en MySQL.
            </p>
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
    gridTemplateColumns: '6fr 4fr',
    gap: '24px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
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
  providerGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  providerCard: {
    display: 'flex',
    textAlign: 'left',
    background: 'transparent',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  activeProviderCard: {
    borderColor: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.05)',
  },
  providerIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  providerName: {
    fontWeight: '700',
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  providerDesc: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '2px',
  },
  inputHelp: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '4px',
  },
  infoCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  infoText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  bullets: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    paddingLeft: '20px',
    margin: '12px 0',
    lineHeight: '1.6',
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
