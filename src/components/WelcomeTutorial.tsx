'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CircleHelp, ClipboardCheck, FileUp, GraduationCap, Play, X } from 'lucide-react';
import CampusDialog from './CampusDialog';
import styles from './CampusFlow.module.css';

const guides = {
  administrador: [
    { title: 'Tu campus, en orden', description: 'Desde administración puedes gestionar las materias, las cuentas y el acceso al contenido.', icon: GraduationCap, label: 'Administración del campus', items: ['Revisa las propuestas en Aprobación de cursos.', 'Abre Materias y contenido para editar clases y exámenes.', 'Los cambios de contenido se reflejan en el aula de los alumnos.'] },
    { title: 'Publica contenido con el mismo editor', description: 'Cada materia reúne clases, exámenes, inscripciones y datos del programa.', icon: FileUp, label: 'El contenido en un solo lugar', items: ['Crea o edita una clase en tres pasos.', 'Añade presentaciones, videos, materiales y tareas.', 'En Exámenes revisa resultados y habilita nuevos intentos cuando corresponda.'] },
    { title: 'Organiza a las personas', description: 'Administra las cuentas y los grupos para que cada alumno vea su contenido.', icon: ClipboardCheck, label: 'Acceso y seguimiento', items: ['Consulta Alumnos y Usuarios para administrar las cuentas.', 'Organiza Grupos y cohortes y asígnalos a las materias.', 'Revisa la inscripción de un alumno desde Alumnos y grupos dentro de la materia.'] },
    { title: 'Herramientas a mano', description: 'Completa la configuración y consulta esta guía cuando la necesites.', icon: BookOpen, label: 'Listo para administrar', items: ['Gestiona el material desde Biblioteca.', 'Revisa Configuración de IA para ajustar el asistente académico.', 'Usa Perfil y contraseña para actualizar tu cuenta y Tutorial para volver a esta guía.'] },
  ],
  maestro: [
    { title: 'Tu próxima clase empieza aquí', description: 'Prepara el contenido a tu ritmo. Esta guía te muestra cómo llevarlo al aula en pocos pasos.', icon: GraduationCap, label: 'Tu espacio docente', items: ['Elige una materia en Mis materias.', 'Pulsa Nueva clase para empezar.', 'Puedes editar tus clases después de publicarlas.'] },
    { title: 'Publica una clase en tres pasos', description: 'El asistente te acompaña desde el título hasta la publicación.', icon: FileUp, label: 'De tu archivo al aula', items: ['Información: escribe el título y una breve explicación.', 'Contenido: sube un PDF o PowerPoint, o pega enlaces de video.', 'Revisar: comprueba los datos y pulsa Publicar clase.'] },
    { title: 'Añade solo lo que necesites', description: 'Las lecturas y tareas son opcionales. Puedes empezar con un solo archivo y añadir más material después.', icon: ClipboardCheck, label: 'Acompaña el aprendizaje', items: ['En Material complementario puedes organizar archivos, enlaces y libros.', 'Activa la tarea e indica qué deben entregar tus estudiantes.', 'Revisa las entregas desde Tareas por calificar en el menú.'] },
    { title: 'Todo listo para enseñar', description: 'Comprueba quién tiene acceso a la materia y organiza tus próximas sesiones.', icon: CalendarDays, label: 'Tu aula, en orden', items: ['En Alumnos y grupos asigna los grupos que verán el contenido.', 'Usa Calendario para organizar las sesiones.', 'Abre Tutorial en la barra superior cuando necesites repasar.'] },
  ],
  estudiante: [
    { title: 'Bienvenido a tu aula', description: 'Aquí encuentras tus clases, materiales y actividades. Te mostramos dónde está lo que necesitas.', icon: GraduationCap, label: 'Tu recorrido de aprendizaje', items: ['En Mis materias aparecen las materias a las que tienes acceso.', 'Abre una materia para ver sus clases.', 'Si falta una materia, pide a tu profesor que revise tu inscripción.'] },
    { title: 'Abre tu primera clase', description: 'Cada clase reúne su explicación y los recursos para estudiar.', icon: Play, label: 'Aprende a tu ritmo', items: ['Selecciona una clase dentro de la materia.', 'Reproduce los videos o lee la presentación.', 'Consulta las lecturas y materiales complementarios debajo del contenido.'] },
    { title: 'Entrega y revisa tus actividades', description: 'Si una clase tiene tarea, encontrarás las instrucciones en esa misma pantalla.', icon: ClipboardCheck, label: 'Sigue tu avance', items: ['Lee las instrucciones antes de preparar tu entrega.', 'Adjunta tu trabajo y confirma el envío.', 'Consulta la revisión del profesor en Mis calificaciones.'] },
    { title: 'Ya sabes por dónde empezar', description: 'El menú del aula te acompaña durante tu programa.', icon: BookOpen, label: 'Siempre a mano', items: ['Consulta Calendario para ver las sesiones.', 'Explora Biblioteca y los materiales disponibles para tu cuenta.', 'Puedes volver a abrir este Tutorial desde la barra superior.'] },
  ],
};

export default function WelcomeTutorial({ role, userId }: { role: keyof typeof guides; userId: number }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const steps = guides[role];
  const current = steps[step];
  const Icon = current.icon;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/tutorial', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const progress = await response.json();
        if (controller.signal.aborted) return;
        if (progress.status === 'pendiente') {
          setStep(Math.max(0, Math.min(steps.length - 1, progress.step || 0)));
          setOpen(true);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, [role, userId, steps.length]);

  useEffect(() => { if (open) titleRef.current?.focus(); }, [open, step]);

  async function saveProgress(nextStep: number, status: 'pendiente' | 'completado' | 'omitido') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/tutorial', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep, status }),
      });
      if (!response.ok) throw new Error('No se pudo guardar tu avance. Inténtalo de nuevo.');
      setStep(nextStep);
      if (status !== 'pendiente') setOpen(false);
    } catch {
      setError('No se pudo guardar tu avance. Inténtalo de nuevo.');
      if (status === 'omitido') setOpen(false);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className={styles.helpButton} onClick={() => { setStep(0); setError(''); setOpen(true); }} aria-label="Abrir tutorial">
        <CircleHelp size={19} aria-hidden="true" /><span>Tutorial</span>
      </button>
      {open && (
        <CampusDialog titleId="tutorial-title" onClose={() => void saveProgress(step, 'omitido')} busy={busy}>
          <div className={styles.tourHeader}>
            <span className={styles.eyebrow}>Guía para {role === 'administrador' ? 'administradores' : role === 'maestro' ? 'profesores' : 'estudiantes'}</span>
            <button type="button" className={styles.iconButton} aria-label="Cerrar tutorial" disabled={busy} onClick={() => void saveProgress(step, 'omitido')}><X size={21} /></button>
          </div>
          <div className={styles.tourBody}>
            <div className={styles.tourIllustration} aria-hidden="true">
              <Icon size={38} strokeWidth={1.4} />
              <span>{current.label}</span>
              <div className={styles.tourPath}>{steps.map((_, index) => <span key={index} data-active={index <= step}>{index < step ? <Check size={15} /> : index + 1}</span>)}</div>
            </div>
            <div className={styles.tourContent}>
              <p className={styles.helper}>Paso {step + 1} de {steps.length} · Puedes omitir esta guía</p>
              <h2 id="tutorial-title" ref={titleRef} tabIndex={-1}>{current.title}</h2>
              <p>{current.description}</p>
              <ol className={styles.tourInstructions}>{current.items.map((item) => <li key={item}>{item}</li>)}</ol>
              {error && <p role="alert" className={styles.error}>{error}</p>}
            </div>
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.textButton} disabled={busy} onClick={() => void saveProgress(step, 'omitido')}>Omitir tutorial</button>
            <div className={styles.actions}>
              {step > 0 && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void saveProgress(step - 1, 'pendiente')}><ArrowLeft size={17} /> Atrás</button>}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveProgress(Math.min(step + 1, steps.length - 1), step === steps.length - 1 ? 'completado' : 'pendiente')}>
                {busy ? 'Guardando…' : step === steps.length - 1 ? 'Empezar' : 'Siguiente'}<ArrowRight size={17} />
              </button>
            </div>
          </div>
        </CampusDialog>
      )}
    </>
  );
}
