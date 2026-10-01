import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openpayStatusToEstado } from '@/lib/openpay';

export const runtime = 'nodejs';

// Webhook de Openpay: confirma pagos asíncronos (sobre todo SPEI/efectivo).
// ponytail: validación por token compartido en query (?token=) si OPENPAY_WEBHOOK_TOKEN
// está configurado; Openpay también permite basic-auth en la URL del webhook.
export async function POST(request: Request) {
  try {
    const expected = process.env.OPENPAY_WEBHOOK_TOKEN;
    if (expected) {
      const token = new URL(request.url).searchParams.get('token');
      if (token !== expected) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));

    // Openpay verifica la URL enviando un type=verification con verification_code.
    if (body?.type === 'verification') {
      return NextResponse.json({ verification_code: body.verification_code });
    }

    const tx = body?.transaction || {};
    const chargeId: string | undefined = tx.id;
    const estado = openpayStatusToEstado(tx.status);

    if (chargeId) {
      await pool.execute(
        `UPDATE compras_libros SET estado = ? WHERE openpay_charge_id = ?`,
        [estado, chargeId]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error en webhook Openpay:', error);
    // Respondemos 200 igualmente para que Openpay no reintente en bucle por errores nuestros.
    return NextResponse.json({ ok: false });
  }
}
