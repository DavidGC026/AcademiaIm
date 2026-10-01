import { NextResponse } from 'next/server';
import { askAI } from '@/lib/ai-service';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });
    }

    const reply = await askAI(message, history || []);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error en API de Chatbot:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar la pregunta' }, { status: 500 });
  }
}
