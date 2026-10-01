// Self-check de los helpers puros de Openpay. Ejecuta:
//   node --experimental-strip-types scripts/openpay-selfcheck.mjs
import assert from 'node:assert';
import { openpayBaseUrl, openpayAuthHeader, openpayStatusToEstado } from '../src/lib/openpay.ts';

// URL base: sandbox vs producción
assert.equal(openpayBaseUrl('m123', false), 'https://sandbox-api.openpay.mx/v1/m123');
assert.equal(openpayBaseUrl('m123', true), 'https://api.openpay.mx/v1/m123');

// Auth básica: usuario = private key, password vacío
assert.equal(openpayAuthHeader('sk_test'), 'Basic ' + Buffer.from('sk_test:').toString('base64'));

// Mapeo de estados
assert.equal(openpayStatusToEstado('completed'), 'pagado');
assert.equal(openpayStatusToEstado('in_progress'), 'pendiente');
assert.equal(openpayStatusToEstado('failed'), 'fallido');
assert.equal(openpayStatusToEstado('cancelled'), 'fallido');
assert.equal(openpayStatusToEstado('refunded'), 'reembolsado');
assert.equal(openpayStatusToEstado(undefined), 'pendiente');

console.log('openpay-selfcheck OK');
