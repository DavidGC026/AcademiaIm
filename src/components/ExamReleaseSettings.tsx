'use client';

import { useState } from 'react';
import type { ExamDetails, ExamReleaseConfig, ExamReleaseMode } from '@/lib/examTypes';
import styles from './ExamManagement.module.css';

export default function ExamReleaseSettings({ exam, classes, onSaved }: {
  exam: ExamDetails;
  classes: { id: number; titulo: string }[];
  onSaved: (message: string) => void;
}) {
  const [mode, setMode] = useState<ExamReleaseMode>(exam.modo_liberacion);
  const [classId, setClassId] = useState(String(exam.clase_requisito_id || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(config: ExamReleaseConfig) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/examenes/${exam.id}/liberacion`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar la configuración.');
      onSaved(config.modo_liberacion === 'abierto' ? 'Examen habilitado para los alumnos.' : config.modo_liberacion === 'bloqueado'
        ? 'El examen esperará a que lo habilites al terminar la clase.' : 'El examen se habilitará a cada alumno cuando entregue la tarea final seleccionada.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  return <section className={styles.release} aria-labelledby="exam-release-title">
    <div className={styles.reviewHeader}>
      <h2 id="exam-release-title">Habilitar examen</h2>
      <span className={exam.modo_liberacion === 'abierto' ? styles.status : styles.pending}>
        {exam.modo_liberacion === 'abierto' ? 'Habilitado' : exam.modo_liberacion === 'tarea_entregada' ? 'Según entrega de tarea' : 'Bloqueado'}
      </span>
    </div>
    <p className={styles.muted}>Habilítalo al terminar la clase o elige una tarea final para que se abra automáticamente a cada alumno al entregarla. No necesita estar calificada.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void save({ modo_liberacion: mode, clase_requisito_id: mode === 'tarea_entregada' ? Number(classId) : null }); }}>
      <fieldset disabled={saving} className={styles.releaseFields}>
        <div>
          <label htmlFor="exam-release-mode">Cuándo habilitarlo</label>
          <select id="exam-release-mode" value={mode} onChange={event => setMode(event.target.value as ExamReleaseMode)}>
            <option value="bloqueado">Esperar a que el maestro lo habilite</option>
            <option value="abierto">Disponible para todos los alumnos</option>
            <option value="tarea_entregada">Al entregar la tarea final</option>
          </select>
        </div>
        {mode === 'tarea_entregada' && <div>
          <label htmlFor="exam-release-task">Clase con la tarea final</label>
          <select id="exam-release-task" required value={classId} onChange={event => setClassId(event.target.value)} aria-describedby="exam-release-task-help">
            <option value="">Selecciona una tarea</option>
            {classes.map(item => <option key={item.id} value={item.id}>{item.titulo}</option>)}
          </select>
          <p id="exam-release-task-help" className={styles.muted}>{classes.length ? 'Si el alumno ya entregó esta tarea, tendrá acceso de inmediato.' : 'Primero activa la entrega de tarea en una clase de esta materia.'}</p>
        </div>}
        <div className={styles.releaseActions}>
          {exam.modo_liberacion === 'bloqueado' && mode === 'bloqueado' ?
            <button type="button" className="btn btn-primary" onClick={() => void save({ modo_liberacion: 'abierto', clase_requisito_id: null })}>{saving ? 'Habilitando...' : 'Habilitar examen ahora'}</button> :
            <button type="submit" className="btn btn-primary" disabled={mode === 'tarea_entregada' && !classes.length}>{saving ? 'Guardando...' : 'Guardar disponibilidad'}</button>}
        </div>
      </fieldset>
    </form>
  </section>;
}
