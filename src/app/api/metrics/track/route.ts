import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ ok: false });
    const body = await req.json();
    const { sessionId, type, path, durationMs, userId, ts, userAgent } = body || {};
    if (!sessionId || !type) return NextResponse.json({ ok: false });
    const doc = {
      sessionId: String(sessionId),
      type: String(type),
      path: path ? String(path) : null,
      durationMs: typeof durationMs === 'number' ? durationMs : null,
      userId: userId ? String(userId) : null,
      userAgent: userAgent ? String(userAgent) : null,
      ts: ts ? new Date(ts).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection('metrics_events').add(doc as any);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}


