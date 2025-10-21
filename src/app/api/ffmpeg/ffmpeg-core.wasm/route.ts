import type { NextRequest } from 'next/server';

export const dynamic = 'force-static';

export async function GET(_req: NextRequest) {
  const upstream = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm';
  const res = await fetch(upstream, { cache: 'no-store' });
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': 'application/wasm',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}

