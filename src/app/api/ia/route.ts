import { NextResponse } from 'next/server';
import { askAI } from '@/lib/ai-service';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

const MAX_MESSAGE_LENGTH = 1_500;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'estudiante') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usageLimit = rateLimit(`academic-assistant:${session.userId}`, 15, 60_000);
    if (!usageLimit.allowed) {
      return NextResponse.json(
        { error: 'Has enviado varias preguntas seguidas. Espera un momento antes de continuar.' },
        {
          status: 429,
          headers: { 'Retry-After': String(usageLimit.retryAfterSeconds) },
        }
      );
    }

    const { message, history, currentClassId } = await request.json();
    const normalizedMessage = typeof message === 'string' ? message.trim() : '';

    if (!normalizedMessage) {
      return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });
    }
    if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `El mensaje no puede exceder ${MAX_MESSAGE_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    const parsedClassId = Number.parseInt(String(currentClassId || ''), 10);

    const answer = await askAI({
      userId: session.userId,
      userMessage: normalizedMessage,
      history: Array.isArray(history) ? history : [],
      currentClassId: Number.isFinite(parsedClassId) && parsedClassId > 0 ? parsedClassId : null,
    });

    return NextResponse.json(answer);
  } catch (error: unknown) {
    console.error('Error en API de Chatbot:', error);
    return NextResponse.json(
      { error: 'El asistente no pudo procesar la pregunta en este momento.' },
      { status: 500 }
    );
  }
}
