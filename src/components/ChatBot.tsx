'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, CalendarClock, Send, Sparkles, X } from 'lucide-react';
import { toAssetUrl } from '@/lib/assetUrl';
import ChatMarkdown from '@/components/ChatMarkdown';

interface AssistantAction {
  id: string;
  label: string;
  href: string;
}

interface Message {
  role: 'user' | 'model';
  content: string;
  actions?: AssistantAction[];
}

const INITIAL_MESSAGE: Message = {
  role: 'model',
  content: '¡Hola! Puedo ayudarte a encontrar materias y clases, revisar tus pendientes y calendario, o explicarte el tema que estás estudiando. Te orientaré sin resolver tareas ni exámenes por ti.',
};

const QUICK_QUESTIONS = [
  '¿Qué actividades tengo pendientes?',
  '¿Cuáles son mis próximas clases?',
  'Ayúdame a encontrar una clase',
];

export default function ChatBot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentClassId = pathname.match(/\/estudiante\/clases\/(\d+)/)?.[1] || null;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (rawMessage: string) => {
    const userMessage = rawMessage.trim();
    if (!userMessage || loading) return;

    const historyPayload = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setInput('');
    setMessages((previous) => [...previous, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(toAssetUrl('/api/ia'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: historyPayload,
          currentClassId,
        }),
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.error || 'No se pudo consultar el asistente.');

      setMessages((previous) => [
        ...previous,
        {
          role: 'model',
          content: responseBody.reply,
          actions: Array.isArray(responseBody.actions) ? responseBody.actions : [],
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: 'model',
          content: error instanceof Error
            ? error.message
            : 'Ocurrió un error temporal. Intenta nuevamente en un momento.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="chatbot-root" style={styles.container}>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={styles.floatingButton}
          className="btn-primary"
          aria-label="Abrir asistente académico"
        >
          <Sparkles size={22} aria-hidden />
          <span className="chatbot-floating-text" style={styles.floatingText}>Asistente Académico</span>
        </button>
      )}

      {isOpen && (
        <section
          style={styles.chatWindow}
          className="glass-panel chatbot-panel"
          aria-label="Asistente académico"
        >
          <header style={styles.chatHeader}>
            <div>
              <div style={styles.headerTitle}>
                <Sparkles size={17} aria-hidden />
                <span>Asistente Académico</span>
              </div>
              <div style={styles.headerSubtitle}>
                {currentClassId ? 'Con contexto de esta clase' : 'Con contexto de tus materias'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={styles.closeButton}
              aria-label="Cerrar asistente"
            >
              <X size={20} aria-hidden />
            </button>
          </header>

          <div ref={scrollRef} style={styles.messageBox} aria-live="polite">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={`${message.role}-${index}`}
                  style={{ ...styles.messageWrapper, justifyContent: isUser ? 'flex-end' : 'flex-start' }}
                >
                  <div style={styles.messageContent}>
                    <div style={{ ...styles.bubble, ...(isUser ? styles.userBubble : styles.aiBubble) }}>
                      {isUser ? message.content : <ChatMarkdown content={message.content} />}
                    </div>
                    {!isUser && message.actions && message.actions.length > 0 && (
                      <div style={styles.actionList}>
                        {message.actions.map((action) => (
                          <Link key={action.id} href={action.href} style={styles.actionButton}>
                            <span>{action.label}</span>
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {messages.length === 1 && (
              <div style={styles.quickQuestionList}>
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    style={styles.quickQuestion}
                    disabled={loading}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
                <div style={{ ...styles.bubble, ...styles.aiBubble, ...styles.loadingBubble }}>
                  <span style={styles.loadingDot} />
                  Consultando tus materias…
                </div>
              </div>
            )}
          </div>

          <div style={styles.boundaryNote}>
            <CalendarClock size={13} aria-hidden />
            Orienta y explica; no realiza actividades evaluables.
          </div>

          <form onSubmit={handleSubmit} style={styles.inputArea}>
            <input
              ref={inputRef}
              type="text"
              className="form-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={currentClassId ? 'Pregunta sobre esta clase…' : 'Pregunta por una materia o pendiente…'}
              style={styles.chatInput}
              disabled={loading}
              maxLength={1_500}
              aria-label="Pregunta para el asistente académico"
            />
            <button
              type="submit"
              style={styles.sendButton}
              className="btn btn-primary"
              disabled={loading || !input.trim()}
              aria-label="Enviar pregunta"
            >
              <Send size={16} aria-hidden />
            </button>
          </form>
        </section>
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
  floatingButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 22px',
    borderRadius: '30px',
    boxShadow: '0 12px 32px rgba(0, 115, 165, 0.28)',
    cursor: 'pointer',
    border: 'none',
  },
  floatingText: {
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading)',
  },
  chatWindow: {
    width: '400px',
    height: 'min(620px, calc(100vh - 48px))',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    overflow: 'hidden',
    borderRadius: '18px',
    boxShadow: '0 20px 56px rgba(15, 23, 42, 0.2)',
  },
  chatHeader: {
    background: 'linear-gradient(135deg, var(--accent), #00567c)',
    color: '#FFFFFF',
    padding: '16px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 800,
    fontSize: '14px',
    fontFamily: 'var(--font-heading)',
  },
  headerSubtitle: {
    marginTop: '3px',
    fontSize: '11px',
    opacity: 0.82,
  },
  closeButton: {
    width: '36px',
    height: '36px',
    padding: 0,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBox: {
    flex: 1,
    padding: '18px',
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
  messageContent: {
    maxWidth: '88%',
  },
  bubble: {
    padding: '11px 14px',
    borderRadius: '14px',
    fontSize: '13px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    backgroundColor: 'var(--accent)',
    color: '#FFFFFF',
    borderBottomRightRadius: '3px',
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderBottomLeftRadius: '3px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
  },
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    marginTop: '8px',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '9px 11px',
    border: '1px solid rgba(0, 115, 165, 0.24)',
    borderRadius: '9px',
    backgroundColor: '#FFFFFF',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  quickQuestionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  quickQuestion: {
    padding: '9px 12px',
    border: '1px solid #D7E8F0',
    borderRadius: '999px',
    backgroundColor: '#F0F8FB',
    color: '#075E83',
    fontSize: '12px',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },
  loadingBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#64748B',
  },
  loadingDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    boxShadow: '12px 0 0 rgba(0,115,165,.55), 24px 0 0 rgba(0,115,165,.25)',
    marginRight: '24px',
  },
  boundaryNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderTop: '1px solid var(--border)',
    backgroundColor: '#F8FAFC',
    color: '#64748B',
    fontSize: '10px',
  },
  inputArea: {
    display: 'flex',
    padding: '12px 14px',
    gap: '8px',
    backgroundColor: '#FFFFFF',
    borderTop: '1px solid var(--border)',
  },
  chatInput: {
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '20px',
  },
  sendButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
