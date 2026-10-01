import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { parseReferencias } from '@/lib/referencias';
import { normalizeTareaRecursos, parseTareaRecursos } from '@/lib/tareaRecursos';
import { parseSecciones, serializeSecciones } from '@/lib/claseSecciones';

function mapClaseRow(c: Record<string, unknown>) {
  const tarea_recursos = parseTareaRecursos(
    c.tarea_recursos,
    c.tarea_recurso_nombre as string | null,
    c.tarea_recurso_url as string | null
  );
  return {
    ...c,
    materiales: typeof c.materiales === 'string' ? JSON.parse(c.materiales as string) : c.materiales || [],
    videos: typeof c.videos === 'string' ? JSON.parse(c.videos as string) : c.videos || [],
    referencias: parseReferencias(c.referencias),
    secciones: parseSecciones(c.secciones),
    tarea_recursos,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursoId = searchParams.get('curso_id');

    if (!cursoId) {
      return NextResponse.json({ error: 'Falta curso_id' }, { status: 400 });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM clases WHERE curso_id = ? ORDER BY orden ASC, created_at ASC`,
      [cursoId]
    ) as any[];

    const classes = rows.map((c: any) => mapClaseRow(c));

    return NextResponse.json({ classes });
  } catch (error: unknown) {
    console.error('Error al obtener clases:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { curso_id, titulo, descripcion, video_url, videos, clase_en_vivo_url, materiales, requiere_tarea, orden, tarea_descripcion, tarea_recursos, referencias, secciones, presentacion_url, presentacion_nombre, contenido_central } =
      await request.json();

    if (!curso_id || !titulo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const materialesJson = '[]';
    const referenciasJson = '[]';
    const seccionesJson = JSON.stringify(serializeSecciones(parseSecciones(secciones)));

    const { videosList, primaryVideoUrl, presUrl, presNombre } = resolveContenidoCentral(
      contenido_central,
      videos,
      video_url,
      presentacion_url,
      presentacion_nombre
    );
    const videosJson = JSON.stringify(videosList);

    const recursosList = requiere_tarea ? normalizeTareaRecursos(tarea_recursos) : [];
    const tareaRecursosJson = JSON.stringify(recursosList);
    const firstRecurso = recursosList[0];

    const [result] = await pool.execute(
      `INSERT INTO clases (curso_id, titulo, descripcion, video_url, videos, clase_en_vivo_url, materiales, requiere_tarea, tarea_descripcion, tarea_recurso_nombre, tarea_recurso_url, tarea_recursos, referencias, secciones, presentacion_url, presentacion_nombre, orden) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        curso_id,
        titulo,
        descripcion || '',
        primaryVideoUrl,
        videosJson,
        clase_en_vivo_url || null,
        materialesJson,
        requiere_tarea ? 1 : 0,
        requiere_tarea ? (tarea_descripcion || null) : null,
        requiere_tarea ? (firstRecurso?.archivo_nombre || null) : null,
        requiere_tarea ? (firstRecurso?.archivo_url || null) : null,
        requiere_tarea ? tareaRecursosJson : null,
        referenciasJson,
        seccionesJson,
        presUrl,
        presNombre,
        orden || 0,
      ]
    ) as any[];

    return NextResponse.json({
      success: true,
      class: {
        id: result.insertId,
        curso_id,
        titulo,
        descripcion,
        video_url: primaryVideoUrl,
        videos: videosList,
        clase_en_vivo_url: clase_en_vivo_url || null,
        materiales: [],
        requiere_tarea: requiere_tarea ? 1 : 0,
        tarea_descripcion: requiere_tarea ? (tarea_descripcion || null) : null,
        tarea_recursos: recursosList,
        referencias: [],
        secciones: parseSecciones(secciones),
        presentacion_url: presUrl,
        presentacion_nombre: presNombre,
        orden,
      },
    });
  } catch (error: unknown) {
    console.error('Error al crear clase:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

function normalizeVideos(videos: unknown, video_url?: string) {
  const videosList: { titulo: string; url: string }[] = Array.isArray(videos)
    ? videos
        .filter((v: { url?: string }) => v && typeof v.url === 'string' && v.url.trim())
        .map((v: { titulo?: string; url: string }) => ({ titulo: (v.titulo || '').trim(), url: v.url.trim() }))
    : [];
  if (videosList.length === 0 && video_url) {
    videosList.push({ titulo: '', url: String(video_url).trim() });
  }
  return videosList;
}

function resolveContenidoCentral(
  contenido_central: string | undefined,
  videos: unknown,
  video_url?: string,
  presentacion_url?: string | null,
  presentacion_nombre?: string | null
) {
  if (contenido_central === 'presentacion') {
    return {
      videosList: [] as { titulo: string; url: string }[],
      primaryVideoUrl: null as string | null,
      presUrl: presentacion_url?.trim() || null,
      presNombre: presentacion_nombre?.trim() || null,
    };
  }
  const videosList = normalizeVideos(videos, video_url);
  return {
    videosList,
    primaryVideoUrl: videosList[0]?.url || null,
    presUrl: null as string | null,
    presNombre: null as string | null,
  };
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, titulo, descripcion, video_url, videos, requiere_tarea, orden, tarea_descripcion, tarea_recursos, secciones, presentacion_url, presentacion_nombre, contenido_central } =
      await request.json();

    if (!id || !titulo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const [existing] = (await pool.execute(
      `SELECT c.id, cur.creado_por_id FROM clases c
       JOIN cursos cur ON c.curso_id = cur.id WHERE c.id = ?`,
      [id]
    )) as any[];

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
    }

    if (session.roleName === 'maestro' && existing[0].creado_por_id !== session.userId) {
      return NextResponse.json({ error: 'No tienes permiso para editar esta clase' }, { status: 403 });
    }

    const { videosList, primaryVideoUrl, presUrl, presNombre } = resolveContenidoCentral(
      contenido_central,
      videos,
      video_url,
      presentacion_url,
      presentacion_nombre
    );
    const videosJson = JSON.stringify(videosList);
    const materialesJson = '[]';
    const referenciasJson = '[]';
    const seccionesJson = JSON.stringify(serializeSecciones(parseSecciones(secciones)));
    const recursosList = requiere_tarea ? normalizeTareaRecursos(tarea_recursos) : [];
    const tareaRecursosJson = JSON.stringify(recursosList);
    const firstRecurso = recursosList[0];

    await pool.execute(
      `UPDATE clases SET titulo = ?, descripcion = ?, video_url = ?, videos = ?, materiales = ?, requiere_tarea = ?, tarea_descripcion = ?, tarea_recurso_nombre = ?, tarea_recurso_url = ?, tarea_recursos = ?, referencias = ?, secciones = ?, presentacion_url = ?, presentacion_nombre = ?, orden = ?
       WHERE id = ?`,
      [
        titulo,
        descripcion || '',
        primaryVideoUrl,
        videosJson,
        materialesJson,
        requiere_tarea ? 1 : 0,
        requiere_tarea ? (tarea_descripcion || null) : null,
        requiere_tarea ? (firstRecurso?.archivo_nombre || null) : null,
        requiere_tarea ? (firstRecurso?.archivo_url || null) : null,
        requiere_tarea ? tareaRecursosJson : null,
        referenciasJson,
        seccionesJson,
        presUrl,
        presNombre,
        orden ?? 0,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      class: {
        id,
        titulo,
        descripcion,
        video_url: primaryVideoUrl,
        videos: videosList,
        materiales: [],
        requiere_tarea: requiere_tarea ? 1 : 0,
        tarea_descripcion: requiere_tarea ? (tarea_descripcion || null) : null,
        tarea_recursos: recursosList,
        referencias: [],
        secciones: parseSecciones(secciones),
        presentacion_url: presUrl,
        presentacion_nombre: presNombre,
        orden,
      },
    });
  } catch (error: unknown) {
    console.error('Error al actualizar clase:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el id de la clase' }, { status: 400 });
    }

    await pool.execute('DELETE FROM clases WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al eliminar clase:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
