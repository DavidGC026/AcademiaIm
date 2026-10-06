import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attemptSnapshot, gradeExam } from '../src/lib/examGrading';
import type { ExamQuestion } from '../src/lib/examTypes';

const questions: ExamQuestion[] = [
  { id: 1, pregunta: 'Primera', tipo: 'opcion_multiple', opciones: [
    { id: 11, pregunta_id: 1, texto: 'Uno', es_correcta: 0 }, { id: 12, pregunta_id: 1, texto: 'Dos', es_correcta: 1 },
  ] },
  { id: 2, pregunta: 'Segunda', tipo: 'opcion_multiple', opciones: [
    { id: 21, pregunta_id: 2, texto: 'Verdadero', es_correcta: 1 }, { id: 22, pregunta_id: 2, texto: 'Falso', es_correcta: 0 },
  ] },
];

test('califica respuestas completas, parciales y en blanco sin superar 100', () => {
  assert.equal(gradeExam(questions, { 1: 12, 2: 21 }).calificacion, 100);
  assert.equal(gradeExam(questions, { 1: 12 }).calificacion, 50);
  assert.equal(gradeExam(questions, { 1: 11, 2: 22 }).calificacion, 0);
  assert.equal(gradeExam(questions, {}).calificacion, 0);
});

test('rechaza preguntas ajenas, opciones de otra pregunta e IDs duplicados disfrazados', () => {
  for (const answers of [{ 3: 12 }, { 1: 21 }, { 1: 999 }, { 1: 12, '01': 12 }, { '1x': 12 }, { 1: '12' }, null, []]) {
    assert.throws(() => gradeExam(questions, answers));
  }
});

test('no califica un examen sin preguntas o con una clave ambigua', () => {
  assert.throws(() => gradeExam([], {}));
  assert.throws(() => gradeExam([{ ...questions[0], opciones: questions[0].opciones.map(option => ({ ...option, es_correcta: 1 })) }], {}));
});

test('conserva las notas cero y las fechas; distingue intentos antiguos sin respuestas guardadas', () => {
  const fecha = new Date('2026-10-06T20:00:00Z');
  assert.deepEqual(attemptSnapshot({ calificacion: '0.00', finalizado_at: fecha, respuestas: null }), { calificacion: 0, fecha: fecha.toISOString(), respuestas: null });
  assert.deepEqual(attemptSnapshot({ calificacion: '50.00', finalizado_at: fecha, respuestas: '{"1":12}' })?.respuestas, { 1: 12 });
});
