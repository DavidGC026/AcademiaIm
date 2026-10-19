import assert from 'node:assert/strict';
import test from 'node:test';
import { createActiveAttempt, readActiveAttempt, remainingSeconds, submissionExpired } from '../src/lib/examAttemptState';
import { normalizePreguntasMostrar, parsePreguntasIds, pickRandomIds, validatePreguntasMostrar } from '../src/lib/examenPreguntas';
import { attemptSnapshot, gradeExam } from '../src/lib/examGrading';
import type { ExamQuestion } from '../src/lib/examTypes';

const bank: ExamQuestion[] = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, pregunta: `Pregunta ${index + 1}`, tipo: 'opcion_multiple', opciones: [{ id: 100 + index * 2, pregunta_id: index + 1, texto: 'Correcta', es_correcta: 1 }, { id: 101 + index * 2, pregunta_id: index + 1, texto: 'Incorrecta', es_correcta: 0 }] }));

test('selección única del banco, límites estrictos y compatibilidad con 0', () => {
  const ids = bank.map(question => question.id);
  for (let index = 0; index < 30; index++) {
    const selected = pickRandomIds(ids, 3);
    assert.equal(selected.length, 3); assert.equal(new Set(selected).size, 3);
    assert.ok(selected.every(id => ids.includes(id)));
  }
  assert.deepEqual(pickRandomIds(ids, 0), ids);
  assert.deepEqual(pickRandomIds(ids, 10), ids);
  assert.equal(normalizePreguntasMostrar(20, 10), 10);
  assert.equal(validatePreguntasMostrar(null, 10), 0);
  for (const invalid of [-1, 11, 1.5, '2x', Infinity]) assert.throws(() => validatePreguntasMostrar(invalid, 10));
  assert.deepEqual(parsePreguntasIds('[2,7]'), [2, 7]);
  for (const invalid of ['[2,2]', '["2"]', '[0]', 'broken']) assert.equal(parsePreguntasIds(invalid), null);
});

test('abrir/recargar conserva preguntas, claves y reloj; sólo se califica lo asignado', () => {
  const now = new Date('2026-10-19T16:00:00Z');
  const attempt = createActiveAttempt(bank, 3, 1, now);
  const reloaded = readActiveAttempt(JSON.stringify(attempt))!;
  assert.deepEqual(reloaded, attempt);
  assert.equal(remainingSeconds(reloaded, new Date(now.getTime() + 20_000)), 40);
  assert.equal(submissionExpired(reloaded, new Date(now.getTime() + 89_000)), false);
  assert.equal(submissionExpired(reloaded, new Date(now.getTime() + 91_000)), true);
  const correct = Object.fromEntries(attempt.preguntas.map(question => [question.id, question.opciones[0].id]));
  assert.equal(gradeExam(reloaded.preguntas, correct).calificacion, 100);
  const excluded = bank.find(question => !attempt.preguntas.some(selected => selected.id === question.id))!;
  assert.throws(() => gradeExam(reloaded.preguntas, { ...correct, [excluded.id]: excluded.opciones[0].id }));
  const before = JSON.stringify(reloaded);
  bank[0].pregunta = 'Banco editado';
  assert.equal(JSON.stringify(reloaded), before, 'El snapshot persistido no cambia cuando se edita el banco.');
});

test('RUA incompleto conserva IDs y fecha anterior con reloj nuevo sin penalización retroactiva', () => {
  const now = new Date('2026-10-19T16:00:00Z');
  const legacy = createActiveAttempt(bank, 1, 5, now, { preguntas_ids: '[3,8]', iniciado_at: '2026-01-01T12:00:00Z' });
  assert.deepEqual(legacy.preguntas.map(question => question.id), [3, 8]);
  assert.equal(legacy.iniciado_at, '2026-01-01T12:00:00.000Z');
  assert.equal(remainingSeconds(legacy, now), 300);
  assert.equal(submissionExpired(legacy, now), false);
  assert.throws(() => createActiveAttempt(bank, 1, 5, now, { preguntas_ids: '[999]', iniciado_at: now }));
});

test('snapshot histórico mantiene nota, fecha, respuestas y preguntas asignadas al abrir otro intento', () => {
  const completed = { calificacion: '75.00', finalizado_at: new Date('2026-10-18T12:00:00Z'), iniciado_at: new Date('2026-10-18T11:00:00Z'), respuestas: '{"3":104}', preguntas_ids: '[3]', preguntas_snapshot: JSON.stringify([bank[2]]) };
  const original = structuredClone(completed);
  const snapshot = attemptSnapshot(completed)!;
  const retry = createActiveAttempt(bank, 2, 10);
  assert.equal(retry.preguntas.length, 2);
  assert.deepEqual(completed, original);
  assert.equal(snapshot.calificacion, 75);
  assert.equal(snapshot.fecha, '2026-10-18T12:00:00.000Z');
  assert.deepEqual(snapshot.respuestas, { 3: 104 });
  assert.deepEqual(snapshot.preguntas_ids, [3]);
  assert.deepEqual(snapshot.preguntas, [bank[2]]);
});
