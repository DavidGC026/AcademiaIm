'use client';

import { useState, useEffect, useEffectEvent, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { coursePath, parseCourseRoute } from '@/lib/courseRoutes';
import { 
  Plus, 
  BookOpen, 
  Video, 
  ChevronRight, 
  Layers, 
  FileText,
  AlertCircle,
  Trash2,
  Pencil,
  Users,
  Check,
  Copy,
  Search,
  UserPlus,
  ArrowLeft,
  Settings2,
  X
} from 'lucide-react';
import FileResourcePreview from '@/components/FileResourcePreview';
import BiografiasPanel from '@/components/BiografiasPanel';
import ClaseSeccionesEditor from '@/components/ClaseSeccionesEditor';
import { type ClaseSeccion, defaultSecciones, resolveSecciones, serializeSecciones } from '@/lib/claseSecciones';
import { toAssetUrl, toClasePresentacionUrl } from '@/lib/assetUrl';

interface Course {
  id: number;
  nombre: string;
  descripcion: string;
  codigo?: string;
  imagen?: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  created_at: string;
  grupos_asignados?: number;
  creador_nombre?: string;
}

const courseSections = [
  { id: 'clases', label: 'Clases', icon: BookOpen },
  { id: 'examenes', label: 'Exámenes', icon: FileText },
  { id: 'alumnos', label: 'Alumnos y grupos', icon: Users },
  { id: 'datos', label: 'Descripción y datos', icon: Settings2 },
  { id: 'biografias', label: 'Biografías', icon: UserPlus },
] as const;

const courseStatusLabels = { aprobado: 'Aprobado', pendiente: 'En revisión', rechazado: 'Rechazado' };

const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

interface EstudianteInscrito {
  id: number;
  nombre: string;
  email: string;
  id_estudiante: string | null;
  inscrito_en: string;
}

interface EstudianteBusqueda {
  id: number;
  nombre: string;
  email: string;
  id_estudiante: string | null;
}

interface GrupoAsignacion {
  id: number;
  nombre: string;
  codigo: string;
  asignado: number;
}

interface ClaseVideo {
  titulo: string;
  url: string;
}

interface ClassItem {
  id: number;
  curso_id: number;
  titulo: string;
  descripcion: string;
  video_url: string | null;
  videos?: ClaseVideo[];
  clase_en_vivo_url?: string | null;
  materiales: unknown[];
  requiere_tarea?: number;
  tarea_descripcion?: string | null;
  tarea_recursos?: { archivo_url: string; archivo_nombre: string; titulo?: string }[];
  secciones?: ClaseSeccion[];
  referencias?: { tipo: string; libro_id?: number; titulo?: string; archivo_url?: string; archivo_nombre?: string }[];
  presentacion_url?: string | null;
  presentacion_nombre?: string | null;
  orden?: number;
}

export default function CourseManagement({ role }: { role: 'maestro' | 'administrador' }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = role === 'administrador';
  const basePath = isAdmin ? '/admin/materias' : '/maestro/materias';
  const route = parseCourseRoute(pathname.slice(basePath.length).split('/').filter(Boolean));
  const activeSection = route.section;
  const showCourseForm = route.kind === 'new';
  const showClassForm = route.editor === 'class';
  const editingClassId = route.classId;
  const showExamBuilder = route.editor === 'exam';
  const showExcelImporter = route.editor === 'import';
  const editorInitialized = useRef<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseSearch, setCourseSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | Course['estado']>('todos');
  const [coursesError, setCoursesError] = useState('');
  const [courseCreateError, setCourseCreateError] = useState('');
  const [notice, setNotice] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const selectedCourseId = useRef<number | null>(null);
  const [classFormDirty, setClassFormDirty] = useState(false);
  const [classError, setClassError] = useState('');

  // Selecciones
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Form Cursos
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseImagen, setNewCourseImagen] = useState('');
  const [editCourseImagen, setEditCourseImagen] = useState('');
  const [editCourseNombre, setEditCourseNombre] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');
  const [courseDetailsSaving, setCourseDetailsSaving] = useState(false);
  const [courseEditMsg, setCourseEditMsg] = useState('');
  const [courseLoading, setCourseLoading] = useState(false);

  // Form Clases
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [classVideos, setClassVideos] = useState<ClaseVideo[]>([]);
  const [videoTituloInput, setVideoTituloInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [presentacionUrl, setPresentacionUrl] = useState('');
  const [presentacionNombre, setPresentacionNombre] = useState('');
  const [presentacionLocalFile, setPresentacionLocalFile] = useState<File | null>(null);
  const [presentacionUploading, setPresentacionUploading] = useState(false);
  const [contenidoCentral, setContenidoCentral] = useState<'video' | 'presentacion'>('video');
  const [requiereTarea, setRequiereTarea] = useState(false);
  const [tareaDescripcion, setTareaDescripcion] = useState('');
  const [tareaRecursos, setTareaRecursos] = useState<{ archivo_url: string; archivo_nombre: string; titulo?: string }[]>([]);
  const [tareaRecursoUploading, setTareaRecursoUploading] = useState(false);
  const [bibliotecaLibros, setBibliotecaLibros] = useState<{ id: number; titulo: string; autor: string }[]>([]);
  const [classSecciones, setClassSecciones] = useState<ClaseSeccion[]>(defaultSecciones());
  const [classLoading, setClassLoading] = useState(false);
  // Exámenes
  const [exams, setExams] = useState<{ id: number; titulo: string; descripcion: string; limite_tiempo: number }[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  // Form Exámenes
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDesc, setNewExamDesc] = useState('');
  const [newExamTime, setNewExamTime] = useState(0);
  
  interface QuestionBuilder {
    pregunta: string;
    tipo: string;
    opciones: { texto: string; es_correcta: boolean }[];
  }
  const [questions, setQuestions] = useState<QuestionBuilder[]>([]);

  const [gruposCurso, setGruposCurso] = useState<GrupoAsignacion[]>([]);
  const [selectedGrupoIds, setSelectedGrupoIds] = useState<number[]>([]);
  const [gruposCursoLoading, setGruposCursoLoading] = useState(false);
  const [gruposSaveLoading, setGruposSaveLoading] = useState(false);
  const [gruposMsg, setGruposMsg] = useState('');

  const [cursoCodigo, setCursoCodigo] = useState('');
  const [estudiantesCurso, setEstudiantesCurso] = useState<EstudianteInscrito[]>([]);
  const [estudiantesLoading, setEstudiantesLoading] = useState(false);
  const [estudiantesMsg, setEstudiantesMsg] = useState('');
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<EstudianteBusqueda[]>([]);
  const [busquedaLoading, setBusquedaLoading] = useState(false);
  const [inscribiendoId, setInscribiendoId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchCourses = () => fetch('/api/cursos')
    .then(async response => {
      if (!response.ok) throw new Error('No se pudieron cargar tus materias. Intenta de nuevo.');
      return response.json();
    })
    .then(result => {
        setCourses(result.courses);
        setCoursesError('');
    })
    .catch(error => setCoursesError(error instanceof Error ? error.message : 'No se pudieron cargar tus materias. Intenta de nuevo.'))
    .finally(() => setLoading(false));

  const fetchClasses = async (cursoId: number) => {
    try {
      const res = await fetch(`/api/clases?curso_id=${cursoId}`);
      if (!res.ok) throw new Error('No se pudieron cargar las clases.');
      if (res.ok) {
        const data = await res.json();
        if (selectedCourseId.current !== cursoId) return;
        setClasses(data.classes.map((cls: ClassItem & { materiales?: unknown; videos?: unknown; referencias?: unknown; secciones?: unknown; tarea_recursos?: unknown }) => ({
          ...cls,
          materiales: typeof cls.materiales === 'string' ? JSON.parse(cls.materiales as string) : cls.materiales || [],
          videos: typeof cls.videos === 'string' ? JSON.parse(cls.videos as string) : cls.videos || [],
          referencias: Array.isArray(cls.referencias) ? cls.referencias : [],
          secciones: resolveSecciones(cls.secciones, cls.materiales, cls.referencias),
          tarea_recursos: Array.isArray(cls.tarea_recursos) ? cls.tarea_recursos : [],
        })));
      }
    } catch (error) {
      console.error('Error al cargar clases:', error);
      if (selectedCourseId.current === cursoId) setWorkspaceError('No se pudieron cargar las clases. Intenta de nuevo.');
    }
  };

  const fetchExams = async (cursoId: number) => {
    try {
      const res = await fetch(`/api/examenes?curso_id=${cursoId}`);
      if (!res.ok) throw new Error('No se pudieron cargar los exámenes.');
      if (res.ok) {
        const data = await res.json();
        if (selectedCourseId.current !== cursoId) return;
        setExams(data.exams || []);
      }
    } catch (error) {
      console.error('Error al cargar exámenes:', error);
      if (selectedCourseId.current === cursoId) setWorkspaceError('No se pudieron cargar los exámenes. Intenta de nuevo.');
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!showClassForm) return;
    let cancelled = false;
    fetch('/api/biblioteca/libros')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setBibliotecaLibros(d.libros || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showClassForm]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    setCourseCreateError('');
    setCourseLoading(true);
    try {
      const res = await fetch('/api/cursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newCourseName.trim(), descripcion: newCourseDesc.trim(), imagen: newCourseImagen || null }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'No se pudo crear la materia.');
      }
      if (res.ok) {
        setNewCourseName('');
        setNewCourseDesc('');
        setNewCourseImagen('');
        const result = await res.json();
        setStatusFilter('todos');
        setCourseSearch('');
        setNotice(isAdmin ? 'Materia creada. Ya puedes agregar clases, exámenes y alumnos.' : 'Materia enviada a revisión. Puedes editar sus datos mientras el administrador la aprueba.');
        await fetchCourses();
        router.replace(coursePath(basePath, result.course.id, isAdmin ? 'clases' : 'datos'));
      }
    } catch (error) {
      setCourseCreateError(error instanceof Error ? error.message : 'No se pudo crear la materia. Revisa tu conexión.');
    } finally {
      setCourseLoading(false);
    }
  };

  const handleUploadCourseImage = async (file: File, target: 'new' | 'edit') => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        if (target === 'new') setNewCourseImagen(data.url);
        else setEditCourseImagen(data.url);
      } else {
        alert(data.error || 'Error al subir imagen');
      }
    } catch {
      alert('Error de conexión al subir imagen');
    }
  };

  const handleSaveCourseDetails = async () => {
    if (!selectedCourse) return;
    const nombre = editCourseNombre.trim();
    if (!nombre) {
      setCourseEditMsg('El nombre es obligatorio');
      return;
    }
    setCourseEditMsg('');
    setCourseDetailsSaving(true);
    try {
      const res = await fetch(`/api/cursos/${selectedCourse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion: editCourseDesc.trim(), imagen: editCourseImagen.trim() || null }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = {
          ...selectedCourse,
          nombre: data.curso?.nombre ?? nombre,
          descripcion: data.curso?.descripcion ?? editCourseDesc.trim(),
          imagen: data.curso?.imagen ?? null,
        };
        setSelectedCourse(updated);
        setEditCourseNombre(updated.nombre);
        setEditCourseDesc(updated.descripcion);
        setEditCourseImagen(updated.imagen || '');
        setCourseEditMsg('Materia actualizada correctamente');
        fetchCourses();
      } else {
        const data = await res.json();
        setCourseEditMsg(data.error || 'Error al guardar');
      }
    } catch {
      setCourseEditMsg('Error de conexión');
    } finally {
      setCourseDetailsSaving(false);
    }
  };

  const addVideoToList = () => {
    if (!videoUrlInput.trim()) return;
    setClassVideos([
      ...classVideos,
      { titulo: videoTituloInput.trim(), url: videoUrlInput.trim() },
    ]);
    setVideoTituloInput('');
    setVideoUrlInput('');
  };

  const removeVideoFromList = (idx: number) => {
    setClassVideos(classVideos.filter((_, i) => i !== idx));
  };

  const resetClassForm = () => {
    setClassFormDirty(false);
    setClassError('');
    setNewClassTitle('');
    setNewClassDesc('');
    setClassVideos([]);
    setVideoTituloInput('');
    setVideoUrlInput('');
    setRequiereTarea(false);
    setTareaDescripcion('');
    setTareaRecursos([]);
    setClassSecciones(defaultSecciones());
    setPresentacionUrl('');
    setPresentacionNombre('');
    setPresentacionLocalFile(null);
    setContenidoCentral('video');
  };

  const startEditClass = (c: ClassItem) => {
    setClassFormDirty(false);
    setClassError('');
    const videoList: ClaseVideo[] =
      c.videos && c.videos.length > 0
        ? c.videos
        : c.video_url
        ? [{ titulo: '', url: c.video_url }]
        : [];
    setNewClassTitle(c.titulo);
    setNewClassDesc(c.descripcion || '');
    setClassVideos([...videoList]);
    setRequiereTarea(!!c.requiere_tarea);
    setTareaDescripcion(c.tarea_descripcion || '');
    setTareaRecursos(Array.isArray(c.tarea_recursos) ? [...c.tarea_recursos] : []);
    setClassSecciones(
      c.secciones && c.secciones.length > 0
        ? c.secciones.map((s) => ({ ...s, items: [...s.items] }))
        : resolveSecciones(null, c.materiales, c.referencias)
    );
    setPresentacionUrl(c.presentacion_url || '');
    setPresentacionNombre(c.presentacion_nombre || '');
    setPresentacionLocalFile(null);
    setContenidoCentral(
      videoList.length > 0 ? 'video' : c.presentacion_url ? 'presentacion' : 'video'
    );
    setVideoTituloInput('');
    setVideoUrlInput('');
  };

  const handleTareaRecursoUpload = async (file: File) => {
    setTareaRecursoUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setTareaRecursos((prev) => [
          ...prev,
          { archivo_url: data.url, archivo_nombre: data.name || file.name },
        ]);
      } else {
        alert(data.error || 'Error al subir el recurso');
      }
    } catch {
      alert('Error de conexión al subir el recurso');
    } finally {
      setTareaRecursoUploading(false);
    }
  };

  const removeTareaRecurso = (idx: number) => {
    setTareaRecursos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePresentacionUpload = async (file: File) => {
    setPresentacionUploading(true);
    setPresentacionLocalFile(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/clases/presentacion', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      setPresentacionUrl(data.ref);
      setPresentacionNombre(data.name || file.name);
    } catch (error) {
      setPresentacionLocalFile(null);
      alert(error instanceof Error ? error.message : 'Error al subir presentación');
    } finally {
      setPresentacionUploading(false);
    }
  };

  const clearPresentacion = () => {
    setPresentacionUrl('');
    setPresentacionNombre('');
    setPresentacionLocalFile(null);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassTitle.trim() || !selectedCourse) return;
    setClassError('');
    // Incluir un video pendiente en los inputs aunque no se haya pulsado "Agregar".
    const videosToSend = contenidoCentral === 'video' ? [...classVideos] : [];
    if (contenidoCentral === 'video' && videoUrlInput.trim()) {
      videosToSend.push({ titulo: videoTituloInput.trim(), url: videoUrlInput.trim() });
    }
    if (contenidoCentral === 'presentacion' && !presentacionUrl) {
      setClassError('Sube una presentación (PDF, PPT o PPTX) o elige la opción Video.');
      return;
    }
    setClassLoading(true);
    try {
      const existing = editingClassId ? classes.find((c) => c.id === editingClassId) : null;
      const res = await fetch('/api/clases', {
        method: editingClassId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingClassId
            ? {
                id: editingClassId,
                titulo: newClassTitle,
                descripcion: newClassDesc,
                videos: videosToSend,
                contenido_central: contenidoCentral,
                presentacion_url: contenidoCentral === 'presentacion' ? presentacionUrl || null : null,
                presentacion_nombre: contenidoCentral === 'presentacion' ? presentacionNombre || null : null,
                secciones: serializeSecciones(classSecciones),
                requiere_tarea: requiereTarea,
                tarea_descripcion: tareaDescripcion,
                tarea_recursos: tareaRecursos,
                orden: existing?.orden ?? 0,
              }
            : {
                curso_id: selectedCourse.id,
                titulo: newClassTitle,
                descripcion: newClassDesc,
                videos: videosToSend,
                contenido_central: contenidoCentral,
                presentacion_url: contenidoCentral === 'presentacion' ? presentacionUrl || null : null,
                presentacion_nombre: contenidoCentral === 'presentacion' ? presentacionNombre || null : null,
                secciones: serializeSecciones(classSecciones),
                requiere_tarea: requiereTarea,
                tarea_descripcion: tareaDescripcion,
                tarea_recursos: tareaRecursos,
                orden: classes.length + 1,
              }
        ),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'No se pudo guardar la clase.');
      }
      if (res.ok) {
        setNotice(editingClassId ? 'Cambios de la clase guardados.' : 'Clase creada correctamente.');
        resetClassForm();
        router.replace(coursePath(basePath, selectedCourse.id, 'clases'));
        fetchClasses(selectedCourse.id);
      }
    } catch (error) {
      setClassError(error instanceof Error ? error.message : 'No se pudo guardar la clase. Revisa tu conexión.');
    } finally {
      setClassLoading(false);
    }
  };

  const handleDeleteClass = async (classId: number) => {
    if (!confirm('¿Seguro que deseas eliminar esta clase? Se perderán las tareas entregadas por los alumnos.')) return;
    try {
      const res = await fetch(`/api/clases?id=${classId}`, {
        method: 'DELETE'
      });
      if (res.ok && selectedCourse) {
        fetchClasses(selectedCourse.id);
      } else {
        alert('Error al eliminar la clase');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        pregunta: '',
        tipo: 'opcion_multiple',
        opciones: [
          { texto: '', es_correcta: true },
          { texto: '', es_correcta: false },
          { texto: '', es_correcta: false },
          { texto: '', es_correcta: false },
        ]
      }
    ]);
  };

  const updateQuestionText = (qIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].pregunta = text;
    setQuestions(updated);
  };

  const updateOptionText = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].opciones[optIdx].texto = text;
    setQuestions(updated);
  };

  const setOptionCorrect = (qIdx: number, optIdx: number) => {
    const updated = [...questions];
    updated[qIdx].opciones.forEach((opt, idx) => {
      opt.es_correcta = idx === optIdx;
    });
    setQuestions(updated);
  };

  const removeQuestion = (qIdx: number) => {
    setQuestions(questions.filter((_, idx) => idx !== qIdx));
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle || !selectedCourse) return;
    if (questions.length === 0) {
      alert('Debes agregar al menos una pregunta al examen.');
      return;
    }
    
    // Validaciones
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.pregunta.trim()) {
        alert(`La pregunta ${i + 1} no puede estar vacía.`);
        return;
      }
      for (let j = 0; j < q.opciones.length; j++) {
        if (!q.opciones[j].texto.trim()) {
          alert(`La opción ${j + 1} de la pregunta ${i + 1} no puede estar vacía.`);
          return;
        }
      }
    }

    setExamLoading(true);
    try {
      const res = await fetch('/api/examenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curso_id: selectedCourse.id,
          titulo: newExamTitle,
          descripcion: newExamDesc,
          limite_tiempo: newExamTime,
          preguntas: questions
        })
      });

      if (res.ok) {
        setNewExamTitle('');
        setNewExamDesc('');
        setNewExamTime(0);
        setQuestions([]);
        router.replace(coursePath(basePath, selectedCourse.id, 'examenes'));
        fetchExams(selectedCourse.id);
      } else {
        alert('Error al crear examen.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    } finally {
      setExamLoading(false);
    }
  };

  const handleImportExcelExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle || !selectedCourse || !importFile) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('curso_id', String(selectedCourse.id));
      formData.append('titulo', newExamTitle);
      formData.append('descripcion', newExamDesc);
      formData.append('limite_tiempo', String(newExamTime));

      const res = await fetch('/api/examenes/importar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Examen importado con éxito.');
        setNewExamTitle('');
        setNewExamDesc('');
        setNewExamTime(0);
        setImportFile(null);
        router.replace(coursePath(basePath, selectedCourse.id, 'examenes'));
        fetchExams(selectedCourse.id);
      } else {
        alert(data.error || 'Error al importar examen.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al importar examen.');
    } finally {
      setImportLoading(false);
    }
  };

  const fetchCourseGrupos = async (cursoId: number) => {
    setGruposCursoLoading(true);
    setGruposMsg('');
    try {
      const res = await fetch(`/api/cursos/${cursoId}/grupos`);
      if (!res.ok) throw new Error('No se pudieron cargar los grupos.');
      if (res.ok) {
        const data = await res.json();
        if (selectedCourseId.current !== cursoId) return;
        const lista = (data.grupos || []) as GrupoAsignacion[];
        setGruposCurso(lista);
        setSelectedGrupoIds(
          lista.filter((g) => Number(g.asignado) === 1).map((g) => g.id)
        );
      }
    } catch (error) {
      console.error('Error al cargar grupos del curso:', error);
      if (selectedCourseId.current === cursoId) setWorkspaceError('No se pudieron cargar los grupos. Intenta de nuevo.');
    } finally {
      if (selectedCourseId.current === cursoId) setGruposCursoLoading(false);
    }
  };

  const toggleGrupoSelection = (grupoId: number) => {
    setGruposMsg('');
    setSelectedGrupoIds((prev) =>
      prev.includes(grupoId) ? prev.filter((id) => id !== grupoId) : [...prev, grupoId]
    );
  };

  const handleSaveCourseGrupos = async () => {
    if (!selectedCourse || gruposSaveLoading) return;
    const cursoId = selectedCourse.id;
    setGruposSaveLoading(true);
    setGruposMsg('');
    try {
      const res = await fetch(`/api/cursos/${cursoId}/grupos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo_ids: selectedGrupoIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar');
      }
      if (selectedCourseId.current !== cursoId) return;
      const savedIds = new Set<number>((data.asignados || []).map((grupo: { id: number }) => grupo.id));
      setGruposCurso(previous => previous.map(grupo => ({ ...grupo, asignado: savedIds.has(grupo.id) ? 1 : 0 })));
      setSelectedGrupoIds(gruposCurso.filter(grupo => savedIds.has(grupo.id)).map(grupo => grupo.id));
      setGruposMsg('Asignaciones guardadas correctamente.');
      void fetchCourses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      if (selectedCourseId.current === cursoId) setGruposMsg(message);
    } finally {
      setGruposSaveLoading(false);
    }
  };

  const fetchCourseEstudiantes = async (cursoId: number) => {
    setEstudiantesLoading(true);
    setEstudiantesMsg('');
    try {
      const res = await fetch(`/api/cursos/${cursoId}/estudiantes`);
      if (!res.ok) throw new Error('No se pudieron cargar los alumnos.');
      if (res.ok) {
        const data = await res.json();
        if (selectedCourseId.current !== cursoId) return;
        setEstudiantesCurso(data.estudiantes || []);
        if (data.curso?.codigo) setCursoCodigo(data.curso.codigo);
      }
    } catch (error) {
      console.error('Error al cargar alumnos del curso:', error);
      if (selectedCourseId.current === cursoId) setWorkspaceError('No se pudieron cargar los alumnos. Intenta de nuevo.');
    } finally {
      if (selectedCourseId.current === cursoId) setEstudiantesLoading(false);
    }
  };

  const handleCopyCodigo = async () => {
    if (!cursoCodigo) return;
    try {
      await navigator.clipboard.writeText(cursoCodigo);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setEstudiantesMsg('No se pudo copiar. Selecciona el código y cópialo manualmente.');
    }
  };

  const handleBuscarAlumno = async () => {
    if (busquedaAlumno.trim().length < 2) return;
    setBusquedaLoading(true);
    try {
      const res = await fetch(`/api/usuarios/buscar?q=${encodeURIComponent(busquedaAlumno)}&rol=estudiante`);
      if (res.ok) {
        const data = await res.json();
        const inscritos = new Set(estudiantesCurso.map((e) => e.id));
        setResultadosBusqueda((data.usuarios || []).filter((u: EstudianteBusqueda) => !inscritos.has(u.id)));
      }
    } catch (error) {
      console.error('Error al buscar alumnos:', error);
    } finally {
      setBusquedaLoading(false);
    }
  };

  const handleInscribirAlumno = async (estudianteId: number) => {
    if (!selectedCourse) return;
    setInscribiendoId(estudianteId);
    setEstudiantesMsg('');
    try {
      const res = await fetch(`/api/cursos/${selectedCourse.id}/estudiantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudiante_id: estudianteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo inscribir');
      setEstudiantesMsg(`${data.estudiante.nombre} inscrito correctamente.`);
      setResultadosBusqueda((prev) => prev.filter((u) => u.id !== estudianteId));
      fetchCourseEstudiantes(selectedCourse.id);
    } catch (err: unknown) {
      setEstudiantesMsg(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setInscribiendoId(null);
    }
  };

  const handleQuitarAlumno = async (estudianteId: number) => {
    if (!selectedCourse) return;
    if (!confirm('¿Quitar la inscripción directa de este alumno a la materia?')) return;
    try {
      const res = await fetch(
        `/api/cursos/${selectedCourse.id}/estudiantes?estudiante_id=${estudianteId}`,
        { method: 'DELETE' }
      );
      if (res.ok) fetchCourseEstudiantes(selectedCourse.id);
    } catch (error) {
      console.error('Error al quitar alumno:', error);
    }
  };

  const selectCourse = async (course: Course) => {
    selectedCourseId.current = course.id;
    editorInitialized.current = null;
    setSelectedCourse(course);
    setWorkspaceError('');
    resetClassForm();
    setNewExamTitle('');
    setNewExamDesc('');
    setNewExamTime(0);
    setQuestions([]);
    setImportFile(null);
    setCopiedCode(false);
    setClasses([]);
    setExams([]);
    setGruposCurso([]);
    setSelectedGrupoIds([]);
    setGruposMsg('');
    setEstudiantesCurso([]);
    setEstudiantesMsg('');
    setBusquedaAlumno('');
    setResultadosBusqueda([]);
    setCursoCodigo(course.codigo || '');
    setEditCourseImagen(course.imagen || '');
    setEditCourseNombre(course.nombre);
    setEditCourseDesc(course.descripcion || '');
    setCourseEditMsg('');
    setWorkspaceLoading(course.estado === 'aprobado');
    if (course.estado === 'aprobado') {
      await Promise.all([
        fetchClasses(course.id),
        fetchExams(course.id),
        fetchCourseGrupos(course.id),
        fetchCourseEstudiantes(course.id),
      ]);
      if (selectedCourseId.current === course.id) setWorkspaceLoading(false);
    }
  };

  const hasGroupChanges = gruposCurso.some(grupo => (Number(grupo.asignado) === 1) !== selectedGrupoIds.includes(grupo.id));
  const hasUnsavedChanges = (showCourseForm && !!(newCourseName || newCourseDesc || newCourseImagen)) || (!!selectedCourse && (
    classFormDirty ||
    ((showExamBuilder || showExcelImporter) && !!(newExamTitle || newExamDesc || importFile || questions.some(q => q.pregunta || q.opciones.some(o => o.texto)))) ||
    editCourseNombre !== selectedCourse.nombre ||
    editCourseDesc !== (selectedCourse.descripcion || '') ||
    editCourseImagen !== (selectedCourse.imagen || '') ||
    hasGroupChanges
  ));
  const workspaceBusy = courseLoading || courseDetailsSaving || classLoading || examLoading || importLoading || gruposSaveLoading || presentacionUploading || tareaRecursoUploading;
  const confirmLeave = () => !hasUnsavedChanges || confirm('Tienes cambios sin guardar en esta materia. ¿Quieres descartarlos y continuar?');

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  // La URL controla la vista; el layout conserva los borradores al usar Atrás/Adelante.
  const syncCourseFromRoute = useEffectEvent(() => {
    if (loading) return;
    const course = courses.find(item => item.id === route.courseId);
    if (!course) {
      selectedCourseId.current = null;
      setSelectedCourse(null);
    } else {
      if (course.estado !== 'aprobado' && route.section !== 'datos') router.replace(coursePath(basePath, course.id, 'datos'));
      if (selectedCourseId.current !== course.id) void selectCourse(course);
    }
  });
  // Sincroniza el estado del formulario con la ruta externa sin perder los borradores de otras secciones.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { syncCourseFromRoute(); }, [route.courseId, route.section, loading, courses]);

  const syncEditorFromRoute = useEffectEvent(() => {
    if (!route.editor || !selectedCourse || selectedCourse.id !== route.courseId || workspaceLoading || editorInitialized.current === pathname) return;
    if (route.editor === 'class') {
      if (route.classId) {
        const cls = classes.find(item => item.id === route.classId);
        if (!cls) return;
        startEditClass(cls);
      } else {
        resetClassForm();
      }
    } else {
      setNewExamTitle('');
      setNewExamDesc('');
      setNewExamTime(0);
      setImportFile(null);
      setQuestions(route.editor === 'exam' ? [{ pregunta: '', tipo: 'opcion_multiple', opciones: Array.from({ length: 4 }, () => ({ texto: '', es_correcta: false })) }] : []);
    }
    editorInitialized.current = pathname;
  });
  // Inicializa cada editor una sola vez; volver con el navegador conserva el borrador abierto.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { syncEditorFromRoute(); }, [pathname, workspaceLoading, selectedCourse?.id, classes]);

  const guardNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (workspaceBusy || !confirmLeave()) event.preventDefault();
  };

  const filteredCourses = courses.filter(course =>
    (statusFilter === 'todos' || course.estado === statusFilter) &&
    normalizeSearch(`${course.nombre} ${course.descripcion || ''} ${course.codigo || ''}`).includes(normalizeSearch(courseSearch))
  );

  if (loading || (route.courseId && courses.some(course => course.id === route.courseId) && selectedCourse?.id !== route.courseId)) {
    return <div style={styles.loading}>Cargando herramientas de gestión...</div>;
  }

  if (route.kind === 'invalid' || (route.courseId && !selectedCourse) || (route.classId && !workspaceLoading && !classes.some(cls => cls.id === route.classId))) {
    return <div className="teacher-workspace"><div className="card teacher-empty"><AlertCircle size={28} /><h1>Materia no disponible</h1><p>{coursesError || 'Revisa la dirección o selecciona una materia a la que tengas acceso.'}</p><Link className="btn btn-primary" href={basePath}>Volver a materias</Link></div></div>;
  }

  return (
    <div className="teacher-workspace">
      <div className="teacher-page-heading">
        <div>
          <p className="teacher-eyebrow">{isAdmin ? 'Administración de materias' : 'Panel de maestros'}</p>
          <h1>{showCourseForm ? 'Nueva materia' : selectedCourse ? selectedCourse.nombre : isAdmin ? 'Materias' : 'Mis materias'}</h1>
          <p className="teacher-page-description">{selectedCourse ? 'Organiza el contenido y administra el acceso de tus alumnos.' : 'Da de alta una materia o abre una existente para agregar clases, exámenes y alumnos.'}</p>
        </div>
        {!showCourseForm && <div className="teacher-inline-actions">
          {selectedCourse && activeSection !== 'datos' && <Link className="btn btn-secondary" href={coursePath(basePath, selectedCourse.id, 'datos')}><Pencil size={17} /> Editar descripción</Link>}
          <Link className="btn btn-primary" href={`${basePath}/nueva`} onClick={guardNavigation}><Plus size={18} /> Nueva materia</Link>
        </div>}
      </div>

      {notice && <div className="teacher-alert" role="status"><Check size={18} /><span>{notice}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={18} /></button></div>}

      {!selectedCourse || showCourseForm ? <>
        {showCourseForm ? <section className="card teacher-proposal" aria-labelledby="proposal-title">
          <div className="teacher-section-heading">
            <div><h2 id="proposal-title" style={styles.cardTitle}>Datos de la materia</h2><p style={styles.cardSubtitle}>{isAdmin ? 'Al guardarla podrás agregar clases, exámenes y alumnos.' : 'El administrador revisará la materia antes de que puedas agregar clases y alumnos.'}</p></div>
            <Link className="btn btn-neutral" href={basePath} onClick={guardNavigation}>Volver a materias</Link>
          </div>
          {courseCreateError && <div className="teacher-alert teacher-alert--error" role="alert">{courseCreateError}</div>}
            <form onSubmit={handleCreateCourse} style={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="courseNameInput">Nombre de la materia</label>
                <input
                  type="text"
                  id="courseNameInput"
                  autoFocus
                  className="form-input"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Ej. Diplomado en Tecnología, concreto y construcción"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="courseDescInput">Descripción</label>
                <textarea
                  id="courseDescInput"
                  className="form-textarea"
                  rows={3}
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="Describe los objetivos y alcances del curso..."
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Imagen de la materia (opcional)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={newCourseImagen}
                    onChange={(e) => setNewCourseImagen(e.target.value)}
                    aria-label="URL de la imagen de la materia"
                    placeholder="URL de imagen o sube un archivo"
                    style={{ flex: 1 }}
                  />
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    Subir
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadCourseImage(f, 'new');
                      }}
                    />
                  </label>
                </div>
                {newCourseImagen && (
                  <img src={toAssetUrl(newCourseImagen)} alt="" style={{ maxHeight: '80px', borderRadius: '8px' }} />
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={courseLoading}>
                <Plus size={16} /> {courseLoading ? 'Guardando...' : isAdmin ? 'Crear materia' : 'Crear y enviar a revisión'}
              </button>
            </form>
        </section> : <section className="card teacher-catalog" aria-label="Mis materias">
          <div className="teacher-catalog-toolbar">
            <label className="teacher-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar materias</span><input type="search" placeholder="Buscar por nombre o código" value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} /></label>
            <span className="teacher-result-count" role="status">{filteredCourses.length} de {courses.length} materias</span>
          </div>
          <div className="teacher-filters" role="group" aria-label="Filtrar materias por estado">
            {(['todos', 'aprobado', 'pendiente', 'rechazado'] as const).map(status => <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{status === 'todos' ? 'Todos' : status === 'aprobado' ? 'Aprobados' : status === 'pendiente' ? 'En revisión' : 'Rechazados'}<span>{status === 'todos' ? courses.length : courses.filter(course => course.estado === status).length}</span></button>)}
          </div>
          {coursesError ? <div className="teacher-empty" role="alert"><AlertCircle size={28} /><h2>No pudimos cargar las materias</h2><p>{coursesError}</p><button type="button" className="btn btn-secondary" onClick={() => { setLoading(true); fetchCourses(); }}>Reintentar</button></div> : filteredCourses.length === 0 ? <div className="teacher-empty"><BookOpen size={32} /><h2>{courses.length ? 'No hay materias con estos filtros' : 'Tu primera materia empieza aquí'}</h2><p>{courses.length ? 'Prueba con otro nombre o cambia el estado.' : 'Envía una propuesta para comenzar a preparar tus clases.'}</p>{courses.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => { setCourseSearch(''); setStatusFilter('todos'); }}>Limpiar filtros</button>}</div> : <ul className="teacher-course-list">
            {filteredCourses.map(course => <li key={course.id}>
              <Link className="teacher-course-row" href={coursePath(basePath, course.id, course.estado === 'aprobado' ? 'clases' : 'datos')}>
                <span className="teacher-course-cover">{course.imagen ? <img src={toAssetUrl(course.imagen)} alt="" /> : <BookOpen size={24} />}</span>
                <span className="teacher-course-info"><span className="teacher-course-name">{course.nombre}</span><span className="teacher-course-description">{course.descripcion || 'Sin descripción.'}</span><span className="teacher-course-meta">{course.codigo && <span>{course.codigo}</span>}{isAdmin && course.creador_nombre && <span>{course.creador_nombre}</span>}{course.estado === 'aprobado' && course.grupos_asignados !== undefined && <span><Users size={14} />{course.grupos_asignados || 0} {(course.grupos_asignados || 0) === 1 ? 'grupo asignado' : 'grupos asignados'}</span>}</span></span>
                <span className={`teacher-status teacher-status--${course.estado}`}>{courseStatusLabels[course.estado]}</span>
                <span className="teacher-course-open">{course.estado === 'aprobado' ? 'Abrir materia' : 'Ver y editar'}<ChevronRight size={18} /></span>
              </Link>
            </li>)}
          </ul>}
        </section>}
      </> : <>
        <div className="teacher-workspace-toolbar">
          <Link className="btn btn-neutral" href={basePath} onClick={guardNavigation}><ArrowLeft size={17} /> Todas las materias</Link>
          <label className="teacher-course-switch">Cambiar materia<select className="form-input" value={selectedCourse.id} disabled={workspaceBusy} onChange={(event) => { const course = courses.find(item => item.id === Number(event.target.value)); if (course && confirmLeave()) router.push(coursePath(basePath, course.id, course.estado === 'aprobado' ? 'clases' : 'datos')); }}>{courses.map(course => <option key={course.id} value={course.id}>{course.nombre}</option>)}</select></label>
          <span className={`teacher-status teacher-status--${selectedCourse.estado}`}>{courseStatusLabels[selectedCourse.estado]}</span>
        </div>
        {selectedCourse.estado !== 'aprobado' && <div className="teacher-alert"><AlertCircle size={22} /><span>{selectedCourse.estado === 'pendiente' ? 'Materia en revisión. Puedes editar su nombre, descripción e imagen. Las clases y los alumnos se habilitarán al aprobarla.' : 'Materia rechazada. Puedes corregir sus datos y contactar al administrador para revisar la propuesta.'}</span></div>}
        <>
          <nav className="teacher-tabs" aria-label="Secciones de la materia">
            {courseSections.filter(section => selectedCourse.estado === 'aprobado' || section.id === 'datos').map(({ id, label, icon: Icon }) => <Link key={id} id={`course-tab-${id}`} href={coursePath(basePath, selectedCourse.id, id)} aria-current={activeSection === id ? 'page' : undefined}><Icon size={17} />{label}{!workspaceLoading && (id === 'clases' || id === 'examenes') && <span>{id === 'clases' ? classes.length : exams.length}</span>}</Link>)}
          </nav>
          {workspaceLoading && activeSection !== 'datos' ? <div className="card teacher-empty" role="status">Cargando el contenido de la materia...</div> : workspaceError && activeSection !== 'datos' ? <div className="card teacher-empty" role="alert"><AlertCircle size={28} /><p>{workspaceError}</p><button type="button" className="btn btn-secondary" onClick={() => { if (confirmLeave()) selectCourse(selectedCourse); }}>Reintentar</button></div> : <>
            <div id="course-panel-clases" role="region" aria-labelledby="course-tab-clases" hidden={activeSection !== 'clases'} tabIndex={0}>
              {/* Sección de Clases */}
              <div className="card">
                  <div className="teacher-section-heading">
                    <div>
                      <h2 style={styles.cardTitle}>{showClassForm ? (editingClassId ? 'Editar clase' : 'Nueva clase') : 'Clases de la materia'}</h2>
                      <p style={styles.cardSubtitle}>{showClassForm ? 'Completa el contenido principal y agrega los recursos que necesites.' : `${classes.length} clase${classes.length !== 1 ? 's' : ''}. Administra el contenido en el orden en que lo ven tus alumnos.`}</p>
                    </div>
                    {!showClassForm && <Link className="btn btn-primary" href={`${coursePath(basePath, selectedCourse.id, 'clases')}/nueva`}><Plus size={18} /> Nueva clase</Link>}
                  </div>

                  {/* Lista de Clases Existentes */}
                  {!showClassForm && <div style={styles.classList}>
                    {classes.length === 0 ? (
                      <div style={styles.emptyState}>Esta materia aún no tiene clases. Usa «Nueva clase» para agregar la primera.</div>
                    ) : (
                      classes.map((c, classIdx) => {
                        const videoList: ClaseVideo[] =
                          c.videos && c.videos.length > 0
                            ? c.videos
                            : c.video_url
                            ? [{ titulo: '', url: c.video_url }]
                            : [];
                        return (
                          <div key={c.id} style={styles.classItem}>
                            <div style={styles.classHeader}>
                              <div style={styles.classTitleBlock}>
                                <span style={styles.classOrderBadge}>{classIdx + 1}</span>
                                <strong>{c.titulo}</strong>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => router.push(`${coursePath(basePath, selectedCourse.id, 'clases')}/${c.id}/editar`)}
                                  style={{ border: 'none', background: 'none', color: '#0073A5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  className="teacher-icon-action"
                                  aria-label={`Editar clase: ${c.titulo}`}
                                  title="Editar clase"
                                >
                                  <Pencil size={16} /> <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClass(c.id)}
                                  style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  className="teacher-icon-action"
                                  aria-label={`Eliminar clase: ${c.titulo}`}
                                  title="Eliminar clase"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            <div style={styles.classMetaRow}>
                              <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                {c.requiere_tarea ? 'Con Tarea' : 'Sin Tarea'}
                              </span>
                              <span style={styles.classMetaItem}>
                                <Video size={12} color="#0073A5" /> {videoList.length} video{videoList.length !== 1 ? 's' : ''}
                              </span>
                              {videoList.length === 0 && c.presentacion_url && (
                                <span style={styles.classMetaItem}>
                                  <FileText size={12} color="#0073A5" /> Presentación
                                </span>
                              )}
                              {(c.secciones?.length ?? 0) > 0 && (
                                <span style={styles.classMetaItem}>
                                  <Layers size={12} color="#0073A5" /> {c.secciones!.length} sección{c.secciones!.length !== 1 ? 'es' : ''}
                                </span>
                              )}
                            </div>

                            {c.descripcion && <p style={styles.classDescText}>{c.descripcion}</p>}
                          </div>
                        );
                      })
                    )}
                  </div>}

                  {showClassForm && <form onSubmit={handleSaveClass} onChange={() => setClassFormDirty(true)} style={styles.form}>
                    {classError && <div className="teacher-alert teacher-alert--error" role="alert">{classError}</div>}
                    <div className="form-group">
                      <label className="form-label" htmlFor="class-title">Título de la clase</label>
                      <input
                        type="text"
                        className="form-input"
                        id="class-title"
                        autoFocus
                        value={newClassTitle}
                        onChange={(e) => setNewClassTitle(e.target.value)}
                        placeholder="Ej. Clase 1: Resistencia y Ensayos de Compresión"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="class-description">Descripción e instrucciones</label>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        id="class-description"
                        value={newClassDesc}
                        onChange={(e) => setNewClassDesc(e.target.value)}
                        placeholder="Describe de qué trata la clase e instrucciones para la tarea..."
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Contenido central de la clase</label>
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                          <input
                            type="radio"
                            name="contenidoCentral"
                            checked={contenidoCentral === 'video'}
                            onChange={() => setContenidoCentral('video')}
                          />
                          <Video size={16} color="#0073A5" /> Video(s)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                          <input
                            type="radio"
                            name="contenidoCentral"
                            checked={contenidoCentral === 'presentacion'}
                            onChange={() => setContenidoCentral('presentacion')}
                          />
                          <FileText size={16} color="#0073A5" /> Presentación (PDF, PPT, PPTX)
                        </label>
                      </div>
                    </div>

                    {contenidoCentral === 'video' && (
                    <div className="form-group">
                      <label className="form-label">Videos de la Clase (puedes agregar varios, cada uno con su título)</label>

                      {classVideos.length > 0 && (
                        <div style={styles.videoList}>
                          {classVideos.map((v, idx) => (
                            <div key={idx} style={styles.videoChip}>
                              <Video size={14} color="#0073A5" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '13px' }}>
                                  {v.titulo || `Video ${idx + 1}`}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v.url}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeVideoFromList(idx)}
                                style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}
                                title="Quitar video"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={styles.videoInputRow}>
                        <input
                          type="text"
                          className="form-input"
                          aria-label="Título del video"
                          value={videoTituloInput}
                          onChange={(e) => setVideoTituloInput(e.target.value)}
                          placeholder="Título del video (ej. Parte 1: Introducción)"
                          style={{ flex: 3 }}
                        />
                        <input
                          type="url"
                          className="form-input"
                          aria-label="Enlace del video"
                          value={videoUrlInput}
                          onChange={(e) => setVideoUrlInput(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=... o Drive"
                          style={{ flex: 4 }}
                        />
                        <button type="button" onClick={addVideoToList} className="btn btn-secondary">
                          <Plus size={14} /> Agregar
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                        Soporta YouTube, Google Drive o enlaces directos. Si dejas el título vacío se numerará automáticamente.
                      </p>
                    </div>
                    )}

                    {contenidoCentral === 'presentacion' && (
                      <div className="form-group" style={{ padding: '14px', borderRadius: '8px', border: '1px dashed rgba(0,115,165,0.35)', backgroundColor: 'rgba(0,115,165,0.04)' }}>
                        <label className="form-label">Presentación como artículo central</label>
                        <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>
                          Sube PDF, PPT o PPTX. Los alumnos la verán en lugar del video (PDF con visor en plataforma; PPT/PPTX descargable).
                        </p>
                        <input
                          type="file"
                          accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          disabled={presentacionUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePresentacionUpload(f);
                            e.target.value = '';
                          }}
                          style={{ fontSize: '12px', marginBottom: '8px' }}
                        />
                        {presentacionUploading && (
                          <p style={{ fontSize: '12px', color: '#0073A5' }}>Subiendo presentación…</p>
                        )}
                        {(presentacionUrl || presentacionLocalFile) && (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0073A5' }}>
                                {presentacionNombre || 'Presentación cargada'}
                              </span>
                              <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={clearPresentacion}>
                                Quitar
                              </button>
                            </div>
                            {/\.pdf$/i.test(presentacionNombre || presentacionUrl) ? (
                              <FileResourcePreview
                                fileName={presentacionNombre || 'presentacion.pdf'}
                                fileUrl={presentacionLocalFile ? undefined : toClasePresentacionUrl(presentacionUrl)}
                                localFile={presentacionLocalFile}
                                maxHeight={280}
                                securePdf
                              />
                            ) : (
                              <p style={{ fontSize: '13px', color: '#64748B' }}>
                                Archivo listo: {presentacionNombre}. Los alumnos podrán descargarlo al ver la clase.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '16px' }}>
                      <input
                        type="checkbox"
                        id="requiereTareaCheckbox"
                        checked={requiereTarea}
                        onChange={(e) => setRequiereTarea(e.target.checked)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <label htmlFor="requiereTareaCheckbox" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Requiere entrega de tarea por el alumno
                      </label>
                    </div>

                    {requiereTarea && (
                      <div style={styles.tareaSection}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0073A5', marginBottom: '12px' }}>
                          Actividad a entregar
                        </h4>
                        <div className="form-group">
                          <label className="form-label">Descripción de la actividad a realizar</label>
                          <textarea
                            className="form-textarea"
                            rows={4}
                            value={tareaDescripcion}
                            onChange={(e) => setTareaDescripcion(e.target.value)}
                            placeholder="Indica qué debe hacer el alumno: formato, criterios, plazo, etc."
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Recursos para la entrega (opcional)</label>
                          <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>
                            Plantillas o material de apoyo (.pdf, .docx, .xls, .xlsx, .csv). Puedes agregar varios.
                          </p>
                          {tareaRecursos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                              {tareaRecursos.map((rec, idx) => (
                                <div key={idx} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: '#FAFBFD' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                      {rec.archivo_nombre}
                                    </span>
                                    <button type="button" onClick={() => removeTareaRecurso(idx)} style={styles.chipRemoveBtn} title="Quitar recurso">
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <FileResourcePreview
                                    fileName={rec.archivo_nombre}
                                    fileUrl={rec.archivo_url}
                                    maxHeight={240}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleTareaRecursoUpload(f);
                              e.target.value = '';
                            }}
                            style={{ fontSize: '12px' }}
                            disabled={tareaRecursoUploading}
                          />
                          {tareaRecursoUploading && (
                            <p style={{ fontSize: '12px', color: '#0073A5', marginTop: '8px' }}>Subiendo recurso...</p>
                          )}
                        </div>
                      </div>
                    )}

                    <details className="teacher-resources">
                      <summary>Recursos y secciones de apoyo <span>Opcional</span></summary>
                      <p>Agrega lecturas, referencias y archivos para acompañar la clase.</p>
                    <ClaseSeccionesEditor
                      secciones={classSecciones}
                      onChange={(secciones) => { setClassSecciones(secciones); setClassFormDirty(true); }}
                      libros={bibliotecaLibros}
                      copyFromClasses={classes
                        .filter((c) => c.id !== editingClassId)
                        .map((c) => ({
                          id: c.id,
                          titulo: c.titulo,
                          secciones: c.secciones?.length
                            ? c.secciones
                            : resolveSecciones(null, c.materiales, c.referencias),
                        }))}
                    />

                    </details>
                    <div className="teacher-form-actions">
                      <button type="submit" className="btn btn-primary" disabled={classLoading || presentacionUploading || tareaRecursoUploading}>
                        {classLoading ? 'Guardando...' : editingClassId ? (
                          <><Check size={16} /> Guardar cambios</>
                        ) : (
                          <><Plus size={16} /> Crear Clase</>
                        )}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={classLoading || presentacionUploading || tareaRecursoUploading} onClick={() => { if (confirmLeave()) { resetClassForm(); editorInitialized.current = null; router.push(coursePath(basePath, selectedCourse.id, 'clases')); } }}>
                          Cancelar
                        </button>
                    </div>
                  </form>}
                </div>


            </div>
            <div id="course-panel-examenes" role="region" aria-labelledby="course-tab-examenes" hidden={activeSection !== 'examenes'} tabIndex={0}>
              {/* Sección de Exámenes */}
              <div className="card" >
                  <div className="teacher-section-heading">
                    <div>
                      <h3 style={styles.cardTitle}>Exámenes de la materia</h3>
                      <p style={styles.cardSubtitle}>Crea evaluaciones de opción múltiple con autocalificación o súbelas en Excel</p>
                    </div>
                    {!showExamBuilder && !showExcelImporter && (
                      <div className="teacher-inline-actions">
                        <Link href={`${coursePath(basePath, selectedCourse.id, 'examenes')}/nuevo`} className="btn btn-primary"><Plus size={16} /> Crear examen</Link>
                        <Link href={`${coursePath(basePath, selectedCourse.id, 'examenes')}/importar`} className="btn btn-secondary"><FileText size={16} /> Importar desde Excel</Link>
                      </div>
                    )}
                  </div>

                  {/* Listado de Exámenes */}
                  {!showExamBuilder && !showExcelImporter && (
                    <div style={{ ...styles.classList, marginBottom: '0' }}>
                      {exams.length === 0 ? (
                        <div style={styles.emptyState}>No hay exámenes creados en esta materia.</div>
                      ) : (
                        exams.map((ex) => (
                          <div key={ex.id} style={styles.classItem}>
                            <div style={styles.classHeader}>
                              <div style={styles.classTitleBlock}>
                                <FileText size={16} color="#0073A5" />
                                <strong>{ex.titulo}</strong>
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>
                                Límite: {ex.limite_tiempo > 0 ? `${ex.limite_tiempo} minutos` : 'Sin límite'}
                              </span>
                            </div>
                            <p style={styles.classDescText}>{ex.descripcion}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Importador de Examen desde Excel */}
                  {showExcelImporter && (
                    <form onSubmit={handleImportExcelExam} style={styles.form}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                        <div style={{ textAlign: 'left' }}>
                          <strong style={{ color: '#10B981', fontSize: '14px', display: 'block' }}>Plantilla Oficial de Examen</strong>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>Descarga la plantilla y rellena tus preguntas antes de subirla.</span>
                        </div>
                        <a 
                          href={toAssetUrl('/plantilla_examen.xlsx')} 
                          download 
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF' }}
                        >
                          Descargar Plantilla Excel
                        </a>
                      </div>

                      <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label">Título del Examen</label>
                        <input
                          type="text"
                          className="form-input"
                          value={newExamTitle}
                          onChange={(e) => setNewExamTitle(e.target.value)}
                          placeholder="Ej. Evaluación Módulo I: Ensayos e Hidratación"
                          required
                        />
                      </div>

                      <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label">Instrucciones / Descripción</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={newExamDesc}
                          onChange={(e) => setNewExamDesc(e.target.value)}
                          placeholder="Ej. Lee con atención cada pregunta..."
                        />
                      </div>

                      <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label">Límite de Tiempo (Minutos - 0 para sin límite)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={newExamTime}
                          onChange={(e) => setNewExamTime(parseInt(e.target.value, 10) || 0)}
                          min="0"
                        />
                      </div>

                      <div className="form-group" style={{ padding: '20px', border: '2px dashed #10B981', borderRadius: '8px', textAlign: 'center', backgroundColor: '#FAFDFB', cursor: 'pointer', marginBottom: '20px' }}>
                        <label htmlFor="excelFileInput" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <FileText size={32} color="#10B981" />
                          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {importFile ? importFile.name : 'Selecciona tu archivo de Excel'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>Formatos soportados: .xlsx, .xls</span>
                        </label>
                        <input
                          type="file"
                          id="excelFileInput"
                          accept=".xlsx, .xls"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setImportFile(e.target.files[0]);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: '#10B981', borderColor: '#10B981' }} disabled={importLoading || !importFile}>
                          {importLoading ? 'Importando preguntas...' : 'Importar y Publicar Examen'}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { if (confirmLeave()) router.push(coursePath(basePath, selectedCourse.id, 'examenes')); }} 
                          className="btn btn-secondary" 
                          style={{ flex: 1 }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Creador/Formulario de Examen */}
                  {showExamBuilder && (
                    <form onSubmit={handleCreateExam} style={styles.form}>
                      <div className="form-group">
                        <label className="form-label">Título del Examen</label>
                        <input
                          type="text"
                          className="form-input"
                          value={newExamTitle}
                          onChange={(e) => setNewExamTitle(e.target.value)}
                          placeholder="Ej. Evaluación I: Conceptos del Cemento"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Instrucciones / Descripción</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={newExamDesc}
                          onChange={(e) => setNewExamDesc(e.target.value)}
                          placeholder="Instrucciones para el estudiante..."
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label">Límite de Tiempo (Minutos - 0 para sin límite)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={newExamTime}
                          onChange={(e) => setNewExamTime(parseInt(e.target.value, 10) || 0)}
                          min="0"
                        />
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Preguntas ({questions.length})</span>
                          <button type="button" onClick={addQuestion} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                            + Añadir Pregunta
                          </button>
                        </h4>

                        {questions.map((q, qIdx) => (
                          <div key={qIdx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#F8FAFC' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <strong style={{ fontSize: '14px', color: '#0073A5' }}>Pregunta {qIdx + 1}</strong>
                              {questions.length > 1 && (
                                <button type="button" onClick={() => removeQuestion(qIdx)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                  Eliminar Pregunta
                                </button>
                              )}
                            </div>

                            <div className="form-group">
                              <input
                                type="text"
                                className="form-input"
                                value={q.pregunta}
                                onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                                placeholder="Enunciado de la pregunta (ej. ¿Cuál es el componente principal del cemento Portland?)"
                                required
                              />
                            </div>

                            <div style={{ marginTop: '12px' }}>
                              <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Opciones (Selecciona la correcta):</label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {q.opciones.map((opt, optIdx) => (
                                  <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                      type="radio"
                                      name={`correct_${qIdx}`}
                                      checked={opt.es_correcta}
                                      onChange={() => setOptionCorrect(qIdx, optIdx)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <input
                                      type="text"
                                      className="form-input"
                                      value={opt.texto}
                                      onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                                      placeholder={`Opción ${String.fromCharCode(65 + optIdx)}`}
                                      style={{ flex: 1 }}
                                      required
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={examLoading}>
                          {examLoading ? 'Guardando Examen...' : 'Guardar y Publicar Examen'}
                        </button>
                        <button type="button" onClick={() => { if (confirmLeave()) router.push(coursePath(basePath, selectedCourse.id, 'examenes')); }} className="btn btn-secondary" style={{ flex: 1 }}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>


            </div>
            <div id="course-panel-alumnos" role="region" aria-labelledby="course-tab-alumnos" hidden={activeSection !== 'alumnos'} tabIndex={0}>
              <div className="card" style={{ marginBottom: '24px', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      <UserPlus size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                      Inscripciones individuales
                    </h3>
                    <p style={styles.cardSubtitle}>
                      Agrega alumnos directamente o comparte el código para que se inscriban solos.
                    </p>
                  </div>
                </div>

                {cursoCodigo && (
                  <div style={styles.codeRow}>
                    <span style={styles.codeBadge}>Código: {cursoCodigo}</span>
                    <button type="button" className="btn btn-secondary" onClick={handleCopyCodigo} style={{ padding: '6px 10px', fontSize: '12px' }}>
                      <Copy size={14} /> {copiedCode ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}

                {estudiantesMsg && (
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px',
                    backgroundColor: estudiantesMsg.includes('correctamente') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: estudiantesMsg.includes('correctamente') ? 'var(--success)' : '#EF4444',
                  }}>
                    {estudiantesMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    aria-label="Buscar alumno por nombre, correo o matrícula"
                    placeholder="Nombre, correo o matrícula"
                    value={busquedaAlumno}
                    onChange={(e) => setBusquedaAlumno(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarAlumno())}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleBuscarAlumno} disabled={busquedaLoading || busquedaAlumno.trim().length < 2} aria-label="Buscar alumnos">
                    <Search size={16} />
                  </button>
                </div>

                {resultadosBusqueda.length > 0 && (
                  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {resultadosBusqueda.map((u) => (
                      <div key={u.id} style={styles.searchResultRow}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{u.nombre}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email}{u.id_estudiante ? ` · ${u.id_estudiante}` : ''}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          disabled={inscribiendoId === u.id}
                          onClick={() => handleInscribirAlumno(u.id)}
                        >
                          {inscribiendoId === u.id ? '...' : 'Agregar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {estudiantesLoading ? (
                  <div style={styles.emptyState}>Cargando alumnos inscritos...</div>
                ) : estudiantesCurso.length === 0 ? (
                  <div style={styles.emptyState}>Aún no hay inscripciones individuales. Los alumnos de los grupos asignados también tienen acceso.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {estudiantesCurso.map((e) => (
                      <div key={e.id} style={styles.searchResultRow}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{e.nombre}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{e.email}</div>
                        </div>
                        <button type="button" onClick={() => handleQuitarAlumno(e.id)} style={styles.removeBtn} title="Quitar de la materia" aria-label={`Quitar a ${e.nombre} de la materia`}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <div className="card" style={{ marginBottom: '24px', border: '1px solid rgba(0,115,165,0.2)' }}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      <Users size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                      Grupos con acceso
                    </h3>
                    <p style={styles.cardSubtitle}>
                      Los alumnos de estos grupos tendrán acceso a la materia. También puedes inscribir alumnos individualmente.
                    </p>
                  </div>
                </div>

                {gruposMsg && (
                  <div
                    role={gruposMsg.includes('correctamente') ? 'status' : 'alert'}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '16px',
                      backgroundColor: gruposMsg.includes('correctamente')
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: gruposMsg.includes('correctamente') ? 'var(--success)' : '#EF4444',
                    }}
                  >
                    {gruposMsg}
                  </div>
                )}

                {gruposCursoLoading ? (
                  <div style={styles.emptyState}>Cargando grupos disponibles...</div>
                ) : gruposCurso.length === 0 ? (
                  <div style={styles.emptyState}>
                    No hay grupos disponibles. Ve a <Link href={isAdmin ? '/admin/grupos' : '/maestro/grupos'} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{isAdmin ? 'Grupos y Cohortes' : 'Mis grupos'}</Link> para darlos de alta.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {gruposCurso.map((g) => {
                        const checked = selectedGrupoIds.includes(g.id);
                        return (
                          <label
                            key={g.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              border: `1px solid ${checked ? '#0073A5' : 'var(--border)'}`,
                              backgroundColor: checked ? 'rgba(0,115,165,0.06)' : '#F8FAFC',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={gruposSaveLoading}
                              onChange={() => toggleGrupoSelection(g.id)}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '700', fontSize: '14px' }}>{g.nombre}</div>
                              <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                                Código: {g.codigo}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }} role="status">
                      {hasGroupChanges
                        ? 'Tienes cambios pendientes. Pulsa «Guardar asignación de grupos» para aplicarlos.'
                        : 'La selección coincide con las asignaciones guardadas.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveCourseGrupos}
                      disabled={gruposSaveLoading || !hasGroupChanges}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Check size={16} />
                      {gruposSaveLoading ? 'Guardando...' : 'Guardar asignación de grupos'}
                    </button>
                  </>
                )}
              </div>


            </div>
            <div id="course-panel-datos" role="region" aria-labelledby="course-tab-datos" hidden={activeSection !== 'datos'} tabIndex={0}>
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={styles.cardTitle}>Descripción y datos</h3>
                <p style={styles.cardSubtitle}>Edita el nombre, la descripción y la imagen que ven los alumnos.</p>
                <form onSubmit={(event) => { event.preventDefault(); void handleSaveCourseDetails(); }}>
                <fieldset disabled={courseDetailsSaving} style={{ border: 0, padding: 0, minWidth: 0 }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" htmlFor="editCourseNombre">Nombre de la materia</label>
                  <input
                    id="editCourseNombre"
                    type="text"
                    className="form-input"
                    value={editCourseNombre}
                    onChange={(e) => setEditCourseNombre(e.target.value)}
                    placeholder="Nombre de la materia"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="editCourseDesc">Descripción de la materia</label>
                  <textarea id="editCourseDesc" className="form-textarea" rows={6} value={editCourseDesc} onChange={(event) => setEditCourseDesc(event.target.value)} placeholder="Describe los objetivos, los temas y lo que aprenderán los alumnos." />
                </div>
                <label className="form-label" htmlFor="editCourseImagen">Imagen de la materia (opcional)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    id="editCourseImagen"
                    type="text"
                    className="form-input"
                    value={editCourseImagen}
                    onChange={(e) => setEditCourseImagen(e.target.value)}
                    aria-label="URL de la imagen de la materia"
                    placeholder="URL de imagen o sube un archivo"
                    style={{ flex: 1 }}
                  />
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    Subir
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadCourseImage(f, 'edit');
                      }}
                    />
                  </label>
                </div>
                {editCourseImagen && (
                  <img src={toAssetUrl(editCourseImagen)} alt="" style={{ maxHeight: '120px', borderRadius: '8px' }} />
                )}
                <div className="teacher-form-actions">
                  <button type="submit" className="btn btn-primary" disabled={courseDetailsSaving}><Check size={17} />{courseDetailsSaving ? 'Guardando...' : 'Guardar cambios'}</button>
                </div>
                </fieldset>
                </form>
                {courseEditMsg && (
                  <p role={courseEditMsg.includes('correctamente') ? 'status' : 'alert'} style={{ fontSize: '13px', marginTop: '8px', color: courseEditMsg.includes('correctamente') ? 'var(--success)' : '#EF4444' }}>
                    {courseEditMsg}
                  </p>
                )}
              </div>


            </div>
            <div id="course-panel-biografias" role="region" aria-labelledby="course-tab-biografias" hidden={activeSection !== 'biografias'} tabIndex={0}>
              {activeSection === 'biografias' && <div className="card"><BiografiasPanel cursoId={selectedCourse.id} variant="teacher" /></div>}
            </div>
          </>}
        </>
      </>}
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
    gridTemplateColumns: '4fr 8fr',
    gap: '24px',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  cardSubtitle: {
    fontSize: '13px',
    color: '#64748B',
    marginBottom: '20px',
  },
  form: {
    width: '100%',
  },
  courseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  courseItem: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  selectedCourseItem: {
    borderColor: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.03)',
  },
  courseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  courseDescText: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: '1.4',
  },
  placeholderCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minHeight: '400px',
    padding: '40px',
    color: '#64748B',
    gap: '16px',
  },
  panelContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#64748B',
    marginBottom: '16px',
    padding: '10px 14px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    border: '1px solid var(--border)',
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  codeBadge: {
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.08)',
    padding: '6px 12px',
    borderRadius: '6px',
  },
  searchResultRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#F8FAFC',
  },
  removeBtn: {
    background: 'none',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
    color: '#EF4444',
    display: 'flex',
    alignItems: 'center',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    color: '#64748B',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    marginBottom: '20px',
  },
  moduleBadgeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
  },
  moduleSelectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    border: '1px solid var(--border)',
    background: 'none',
    borderRadius: 'var(--radius-sm)',
    textAlign: 'left',
    cursor: 'pointer',
    fontWeight: '600',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
  },
  activeModuleSelectBtn: {
    borderColor: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.05)',
    color: '#0073A5',
  },
  inlineForm: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
  },
  classList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  classItem: {
    padding: '16px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  classHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  classTitleBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    color: 'var(--text-primary)',
  },
  classOrderBadge: {
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
  classMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
  },
  classMetaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748B',
  },
  classVideoList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '4px',
  },
  classVideoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.06)',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  videoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '10px',
  },
  videoChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#F8FAFC',
  },
  videoInputRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  classDescText: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  classMaterials: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border)',
  },
  materialLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#0073A5',
    backgroundColor: 'rgba(0, 115, 165, 0.06)',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  materialSection: {
    marginTop: '16px',
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
  },
  tareaSection: {
    marginBottom: '16px',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 115, 165, 0.25)',
    backgroundColor: 'rgba(0, 115, 165, 0.04)',
  },
  chipRemoveBtn: {
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  materialInputRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
  },
  materialList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px',
  },
  materialBadge: {
    fontSize: '11px',
    backgroundColor: 'var(--border)',
    padding: '4px 8px',
    borderRadius: '4px',
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
