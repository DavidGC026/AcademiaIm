import * as xlsx from 'xlsx';

export interface ImportedExamQuestion {
  pregunta: string;
  opciones: { texto: string; esCorrecta: boolean }[];
}

export class ExamImportError extends Error {}

function cellText(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Verdadero' : 'Falso';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeHeader(value: unknown): string {
  return cellText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sheetRows(sheet: xlsx.WorkSheet) {
  return xlsx.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: null, blankrows: true, range: 0,
  }).map((cells, index) => ({ cells, row: index + 1 }))
    .filter(({ cells }) => cells.some(value => cellText(value) !== ''));
}

function questionId(value: unknown, location: string): number {
  const text = cellText(value);
  const id = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(id) || id < 1) {
    throw new ExamImportError(`${location}: el número de pregunta debe ser un entero mayor que cero.`);
  }
  return id;
}

function validateQuestion(question: ImportedExamQuestion, location: string) {
  if (!question.pregunta) throw new ExamImportError(`${location}: falta el texto de la pregunta.`);
  if (question.opciones.length < 2) {
    throw new ExamImportError(`${location}: se requieren al menos dos opciones.`);
  }
  if (question.opciones.filter(option => option.esCorrecta).length !== 1) {
    throw new ExamImportError(`${location}: debe haber exactamente una respuesta correcta.`);
  }
}

function parseRelatedSheets(questionsSheet: xlsx.WorkSheet, answersSheet: xlsx.WorkSheet): ImportedExamQuestion[] {
  const questions = new Map<number, { question: ImportedExamQuestion; row: number }>();
  for (const { cells, row } of sheetRows(questionsSheet)) {
    const location = `PREGUNTAS, fila ${row}`;
    const id = questionId(cells[0], location);
    if (questions.has(id)) throw new ExamImportError(`${location}: el número de pregunta ${id} está repetido.`);
    const pregunta = cellText(cells[1]);
    if (!pregunta) throw new ExamImportError(`${location}: falta el texto de la pregunta ${id}.`);
    questions.set(id, { question: { pregunta, opciones: [] }, row });
  }

  for (const { cells, row } of sheetRows(answersSheet)) {
    const location = `RESPUESTAS, fila ${row}`;
    const id = questionId(cells[0], location);
    const entry = questions.get(id);
    if (!entry) throw new ExamImportError(`${location}: la pregunta ${id} no existe en PREGUNTAS.`);
    const texto = cellText(cells[1]);
    if (!texto) throw new ExamImportError(`${location}: falta el texto de la opción de la pregunta ${id}.`);
    const flag = cells[2];
    const marker = typeof flag === 'boolean' ? Number(flag) : cellText(flag);
    if (![0, 1, '0', '1'].includes(marker)) {
      throw new ExamImportError(`${location}: indica 1 para la respuesta correcta y 0 para las demás.`);
    }
    entry.question.opciones.push({ texto, esCorrecta: Number(marker) === 1 });
  }

  for (const [id, { question, row }] of questions) {
    validateQuestion(question, `PREGUNTAS, fila ${row} (pregunta ${id})`);
  }
  return Array.from(questions.values(), ({ question }) => question);
}

function parseClassicSheet(sheet: xlsx.WorkSheet, name: string): ImportedExamQuestion[] {
  const [header, ...rows] = sheetRows(sheet);
  if (!header) return [];
  const headers = header.cells.map(normalizeHeader);
  const column = (name: string) => headers.indexOf(name);
  if (['PREGUNTA', 'OPCIONA', 'OPCIONB', 'RESPUESTACORRECTA'].some(name => column(name) === -1)) {
    throw new ExamImportError('Usa las hojas PREGUNTAS y RESPUESTAS sin encabezados, o la plantilla clásica con Pregunta, Opcion_A, Opcion_B y Respuesta_Correcta.');
  }

  return rows.map(({ cells, row }) => {
    const location = `${name}, fila ${row}`;
    const letters = ['A', 'B', 'C', 'D'];
    const options = letters.map(letter => cellText(cells[column(`OPCION${letter}`)]));
    if (!options[0] || !options[1]) throw new ExamImportError(`${location}: completa las opciones A y B.`);
    const key = cellText(cells[column('RESPUESTACORRECTA')]).toUpperCase();
    if (!key) throw new ExamImportError(`${location}: falta Respuesta_Correcta.`);
    const keyIndex = /^[A-D]$/.test(key) ? letters.indexOf(key) : /^[1-4]$/.test(key) ? Number(key) - 1 : -1;
    const question: ImportedExamQuestion = {
      pregunta: cellText(cells[column('PREGUNTA')]),
      opciones: options.flatMap((texto, index) => texto ? [{
        texto,
        esCorrecta: keyIndex >= 0 ? index === keyIndex : texto.toUpperCase() === key,
      }] : []),
    };
    validateQuestion(question, location);
    return question;
  });
}

export function parseExamWorkbook(bytes: Uint8Array): ImportedExamQuestion[] {
  let workbook: xlsx.WorkBook;
  try {
    workbook = xlsx.read(bytes, { type: 'array' });
  } catch {
    throw new ExamImportError('No se pudo leer el archivo Excel. Guarda el libro como .xlsx o .xls y vuelve a intentarlo.');
  }
  const findSheet = (name: string) => workbook.SheetNames.find(sheet => normalizeHeader(sheet) === name);
  const questionsName = findSheet('PREGUNTAS');
  const answersName = findSheet('RESPUESTAS');
  let questions: ImportedExamQuestion[];
  if (questionsName && answersName) {
    questions = parseRelatedSheets(workbook.Sheets[questionsName], workbook.Sheets[answersName]);
  } else if (questionsName || answersName) {
    throw new ExamImportError('El formato de dos hojas necesita PREGUNTAS (número, pregunta) y RESPUESTAS (número, opción, 1 o 0), ambas sin encabezados.');
  } else if (workbook.SheetNames[0]) {
    questions = parseClassicSheet(workbook.Sheets[workbook.SheetNames[0]], workbook.SheetNames[0]);
  } else {
    questions = [];
  }
  if (!questions.length) throw new ExamImportError('El archivo Excel no contiene preguntas.');
  return questions;
}
