'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, MessageSquare } from 'lucide-react';

export interface ForumPost {
  id: number;
  curso_id: number;
  usuario_id: number;
  usuario_nombre: string;
  rol_nombre: string;
  post_padre_id: number | null;
  contenido: string;
  created_at: string;
}

interface ForoPanelProps {
  cursoId: number | null;
  variant?: 'teacher' | 'student';
}

export default function ForoPanel({ cursoId, variant = 'student' }: ForoPanelProps) {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [forumLoading, setForumLoading] = useState(false);

  const fetchForumPosts = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/foro?curso_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setForumPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error al cargar foro:', error);
    }
  }, []);

  useEffect(() => {
    if (cursoId) {
      fetchForumPosts(cursoId);
    } else {
      setForumPosts([]);
    }
  }, [cursoId, fetchForumPosts]);

  const handleAddPost = async (e: React.FormEvent, parentId: number | null = null) => {
    e.preventDefault();
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !cursoId) return;
    setForumLoading(true);

    try {
      const res = await fetch('/api/foro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curso_id: cursoId,
          contenido: content,
          post_padre_id: parentId,
        }),
      });

      if (res.ok) {
        if (parentId) {
          setReplyContent('');
          setReplyToId(null);
        } else {
          setNewComment('');
        }
        fetchForumPosts(cursoId);
      }
    } catch (error) {
      console.error('Error al enviar post de foro:', error);
    } finally {
      setForumLoading(false);
    }
  };

  if (!cursoId) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 20px', color: '#64748B' }}>
        <MessageSquare size={40} color="#B0B3B5" style={{ marginBottom: '8px' }} />
        <p>Selecciona una materia para ver el foro.</p>
      </div>
    );
  }

  const parentPosts = forumPosts.filter((p) => p.post_padre_id === null);
  const getRepliesFor = (parentId: number) => forumPosts.filter((p) => p.post_padre_id === parentId);

  const isTeacher = variant === 'teacher';
  const title = 'Foro de Presentación e Interacción';
  const subtitle = isTeacher
    ? 'Responde presentaciones y fomenta la interacción entre alumnos.'
    : 'Preséntate, saluda a tus compañeros e interactúa con tu docente.';
  const newPostPlaceholder = isTeacher
    ? 'Escribe un mensaje de bienvenida o inicia una interacción...'
    : 'Preséntate o comparte un comentario con el grupo...';
  const submitLabel = isTeacher ? 'Publicar mensaje' : 'Publicar presentación';
  const emptyMsg = isTeacher
    ? 'Aún no hay presentaciones ni mensajes en esta materia. Anima a tus alumnos a participar.'
    : 'Sé el primero en presentarte e interactuar con tus compañeros en esta materia.';

  return (
    <div>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <p style={styles.cardSubtitle}>{subtitle}</p>

      <form onSubmit={(e) => handleAddPost(e, null)} style={styles.newCommentForm}>
        <textarea
          className="form-textarea"
          rows={2}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={newPostPlaceholder}
          required
        />
        <button type="submit" className="btn btn-primary" style={styles.sendBtn} disabled={forumLoading}>
          <Send size={14} /> {submitLabel}
        </button>
      </form>

      <div style={styles.forumList}>
        {parentPosts.length === 0 ? (
          <div style={styles.emptyForum}>{emptyMsg}</div>
        ) : (
          parentPosts.map((post) => {
            const replies = getRepliesFor(post.id);
            const showReplyForm = replyToId === post.id;
            const isStaff = post.rol_nombre === 'administrador' || post.rol_nombre === 'maestro';

            return (
              <div key={post.id} style={styles.postBlock}>
                <div style={styles.postHeader}>
                  <div>
                    <strong style={{ color: isStaff ? '#0073A5' : 'var(--text-primary)' }}>
                      {post.usuario_nombre}
                    </strong>
                    <span style={styles.userRoleTag}>{post.rol_nombre}</span>
                  </div>
                  <div style={styles.postDate}>
                    {new Date(post.created_at).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <p style={styles.postContent}>{post.contenido}</p>

                <button
                  type="button"
                  onClick={() => setReplyToId(showReplyForm ? null : post.id)}
                  style={styles.replyLink}
                >
                  <MessageSquare size={12} /> Responder
                </button>

                {replies.length > 0 && (
                  <div style={styles.repliesList}>
                    {replies.map((reply) => {
                      const isReplyStaff =
                        reply.rol_nombre === 'administrador' || reply.rol_nombre === 'maestro';
                      return (
                        <div key={reply.id} style={styles.replyItem}>
                          <div style={styles.postHeader}>
                            <div>
                              <strong style={{ color: isReplyStaff ? '#0073A5' : 'var(--text-primary)' }}>
                                {reply.usuario_nombre}
                              </strong>
                              <span style={styles.userRoleTag}>{reply.rol_nombre}</span>
                            </div>
                            <div style={styles.postDate}>
                              {new Date(reply.created_at).toLocaleString('es-MX', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          <p style={styles.postContent}>{reply.contenido}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showReplyForm && (
                  <form onSubmit={(e) => handleAddPost(e, post.id)} style={styles.replyForm}>
                    <input
                      type="text"
                      className="form-input"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '8px 12px' }}
                      disabled={forumLoading}
                    >
                      Responder
                    </button>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  cardSubtitle: {
    fontSize: '12px',
    color: '#64748B',
    marginBottom: '20px',
  },
  newCommentForm: {
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sendBtn: {
    alignSelf: 'flex-end',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '13px',
  },
  forumList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  emptyForum: {
    textAlign: 'center',
    padding: '32px 16px',
    color: '#94A3B8',
    fontSize: '13px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    border: '1px dashed var(--border)',
  },
  postBlock: {
    padding: '16px',
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid var(--border)',
  },
  postHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
    gap: '12px',
  },
  userRoleTag: {
    marginLeft: '8px',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748B',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  postDate: {
    fontSize: '11px',
    color: '#94A3B8',
    whiteSpace: 'nowrap',
  },
  postContent: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    margin: '0 0 8px',
  },
  replyLink: {
    background: 'none',
    border: 'none',
    color: '#0073A5',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: 0,
  },
  repliesList: {
    marginTop: '12px',
    marginLeft: '16px',
    paddingLeft: '16px',
    borderLeft: '2px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  replyItem: {
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid var(--border)',
  },
  replyForm: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    marginLeft: '16px',
  },
};
