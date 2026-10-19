import type { ClaseSeccion } from './claseSecciones';

export interface ClassDraftContent {
  step: number;
  title: string;
  description: string;
  contentType: 'presentacion' | 'video' | 'materiales';
  presentation: { ref: string; name: string };
  videos: { titulo: string; url: string }[];
  sections: ClaseSeccion[];
  requiresHomework: boolean;
  homework: string;
  resources: { archivo_url: string; archivo_nombre: string; titulo?: string }[];
}

export interface ClassDraftScope { campus: string; userId: number; courseId: number; classId: number | null; }
const MAX_DRAFT_LENGTH = 2_000_000;
const DRAFT_LIFETIME = 7 * 24 * 60 * 60 * 1000;

export function classDraftKey(scope: ClassDraftScope): string {
  if (![scope.userId, scope.courseId, ...(scope.classId === null ? [] : [scope.classId])].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Identidad del borrador inválida');
  return `campus:class-draft:v1:${encodeURIComponent(scope.campus || '/Academia')}:${scope.userId}:${scope.courseId}:${scope.classId ?? 'new'}`;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Borrador inválido');
  return value as Record<string, unknown>;
}
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('Texto de borrador inválido'); return value; }
function list(value: unknown): unknown[] { if (!Array.isArray(value) || value.length > 1000) throw new Error('Lista de borrador inválida'); return value; }
function id(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('Referencia de borrador inválida'); return Number(value); }

/** Whitelist only published-resource references and form text; never persist File, Blob or extra properties. */
function draftContent(raw: unknown): ClassDraftContent {
  const value = object(raw);
  const presentation = object(value.presentation);
  if (!['presentacion', 'video', 'materiales'].includes(String(value.contentType)) || typeof value.requiresHomework !== 'boolean' || !Number.isInteger(value.step) || Number(value.step) < 0 || Number(value.step) > 2) throw new Error('Formulario de borrador inválido');
  return {
    step: Number(value.step), title: string(value.title), description: string(value.description), contentType: value.contentType as ClassDraftContent['contentType'],
    presentation: { ref: string(presentation.ref), name: string(presentation.name) },
    videos: list(value.videos).map(rawVideo => { const video = object(rawVideo); return { titulo: string(video.titulo), url: string(video.url) }; }),
    sections: list(value.sections).map(rawSection => {
      const section = object(rawSection);
      if (!Number.isFinite(section.orden) || (section.permite_descarga !== undefined && typeof section.permite_descarga !== 'boolean')) throw new Error('Sección inválida');
      return {
        id: string(section.id), nombre: string(section.nombre), color: string(section.color), orden: Number(section.orden),
        ...(section.permite_descarga === undefined ? {} : { permite_descarga: section.permite_descarga as boolean }),
        items: list(section.items).map(rawItem => {
          const item = object(rawItem);
          if (item.tipo === 'biblioteca') return { tipo: 'biblioteca' as const, libro_id: id(item.libro_id) };
          if (item.tipo === 'enlace') return { tipo: 'enlace' as const, titulo: string(item.titulo), url: string(item.url) };
          if (item.tipo === 'video') return { tipo: 'video' as const, titulo: string(item.titulo), url: string(item.url), ...(item.archivo_nombre === undefined ? {} : { archivo_nombre: string(item.archivo_nombre) }) };
          if (item.tipo === 'archivo') return { tipo: 'archivo' as const, nombre: string(item.nombre), url: string(item.url), ...(item.archivo_nombre === undefined ? {} : { archivo_nombre: string(item.archivo_nombre) }), ...(item.portada === undefined ? {} : { portada: string(item.portada) }) };
          throw new Error('Recurso inválido');
        }),
      };
    }),
    requiresHomework: value.requiresHomework, homework: string(value.homework),
    resources: list(value.resources).map(rawResource => { const resource = object(rawResource); return { archivo_url: string(resource.archivo_url), archivo_nombre: string(resource.archivo_nombre), ...(resource.titulo === undefined ? {} : { titulo: string(resource.titulo) }) }; }),
  };
}

export function serializeClassDraft(scope: ClassDraftScope, source: string, content: ClassDraftContent, now = Date.now()): string {
  const serialized = JSON.stringify({ version: 1, scope: classDraftKey(scope), source, savedAt: now, content: draftContent(content) });
  if (serialized.length > MAX_DRAFT_LENGTH) throw new Error('El borrador supera el espacio disponible');
  return serialized;
}

/** A draft belongs to one user, campus, class and exact source revision. */
export function restoreClassDraft(raw: string | null, scope: ClassDraftScope, source: string, now = Date.now()): ClassDraftContent | null {
  if (!raw || raw.length > MAX_DRAFT_LENGTH) return null;
  try {
    const draft = object(JSON.parse(raw));
    if (draft.version !== 1 || draft.scope !== classDraftKey(scope) || draft.source !== source || typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt) || draft.savedAt > now || now - draft.savedAt > DRAFT_LIFETIME) return null;
    return draftContent(draft.content);
  } catch { return null; }
}
