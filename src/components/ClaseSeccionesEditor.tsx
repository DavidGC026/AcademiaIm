'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  BookOpen,
  Copy,
  Video,
} from 'lucide-react';
import SeccionItemsCarousel from '@/components/SeccionItemsCarousel';
import {
  type ClaseSeccion,
  type SeccionItem,
  defaultSecciones,
  moveSeccion,
  newSeccionId,
  normalizeSeccionColor,
  cloneSecciones,
  mergeClonedSecciones,
} from '@/lib/claseSecciones';
import { toColorPickerValue } from '@/lib/colorUtils';
import { isSupportedVideoUrl } from '@/lib/videoEmbed';
import { MAX_VIDEO_SIZE_MB, VIDEO_ACCEPT, validateVideoFile } from '@/lib/videoFiles';

interface LibroOption {
  id: number;
  titulo: string;
  autor: string;
}

interface CopySourceClass {
  id: number;
  titulo: string;
  secciones: ClaseSeccion[];
}

interface Props {
  secciones: ClaseSeccion[];
  onChange: (secciones: ClaseSeccion[]) => void;
  libros: LibroOption[];
  /** Otras clases del mismo curso con secciones para copiar. */
  copyFromClasses?: CopySourceClass[];
  onUploadingChange?: (uploading: boolean) => void;
}

function updateSection(
  secciones: ClaseSeccion[],
  id: string,
  patch: Partial<ClaseSeccion>
): ClaseSeccion[] {
  return secciones.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export default function ClaseSeccionesEditor({ secciones, onChange, libros, copyFromClasses = [], onUploadingChange }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, { titulo: string; url: string }>>({});
  const [videoDraft, setVideoDraft] = useState<Record<string, { titulo: string; url: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const currentProps = useRef({ secciones, onChange });
  const uploadAbort = useRef<AbortController | null>(null);
  const [copyClassId, setCopyClassId] = useState('');
  const [copyMode, setCopyMode] = useState<'append' | 'replace'>('append');
  const [showCopyPanel, setShowCopyPanel] = useState(false);

  useEffect(() => { currentProps.current = { secciones, onChange }; }, [secciones, onChange]);
  useEffect(() => () => {
    uploadAbort.current?.abort();
    uploadAbort.current = null;
    onUploadingChange?.(false);
  }, [onUploadingChange]);

  const sourcesWithSections = copyFromClasses.filter((c) => c.secciones.length > 0);

  const handleCopySections = () => {
    const source = sourcesWithSections.find((c) => String(c.id) === copyClassId);
    if (!source) {
      alert('Elige una clase de origen');
      return;
    }
    const totalItems = source.secciones.reduce((n, s) => n + s.items.length, 0);
    const msg =
      copyMode === 'replace'
        ? `¿Reemplazar las secciones actuales por las ${source.secciones.length} sección(es) de "${source.titulo}"?`
        : `¿Añadir ${source.secciones.length} sección(es) de "${source.titulo}" al final? (${totalItems} recursos)`;
    if (!confirm(msg)) return;

    if (copyMode === 'replace') {
      onChange(cloneSecciones(source.secciones));
    } else {
      onChange(mergeClonedSecciones(secciones, source.secciones));
    }
    setShowCopyPanel(false);
  };

  const ensureDefaults = () => {
    if (secciones.length === 0) onChange(defaultSecciones());
  };

  const uploadFile = async (sectionId: string, file: File, video = false) => {
    if (uploadAbort.current) return;
    const validationError = video ? validateVideoFile(file) : null;
    setErrors((prev) => ({ ...prev, [sectionId]: validationError || '' }));
    if (validationError) return;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(sectionId);
    onUploadingChange?.(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(video ? '/api/upload?tipo=video' : '/api/upload', { method: 'POST', body: formData, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        const item: SeccionItem = video ? {
          tipo: 'video',
          titulo: videoDraft[sectionId]?.titulo.trim() || file.name,
          url: data.url,
          archivo_nombre: data.name || file.name,
        } : {
          tipo: 'archivo',
          nombre: data.name || file.name,
          url: data.url,
          archivo_nombre: data.name || file.name,
        };
        const current = currentProps.current;
        const section = current.secciones.find((s) => s.id === sectionId);
        if (!section || controller.signal.aborted) return;
        current.onChange(
          updateSection(current.secciones, sectionId, {
            items: [...section.items, item],
          })
        );
      } else {
        setErrors((prev) => ({ ...prev, [sectionId]: data.error || (res.status === 413 ? 'El servidor rechazó el tamaño del archivo. Usa un enlace de YouTube o Google Drive.' : 'Error al subir el archivo.') }));
      }
    } catch {
      if (!controller.signal.aborted) setErrors((prev) => ({ ...prev, [sectionId]: 'No se pudo subir el archivo. Revisa la conexión e inténtalo de nuevo.' }));
    } finally {
      if (uploadAbort.current === controller) {
        uploadAbort.current = null;
        setUploading(null);
        onUploadingChange?.(false);
      }
    }
  };

  const removeItem = (sectionId: string, itemIdx: number) => {
    const sec = secciones.find((s) => s.id === sectionId);
    if (!sec) return;
    onChange(
      updateSection(secciones, sectionId, {
        items: sec.items.filter((_, i) => i !== itemIdx),
      })
    );
  };

  const toggleLibro = (sectionId: string, libroId: number) => {
    const sec = secciones.find((s) => s.id === sectionId);
    if (!sec) return;
    const exists = sec.items.some((i) => i.tipo === 'biblioteca' && i.libro_id === libroId);
    const items = exists
      ? sec.items.filter((i) => !(i.tipo === 'biblioteca' && i.libro_id === libroId))
      : [...sec.items, { tipo: 'biblioteca' as const, libro_id: libroId }];
    onChange(updateSection(secciones, sectionId, { items }));
  };

  const addLink = (sectionId: string) => {
    const draft = linkDraft[sectionId] || { titulo: '', url: '' };
    if (!draft.url.trim()) return;
    const sec = secciones.find((s) => s.id === sectionId);
    if (!sec) return;
    onChange(
      updateSection(secciones, sectionId, {
        items: [
          ...sec.items,
          { tipo: 'enlace', titulo: draft.titulo.trim() || 'Enlace', url: draft.url.trim() },
        ],
      })
    );
    setLinkDraft((prev) => ({ ...prev, [sectionId]: { titulo: '', url: '' } }));
  };

  const addVideo = (sectionId: string) => {
    const draft = videoDraft[sectionId] || { titulo: '', url: '' };
    if (!isSupportedVideoUrl(draft.url)) {
      setErrors((prev) => ({ ...prev, [sectionId]: 'Usa un enlace de video de YouTube, Google Drive o un archivo MP4, WebM u OGV.' }));
      return;
    }
    const section = secciones.find((s) => s.id === sectionId);
    if (!section) return;
    onChange(updateSection(secciones, sectionId, {
      items: [...section.items, { tipo: 'video', titulo: draft.titulo.trim() || 'Video', url: draft.url.trim() }],
    }));
    setErrors((prev) => ({ ...prev, [sectionId]: '' }));
    setVideoDraft((prev) => ({ ...prev, [sectionId]: { titulo: '', url: '' } }));
  };

  if (secciones.length === 0) {
    return (
      <div style={styles.emptyWrap}>
        <Layers size={32} color="#94A3B8" />
        <p style={{ margin: '12px 0', color: '#64748B', fontSize: '14px' }}>
          Organiza el contenido de la clase en secciones con nombre y color propios.
        </p>
        <button type="button" className="btn btn-primary" onClick={ensureDefaults}>
          <Plus size={16} /> Crear 3 secciones sugeridas
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>
            <Layers size={18} /> Secciones de contenido
          </h4>
          <p style={styles.subtitle}>
            Nombra cada bloque, elige su color y ordénalos. Los alumnos los verán en ese orden.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: '12px' }}
          onClick={() =>
            onChange([
              ...secciones,
              {
                id: newSeccionId(),
                nombre: `Sección ${secciones.length + 1}`,
                color: '#64748B',
                orden: secciones.length,
                items: [],
              },
            ])
          }
        >
          <Plus size={14} /> Nueva sección
        </button>
      </div>

      {sourcesWithSections.length > 0 && (
        <div style={styles.copyPanel}>
          <button
            type="button"
            onClick={() => setShowCopyPanel((v) => !v)}
            style={styles.copyToggle}
          >
            <Copy size={14} />
            {showCopyPanel ? 'Ocultar copiar de otra clase' : 'Copiar secciones de otra clase'}
            <ChevronDown
              size={14}
              style={{ transform: showCopyPanel ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
            />
          </button>
          {showCopyPanel && (
            <div style={styles.copyBody}>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px' }}>
                Reutiliza las secciones (nombre, color y archivos) de otra clase de este módulo.
              </p>
              <select
                className="form-select"
                value={copyClassId}
                onChange={(e) => setCopyClassId(e.target.value)}
                style={{ marginBottom: '10px', fontSize: '13px' }}
              >
                <option value="">— Clase de origen —</option>
                {sourcesWithSections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo} ({c.secciones.length} secciones)
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <label style={styles.copyModeLabel}>
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyMode === 'append'}
                    onChange={() => setCopyMode('append')}
                  />
                  Añadir al final
                </label>
                <label style={styles.copyModeLabel}>
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyMode === 'replace'}
                    onChange={() => setCopyMode('replace')}
                  />
                  Reemplazar actuales
                </label>
              </div>
              <button type="button" className="btn btn-primary" style={{ fontSize: '12px' }} onClick={handleCopySections} disabled={uploading !== null}>
                <Copy size={14} /> Copiar secciones
              </button>
            </div>
          )}
        </div>
      )}

      {secciones.map((sec, secIdx) => {
        const color = normalizeSeccionColor(sec.color, '#0073A5');
        const draft = linkDraft[sec.id] || { titulo: '', url: '' };
        const video = videoDraft[sec.id] || { titulo: '', url: '' };
        const libroIds = sec.items
          .filter((i): i is Extract<SeccionItem, { tipo: 'biblioteca' }> => i.tipo === 'biblioteca')
          .map((i) => i.libro_id);

        return (
          <div
            key={sec.id}
            style={{
              ...styles.sectionCard,
              borderColor: color,
              background: `linear-gradient(135deg, ${color}12 0%, #fff 55%)`,
            }}
          >
            <div style={styles.sectionToolbar}>
              <GripVertical size={16} color="#94A3B8" />
              <span style={styles.orderNum}>{secIdx + 1}</span>
              <input
                type="text"
                className="form-input"
                value={sec.nombre}
                onChange={(e) => onChange(updateSection(secciones, sec.id, { nombre: e.target.value }))}
                placeholder="Nombre de la sección"
                style={{ flex: 1, fontWeight: 700 }}
              />
              <input
                type="color"
                value={toColorPickerValue(sec.color)}
                onChange={(e) => onChange(updateSection(secciones, sec.id, { color: e.target.value }))}
                style={styles.colorInput}
                title="Color del contenedor"
              />
              <input
                type="text"
                className="form-input"
                value={sec.color}
                onChange={(e) => onChange(updateSection(secciones, sec.id, { color: e.target.value }))}
                placeholder="#hex o rgb()"
                style={{ width: '120px', fontSize: '12px' }}
              />
              <button
                type="button"
                onClick={() => onChange(moveSeccion(secciones, sec.id, -1))}
                disabled={secIdx === 0}
                style={styles.iconBtn}
                title="Subir"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => onChange(moveSeccion(secciones, sec.id, 1))}
                disabled={secIdx === secciones.length - 1}
                style={styles.iconBtn}
                title="Bajar"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => onChange(secciones.filter((s) => s.id !== sec.id))}
                disabled={uploading === sec.id}
                style={{ ...styles.iconBtn, color: 'var(--danger)' }}
                title="Eliminar sección"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <label style={styles.downloadToggle}>
              <input
                type="checkbox"
                checked={sec.permite_descarga !== false}
                onChange={(e) =>
                  onChange(updateSection(secciones, sec.id, { permite_descarga: e.target.checked }))
                }
              />
              Permitir descarga de archivos para los alumnos
            </label>

            {sec.items.length > 0 && (
              <SeccionItemsCarousel accentColor={color} maxHeight={120}>
                {sec.items.map((item, itemIdx) => (
                  <div key={itemIdx} style={{ ...styles.itemRow, borderLeftColor: color }}>
                    {item.tipo === 'biblioteca' ? (
                      <>
                        <BookOpen size={14} color={color} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600 }}>
                          {libros.find((l) => l.id === item.libro_id)?.titulo || `Libro #${item.libro_id}`}
                        </span>
                      </>
                    ) : item.tipo === 'video' || item.tipo === 'enlace' ? (
                      <>
                        {item.tipo === 'video' ? <Video size={14} color={color} /> : <Link2 size={14} color={color} />}
                        <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>{item.titulo}</span>
                      </>
                    ) : (
                      <>
                        <Paperclip size={14} color={color} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>{item.nombre}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(sec.id, itemIdx)}
                      style={styles.removeItemBtn}
                      title="Quitar de esta sección"
                    >
                      <Trash2 size={14} />
                      Quitar
                    </button>
                  </div>
                ))}
              </SeccionItemsCarousel>
            )}

            <div style={styles.addRow}>
              <label style={styles.uploadLabel}>
                <Paperclip size={14} />
                {uploading === sec.id ? 'Subiendo…' : 'Subir archivo'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx"
                  style={{ display: 'none' }}
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(sec.id, f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <fieldset style={styles.videoPanel}>
              <legend style={{ fontSize: '13px', fontWeight: 700, color, padding: '0 6px' }}>
                <Video size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Agregar video
              </legend>
              <div style={styles.linkRow}>
                <input
                  type="text"
                  className="form-input"
                  aria-label={`Título del video en ${sec.nombre}`}
                  placeholder="Título del video (opcional)"
                  value={video.titulo}
                  onChange={(e) => setVideoDraft((prev) => ({ ...prev, [sec.id]: { ...video, titulo: e.target.value } }))}
                  style={{ flex: '1 1 180px', minWidth: 0, fontSize: '12px' }}
                />
                <input
                  type="url"
                  className="form-input"
                  aria-label={`URL del video en ${sec.nombre}`}
                  placeholder="Enlace de YouTube, Google Drive o video"
                  value={video.url}
                  onChange={(e) => setVideoDraft((prev) => ({ ...prev, [sec.id]: { ...video, url: e.target.value } }))}
                  style={{ flex: '2 1 240px', minWidth: 0, fontSize: '12px' }}
                />
                <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => addVideo(sec.id)} disabled={!video.url.trim()}>
                  <Plus size={14} /> Agregar video
                </button>
              </div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginTop: '12px', color: '#475569' }}>
                O subir un video desde tu equipo
                <input
                  type="file"
                  accept={VIDEO_ACCEPT}
                  aria-label={`Subir video en ${sec.nombre}`}
                  disabled={uploading !== null}
                  style={{ display: 'block', width: '100%', marginTop: '6px', fontSize: '12px' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(sec.id, file, true);
                    e.target.value = '';
                  }}
                />
              </label>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '10px 0 0', lineHeight: 1.5 }}>
                MP4, WebM u OGV, hasta {MAX_VIDEO_SIZE_MB} MB. En Google Drive, comparte el video como «Cualquier persona con el enlace».
              </p>
            </fieldset>
            {uploading === sec.id && <p role="status" style={{ fontSize: '12px', color }}>Subiendo archivo… Espera a que termine para guardar la clase.</p>}
            {errors[sec.id] && <p role="alert" style={{ fontSize: '12px', color: '#B91C1C' }}>{errors[sec.id]}</p>}

            {libros.length > 0 && (
              <details style={styles.librosDetails}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 700, color }}>
                  <BookOpen size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Agregar de biblioteca ({libroIds.length} seleccionados)
                </summary>
                <div style={styles.librosGrid}>
                  {libros.map((libro) => (
                    <label key={libro.id} style={styles.libroChip}>
                      <input
                        type="checkbox"
                        checked={libroIds.includes(libro.id)}
                        onChange={() => toggleLibro(sec.id, libro.id)}
                      />
                      <span>{libro.titulo}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}

            <div style={styles.linkRow}>
              <input
                type="text"
                className="form-input"
                placeholder="Título del enlace"
                value={draft.titulo}
                onChange={(e) =>
                  setLinkDraft((prev) => ({ ...prev, [sec.id]: { ...draft, titulo: e.target.value } }))
                }
                style={{ flex: 2, fontSize: '12px' }}
              />
              <input
                type="url"
                className="form-input"
                placeholder="https://..."
                value={draft.url}
                onChange={(e) =>
                  setLinkDraft((prev) => ({ ...prev, [sec.id]: { ...draft, url: e.target.value } }))
                }
                style={{ flex: 3, fontSize: '12px' }}
              />
              <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => addLink(sec.id)}>
                <Link2 size={14} /> Enlace
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '16px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  subtitle: { margin: '4px 0 0', fontSize: '12px', color: '#64748B', maxWidth: '480px' },
  emptyWrap: {
    textAlign: 'center',
    padding: '32px 20px',
    border: '2px dashed var(--border)',
    borderRadius: '12px',
    backgroundColor: '#FAFBFD',
  },
  sectionCard: {
    border: '2px solid',
    borderRadius: '14px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
  },
  sectionToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  downloadToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  orderNum: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 800,
    color: '#64748B',
    flexShrink: 0,
  },
  colorInput: {
    width: '40px',
    height: '36px',
    padding: 0,
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  iconBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    color: '#64748B',
  },
  itemsList: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    borderLeftWidth: '3px',
  },
  removeItemBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(239, 68, 68, 0.45)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    color: '#DC2626',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  addRow: { marginBottom: '10px' },
  videoPanel: { minWidth: 0, margin: '0 0 12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', backgroundColor: '#F8FAFC' },
  uploadLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px dashed var(--border)',
    backgroundColor: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569',
  },
  librosDetails: { marginBottom: '10px', fontSize: '12px' },
  librosGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '8px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  libroChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '6px',
    backgroundColor: '#fff',
    border: '1px solid var(--border)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  linkRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  copyPanel: {
    marginBottom: '16px',
    borderRadius: '10px',
    border: '1px dashed var(--border)',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  copyToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
    color: '#0073A5',
    textAlign: 'left',
  },
  copyBody: { padding: '0 14px 14px' },
  copyModeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
};
