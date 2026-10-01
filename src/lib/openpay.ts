// Cliente mínimo para la API REST de Openpay (sin SDK, solo fetch).
// Las credenciales se leen de variables de entorno; mientras no estén
// configuradas, isOpenpayConfigured() devuelve false y la UI hace fallback
// al enlace de la tienda externa.
//
// Variables esperadas (servidor):
//   OPENPAY_MERCHANT_ID, OPENPAY_PRIVATE_KEY, OPENPAY_PRODUCTION ("true"/"false")
// Variables públicas (cliente, para tokenizar tarjeta con openpay.js):
//   NEXT_PUBLIC_OPENPAY_MERCHANT_ID, NEXT_PUBLIC_OPENPAY_PUBLIC_KEY, NEXT_PUBLIC_OPENPAY_PRODUCTION

export interface OpenpayConfig {
  merchantId: string;
  privateKey: string;
  production: boolean;
}

export type EstadoCompra = 'pendiente' | 'pagado' | 'fallido' | 'reembolsado';

// ---- Helpers puros (testeables sin red ni env) ----

export function openpayBaseUrl(merchantId: string, production: boolean): string {
  const host = production ? 'https://api.openpay.mx' : 'https://sandbox-api.openpay.mx';
  return `${host}/v1/${merchantId}`;
}

export function openpayAuthHeader(privateKey: string): string {
  // Basic auth: usuario = private key, password vacío.
  return 'Basic ' + Buffer.from(`${privateKey}:`).toString('base64');
}

/** Mapea el status de un cargo de Openpay al estado interno de la compra. */
export function openpayStatusToEstado(status: string | undefined): EstadoCompra {
  switch (status) {
    case 'completed':
      return 'pagado';
    case 'refunded':
    case 'chargeback_accepted':
      return 'reembolsado';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'fallido';
    default:
      // in_progress, charge_pending, etc. siguen pendientes (típico de SPEI/efectivo)
      return 'pendiente';
  }
}

// ---- Configuración ----

export function getOpenpayConfig(): OpenpayConfig | null {
  const merchantId = process.env.OPENPAY_MERCHANT_ID;
  const privateKey = process.env.OPENPAY_PRIVATE_KEY;
  if (!merchantId || !privateKey) return null;
  return {
    merchantId,
    privateKey,
    production: process.env.OPENPAY_PRODUCTION === 'true',
  };
}

export function isOpenpayConfigured(): boolean {
  return getOpenpayConfig() !== null;
}

// ---- Llamadas a la API ----

interface OpenpayCharge {
  id: string;
  status: string;
  amount: number;
  payment_method?: {
    type?: string;
    clabe?: string;
    bank?: string;
    name?: string;
    reference?: string;
    barcode_url?: string;
    agreement?: string;
    due_date?: string;
  };
  [k: string]: unknown;
}

async function openpayRequest(path: string, method: string, body?: unknown): Promise<OpenpayCharge> {
  const cfg = getOpenpayConfig();
  if (!cfg) throw new Error('Openpay no está configurado');

  const res = await fetch(`${openpayBaseUrl(cfg.merchantId, cfg.production)}${path}`, {
    method,
    headers: {
      Authorization: openpayAuthHeader(cfg.privateKey),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.description || data.error_code)) || `Error Openpay (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : `Error Openpay (${res.status})`);
  }
  return data as OpenpayCharge;
}

export interface CrearCargoParams {
  amount: number;
  description: string;
  customer: { name: string; email: string };
  metodo: 'card' | 'spei';
  sourceId?: string; // token de tarjeta (openpay.js)
  deviceSessionId?: string;
}

export async function crearCargo(params: CrearCargoParams): Promise<OpenpayCharge> {
  if (params.metodo === 'card') {
    if (!params.sourceId) throw new Error('Falta el token de la tarjeta');
    return openpayRequest('/charges', 'POST', {
      method: 'card',
      source_id: params.sourceId,
      amount: params.amount,
      currency: 'MXN',
      description: params.description,
      device_session_id: params.deviceSessionId,
      customer: params.customer,
    });
  }
  // SPEI / transferencia: Openpay genera una CLABE de pago.
  return openpayRequest('/charges', 'POST', {
    method: 'bank_account',
    amount: params.amount,
    currency: 'MXN',
    description: params.description,
    customer: params.customer,
  });
}

export async function obtenerCargo(chargeId: string): Promise<OpenpayCharge> {
  return openpayRequest(`/charges/${chargeId}`, 'GET');
}
