import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { generarPortadaPdf, nombrePortada } from '../src/lib/pdfPortada';
import { MAX_RESOURCE_SIZE_BYTES, RESOURCE_EXTENSIONS, validateResourceFile } from '../src/lib/resourceFiles';
import { cloneSecciones, parseSecciones, serializeSecciones } from '../src/lib/claseSecciones';

const execFileAsync = promisify(execFile);

test('los recursos aceptan documentos, imágenes y CSV con un límite de 25 MB', () => {
  for (const extension of RESOURCE_EXTENSIONS) {
    assert.equal(validateResourceFile({ name: `Lectura.${extension.toUpperCase()}`, size: MAX_RESOURCE_SIZE_BYTES }), null);
  }
  assert.match(validateResourceFile({ name: 'lectura.pdf', size: MAX_RESOURCE_SIZE_BYTES + 1 })!, /25 MB/);
  for (const size of [0, -1, NaN, Infinity]) {
    assert.ok(validateResourceFile({ name: 'lectura.pdf', size }));
  }
});

test('rechaza archivos ejecutables y extensiones alteradas antes de guardarlos', () => {
  for (const name of ['pagina.html', 'imagen.svg', 'script.js', 'atajo.desktop', 'file.pdf!', 'documento', 'video.mp4']) {
    assert.match(validateResourceFile({ name, size: 100 })!, /Tipo de archivo no permitido/, name);
  }
});

test('el guardado y la copia de secciones conservan las portadas y la regla de descarga', () => {
  const sections = parseSecciones([{
    id: 'original', nombre: 'Documentos', color: '#0073a5', orden: 0, permite_descarga: false,
    items: [{ tipo: 'archivo', nombre: 'Lectura', url: '/uploads/lectura.pdf', portada: '/uploads/lectura-portada.jpg' }],
  }]);
  assert.deepEqual(parseSecciones(JSON.stringify(serializeSecciones(sections))), sections);
  assert.deepEqual(cloneSecciones(sections)[0].items, sections[0].items);
  assert.equal(cloneSecciones(sections)[0].permite_descarga, false);
});

test('las portadas se nombran junto al PDF y rechazan rutas ajenas a uploads', async () => {
  assert.equal(nombrePortada('recurso-abc.PDF'), 'recurso-abc-portada.jpg');
  assert.equal(await generarPortadaPdf('../privado.pdf'), null);
  assert.equal(await generarPortadaPdf('/tmp/privado.pdf'), null);
  assert.equal(await generarPortadaPdf('imagen.svg'), null);
});

function onePagePdf(): string {
  const content = 'BT /F1 20 Tf 20 100 Td (Documento de prueba) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  return `${pdf}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test('el script genera un JPEG de la primera página y rechaza contenido que no es PDF', async (context) => {
  try {
    await execFileAsync('pdftoppm', ['-v']);
  } catch {
    context.skip('La prueba de render requiere Poppler (pdftoppm).');
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'campus-media-'));
  try {
    const source = join(directory, 'documento.pdf');
    const cover = join(directory, 'documento.jpg');
    const script = join(process.cwd(), 'scripts', 'pdf_portada.py');
    await writeFile(source, onePagePdf());
    const result = await execFileAsync('python3', [script, source, cover, '--ancho', '480']);
    assert.equal(JSON.parse(result.stdout).ok, true);
    const jpeg = await readFile(cover);
    assert.deepEqual(jpeg.subarray(0, 2), Buffer.from([0xff, 0xd8]));
    assert.ok(jpeg.length > 100);
    await writeFile(source, 'Esto no es un PDF');
    await assert.rejects(execFileAsync('python3', [script, source, cover]), (error: unknown) => {
      const result = error as { stdout: string };
      assert.match(JSON.parse(result.stdout).error, /no es un PDF/);
      return true;
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
