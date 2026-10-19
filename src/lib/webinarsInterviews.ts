import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import catalog from '../data/webinars-interviews.json';
import { getYoutubeEmbedUrl } from './videoEmbed';

export interface LibraryInterview {
  titulo: string;
  experto: string;
  cargo: string;
  video_url: string;
  duracion: string;
  descripcion: string;
}

export const webinarsInterviews: readonly LibraryInterview[] = catalog.interviews.map((interview) => {
  const embed = getYoutubeEmbedUrl(interview.video_url);
  if (!embed) throw new Error(`Video de Webinars no válido: ${interview.source_id}`);
  return {
    titulo: interview.titulo,
    experto: interview.experto,
    cargo: interview.cargo,
    video_url: embed.replace('www.youtube.com', 'www.youtube-nocookie.com'),
    duracion: interview.duracion,
    descripcion: interview.descripcion,
  };
});

const placeholderInterviews = new Map([
  ['F429Z5dF_vU', 'La Evolución del Concreto Sustentable en América Latina'],
  ['2_HjZkC6H7I', 'Patología y Durabilidad de Estructuras de Concreto'],
]);
// Identifica el marcador anterior para retirarlo; no forma parte del catálogo.
const rejectedVideoId = 'dQw4w9WgXcQ';

function videoId(url: string): string | null {
  const embed = getYoutubeEmbedUrl(url);
  return embed ? new URL(embed).pathname.split('/').pop() || null : null;
}

export function isPlaceholderInterview(interview: Pick<LibraryInterview, 'titulo' | 'video_url'>): boolean {
  const id = videoId(interview.video_url);
  return Boolean(id && (id === rejectedVideoId || placeholderInterviews.get(id) === interview.titulo));
}

/** El llamador mantiene una transacción; conserva entrevistas agregadas por administración. */
export async function syncWebinarsInterviews(
  connection: Pick<PoolConnection, 'execute'>,
  interviews: readonly LibraryInterview[] = webinarsInterviews,
) {
  const ids = interviews.map((interview) => videoId(interview.video_url));
  if (!interviews.length || ids.some((id) => !id || id === rejectedVideoId) || new Set(ids).size !== ids.length) {
    throw new Error('El catálogo debe contener videos válidos, únicos y reales.');
  }
  const [rows] = await connection.execute<(RowDataPacket & { id: number; titulo: string; video_url: string })[]>(
    'SELECT id, titulo, video_url FROM biblioteca_entrevistas ORDER BY id FOR UPDATE',
  );
  const placeholders = rows.filter(isPlaceholderInterview);
  for (const interview of placeholders) {
    await connection.execute('DELETE FROM biblioteca_entrevistas WHERE id = ?', [interview.id]);
  }
  const removedIds = new Set(placeholders.map((interview) => interview.id));
  const existingVideos = new Set(rows.filter((row) => !removedIds.has(row.id)).map((row) => videoId(row.video_url)));
  let added = 0;
  for (const interview of interviews) {
    const id = videoId(interview.video_url);
    if (existingVideos.has(id)) continue;
    await connection.execute(
      'INSERT INTO biblioteca_entrevistas (titulo, experto, cargo, video_url, duracion, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
      [interview.titulo, interview.experto, interview.cargo, interview.video_url, interview.duracion, interview.descripcion],
    );
    existingVideos.add(id);
    added += 1;
  }
  return { removed: placeholders.length, added, alreadyPresent: interviews.length - added };
}
