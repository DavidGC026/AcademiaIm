'use client';

import { useEffect, useState } from 'react';
import { X, CreditCard, Landmark, ShoppingBag, Loader2, CheckCircle2 } from 'lucide-react';

interface CheckoutBook {
  id: number;
  titulo: string;
  precio: number;
  tienda_url?: string;
}

interface CheckoutModalProps {
  book: CheckoutBook;
  onClose: () => void;
  onSuccess: () => void;
}

interface OpenpayConfig {
  enabled: boolean;
  merchantId: string;
  publicKey: string;
  production: boolean;
}

declare global {
  interface Window {
    OpenPay?: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

export default function CheckoutModal({ book, onClose, onSuccess }: CheckoutModalProps) {
  const [config, setConfig] = useState<OpenpayConfig | null>(null);
  const [metodo, setMetodo] = useState<'card' | 'spei'>('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [spei, setSpei] = useState<any>(null);

  const [card, setCard] = useState({ holder_name: '', card_number: '', expiration_month: '', expiration_year: '', cvv2: '' });

  useEffect(() => {
    fetch('/api/biblioteca/openpay/config')
      .then((r) => r.json())
      .then(async (cfg: OpenpayConfig) => {
        setConfig(cfg);
        if (cfg.enabled && cfg.merchantId && cfg.publicKey) {
          try {
            await loadScript('https://js.openpay.mx/openpay.v1.min.js');
            await loadScript('https://js.openpay.mx/openpay-data.v1.min.js');
            window.OpenPay.setId(cfg.merchantId);
            window.OpenPay.setApiKey(cfg.publicKey);
            window.OpenPay.setSandboxMode(!cfg.production);
          } catch {
            setError('No se pudo inicializar el procesador de pagos.');
          }
        }
      })
      .catch(() => setConfig({ enabled: false, merchantId: '', publicKey: '', production: false }));
  }, []);

  const enviarCompra = async (payload: any) => {
    const res = await fetch('/api/biblioteca/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libro_id: book.id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo procesar el pago');
    return data;
  };

  const pagarTarjeta = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!window.OpenPay) {
      setError('Procesador de pagos no disponible.');
      return;
    }
    setLoading(true);
    let deviceSessionId = '';
    try {
      deviceSessionId = window.OpenPay.deviceData.setup();
    } catch {
      /* ponytail: si el antifraude no inicializa, se envía sin device id */
    }

    window.OpenPay.token.create(
      {
        card_number: card.card_number.replace(/\s/g, ''),
        holder_name: card.holder_name,
        expiration_year: card.expiration_year,
        expiration_month: card.expiration_month,
        cvv2: card.cvv2,
      },
      async (resp: any) => {
        try {
          const data = await enviarCompra({
            metodo: 'card',
            source_id: resp.data.id,
            device_session_id: deviceSessionId,
          });
          if (data.comprado) {
            setDone(true);
            onSuccess();
          } else {
            setError('El pago quedó pendiente de confirmación. Intenta de nuevo o usa otro método.');
          }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
      (err: any) => {
        setLoading(false);
        setError(err?.data?.description || 'Tarjeta inválida. Revisa los datos.');
      }
    );
  };

  const pagarSpei = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await enviarCompra({ metodo: 'spei' });
      setSpei(data.payment_method);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div className="card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        <h3 style={styles.title}>Comprar libro</h3>
        <div style={styles.bookRow}>
          <span style={{ fontWeight: 700 }}>{book.titulo}</span>
          <span style={styles.price}>${Number(book.precio).toFixed(2)} MXN</span>
        </div>

        {done ? (
          <div style={styles.successBox}>
            <CheckCircle2 size={40} color="#10B981" />
            <p style={{ fontWeight: 700, marginTop: '12px' }}>¡Pago completado!</p>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              Ya puedes leer este libro dentro de la plataforma.
            </p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={onClose}>Cerrar</button>
          </div>
        ) : config && !config.enabled ? (
          <div style={styles.infoBox}>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '12px' }}>
              El pago en línea aún no está activo. Puedes adquirir el libro en la tienda oficial.
            </p>
            <a
              href={book.tienda_url || 'https://tienda.imcyc.com/products'}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <ShoppingBag size={16} /> Ir a la tienda
            </a>
          </div>
        ) : !config ? (
          <div style={styles.infoBox}><Loader2 size={20} className="spin" /> Cargando...</div>
        ) : (
          <>
            <div style={styles.tabs}>
              <button
                style={{ ...styles.tab, ...(metodo === 'card' ? styles.tabActive : {}) }}
                onClick={() => { setMetodo('card'); setSpei(null); setError(''); }}
              >
                <CreditCard size={16} /> Tarjeta
              </button>
              <button
                style={{ ...styles.tab, ...(metodo === 'spei' ? styles.tabActive : {}) }}
                onClick={() => { setMetodo('spei'); setError(''); }}
              >
                <Landmark size={16} /> SPEI / Transferencia
              </button>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {metodo === 'card' ? (
              <form onSubmit={pagarTarjeta}>
                <div className="form-group">
                  <label className="form-label">Nombre del titular</label>
                  <input className="form-input" value={card.holder_name} required
                    onChange={(e) => setCard({ ...card, holder_name: e.target.value })} placeholder="Como aparece en la tarjeta" />
                </div>
                <div className="form-group">
                  <label className="form-label">Número de tarjeta</label>
                  <input className="form-input" value={card.card_number} required inputMode="numeric"
                    onChange={(e) => setCard({ ...card, card_number: e.target.value })} placeholder="4111 1111 1111 1111" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mes (MM)</label>
                    <input className="form-input" value={card.expiration_month} required inputMode="numeric" maxLength={2}
                      onChange={(e) => setCard({ ...card, expiration_month: e.target.value })} placeholder="12" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Año (YY)</label>
                    <input className="form-input" value={card.expiration_year} required inputMode="numeric" maxLength={2}
                      onChange={(e) => setCard({ ...card, expiration_year: e.target.value })} placeholder="28" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">CVV</label>
                    <input className="form-input" value={card.cvv2} required inputMode="numeric" maxLength={4}
                      onChange={(e) => setCard({ ...card, cvv2: e.target.value })} placeholder="123" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}
                  style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? <><Loader2 size={16} className="spin" /> Procesando...</> : `Pagar $${Number(book.precio).toFixed(2)} MXN`}
                </button>
                <p style={styles.secure}>Pago seguro procesado por Openpay. No almacenamos los datos de tu tarjeta.</p>
              </form>
            ) : spei ? (
              <div style={styles.speiBox}>
                <p style={{ fontWeight: 700, marginBottom: '8px' }}>Realiza tu transferencia SPEI</p>
                <div style={styles.speiRow}><span>Banco</span><strong>{spei.bank || 'STP'}</strong></div>
                <div style={styles.speiRow}><span>CLABE</span><strong style={{ fontFamily: 'monospace' }}>{spei.clabe}</strong></div>
                <div style={styles.speiRow}><span>Beneficiario</span><strong>{spei.name || 'Openpay'}</strong></div>
                {spei.reference && <div style={styles.speiRow}><span>Referencia</span><strong>{spei.reference}</strong></div>}
                <div style={styles.speiRow}><span>Monto</span><strong>${Number(book.precio).toFixed(2)} MXN</strong></div>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '12px' }}>
                  Tu acceso se activará automáticamente al confirmarse el pago (puede tardar unos minutos).
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
                  Generaremos una CLABE para que pagues por transferencia SPEI desde tu banca en línea.
                </p>
                <button className="btn btn-primary" disabled={loading} onClick={pagarSpei}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? <><Loader2 size={16} className="spin" /> Generando...</> : 'Generar datos de pago SPEI'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' },
  modal: { width: '100%', maxWidth: '460px', padding: '28px', position: 'relative', backgroundColor: '#fff', borderRadius: '16px', maxHeight: '92vh', overflowY: 'auto' },
  closeBtn: { position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' },
  title: { fontSize: '20px', fontWeight: 800, color: '#0073A5', marginBottom: '12px' },
  bookRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px', gap: '12px' },
  price: { fontWeight: 800, color: '#0073A5', whiteSpace: 'nowrap' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#64748B' },
  tabActive: { borderColor: '#0073A5', color: '#0073A5', backgroundColor: 'rgba(0,115,165,0.06)' },
  error: { backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '14px' },
  secure: { fontSize: '11px', color: '#94A3B8', marginTop: '10px', textAlign: 'center' },
  infoBox: { padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  successBox: { padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  speiBox: { backgroundColor: '#F8FAFC', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' },
  speiRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid var(--border)' },
};
