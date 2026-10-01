import { NextResponse } from 'next/server';
import { isOpenpayConfigured } from '@/lib/openpay';

// Config pública para el cliente (tokenización con openpay.js). No expone llaves privadas.
export async function GET() {
  return NextResponse.json({
    enabled: isOpenpayConfigured(),
    merchantId: process.env.NEXT_PUBLIC_OPENPAY_MERCHANT_ID || '',
    publicKey: process.env.NEXT_PUBLIC_OPENPAY_PUBLIC_KEY || '',
    production: process.env.NEXT_PUBLIC_OPENPAY_PRODUCTION === 'true',
  });
}
