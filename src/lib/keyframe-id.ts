import { createHash } from 'crypto';

/** Firestore limita a 1500 bytes los valores en where(). keyframeUrl suele ser muy largo (URLs firmadas, data URLs). */
const FIRESTORE_QUERY_STRING_LIMIT = 1500;

/**
 * Genera un ID corto (hash SHA-256) a partir de keyframeUrl.
 * Se usa para filtrar en Firestore cuando keyframeUrl supera el límite de 1500 bytes.
 */
export function keyframeIdFromUrl(url: string): string {
  if (!url) return '';
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

/** Indica si keyframeUrl es demasiado largo para usarse en un where() de Firestore. */
export function isKeyframeUrlTooLong(url: string): boolean {
  return url.length > FIRESTORE_QUERY_STRING_LIMIT;
}
