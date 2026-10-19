'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, FileUp, Link2, Paperclip, Plus, Trash2, X } from 'lucide-react';
import CampusDialog from './CampusDialog';
import ClaseSeccionesEditor from './ClaseSeccionesEditor';
import { resolveSecciones, serializeSecciones, type ClaseSeccion } from '@/lib/claseSecciones';
import { toAssetUrl, toClasePresentacionUrl } from '@/lib/assetUrl';
import FileResourcePreview from './FileResourcePreview';
import styles from './CampusFlow.module.css';
import { classDraftKey, restoreClassDraft, serializeClassDraft, type ClassDraftContent } from '@/lib/classDraft';

interface ClassSource {
  id: number;
  titulo: string;
  descripcion?: string;
  video_url?: string | null;
  videos?: { titulo: string; url: string }[];
  presentacion_url?: string | null;
  presentacion_nombre?: string | null;
  requiere_tarea?: number;
  tarea_descripcion?: string | null;
  tarea_recursos?: { archivo_url: string; archivo_nombre: string; titulo?: string }[];
  secciones?: ClaseSeccion[];
  materiales?: unknown;
  referencias?: unknown;
  orden?: number;
}

interface Props {
  userId: number;
  course: { id: number; nombre: string; estado: string };
  existing: ClassSource | null;
  classes: ClassSource[];
  books: { id: number; titulo: string; autor: string }[];
  onClose: () => void;
  onSaved: (title: string, edited: boolean) => void;
}

const steps = ['Información', 'Contenido', 'Revisar'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function validVideoUrl(value: string) {
  if (/^\/uploads\/[^/?#]+\.(mp4|webm|ogv)$/i.test(value.trim())) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}

export default function ClassComposer({ userId, course, existing, classes, books, onClose, onSaved }: Props) {
  const previousVideos = existing?.videos?.length ? existing.videos : existing?.video_url ? [{ titulo: '', url: existing.video_url }] : [];
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(existing?.titulo || '');
  const [description, setDescription] = useState(existing?.descripcion || '');
  const [contentType, setContentType] = useState<'presentacion' | 'video' | 'materiales'>(previousVideos.length ? 'video' : existing && !existing.presentacion_url ? 'materiales' : 'presentacion');
  const [presentation, setPresentation] = useState({ ref: existing?.presentacion_url || '', name: existing?.presentacion_nombre || '' });
  const [videos, setVideos] = useState(previousVideos.length ? previousVideos : [{ titulo: '', url: '' }]);
  const [sections, setSections] = useState<ClaseSeccion[]>(resolveSecciones(existing?.secciones, existing?.materiales, existing?.referencias));
  const [requiresHomework, setRequiresHomework] = useState(!!existing?.requiere_tarea);
  const [homework, setHomework] = useState(existing?.tarea_descripcion || '');
  const [resources, setResources] = useState(existing?.tarea_recursos || []);
  const [uploading, setUploading] = useState(false);
  const [sectionUploading, setSectionUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);
  const draftRemoved = useRef(false);
  const scope = { campus: process.env.NEXT_PUBLIC_BASE_PATH || '/Academia', userId, courseId: course.id, classId: existing?.id ?? null };
  const storageKey = classDraftKey(scope);
  // Ignore generated section IDs from legacy classes; compare the actual source content.
  const source = JSON.stringify(existing ? { ...existing, secciones: existing.secciones?.map(section => ({ ...section, id: undefined })) } : null);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const savingRef = useRef(false);
  const busy = uploading || sectionUploading || saving || !draftReady;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = sessionStorage.getItem(storageKey);
        const draft = restoreClassDraft(saved, { campus: process.env.NEXT_PUBLIC_BASE_PATH || '/Academia', userId, courseId: course.id, classId: existing?.id ?? null }, source);
        if (draft) {
          setStep(draft.step); setTitle(draft.title); setDescription(draft.description); setContentType(draft.contentType);
          setPresentation(draft.presentation); setVideos(draft.videos); setSections(draft.sections);
          setRequiresHomework(draft.requiresHomework); setHomework(draft.homework); setResources(draft.resources);
          setDirty(true); setDraftRecovered(true);
        } else if (saved) sessionStorage.removeItem(storageKey);
      } catch { setDraftUnavailable(true); }
      setDraftReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey, source, userId, course.id, existing?.id]);

  useEffect(() => {
    if (!draftReady || !dirty || draftRemoved.current) return;
    const content: ClassDraftContent = { step, title, description, contentType, presentation, videos, sections, requiresHomework, homework, resources };
    let unavailable = false;
    try {
      sessionStorage.setItem(storageKey, serializeClassDraft({ campus: process.env.NEXT_PUBLIC_BASE_PATH || '/Academia', userId, courseId: course.id, classId: existing?.id ?? null }, source, content));
    } catch { unavailable = true; }
    const frame = window.requestAnimationFrame(() => setDraftUnavailable(unavailable));
    return () => window.cancelAnimationFrame(frame);
  }, [draftReady, dirty, step, title, description, contentType, presentation, videos, sections, requiresHomework, homework, resources, storageKey, source, userId, course.id, existing?.id]);

  function removeDraft() {
    draftRemoved.current = true;
    try { sessionStorage.removeItem(storageKey); } catch { /* The browser may block storage. */ }
  }

  function discardDraft() {
    if (busy || !window.confirm('¿Descartar el borrador y salir? Se perderán los cambios que todavía no has guardado en la clase.')) return;
    removeDraft();
    setDirty(false);
    onClose();
  }

  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);
  useEffect(() => () => { request.current?.abort(); }, []);

  function closeEditor() {
    if (busy) return;
    let cannotPreserve = draftUnavailable;
    if (dirty) {
      try {
        sessionStorage.setItem(storageKey, serializeClassDraft(scope, source, { step, title, description, contentType, presentation, videos, sections, requiresHomework, homework, resources }));
        cannotPreserve = false;
      } catch { cannotPreserve = true; }
      setDraftUnavailable(cannotPreserve);
    }
    if (dirty && !window.confirm(cannotPreserve
      ? 'Tienes cambios sin guardar y el navegador no permite conservar el borrador. ¿Salir y descartar los cambios?'
      : '¿Salir del editor? Conservaremos el borrador en esta pestaña para recuperarlo al volver con tu misma cuenta. Todavía no se publica.')) return;
    if (dirty && cannotPreserve) removeDraft();
    onClose();
  }

  function uploadFile(file: File, destination: 'presentation' | 'homework') {
    if (busy) return;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const allowed = destination === 'presentation' ? ['pdf', 'ppt', 'pptx'] : ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
    setUploadError('');
    if (!allowed.includes(extension)) {
      setUploadError(destination === 'presentation' ? 'Elige un archivo PDF o PowerPoint (.ppt o .pptx).' : 'Elige un PDF, una imagen o un documento de Office.');
      return;
    }
    if (!file.size || file.size > MAX_FILE_BYTES) {
      setUploadError(file.size ? 'El archivo supera los 25 MB. Reduce su tamaño y vuelve a elegirlo.' : 'El archivo está vacío. Elige otro archivo.');
      return;
    }
    setUploading(true);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    const body = new FormData();
    body.append('file', file);
    xhr.open('POST', toAssetUrl(destination === 'presentation' ? '/api/clases/presentacion' : '/api/upload'));
    xhr.timeout = 180000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => {
      try {
        let result;
        try { result = JSON.parse(xhr.responseText); }
        catch { throw new Error('El servidor no pudo recibir el archivo. Revisa su tamaño e inténtalo de nuevo.'); }
        if (xhr.status < 200 || xhr.status >= 300 || !(destination === 'presentation' ? result.ref : result.url)) {
          throw new Error(result.error || 'No se pudo subir el archivo. Vuelve a elegirlo para reintentar.');
        }
        if (destination === 'presentation') {
          setPresentation({ ref: result.ref, name: result.name || file.name });
          if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
        } else {
          setResources((current) => [...current, { archivo_url: result.url, archivo_nombre: result.name || file.name }]);
        }
        setDirty(true);
      } catch (failure) { setUploadError(failure instanceof Error ? failure.message : 'No se pudo subir el archivo. Inténtalo de nuevo.'); }
    };
    xhr.onerror = () => setUploadError('Se interrumpió la conexión. Vuelve a elegir el archivo para reintentar.');
    xhr.ontimeout = () => setUploadError('La carga tardó demasiado. Revisa tu conexión e inténtalo de nuevo.');
    xhr.onabort = () => setUploadError('Carga cancelada. Puedes elegir otro archivo.');
    xhr.onloadend = () => { setUploading(false); request.current = null; };
    xhr.send(body);
  }

  function validate(targetStep: number) {
    setError('');
    if (!title.trim()) { setError('Escribe el título de la clase para continuar.'); setStep(0); return false; }
    if (targetStep < 2) return true;
    if (contentType === 'presentacion' && !presentation.ref) { setError('Sube el archivo principal de la clase antes de continuar.'); setStep(1); return false; }
    if (contentType === 'video' && (!videos.some((video) => video.url.trim()) || videos.some((video) => video.url.trim() && !validVideoUrl(video.url.trim())))) {
      setError('Agrega un enlace de video válido que empiece con https:// o http://.'); setStep(1); return false;
    }
    if (requiresHomework && !homework.trim()) { setError('Indica qué deben entregar tus estudiantes o desactiva la tarea.'); setStep(1); return false; }
    return true;
  }

  async function publishClass() {
    if (busy || savingRef.current || !validate(2)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch('/api/clases', {
        method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(existing ? { id: existing.id } : { curso_id: course.id }),
          titulo: title.trim(), descripcion: description.trim(), contenido_central: contentType,
          videos: contentType === 'video' ? videos.filter((video) => video.url.trim()).map((video) => ({ titulo: video.titulo.trim(), url: video.url.trim() })) : [],
          presentacion_url: contentType === 'presentacion' ? presentation.ref : null,
          presentacion_nombre: contentType === 'presentacion' ? presentation.name : null,
          secciones: serializeSecciones(sections), requiere_tarea: requiresHomework,
          tarea_descripcion: homework.trim(), tarea_recursos: resources,
          orden: existing?.orden ?? Math.max(0, ...classes.map((item) => item.orden || 0)) + 1,
        }),
      });
      const result = await response.json().catch(() => ({ error: 'No se pudo guardar la clase. Tu contenido sigue aquí; inténtalo de nuevo.' }));
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la clase. Inténtalo de nuevo.');
      removeDraft();
      setDirty(false);
      onSaved(title.trim(), !!existing);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo conectar. Tu contenido sigue aquí; vuelve a intentar guardar.');
    } finally { setSaving(false); savingRef.current = false; }
  }

  return (
    <CampusDialog titleId="class-composer-title" onClose={closeEditor} busy={busy}>
      <div className={styles.composerHeader}>
        <div><span className={styles.eyebrow}>{existing ? 'Editar clase' : 'Nueva clase'}</span><p>{course.nombre}</p></div>
        <button type="button" className={styles.iconButton} aria-label="Cerrar editor de clase" disabled={busy} onClick={closeEditor}><X size={22} /></button>
      </div>
      <ol className={styles.steps} aria-label="Pasos para publicar una clase">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-complete={index < step}>
          <button type="button" disabled={busy || index > step} onClick={() => { setError(''); setStep(index); }}><span>{index < step ? <Check size={17} /> : index + 1}</span>{label}</button>
        </li>)}
      </ol>
      <form onSubmit={(event) => { event.preventDefault(); if (busy) return; if (step < 2) { if (validate(step + 1)) setStep(step + 1); } else void publishClass(); }} onChange={() => setDirty(true)}>
        <div className={styles.composerBody}>
          <h2 ref={heading} id="class-composer-title" tabIndex={-1}>{['¿Qué van a aprender?', 'Añade el contenido de tu clase', 'Comprueba antes de publicar'][step]}</h2>
          <p className={styles.intro}>{['Un título claro ayuda a encontrar la clase. Después podrás añadir tu archivo o video.', 'Añade un archivo, enlaces de video o materiales para estudiar. También puedes solicitar una tarea.', 'Estos son los datos que verán los estudiantes con acceso a esta materia.'][step]}</p>
          {draftRecovered && <div role="status" className={styles.tip}><FileText size={21} /><div><strong>Recuperamos tu borrador de esta pestaña.</strong><p>Comprueba los cambios antes de guardar. Todavía no se han publicado.</p><button type="button" className={styles.textButton} disabled={busy} onClick={discardDraft}>Descartar borrador y salir</button></div></div>}
          {draftUnavailable && <p role="alert" className={styles.error}>El navegador no permite conservar este borrador. Guarda la clase antes de salir para no perder tus cambios.</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <fieldset disabled={busy} className={styles.fields}>
            {step === 0 && <>
              <div className={styles.field}><label htmlFor="class-title">Título de la clase <span>Obligatorio</span></label><input id="class-title" className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="Ej. Clase 1: conceptos y aplicaciones" autoComplete="off" aria-invalid={!!error && !title.trim()} /></div>
              <div className={styles.field}><label htmlFor="class-description">¿De qué trata? <span>Opcional</span></label><textarea id="class-description" className="form-textarea" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explica brevemente qué aprenderán y por dónde empezar." /></div>
              <div className={styles.tip}><FileText size={23} /><p>¿Ya tienes tu presentación?<br /><strong>En el siguiente paso puedes subirla directamente.</strong></p></div>
            </>}
            {step === 1 && <>
              <div className={styles.typePicker} role="group" aria-label="Tipo de contenido principal">
                <button type="button" aria-pressed={contentType === 'presentacion'} onClick={() => { setContentType('presentacion'); setDirty(true); setError(''); }}><FileText size={23} /><span><strong>Archivo</strong><small>PDF o PowerPoint</small></span></button>
                <button type="button" aria-pressed={contentType === 'video'} onClick={() => { setContentType('video'); setDirty(true); setError(''); }}><Link2 size={23} /><span><strong>Video</strong><small>Uno o varios enlaces</small></span></button>
                <button type="button" aria-pressed={contentType === 'materiales'} onClick={() => { setContentType('materiales'); setDirty(true); setError(''); }}><Paperclip size={23} /><span><strong>Materiales</strong><small>Lecturas y actividades</small></span></button>
              </div>
              {contentType === 'materiales' ? <p className={styles.tip}>Organiza las lecturas, los archivos y los videos en Material complementario. Puedes añadir una tarea debajo.</p> : contentType === 'presentacion' ? <div className={styles.dropZone} data-dragging={dragging} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) uploadFile(file, 'presentation'); }}>
                {presentation.ref ? <Check size={32} /> : <FileUp size={36} strokeWidth={1.5} />}
                <strong>{presentation.ref ? presentation.name || 'Archivo de la clase' : 'Arrastra tu archivo aquí'}</strong>
                <p id="class-file-help">PDF, PPT o PPTX · Máximo 25 MB<br />Los PDF se leen en el aula; los PowerPoint se descargan.</p>
                <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>{presentation.ref ? 'Cambiar archivo' : 'Elegir archivo'}</button>
                <input ref={fileInput} id="class-file" type="file" accept=".pdf,.ppt,.pptx" aria-label="Archivo principal de la clase" aria-describedby="class-file-help" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadFile(file, 'presentation'); event.target.value = ''; }} />
                {presentation.ref && <small role="status">Archivo cargado. La clase se guarda al confirmar el último paso.</small>}
              </div> : <div className={styles.videoList}>
                <p className={styles.helper}>Pega el enlace completo de YouTube, Vimeo o Google Drive. Comprueba que los alumnos tengan permiso para verlo.</p>
                {videos.map((video, index) => <div className={styles.videoRow} key={index}>
                  <div className={styles.field}><label htmlFor={`class-video-${index}`}>Enlace del video {index + 1}</label><input id={`class-video-${index}`} className="form-input" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={video.url} onChange={(event) => setVideos(videos.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} /></div>
                  <div className={styles.field}><label htmlFor={`class-video-title-${index}`}>Nombre <span>Opcional</span></label><input id={`class-video-title-${index}`} className="form-input" value={video.titulo} onChange={(event) => setVideos(videos.map((item, itemIndex) => itemIndex === index ? { ...item, titulo: event.target.value } : item))} /></div>
                  <button type="button" className={styles.iconButton} aria-label={`Quitar video ${index + 1}`} onClick={() => { setVideos(videos.length === 1 ? [{ titulo: '', url: '' }] : videos.filter((_, itemIndex) => itemIndex !== index)); setDirty(true); }}><Trash2 size={18} /></button>
                </div>)}
                <button type="button" className={styles.textButton} onClick={() => setVideos([...videos, { titulo: '', url: '' }])}><Plus size={18} /> Añadir otro video</button>
              </div>}
              {contentType === 'presentacion' && presentation.ref && <details className={styles.optional}><summary><FileText size={19} /> Vista previa del archivo</summary><div className={styles.optionalBody}><FileResourcePreview fileUrl={toClasePresentacionUrl(presentation.ref)} fileName={presentation.name || 'presentacion.pdf'} /></div></details>}
              <details className={styles.optional} open={contentType === 'materiales' || undefined}>
                <summary><Paperclip size={19} /> Material complementario <span>Opcional · {sections.reduce((count, section) => count + section.items.length, 0)} recursos</span></summary>
                <div className={styles.optionalBody}><ClaseSeccionesEditor secciones={sections} onChange={(next) => { setSections(next); setDirty(true); }} libros={books} onUploadingChange={setSectionUploading} copyFromClasses={classes.filter((item) => item.id !== existing?.id).map((item) => ({ id: item.id, titulo: item.titulo, secciones: resolveSecciones(item.secciones, item.materiales, item.referencias) }))} /></div>
              </details>
              <div className={styles.optional}>
                <label className={styles.homeworkToggle} htmlFor="class-homework-toggle"><input id="class-homework-toggle" type="checkbox" checked={requiresHomework} onChange={(event) => setRequiresHomework(event.target.checked)} /><span><strong>Solicitar una tarea</strong><small>Actívalo si tus estudiantes deben entregar un trabajo.</small></span></label>
                {requiresHomework && <div className={styles.optionalBody}>
                  <div className={styles.field}><label htmlFor="class-homework">¿Qué deben entregar?</label><textarea id="class-homework" className="form-textarea" rows={4} value={homework} onChange={(event) => setHomework(event.target.value)} placeholder="Describe la actividad, el formato de entrega y los criterios de evaluación." /></div>
                  {resources.map((resource, index) => <div key={index} className={styles.resource}><FileText size={17} /><span>{resource.archivo_nombre}</span><button type="button" className={styles.iconButton} aria-label={`Quitar ${resource.archivo_nombre}`} onClick={() => { setResources(resources.filter((_, itemIndex) => itemIndex !== index)); setDirty(true); }}><X size={17} /></button></div>)}
                  <label className={styles.fileLabel} htmlFor="class-homework-file">Adjuntar plantilla o ejemplo (opcional)</label><input id="class-homework-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadFile(file, 'homework'); event.target.value = ''; }} />
                  <p className={styles.helper}>PDF, imágenes o documentos de Office. Máximo 25 MB por archivo.</p>
                </div>}
              </div>
            </>}
            {step === 2 && <>
              <article className={styles.review}>
                <span className={styles.eyebrow}>{course.nombre}</span><h3>{title}</h3>
                {description && <p className={styles.description}>{description}</p>}
                <dl><div><dt>Contenido principal</dt><dd>{contentType === 'materiales' ? 'Materiales y actividades' : contentType === 'presentacion' ? presentation.name || 'Presentación' : `${videos.filter((video) => video.url.trim()).length} video(s)`}</dd></div><div><dt>Material complementario</dt><dd>{sections.reduce((count, section) => count + section.items.length, 0)} recursos</dd></div><div><dt>Tarea</dt><dd>{requiresHomework ? homework : 'Sin entrega de tarea'}</dd></div></dl>
              </article>
              <p className={styles.tip}><Check size={22} /><span>{course.estado === 'oculto' ? 'La materia está oculta. La clase será visible cuando publiques la materia.' : 'Al confirmar, los estudiantes inscritos podrán ver esta clase.'} Puedes volver a editarla cuando lo necesites.</span></p>
            </>}
          </fieldset>
          {uploading && <div className={styles.uploadProgress} role="status"><label htmlFor="class-upload-progress">{progress < 100 ? `Subiendo archivo… ${progress}%` : 'Procesando archivo…'}</label><progress id="class-upload-progress" value={progress} max={100} /><button type="button" className={styles.textButton} onClick={() => request.current?.abort()}>Cancelar carga</button></div>}
          {sectionUploading && <p role="status" className={styles.helper}>Subiendo material complementario. Espera para continuar.</p>}
          {uploadError && <p role="alert" className={styles.error}>{uploadError}</p>}
        </div>
        <div className={styles.footer}>
          <div className={styles.exitActions}><button type="button" className={styles.textButton} disabled={busy} onClick={closeEditor}>Salir</button>{dirty && <button type="button" className={styles.textButton} disabled={busy} onClick={discardDraft}>Descartar cambios</button>}</div>
          <div className={styles.actions}>
            {step > 0 && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setError(''); setStep(step - 1); }}><ArrowLeft size={17} /> Atrás</button>}
            <button type="submit" className="btn btn-primary" disabled={busy}>{saving ? 'Guardando…' : uploading || sectionUploading ? 'Subiendo…' : step < 2 ? 'Continuar' : existing ? 'Guardar cambios' : 'Publicar clase'}{step < 2 ? <ArrowRight size={17} /> : <Check size={17} />}</button>
          </div>
        </div>
      </form>
    </CampusDialog>
  );
}
