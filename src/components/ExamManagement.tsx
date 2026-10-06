'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react';
import type { ExamDetails, ExamQuestion, ExamStudentResult } from '@/lib/examTypes';
import styles from './ExamManagement.module.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function Questions({ questions, answers }: { questions: ExamQuestion[]; answers?: Record<number, number> | null }) {
  return <ol className={styles.questions}>
    {questions.map((question, index) => <li key={question.id} className={styles.question}>
      <h3><span className={styles.number}>{index + 1}</span>{question.pregunta}</h3>
      {answers && !answers[question.id] && <p className={styles.muted}>El alumno dejó esta pregunta sin responder.</p>}
      <ul className={styles.options}>
        {question.opciones.map(option => <li key={option.id} className={option.es_correcta ? styles.correct : undefined}>
          <span>{option.texto}</span>
          <span className={styles.optionLabels}>
            {option.es_correcta ? <span><CheckCircle size={14} aria-hidden="true" /> Correcta</span> : null}
            {answers?.[question.id] === option.id && <strong>Respuesta del alumno</strong>}
          </span>
        </li>)}
      </ul>
    </li>)}
  </ol>;
}

export default function ExamManagement({ examId, role }: { examId: string; role: 'maestro' | 'administrador' }) {
  const [exam, setExam] = useState<ExamDetails | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [students, setStudents] = useState<ExamStudentResult[]>([]);
  const [tab, setTab] = useState<'preguntas' | 'resultados'>('preguntas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [busyStudent, setBusyStudent] = useState<number | null>(null);
  const [review, setReview] = useState<{ studentId: number; attempt: number } | null>(null);
  const [reload, setReload] = useState(0);
  const reviewRef = useRef<HTMLElement>(null);
  const base = role === 'administrador' ? '/admin' : '/maestro';

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const responses = await Promise.all([
          fetch(`/api/examenes/${examId}`, { signal: controller.signal }),
          fetch(`/api/examenes/${examId}/resultados`, { signal: controller.signal }),
        ]);
        const [detail, results] = await Promise.all(responses.map(response => response.json()));
        if (!responses[0].ok || !responses[1].ok) throw new Error(detail.error || results.error || 'No se pudo cargar el examen.');
        setExam(detail.exam);
        setQuestions(detail.preguntas);
        setStudents(results.alumnos);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudo cargar el examen.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [examId, reload]);

  useEffect(() => {
    if (review?.studentId) reviewRef.current?.focus();
  }, [review?.studentId]);

  const enableAttempt = async (student: ExamStudentResult) => {
    if (!confirm(`¿Habilitar un nuevo intento para ${student.nombre}? Su calificación anterior se conservará en el historial.`)) return;
    setBusyStudent(student.alumno_id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/examenes/${examId}/rehabilitar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumno_id: student.alumno_id, numero_intento: student.historial.length + 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo habilitar el intento.');
      setStudents(current => current.map(row => row.alumno_id === student.alumno_id ? { ...row, permite_reintento: true } : row));
      setNotice(`Nuevo intento habilitado para ${student.nombre}. El alumno puede volver a abrir el examen.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo habilitar el intento.');
    } finally {
      setBusyStudent(null);
    }
  };

  const visibleStudents = students.filter(student => `${student.nombre} ${student.email}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  const selected = students.find(student => student.alumno_id === review?.studentId);
  const attempts = selected?.intento ? [...selected.historial, selected.intento] : [];
  const selectedAttempt = review ? attempts[review.attempt] : null;

  return <div className={styles.page}>
    <Link href={exam ? `${base}/materias/${exam.curso_id}/examenes` : `${base}/materias`} className={styles.back}>
      <ArrowLeft size={16} aria-hidden="true" /> Volver a exámenes de la materia
    </Link>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" onClick={() => setReload(value => value + 1)}>Actualizar</button></div>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {loading ? <p role="status" className={styles.empty}>Cargando examen y resultados...</p> : exam && <>
      <header className={styles.header}>
        <p className={styles.course}>{exam.curso_nombre}</p>
        <h1>{exam.titulo}</h1>
        {exam.descripcion && <p>{exam.descripcion}</p>}
        <div className={styles.meta}><span>{questions.length} preguntas</span><span>{exam.limite_tiempo > 0 ? `${exam.limite_tiempo} minutos` : 'Sin límite de tiempo'}</span></div>
      </header>
      <div className={styles.tabs} role="group" aria-label="Vista del examen">
        <button type="button" aria-pressed={tab === 'preguntas'} onClick={() => setTab('preguntas')}>Preguntas y respuestas</button>
        <button type="button" aria-pressed={tab === 'resultados'} onClick={() => setTab('resultados')}>Resultados por alumno ({students.length})</button>
      </div>
      {tab === 'preguntas' ? <section aria-label="Preguntas y respuestas">
        <h2 className={styles.srOnly}>Preguntas y respuestas</h2>
        <p className={styles.muted}>Vista del maestro. La respuesta correcta aparece marcada en cada pregunta.</p>
        {questions.length ? <Questions questions={questions} /> : <p className={styles.empty}>Este examen todavía no tiene preguntas.</p>}
      </section> : <section aria-label="Resultados por alumno">
        <div className={styles.toolbar}>
          <div><label htmlFor="exam-student-search">Buscar alumno</label><input id="exam-student-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o correo" /></div>
          <button type="button" className="btn btn-secondary" disabled={busyStudent !== null} onClick={() => { setNotice(''); setReload(value => value + 1); }}><RotateCcw size={16} aria-hidden="true" /> Actualizar resultados</button>
        </div>
        <p className={styles.muted}>La última calificación permanece vigente hasta que el alumno entregue el nuevo intento. Los resultados anteriores se conservan.</p>
        {!visibleStudents.length ? <p className={styles.empty}>{students.length ? 'No hay alumnos que coincidan con la búsqueda.' : 'Todavía no hay alumnos inscritos ni resultados en esta materia.'}</p> : <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Resultados y nuevos intentos del examen</caption>
            <thead><tr><th scope="col">Alumno</th><th scope="col">Última calificación</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
            <tbody>{visibleStudents.map(student => <tr key={student.alumno_id}>
              <th scope="row"><strong>{student.nombre}</strong><small>{student.email}</small>{!student.inscrito && <small>Sin acceso actual a la materia</small>}</th>
              <td data-label="Última calificación">{student.intento ? <><strong>{student.intento.calificacion}/100</strong><small>Intento {student.historial.length + 1} · {formatDate(student.intento.fecha)}</small></> : '—'}</td>
              <td data-label="Estado"><span className={student.permite_reintento ? styles.pending : styles.status}>{student.permite_reintento ? 'Nuevo intento habilitado' : student.intento ? 'Entregado' : 'Sin presentar'}</span></td>
              <td><div className={styles.actions}>
                {student.intento && <button type="button" className="btn btn-secondary" onClick={() => setReview({ studentId: student.alumno_id, attempt: student.historial.length })}>Ver respuestas e historial</button>}
                {student.intento && student.inscrito && !student.permite_reintento && <button type="button" className="btn btn-primary" disabled={busyStudent !== null} onClick={() => void enableAttempt(student)}>{busyStudent === student.alumno_id ? 'Habilitando...' : 'Habilitar nuevo intento'}</button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
        {selected && selectedAttempt && <section ref={reviewRef} tabIndex={-1} className={styles.review} aria-label={`Respuestas de ${selected.nombre}`}>
          <div className={styles.reviewHeader}>
            <h2>Respuestas de {selected.nombre}</h2>
            <button type="button" className="btn btn-secondary" onClick={() => setReview(null)}>Cerrar revisión</button>
          </div>
          <label htmlFor="exam-attempt">Intento a consultar</label>
          <select id="exam-attempt" value={review!.attempt} onChange={event => setReview({ studentId: selected.alumno_id, attempt: Number(event.target.value) })}>
            {attempts.map((attempt, index) => <option key={index} value={index}>Intento {index + 1} · {attempt.calificacion}/100 · {formatDate(attempt.fecha)}</option>)}
          </select>
          {selectedAttempt.respuestas === null && <p className={styles.notice}>Este intento conserva su calificación, pero no tiene respuestas guardadas.</p>}
          <Questions questions={questions} answers={selectedAttempt.respuestas} />
        </section>}
      </section>}
    </>}
  </div>;
}
