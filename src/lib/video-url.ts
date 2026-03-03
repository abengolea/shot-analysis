const DEFAULT_STORAGE_BUCKET = "shotanalisys.firebasestorage.app";

const getStorageBucket = () =>
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;

const fixUndefinedBucket = (url: string) => {
  if (!url.includes("storage.googleapis.com/undefined/")) return url;
  return url.replace(
    "storage.googleapis.com/undefined/",
    `storage.googleapis.com/${getStorageBucket()}/`
  );
};

const gsToHttps = (gsUrl: string) => {
  const withoutScheme = gsUrl.replace(/^gs:\/\//, "");
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) {
    return `https://storage.googleapis.com/${withoutScheme}`;
  }
  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);
  return `https://storage.googleapis.com/${bucket}/${objectPath}`;
};

export const normalizeVideoUrl = (src?: string | null): string | null => {
  if (!src) return null;
  if (src.startsWith("temp://")) {
    const name = src.replace("temp://", "");
    return `/api/local-video?name=${encodeURIComponent(name)}`;
  }
  const fixed = fixUndefinedBucket(src);
  if (fixed.includes("token=")) {
    return fixed;
  }
  if (fixed.startsWith("gs://")) {
    return `/api/video-proxy?src=${encodeURIComponent(fixed)}`;
  }
  if (fixed.includes("storage.googleapis.com/")) {
    // Si es un URL público de GCS, no usar proxy (evita fallos en staging sin credenciales)
    return fixed;
  }
  if (fixed.includes("firebasestorage.googleapis.com/")) {
    return `/api/video-proxy?src=${encodeURIComponent(fixed)}`;
  }
  return fixed;
};

/** Obtiene la URL del video principal de un análisis (prioridad: frontal, principal, lateral izq, lateral der, trasera). */
export function getAnalysisVideoUrl(analysis: {
  videoFrontUrl?: string | null;
  videoUrl?: string | null;
  videoLeftUrl?: string | null;
  videoRightUrl?: string | null;
  videoBackUrl?: string | null;
} | null | undefined): string | undefined {
  if (!analysis) return undefined;
  const rawUrl =
    analysis.videoFrontUrl ||
    analysis.videoUrl ||
    analysis.videoLeftUrl ||
    analysis.videoRightUrl ||
    analysis.videoBackUrl;
  return rawUrl ? (normalizeVideoUrl(String(rawUrl)) ?? undefined) : undefined;
}

/** Devuelve la etiqueta del ángulo de cámara para que el entrenador pueda comparar videos del mismo ángulo. */
export function getAnalysisVideoAngleLabel(analysis: {
  videoFrontUrl?: string | null;
  videoUrl?: string | null;
  videoLeftUrl?: string | null;
  videoRightUrl?: string | null;
  videoBackUrl?: string | null;
} | null | undefined): string {
  if (!analysis) return "Sin especificar";
  if (analysis.videoFrontUrl) return "De frente";
  if (analysis.videoUrl) return "Principal";
  if (analysis.videoLeftUrl) return "Lateral izquierdo";
  if (analysis.videoRightUrl) return "Lateral derecho";
  if (analysis.videoBackUrl) return "De detrás";
  return "Sin especificar";
}
