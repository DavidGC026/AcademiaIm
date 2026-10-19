import assert from 'node:assert/strict';
import test from 'node:test';
import { classDraftKey, restoreClassDraft, serializeClassDraft, type ClassDraftContent } from '../src/lib/classDraft';

const scope = { campus: '/Academia', userId: 21, courseId: 7, classId: 3 };
const content: ClassDraftContent = {
  step: 1, title: 'Clase pendiente', description: 'Trabajo en curso', contentType: 'materiales',
  presentation: { ref: 'clase/abc.pdf', name: 'presentacion.pdf' },
  videos: [{ titulo: 'Repaso', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
  sections: [{ id: 'sec-1', nombre: 'Lecturas', color: '#0073A5', orden: 0, permite_descarga: false, items: [
    { tipo: 'archivo', nombre: 'Guía', url: '/uploads/guia.pdf', archivo_nombre: 'guia.pdf', portada: '/uploads/portada.jpg' },
    { tipo: 'video', titulo: 'Ensayo', url: '/uploads/ensayo.mp4', archivo_nombre: 'ensayo.mp4' },
    { tipo: 'enlace', titulo: 'Sitio', url: 'https://imcyc.com' },
    { tipo: 'biblioteca', libro_id: 2 },
  ] }], requiresHomework: true, homework: 'Entrega el análisis', resources: [{ archivo_url: '/uploads/tarea.docx', archivo_nombre: 'tarea.docx', titulo: 'Plantilla' }],
};
const now = 1_800_000_000_000;

test('el borrador conserva campos y recursos sin publicar', () => {
  const serialized = serializeClassDraft(scope, 'version-original', content, now);
  assert.deepEqual(restoreClassDraft(serialized, scope, 'version-original', now + 1000), content);
  assert.equal(restoreClassDraft(serialized, scope, 'otra-version', now + 1000), null);
});

test('la clave y el contenido impiden restaurar otra cuenta, campus, clase o materia', () => {
  const serialized = serializeClassDraft(scope, 'original', content, now);
  for (const other of [{ ...scope, userId: 22 }, { ...scope, campus: '/ruadiplo' }, { ...scope, courseId: 8 }, { ...scope, classId: 4 }, { ...scope, classId: null }]) {
    assert.notEqual(classDraftKey(scope), classDraftKey(other));
    assert.equal(restoreClassDraft(serialized, other, 'original', now + 1000), null);
  }
  assert.throws(() => classDraftKey({ ...scope, userId: 0 }));
});

test('se rechazan datos corruptos, versiones desconocidas y borradores vencidos', () => {
  const serialized = serializeClassDraft(scope, 'original', content, now);
  assert.equal(restoreClassDraft('{', scope, 'original', now), null);
  assert.equal(restoreClassDraft(serialized, scope, 'original', now + 8 * 24 * 60 * 60 * 1000), null);
  assert.equal(restoreClassDraft(serialized, scope, 'original', now - 1), null);
  assert.equal(restoreClassDraft(JSON.stringify({ ...JSON.parse(serialized), version: 2 }), scope, 'original', now), null);
  assert.equal(restoreClassDraft(JSON.stringify({ ...JSON.parse(serialized), content: { ...content, step: 8 } }), scope, 'original', now), null);
});

test('la serialización ignora archivos, blobs y campos ajenos al editor', () => {
  const extra = { ...content, session: 'secret-session', apiKey: 'secret-key', selectedFile: new Blob(['private']), presentation: { ...content.presentation, file: new Blob(['private']) }, sections: content.sections.map(section => ({ ...section, authToken: 'secret-token' })) };
  const serialized = serializeClassDraft(scope, 'original', extra, now);
  assert.deepEqual(restoreClassDraft(serialized, scope, 'original', now), content);
  for (const value of ['secret-session', 'secret-key', 'secret-token', 'selectedFile', 'private']) assert.ok(!serialized.includes(value));
  assert.throws(() => serializeClassDraft(scope, 'original', { ...content, title: 'x'.repeat(2_000_001) }, now));
});
