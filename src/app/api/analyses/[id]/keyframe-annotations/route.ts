import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';

// Configurar límite de body size para esta ruta
export const runtime = 'nodejs';
export const maxDuration = 30;

type KeyframeAnnotation = {
  id?: string;
  analysisId: string;
  keyframeUrl: string;
  angle?: 'front' | 'back' | 'left' | 'right';
  index?: number;
  overlayUrl: string; // URL en storage (png con transparencia)
  coachId: string;
  coachName?: string;
  createdAt: string;
};

async function verifyCoachPermission(req: NextRequest, analysisId: string): Promise<{ ok: boolean; uid?: string; name?: string; reason?: string }> {
  try {
    if (!adminDb || !adminAuth) return { ok: false, reason: 'Admin SDK not ready' };
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false, reason: 'No token' };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    let name = (decoded as any)?.name || undefined;

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) return { ok: false, reason: 'Analysis not found' };
    const analysis = analysisSnap.data() as any;
    const playerId = analysis?.playerId;
    if (!playerId) return { ok: false, reason: 'Player missing' };

    const playerSnap = await adminDb.collection('players').doc(playerId).get();
    const player = playerSnap.exists ? (playerSnap.data() as any) : null;
    const assignedCoachId = player?.coachId || null;

    if (assignedCoachId && assignedCoachId === uid) {
      // Si name no está disponible en el token, obtenerlo de la colección coaches
      if (!name) {
        try {
          const coachSnap = await adminDb.collection('coaches').doc(uid).get();
          if (coachSnap.exists) {
            const coachData = coachSnap.data() as any;
            name = coachData?.name || undefined;
          }
        } catch (e) {
          console.error('Error obteniendo nombre del coach:', e);
        }
      }
      return { ok: true, uid, name };
    }
    return { ok: false, reason: 'Forbidden' };
  } catch (e) {
    console.error('verifyCoachPermission error', e);
    return { ok: false, reason: 'Auth error' };
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    const { id: analysisId } = await params;
    const { searchParams } = new URL(request.url);
    const keyframeUrl = searchParams.get('keyframeUrl');

    const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeAnnotations');
    let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (keyframeUrl) q = q.where('keyframeUrl', '==', keyframeUrl);
    const snap = await q.get();
    const items: KeyframeAnnotation[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ annotations: items });
  } catch (e) {
    console.error('❌ Error listando anotaciones:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function listAnnotations(analysisId: string, keyframeUrl?: string) {
  if (!adminDb) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
  
  const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeAnnotations');
  let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  if (keyframeUrl) {
    q = q.where('keyframeUrl', '==', keyframeUrl);
  }
  const snap = await q.get();
  const items: KeyframeAnnotation[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ annotations: items });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: analysisId } = await params;
    
    // Leer body con manejo de errores mejorado
    let body: any;
    try {
      body = await request.json();
    } catch (jsonError: any) {
      console.error('❌ Error parseando JSON:', jsonError);
      return NextResponse.json({ error: 'Body inválido o demasiado grande' }, { status: 400 });
    }
    
    // Si action es 'list', manejar como petición de listado (sin autenticación requerida)
    if (body?.action === 'list') {
      const keyframeUrl = String(body?.keyframeUrl || '');
      return await listAnnotations(analysisId, keyframeUrl || undefined);
    }
    
    // Si no, manejar como creación de anotación (requiere autenticación)
    if (!adminDb || !adminAuth || !adminStorage) {
      console.error('❌ Admin SDK no inicializado');
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }

    const perm = await verifyCoachPermission(request, analysisId);
    if (!perm.ok || !perm.uid) {
      console.error('❌ No autorizado:', perm.reason);
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const keyframeUrl = String(body?.keyframeUrl || '');
    const angle = body?.angle as KeyframeAnnotation['angle'] | undefined;
    const index = typeof body?.index === 'number' ? Number(body.index) : undefined;
    const overlayDataUrl = String(body?.overlayDataUrl || ''); // data:image/png;base64,....
    
    console.log('📝 Guardando anotación:', {
      analysisId,
      hasKeyframeUrl: !!keyframeUrl,
      keyframeUrlLength: keyframeUrl.length,
      hasOverlayDataUrl: !!overlayDataUrl,
      overlayDataUrlLength: overlayDataUrl.length,
      overlayDataUrlStart: overlayDataUrl.substring(0, 30),
      angle,
      index
    });
    
    if (!keyframeUrl || !overlayDataUrl.startsWith('data:image/png;base64,')) {
      console.error('❌ Validación fallida:', {
        hasKeyframeUrl: !!keyframeUrl,
        overlayDataUrlStart: overlayDataUrl.substring(0, 50)
      });
      return NextResponse.json({ error: 'keyframeUrl y overlay PNG base64 requeridos' }, { status: 400 });
    }

    // Guardar overlay en Storage
    try {
      const base64 = overlayDataUrl.split(',')[1];
      if (!base64) {
        throw new Error('No se pudo extraer base64 del data URL');
      }
      const buffer = Buffer.from(base64, 'base64');
      const bucket = adminStorage.bucket();
      const fileName = `overlay_${Date.now()}.png`;
      const storagePath = `keyframe-overlays/${perm.uid}/${analysisId}/${fileName}`;
      const fileRef = bucket.file(storagePath);
      await fileRef.save(buffer, { metadata: { contentType: 'image/png' } });
      await fileRef.makePublic();
      const overlayUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      const payload: any = {
        analysisId,
        keyframeUrl,
        overlayUrl,
        coachId: perm.uid,
        createdAt: new Date().toISOString(),
      };
      
      // Solo agregar campos opcionales si tienen valor (Firestore no acepta undefined)
      if (angle) payload.angle = angle;
      if (typeof index === 'number') payload.index = index;
      if (perm.name) payload.coachName = perm.name;
      
      const ref = await adminDb.collection('analyses').doc(analysisId).collection('keyframeAnnotations').add(payload);
      console.log('✅ Anotación guardada exitosamente:', ref.id);
      return NextResponse.json({ success: true, id: ref.id, overlayUrl });
    } catch (storageError: any) {
      console.error('❌ Error guardando en Storage:', storageError);
      return NextResponse.json({ error: `Error guardando imagen: ${storageError.message}` }, { status: 500 });
    }
  } catch (e: any) {
    console.error('❌ Error en POST keyframe-annotations:', e);
    return NextResponse.json({ error: `Error interno: ${e?.message || 'Desconocido'}` }, { status: 500 });
  }
}

