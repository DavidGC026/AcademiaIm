import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { librosComprados } from '@/lib/bibliotecaAcceso';
import { crearCargo, isOpenpayConfigured, openpayStatusToEstado } from '@/lib/openpay';

export const runtime = 'nodejs';

// Devuelve los IDs de libros pagados y las compras pendientes del usuario.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const comprados = await librosComprados(session.userId);
  const [pendientes] = (await pool.execute(
    `SELECT libro_id, openpay_charge_id, metodo, estado FROM compras_libros
     WHERE usuario_id = ? AND estado = 'pendiente'`,
    [session.userId]
  )) as any[];

  return NextResponse.json({ comprados, pendientes });
}

// Crea un cargo en Openpay para comprar un libro y registra la compra.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    if (!isOpenpayConfigured()) {
      return NextResponse.json(
        { error: 'El pago en línea aún no está disponible. Usa el enlace de la tienda.' },
        { status: 503 }
      );
    }

    const { libro_id, metodo, source_id, device_session_id } = await request.json();
    if (!libro_id || (metodo !== 'card' && metodo !== 'spei')) {
      return NextResponse.json({ error: 'Datos de compra inválidos' }, { status: 400 });
    }

    const [libros] = (await pool.execute(
      `SELECT id, titulo, precio FROM biblioteca_libros WHERE id = ?`,
      [libro_id]
    )) as any[];
    const libro = libros[0];
    if (!libro) return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });

    // ¿Ya lo compró?
    const yaComprados = await librosComprados(session.userId);
    if (yaComprados.includes(Number(libro_id))) {
      return NextResponse.json({ error: 'Ya tienes acceso a este libro', comprado: true }, { status: 400 });
    }

    const charge = await crearCargo({
      amount: Number(libro.precio),
      description: `IMCYC · ${libro.titulo}`,
      customer: { name: session.nombre, email: session.email },
      metodo,
      sourceId: source_id,
      deviceSessionId: device_session_id,
    });

    const estado = openpayStatusToEstado(charge.status);

    await pool.execute(
      `INSERT INTO compras_libros (usuario_id, libro_id, openpay_charge_id, monto, metodo, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.userId, libro_id, charge.id, Number(libro.precio), metodo, estado]
    );

    return NextResponse.json({
      success: true,
      estado,
      comprado: estado === 'pagado',
      charge_id: charge.id,
      // Para SPEI: instrucciones de pago (CLABE/banco) que mostramos al alumno.
      payment_method: charge.payment_method || null,
    });
  } catch (error: any) {
    console.error('Error al procesar compra:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el pago' }, { status: 500 });
  }
}
