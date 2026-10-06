import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cloneSecciones, parseSecciones, resolveSecciones, serializeSecciones, type ClaseSeccion } from '../src/lib/claseSecciones';
import { extractDriveFileId, getDriveProxyUrl, getYoutubeEmbedUrl, isSupportedVideoUrl, resolveVideoSource } from '../src/lib/videoEmbed';
import { MAX_VIDEO_SIZE_BYTES, validateVideoFile } from '../src/lib/videoFiles';
import { parseByteRange } from '../src/lib/httpRange';

test('YouTube: enlaces compartidos, móviles, Shorts, directos y tiempo inicial', () => {
  const id = 'M7lc1UVf-VE';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&list=demo`,
    `https://youtu.be/${id}?si=example`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) assert.equal(getYoutubeEmbedUrl(url), `https://www.youtube.com/embed/${id}`);
  assert.equal(getYoutubeEmbedUrl(`https://youtu.be/${id}?t=1m30s`), `https://www.youtube.com/embed/${id}?start=90`);
  assert.equal(getYoutubeEmbedUrl(`https://youtu.be/${id}?start=42`), `https://www.youtube.com/embed/${id}?start=42`);
});

test('rechaza esquemas peligrosos, dominios parecidos y enlaces que no son videos', () => {
  for (const url of [
    'javascript:alert(1)', 'data:video/mp4;base64,abc', 'file:///tmp/video.mp4',
    'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'https://youtube.com/watch?v=invalid', 'https://example.com/document.pdf',
    'https://drive.google.com.evil.test/file/d/1234567890/view',
    'https://drive.google.com/drive/folders/1234567890',
    'https://user:password@example.com/video.mp4',
  ]) assert.equal(isSupportedVideoUrl(url), false, url);
  assert.equal(isSupportedVideoUrl('https://cdn.example.com/video.MP4?signature=example'), true);
  assert.equal(isSupportedVideoUrl('/uploads/recurso.webm'), true);
});

test('Drive conserva el ID y resourcekey de enlaces compartidos', () => {
  const id = '1AbCdef0123456789_-';
  for (const url of [`https://drive.google.com/file/d/${id}/view`, `https://drive.google.com/open?id=${id}`, `https://drive.google.com/uc?id=${id}`]) {
    assert.equal(extractDriveFileId(url), id);
  }
  assert.deepEqual(resolveVideoSource(`https://drive.google.com/file/d/${id}/view?resourcekey=0-abc`), { type: 'drive', driveId: id, driveResourceKey: '0-abc' });
});

test('los videos subidos y el proxy de Drive respetan /Academia', () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = '/Academia';
  try {
    assert.equal(resolveVideoSource('/uploads/recurso.mp4').directUrl, '/Academia/api/uploads/file?ref=%2Fuploads%2Frecurso.mp4');
    assert.equal(getDriveProxyUrl('1234567890', '0-abc'), '/Academia/api/video/drive?id=1234567890&resourcekey=0-abc');
    assert.equal(resolveVideoSource('https://example.com/video.webm').directUrl, 'https://example.com/video.webm');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});

test('el guardado y la copia conservan videos junto a los recursos anteriores', () => {
  const sections: ClaseSeccion[] = [{
    id: 'seccion-original', nombre: 'Material', color: '#0073a5', orden: 0, permite_descarga: false,
    items: [
      { tipo: 'video', titulo: 'Demostración', url: '/uploads/recurso.mp4', archivo_nombre: 'Demo.mp4' },
      { tipo: 'video', titulo: 'YouTube', url: 'https://youtu.be/M7lc1UVf-VE' },
      { tipo: 'video', titulo: 'Drive', url: 'https://drive.google.com/file/d/1234567890/view' },
      { tipo: 'archivo', nombre: 'Lectura', url: '/uploads/lectura.pdf' },
      { tipo: 'biblioteca', libro_id: 1 },
      { tipo: 'enlace', titulo: 'Referencia', url: 'https://www.imcyc.com' },
    ],
  }];
  assert.deepEqual(parseSecciones(JSON.stringify(serializeSecciones(sections))), sections);
  const copy = cloneSecciones(sections);
  assert.notEqual(copy[0].id, sections[0].id);
  assert.deepEqual(copy[0].items, sections[0].items);
  assert.equal(copy[0].permite_descarga, false);
  copy[0].items.pop();
  assert.equal(sections[0].items.length, 6);
  assert.equal(resolveSecciones(null, [{ nombre: 'Anterior.pdf', url: '/uploads/anterior.pdf' }], null)[0].items[0].tipo, 'archivo');
  assert.equal(parseSecciones([{ ...sections[0], items: [{ tipo: 'video', url: 'javascript:alert(1)' }] }])[0].items.length, 0);
  assert.deepEqual(parseSecciones([{ ...sections[0], items: [{ tipo: 'video', titulo: { invalid: true }, url: ' /uploads/demo.mp4 ' }] }])[0].items, [
    { tipo: 'video', titulo: 'Video', url: '/uploads/demo.mp4' },
  ]);
});

test('valida formato, archivos vacíos y límite de 250 MB', () => {
  for (const name of ['video.mp4', 'video.WEBM', 'video.ogv']) assert.equal(validateVideoFile({ name, size: MAX_VIDEO_SIZE_BYTES }), null);
  assert.match(validateVideoFile({ name: 'video.mov', size: 100 })!, /MP4/);
  assert.match(validateVideoFile({ name: 'video.mp4', size: 0 })!, /vacío/);
  assert.match(validateVideoFile({ name: 'video.mp4', size: MAX_VIDEO_SIZE_BYTES + 1 })!, /250 MB/);
});

test('rangos de reproducción: completo, abierto, sufijo y fin truncado', () => {
  assert.equal(parseByteRange(null, 100), null);
  assert.deepEqual(parseByteRange('bytes=0-1', 100), { start: 0, end: 1 });
  assert.deepEqual(parseByteRange('bytes=40-', 100), { start: 40, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-20', 100), { start: 80, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-200', 100), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange('bytes=0-200', 100), { start: 0, end: 99 });
});

test('rangos inválidos o fuera del archivo producen 416', () => {
  for (const range of ['bytes=100-', 'bytes=9-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-5', 'items=0-1', 'bytes=9007199254740992-']) {
    assert.equal(parseByteRange(range, 100), 'invalid', range);
  }
  assert.equal(parseByteRange('bytes=0-', 0), 'invalid');
});
