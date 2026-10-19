/**
 * Limitador de intentos en memoria (ventana deslizante simple).
 * Suficiente para un solo proceso (PM2 fork). Si se escala a varios
 * procesos/servidores, migrar a Redis o similar.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Limpieza periódica para no acumular claves viejas.
let lastCleanup = Date.now();
function maybeCleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Registra un intento para `key` y devuelve si está permitido.
 * @param key identificador (p. ej. `login:${ip}:${email}`)
 * @param limit número máximo de intentos por ventana
 * @param windowMs duración de la ventana en milisegundos
 */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 };
}

/** Reinicia el contador de una clave (p. ej. tras un login exitoso). */
export function resetRateLimit(key: string) {
  store.delete(key);
}
