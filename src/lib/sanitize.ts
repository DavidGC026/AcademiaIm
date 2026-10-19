/**
 * Utilidades para limpiar texto libre antes de guardarlo en base de datos.
 * No sustituye al escape de salida (React ya escapa), pero es defensa en
 * profundidad: recorta espacios, elimina caracteres de control y limita
 * la longitud para evitar abuso de almacenamiento.
 */

// Elimina caracteres de control, conservando tab, salto de línea y retorno.
// Se construye con new RegExp para mantener el fuente en ASCII puro.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

/**
 * Normaliza y recorta un texto. Devuelve string vacío si la entrada no es válida.
 * @param input valor de entrada (cualquier tipo)
 * @param maxLen longitud máxima permitida
 */
export function cleanText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(CONTROL_CHARS, '').trim().slice(0, maxLen);
}

/** Igual que cleanText pero devuelve null si queda vacío (para columnas NULL). */
export function cleanTextOrNull(input: unknown, maxLen: number): string | null {
  const value = cleanText(input, maxLen);
  return value === '' ? null : value;
}
