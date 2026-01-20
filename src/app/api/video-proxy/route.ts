import { adminStorage } from "@/lib/firebase-admin";

const parseStorageLocation = (raw: string) => {
  if (raw.startsWith("gs://")) {
    const withoutScheme = raw.slice(5);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex === -1) return null;
    return {
      bucket: withoutScheme.slice(0, slashIndex),
      objectPath: withoutScheme.slice(slashIndex + 1),
    };
  }

  if (raw.startsWith("https://storage.googleapis.com/")) {
    const withoutBase = raw.replace("https://storage.googleapis.com/", "");
    const slashIndex = withoutBase.indexOf("/");
    if (slashIndex === -1) return null;
    return {
      bucket: withoutBase.slice(0, slashIndex),
      objectPath: withoutBase.slice(slashIndex + 1),
    };
  }

  if (raw.startsWith("https://firebasestorage.googleapis.com/")) {
    const url = new URL(raw);
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return null;
    return {
      bucket: match[1],
      objectPath: decodeURIComponent(match[2]),
    };
  }

  return null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const src = searchParams.get("src");
    if (!src) {
      return new Response("Missing src", { status: 400 });
    }

    const decoded = decodeURIComponent(src);

    if (decoded.includes("token=")) {
      return Response.redirect(decoded, 307);
    }

    const location = parseStorageLocation(decoded);
    if (!location) {
      return new Response("Unsupported video src", { status: 400 });
    }

    if (!adminStorage) {
      return new Response("Storage not configured", { status: 500 });
    }

    const file = adminStorage.bucket(location.bucket).file(location.objectPath);
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });

    return Response.redirect(signedUrl, 307);
  } catch (error) {
    console.error("Video proxy error:", error);
    return new Response("Failed to create signed URL", { status: 500 });
  }
}
