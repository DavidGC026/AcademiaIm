'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, MessageSquare } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: '¡Hola! Soy tu Asistente Académico de la Academia IMCYC. Estoy aquí para responder tus dudas técnicas sobre la dosificación de concreto, química del cemento, aditivos, control de calidad y más. ¿En qué puedo apoyarte hoy?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Tomamos el historial excluyendo el primer mensaje de bienvenida
      const historyPayload = messages.slice(1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const res = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: historyPayload
        })
      });

      if (!res.ok) {
        throw new Error('Fallo en el servidor al procesar la respuesta');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
    } catch (error) {
      setMessages(prev => [
        ...prev, 
        { role: 'model', content: 'Lo siento, ocurrió un error temporal al procesar tu pregunta. Por favor, intenta de nuevo.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Botón Flotante */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} style={styles.floatingBtn} className="btn-primary">
          <Sparkles size={22} />
          <span style={styles.floatingText}>Asistente Académico</span>
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div style={styles.chatWindow} className="glass-panel">
          {/* Cabecera */}
          <div style={styles.chatHeader}>
            <div style={styles.headerTitle}>
              <Sparkles size={16} />
              <span>Asistente IMCYC</span>
            </div>
            <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>
              <X size={18} />
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div ref={scrollRef} style={styles.messageBox}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={idx} 
                  style={{
                    ...styles.messageWrapper,
                    justifyContent: isUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div 
                    style={{
                      ...styles.bubble,
                      ...(isUser ? styles.userBubble : styles.aiBubble)
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
                <div style={{ ...styles.bubble, ...styles.aiBubble, color: '#64748B' }}>
                  Escribiendo respuesta...
                </div>
              </div>
            )}
          </div>

          {/* Barra de Entrada */}
          <form onSubmit={handleSend} style={styles.inputArea}>
            <input
              type="text"
              className="form-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo sobre concreto..."
              style={styles.chatInput}
              disabled={loading}
              required
            />
            <button type="submit" style={styles.sendBtn} className="btn btn-primary" disabled={loading}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 999,
  },
  floatingBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 22px',
    borderRadius: '30px',
    boxShadow: '0 8px 24px rgba(0, 115, 165, 0.3)',
    cursor: 'pointer',
    border: 'none',
  },
  floatingText: {
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading)',
  },
  chatWindow: {
    width: '380px',
    height: '500px',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
  },
  chatHeader: {
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '700',
    fontSize: '14px',
    fontFamily: 'var(--font-heading)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    opacity: 0.8,
    display: 'flex',
    alignItems: 'center',
  },
  messageBox: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    backgroundColor: '#F8FAFC',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: '1.45',
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    borderBottomRightRadius: '2px',
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderBottomLeftRadius: '2px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  inputArea: {
    display: 'flex',
    padding: '12px 16px',
    gap: '8px',
    backgroundColor: '#FFFFFF',
    borderTop: '1px solid var(--border)',
  },
  chatInput: {
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '20px',
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  loading: {
    fontSize: '12px',
    color: '#64748B',
  },
};
