import assert from 'node:assert/strict';
import { test } from 'node:test';
import { examAvailability, parseExamRelease } from '../src/lib/examRelease';

test('los exámenes manuales solo se abren cuando el maestro los habilita', () => {
  assert.equal(examAvailability({ modo_liberacion: 'bloqueado', clase_requisito_id: null }, { titulo: 'Final', entregada: true }).disponible, false);
  assert.equal(examAvailability({ modo_liberacion: 'abierto', clase_requisito_id: null }, null).disponible, true);
});

test('la tarea elegida habilita el examen por entrega, sin exigir calificación', () => {
  const config = { modo_liberacion: 'tarea_entregada', clase_requisito_id: 5 } as const;
  assert.equal(examAvailability(config, { titulo: 'Final', entregada: false }).disponible, false);
  assert.equal(examAvailability(config, { titulo: 'Final', entregada: true }).disponible, true);
  assert.match(examAvailability(config, { titulo: 'Final', entregada: false }).motivo_bloqueo!, /Final/);
});

test('una tarea eliminada, ajena o desactivada no abre el examen', () => {
  assert.equal(examAvailability({ modo_liberacion: 'tarea_entregada', clase_requisito_id: 5 }, null).disponible, false);
  assert.equal(examAvailability({ modo_liberacion: 'tarea_entregada', clase_requisito_id: null }, { titulo: 'Final', entregada: true }).disponible, false);
});

test('valida modos e identificadores y limpia el requisito al volver a liberación manual', () => {
  for (const value of [null, [], {}, { modo_liberacion: ['abierto'] }, { modo_liberacion: 'invalido' }, ...[null, 0, -1, 1.5, '5'].map(id => ({ modo_liberacion: 'tarea_entregada', clase_requisito_id: id }))]) {
    assert.equal(parseExamRelease(value), null);
  }
  assert.deepEqual(parseExamRelease({ modo_liberacion: 'tarea_entregada', clase_requisito_id: 5 }), { modo_liberacion: 'tarea_entregada', clase_requisito_id: 5 });
  assert.deepEqual(parseExamRelease({ modo_liberacion: 'abierto', clase_requisito_id: 5 }), { modo_liberacion: 'abierto', clase_requisito_id: null });
});
