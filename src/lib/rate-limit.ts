/**
 * Rate limiter in-memory por clave (ej. IP o uid).
 * Uso: rutas de debug y email/test para evitar abuso incluso con auth admin.
 */

const windowMs = 60 * 1000; // 1 minuto
const maxPerWindow = 30; // máx 30 requests por minuto por clave

const hits = new Map<string, { count: number; resetAt: number }>();

function getKey(identifier: string): string {
  return identifier;
}

function cleanup(key: string): void {
  const entry = hits.get(key);
  if (entry && Date.now() > entry.resetAt) {
    hits.delete(key);
  }
}

/**
 * Devuelve true si la request está dentro del límite; false si debe rechazarse (429).
 */
export function checkRateLimit(identifier: string): boolean {
  const key = getKey(identifier);
  cleanup(key);
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxPerWindow;
}
