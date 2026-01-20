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
  if (src.startsWith("gs://")) {
    return gsToHttps(src);
  }
  return fixUndefinedBucket(src);
};
