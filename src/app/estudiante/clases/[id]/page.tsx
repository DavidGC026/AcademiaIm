'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  UploadCloud, 
  CheckCircle2, 
  Award,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Download
} from 'lucide-react';
import ForoPanel from '@/components/ForoPanel';
import BiografiasPanel from '@/components/BiografiasPanel';
import FileResourcePreview from '@/components/FileResourcePreview';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';
import { resolveColor, withAlpha } from '@/lib/colorUtils';
import ClaseSeccionesViewer, { type ClaseSeccionEnriquecida } from '@/components/ClaseSeccionesViewer';
import ClassContentViewer from '@/components/ClassContentViewer';

interface ClaseVideo {
  titulo: string;
  url: string;
}

interface ClassData {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  video_url: string | null;
  videos?: ClaseVideo[];
  presentacion_url?: string | null;
  presentacion_nombre?: string | null;
  materiales: Array<{ nombre: string; url: string }>;
  secciones?: ClaseSeccionEnriquecida[];
  curso_nombre: string;
  curso_color?: string | null;
  curso_color_lecturas?: string | null;
  requiere_tarea: number;
  tarea_descripcion?: string | null;
  tarea_recursos?: { archivo_url: string; archivo_nombre: string; titulo?: string }[];
}

interface SiblingClass {
  id: number;
  titulo: string;
}

interface CursoExam {
  id: number;
  titulo: string;
}

interface Submission {
  id: number;
  archivo_nombre: string;
  archivo_url: string;
  estado: 'entregado' | 'calificado';
  fecha_entrega: string;
  calificacion: number | null;
  comentarios: string | null;
  permite_reenvio?: number;
}

export default function ClassPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = React.use(params);
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [siblingClasses, setSiblingClasses] = useState<SiblingClass[]>([]);
  const [cursoExams, setCursoExams] = useState<CursoExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [accesoPrioritario, setAccesoPrioritario] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchCursoNav = async (cursoId: number) => {
    try {
      const res = await fetch(`/api/estudiante/clases?curso_id=${cursoId}`);
      if (res.ok) {
        const data = await res.json();
        setSiblingClasses(data.classes || []);
        setCursoExams(data.exams || []);
      }
    } catch (error) {
      console.error('Error al cargar navegación de la materia:', error);
    }
  };

  const fetchClassDetails = async () => {
    try {
      const res = await fetch(`/api/estudiante/clases/${classId}`);
      if (res.ok) {
        const json = await res.json();
        setClassData(json.clase);
        setSubmission(json.entrega);
        setAccesoPrioritario(!!json.acceso_prioritario);
        if (json.clase?.curso_id) {
          fetchCursoNav(json.clase.curso_id);
        }
      }
    } catch (error) {
      console.error('Error al cargar detalle de clase:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError('');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('claseId', classId);

    try {
      const res = await fetch('/api/tareas/entregar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fallo al subir archivo');
      }

      setSelectedFile(null);
      fetchClassDetails(); // recargar estado de entrega
    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  // Convertir URL normal de YouTube o Google Drive a formato embebido (legacy helper removed — ClassContentViewer)
  if (loading) {
    return <div style={styles.loading}>Cargando reproductor de clase...</div>;
  }

  if (!classData) {
    return <div style={styles.loading}>Clase no encontrada.</div>;
  }

  const videoList: ClaseVideo[] =
    classData.videos && classData.videos.length > 0
      ? classData.videos
      : classData.video_url
      ? [{ titulo: '', url: classData.video_url }]
      : [];

  const currentIdx = siblingClasses.findIndex((c) => c.id === classData.id);
  const prevClass = currentIdx > 0 ? siblingClasses[currentIdx - 1] : null;
  const nextClass = currentIdx >= 0 && currentIdx < siblingClasses.length - 1 ? siblingClasses[currentIdx + 1] : null;
  const moduleColor = resolveColor(classData.curso_color);

  return (
    <div className="class-page" style={styles.container}>
      {/* Volver a mis cursos */}
      <Link href={classData.curso_id ? `/estudiante/materias/${classData.curso_id}` : '/estudiante'} style={{ ...styles.backLink, color: moduleColor }}>
        <ArrowLeft size={16} /> Volver a la materia
      </Link>

      <div style={styles.header}>
        <div style={styles.breadcrumbs}>
          {classData.curso_nombre}
        </div>
        <h1 className="class-page-title" style={{ ...styles.title, color: moduleColor }}>{classData.titulo}</h1>
        {(prevClass || nextClass) && (
          <div className="class-nav-row" style={styles.classNav}>
            {prevClass ? (
              <Link href={`/estudiante/clases/${prevClass.id}`} style={styles.navBtn}>
                <ChevronLeft size={16} /> Anterior
              </Link>
            ) : <span />}
            {nextClass ? (
              <Link href={`/estudiante/clases/${nextClass.id}`} style={styles.navBtn}>
                Siguiente <ChevronRight size={16} />
              </Link>
            ) : <span />}
          </div>
        )}
      </div>

      <div className="page-grid-2col">
        {/* Columna Principal: Reproductor y Foro */}
        <div style={styles.mainCol}>
          <ClassContentViewer
            videos={videoList}
            presentacionUrl={classData.presentacion_url}
            presentacionNombre={classData.presentacion_nombre}
          />

          {/* Foro */}
          <div className="card" style={{ marginTop: '24px' }}>
            <ForoPanel cursoId={classData.curso_id} variant="student" />
          </div>

          <div className="card" style={{ marginTop: '24px' }}>
            <BiografiasPanel cursoId={classData.curso_id} variant="student" />
          </div>
        </div>

        {/* Columna Derecha: Recursos, navegación y Tarea */}
        <div style={styles.rightCol}>
          {siblingClasses.length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={styles.sectionTitle}>
                <Layers size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Clases del módulo
              </h3>
              <div style={styles.siblingList}>
                {siblingClasses.map((c, idx) => (
                  <Link
                    key={c.id}
                    href={`/estudiante/clases/${c.id}`}
                    style={{
                      ...styles.siblingItem,
                      ...(c.id === classData.id ? styles.siblingItemActive : {}),
                    }}
                  >
                    <span style={styles.siblingNum}>{idx + 1}</span>
                    {c.titulo}
                  </Link>
                ))}
              </div>
              {cursoExams.length > 0 && (
                <>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, marginTop: '16px', marginBottom: '8px', color: '#64748B' }}>
                    Evaluaciones
                  </h4>
                  {cursoExams.map((ex) => (
                    <Link key={ex.id} href={`/estudiante/examenes/${ex.id}`} style={styles.examLink}>
                      <FileText size={14} /> {ex.titulo}
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}

          {(classData.secciones?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <ClaseSeccionesViewer
                secciones={classData.secciones!}
                accesoPrioritario={accesoPrioritario}
              />
            </div>
          )}

          {/* Entrega de Tareas */}
          {classData.requiere_tarea === 1 ? (
            <div className="card">
              <h3 style={styles.sectionTitle}>Entrega de Tarea</h3>
              <p style={styles.cardSubtitle}>Envía tu solución a las actividades indicadas en la clase</p>

              {(classData.tarea_descripcion || (classData.tarea_recursos?.length ?? 0) > 0) && (
                <div style={styles.tareaInfoBox}>
                  {classData.tarea_descripcion && (
                    <div style={{ marginBottom: (classData.tarea_recursos?.length ?? 0) > 0 ? '20px' : 0 }}>
                      <h4 style={styles.tareaInfoTitle}>Descripción de la actividad</h4>
                      <p style={styles.tareaInfoText}>{classData.tarea_descripcion}</p>
                    </div>
                  )}
                  {(classData.tarea_recursos?.length ?? 0) > 0 && (
                    <div>
                      <h4 style={styles.tareaInfoTitle}>
                        {(classData.tarea_recursos?.length ?? 0) > 1 ? 'Recursos para la entrega' : 'Recurso para la entrega'}
                      </h4>
                      {classData.tarea_recursos!.map((rec, idx) => (
                        <div key={idx} style={{ marginBottom: idx < classData.tarea_recursos!.length - 1 ? '20px' : 0 }}>
                          <a
                            href={toAbsoluteAssetUrl(rec.archivo_url)}
                            download={rec.archivo_nombre || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.tareaResourceLabel}
                          >
                            <Paperclip size={14} />
                            {rec.archivo_nombre || 'Recurso de la actividad'}
                            <Download size={14} color="#0073A5" aria-hidden />
                          </a>
                          <div style={{ marginTop: '12px' }}>
                            <FileResourcePreview
                              fileName={rec.archivo_nombre || rec.archivo_url}
                              fileUrl={rec.archivo_url}
                              maxHeight={360}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {submission ? (
                <div style={styles.subStatus}>
                  <div style={styles.statusBox}>
                    {submission.estado === 'calificado' ? (
                      <>
                        <div style={styles.statusHeader}>
                          <Award size={24} color="#0073A5" />
                          <div>
                            <strong style={{ color: '#0073A5', fontSize: '16px' }}>Calificado</strong>
                            <div style={styles.gradeText}>Calificación: {submission.calificacion} / 100</div>
                          </div>
                        </div>
                        {submission.comentarios && (
                          <div style={styles.feedbackBox}>
                            <strong>Retroalimentación:</strong>
                            <p style={{ marginTop: '4px', fontStyle: 'italic' }}>&quot;{submission.comentarios}&quot;</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={styles.statusHeader}>
                          <CheckCircle2 size={24} color="var(--success)" />
                          <div>
                            <strong style={{ color: 'var(--success)', fontSize: '16px' }}>Tarea Entregada</strong>
                            <div style={styles.gradeText}>Esperando calificación del maestro</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={styles.submissionMeta}>
                    <div style={styles.metaLine}>
                      <strong>Archivo:</strong>{' '}
                      <a href={submission.archivo_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                        {submission.archivo_nombre}
                      </a>
                    </div>
                    <div style={styles.metaLine}>
                      <strong>Fecha de Entrega:</strong>{' '}
                      {new Date(submission.fecha_entrega).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {submission.estado !== 'calificado' || Number(submission.permite_reenvio) === 1 ? (
                    <div style={{ marginTop: '20px' }}>
                      {Number(submission.permite_reenvio) === 1 && submission.estado === 'calificado' && (
                        <p style={{ fontSize: '13px', color: '#0073A5', marginBottom: '8px', fontWeight: 600 }}>
                          Tu maestro te permitió volver a entregar esta tarea.
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                        {submission.estado === 'calificado'
                          ? 'Sube un nuevo archivo para reemplazar tu entrega calificada.'
                          : '¿Deseas reenviar tu tarea? Si subes un nuevo archivo, reemplazará el anterior.'}
                      </p>
                      <form onSubmit={handleUploadSubmit}>
                        <input
                          type="file"
                          onChange={handleFileChange}
                          style={{ fontSize: '12px', display: 'block', marginBottom: '10px' }}
                          required
                        />
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '8px' }}
                          disabled={uploading || !selectedFile}
                        >
                          {uploading ? 'Reenviando...' : 'Reemplazar Entrega'}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={handleUploadSubmit} style={styles.uploadForm}>
                  <div style={styles.uploadArea}>
                    <UploadCloud size={32} color="#0073A5" />
                    <p style={styles.uploadTitle}>Selecciona el archivo de tu tarea</p>
                    <p style={styles.uploadSubtitle}>Soporte para PDF, Word o imágenes comprimidas</p>
                    
                    <input
                      type="file"
                      id="fileUpload"
                      style={styles.fileInput}
                      onChange={handleFileChange}
                      required
                    />
                    <label htmlFor="fileUpload" style={styles.fileLabel}>
                      Buscar Archivo
                    </label>

                    {selectedFile && (
                      <div style={styles.selectedFileName}>
                        Archivo: <strong>{selectedFile.name}</strong>
                      </div>
                    )}
                  </div>

                  {uploadError && <div style={styles.uploadError}>{uploadError}</div>}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '16px' }}
                    disabled={uploading || !selectedFile}
                  >
                    {uploading ? 'Subiendo tarea...' : 'Enviar Entrega'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="card" style={{ backgroundColor: '#FAFBFD', border: '1px dashed var(--border)', textAlign: 'center', padding: '30px 20px', color: '#64748B' }}>
              <CheckCircle2 size={36} color="#B0B3B5" style={{ marginBottom: '10px', display: 'inline-block' }} />
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Sin Tarea Requerida</h4>
              <p style={{ fontSize: '12px', marginTop: '4px', lineHeight: '1.4' }}>Esta sesión no requiere el envío de actividades o entregables por parte del alumno.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    margin: '0 auto',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0073A5',
    marginBottom: '20px',
  },
  header: {
    marginBottom: '24px',
  },
  breadcrumbs: {
    fontSize: '12px',
    color: '#64748B',
    marginBottom: '4px',
  },
  title: {
    fontSize: '26px',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  classNav: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
    gap: '12px',
  },
  navBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0073A5',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0,115,165,0.2)',
    backgroundColor: 'rgba(0,115,165,0.04)',
  },
  siblingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  siblingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    border: '1px solid transparent',
  },
  siblingItemActive: {
    backgroundColor: 'rgba(0,115,165,0.08)',
    borderColor: '#0073A5',
    fontWeight: '700',
    color: '#0073A5',
  },
  siblingNum: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#94A3B8',
    minWidth: '18px',
  },
  examLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    marginBottom: '4px',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#0073A5',
    textDecoration: 'none',
    backgroundColor: '#F8FAFC',
    border: '1px solid var(--border)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '7.5fr 4.5fr',
    gap: '24px',
  },
  mainCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  videoHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  videoHeadingNum: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: '#0073A5',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
  },
  videoWrapper: {
    position: 'relative',
    paddingBottom: '56.25%', // 16:9 Aspect Ratio
    height: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius-md)',
    backgroundColor: '#000000',
    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  cardSubtitle: {
    fontSize: '12px',
    color: '#64748B',
    marginBottom: '16px',
  },
  newCommentForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '24px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '20px',
  },
  sendBtn: {
    alignSelf: 'flex-end',
    padding: '8px 16px',
    fontSize: '13px',
  },
  forumList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  emptyForum: {
    padding: '20px',
    textAlign: 'center',
    color: '#64748B',
    fontSize: '13px',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  postBlock: {
    borderBottom: '1px solid var(--border)',
    paddingBottom: '16px',
  },
  postHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  userRoleTag: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    padding: '1px 6px',
    borderRadius: '3px',
    marginLeft: '8px',
    textTransform: 'uppercase',
  },
  postDate: {
    fontSize: '11px',
    color: '#94A3B8',
  },
  postContent: {
    fontSize: '13.5px',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
  },
  replyLink: {
    background: 'none',
    border: 'none',
    color: '#0073A5',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  repliesList: {
    marginLeft: '24px',
    paddingLeft: '16px',
    borderLeft: '2px solid var(--border)',
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  replyItem: {
    padding: '8px 0',
  },
  replyForm: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    marginLeft: '24px',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: '#64748B',
    fontSize: '13px',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  materialsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  materialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'var(--transition)',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  },
  materialName: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  materialFormat: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '2px',
  },
  tareaInfoBox: {
    marginBottom: '20px',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 115, 165, 0.2)',
    backgroundColor: '#F8FAFC',
  },
  tareaInfoTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0073A5',
    marginBottom: '8px',
  },
  tareaInfoText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  tareaResourceLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#0073A5',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  uploadForm: {
    width: '100%',
  },
  uploadArea: {
    border: '2px dashed var(--primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '30px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,115,165,0.01)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'var(--transition)',
  },
  fileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  uploadTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '12px',
  },
  uploadSubtitle: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '4px',
    marginBottom: '16px',
  },
  fileLabel: {
    fontSize: '12px',
    fontWeight: '700',
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    padding: '6px 16px',
    borderRadius: '4px',
    pointerEvents: 'none',
  },
  selectedFileName: {
    marginTop: '14px',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
  uploadError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    marginTop: '12px',
    textAlign: 'center',
  },
  subStatus: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statusBox: {
    backgroundColor: 'rgba(0, 115, 165, 0.03)',
    border: '1px solid rgba(0, 115, 165, 0.1)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  gradeText: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
  },
  feedbackBox: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px dashed rgba(0, 115, 165, 0.2)',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  submissionMeta: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '14px',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metaLine: {
    color: 'var(--text-primary)',
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
