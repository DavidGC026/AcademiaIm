import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as xlsx from 'xlsx';
import { ExamImportError, parseExamWorkbook } from '../src/lib/examImport';

function workbook(sheets: Record<string, unknown[][]>, bookType: 'xlsx' | 'xls' = 'xlsx') {
  const book = xlsx.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(rows), name);
  }
  return xlsx.write(book, { type: 'buffer', bookType }) as Buffer;
}

function related(questions: unknown[][], answers: unknown[][]) {
  return workbook({ PREGUNTAS: questions, RESPUESTAS: answers });
}

const classicHeaders = ['Pregunta', 'Opcion_A', 'Opcion_B', 'Opcion_C', 'Opcion_D', 'Respuesta_Correcta'];

test('el archivo M1 original importa las 10 preguntas y 36 opciones con sus claves y orden', () => {
  const bytes = readFileSync(new URL('../docs/referencias/examenes/M1-EXA Cementos hidráulicos.xlsx', import.meta.url));
  const book = xlsx.read(bytes, { type: 'buffer' });
  assert.equal(book.Sheets.PREGUNTAS.A1.f, 'SEQUENCE(10)');
  const questions = parseExamWorkbook(bytes);
  assert.equal(questions.length, 10);
  assert.equal(questions.reduce((total, question) => total + question.opciones.length, 0), 36);
  assert.deepEqual(questions.map(question => question.opciones.findIndex(option => option.esCorrecta)), [0, 1, 2, 1, 3, 0, 1, 1, 1, 0]);
  assert.deepEqual(questions.slice(8).map(question => question.opciones.map(option => option.texto)), [
    ['Verdadero', 'Falso'], ['Verdadero', 'Falso'],
  ]);
  const questionRows = xlsx.utils.sheet_to_json<unknown[]>(book.Sheets.PREGUNTAS, { header: 1 });
  assert.deepEqual(questions.map(question => question.pregunta), questionRows.map(row => String(row[1]).trim()));
});

test('la plantilla clásica descargable sigue importando sus cuatro preguntas', () => {
  const questions = parseExamWorkbook(readFileSync(new URL('../public/plantilla_examen.xlsx', import.meta.url)));
  assert.equal(questions.length, 4);
  assert.deepEqual(questions.map(question => question.opciones.findIndex(option => option.esCorrecta)), [0, 2, 1, 2]);
});

test('relaciona por ID, conserva el orden y acepta filas vacías, booleanos y cero', () => {
  const questions = parseExamWorkbook(workbook({
    ' preguntas ': [[], [8, ' Primero '], [], ['02', 'Segundo']],
    respuestas: [[2, 0, '1'], [8, false, false], [], ['8', true, true], [2, 'Otro', '0']],
  }, 'xls'));
  assert.deepEqual(questions, [
    { pregunta: 'Primero', opciones: [{ texto: 'Falso', esCorrecta: false }, { texto: 'Verdadero', esCorrecta: true }] },
    { pregunta: 'Segundo', opciones: [{ texto: '0', esCorrecta: true }, { texto: 'Otro', esCorrecta: false }] },
  ]);
});

test('plantilla clásica: claves por letra, número o texto, y encabezados con acentos', () => {
  const questions = parseExamWorkbook(workbook({ Examen: [
    [' pregunta ', 'Opción A', 'opcionB', 'OPCION_C', 'OpcionD', 'RespuestaCorrecta'],
    ['Por letra', 'Uno', 'Dos', null, null, 'b'],
    ['Por índice', 'Uno', 'Dos', null, null, 2],
    ['Por texto', 'Cemento', 'Agua', null, null, ' cemento '],
    ['Booleanos', true, false, null, null, false],
    ['Cero', 0, 5, null, null, 0],
  ] }));
  assert.deepEqual(questions.map(question => question.opciones.findIndex(option => option.esCorrecta)), [1, 1, 0, 1, 0]);
  assert.equal(questions[3].opciones[1].texto, 'Falso');
});

test('rechaza hojas faltantes y formatos desconocidos con instrucciones concretas', () => {
  assert.throws(() => parseExamWorkbook(workbook({ PREGUNTAS: [[1, 'Pregunta']] })), /dos hojas.*RESPUESTAS/);
  assert.throws(() => parseExamWorkbook(workbook({ Otro: [['Sin formato']] })), /plantilla clásica/);
  assert.throws(() => parseExamWorkbook(related([], [])), /no contiene preguntas/);
});

test('rechaza IDs duplicados, inválidos y respuestas de preguntas inexistentes', () => {
  assert.throws(() => parseExamWorkbook(related([[1, 'Uno'], ['01', 'Otro']], [])), /PREGUNTAS, fila 2.*repetido/);
  for (const id of [0, -1, 1.5, '1x', true, null]) {
    assert.throws(() => parseExamWorkbook(related([[id, 'Uno']], [])), /entero mayor que cero/);
  }
  assert.throws(() => parseExamWorkbook(related([[1, 'Uno']], [[2, 'Otro', 1]])), /RESPUESTAS, fila 1.*no existe/);
});

test('rechaza textos o claves faltantes y señala la fila real después de filas vacías', () => {
  assert.throws(() => parseExamWorkbook(related([[], [], [1, ' ']], [])), /PREGUNTAS, fila 3.*falta el texto/);
  assert.throws(() => parseExamWorkbook(related([[1, 'Uno']], [[], [1, '', 0]])), /RESPUESTAS, fila 2.*falta el texto/);
  for (const flag of [null, '', 2, -1, 'sí']) {
    assert.throws(() => parseExamWorkbook(related([[1, 'Uno']], [[1, 'Respuesta', flag]])), /indica 1/);
  }
});

test('exige dos opciones y exactamente una correcta; nunca inventa la clave', () => {
  assert.throws(() => parseExamWorkbook(related([[1, 'Uno']], [[1, 'A', 1]])), /al menos dos opciones/);
  for (const flag of [0, 1]) {
    assert.throws(() => parseExamWorkbook(related([[1, 'Uno']], [[1, 'A', flag], [1, 'B', flag]])), /exactamente una/);
  }
  for (const key of ['Z', 'C', 'Sin coincidencia']) {
    assert.throws(() => parseExamWorkbook(workbook({ Examen: [classicHeaders, ['Uno', 'Agua', 'Cemento', null, null, key]] })), /exactamente una/);
  }
});

test('una fila incompleta al final invalida todo el examen clásico', () => {
  assert.throws(() => parseExamWorkbook(workbook({ Examen: [
    classicHeaders, ['Válida', 'Uno', 'Dos', null, null, 'A'], [], ['Incompleta', 'Uno'],
  ] })), (error: unknown) => error instanceof ExamImportError && /Examen, fila 4/.test(error.message));
});
