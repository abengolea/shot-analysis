import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage, isFirebaseAdminAvailable } from '@/lib/firebase-admin';

type VideoType = 'main' | 'back' | 'front' | 'left' | 'right';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'No disponible en producción' }, { status: 404 });
    }

    const { id: analysisId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = (searchParams.get('type') || 'main') as VideoType;

    if (!analysisId) {
      return NextResponse.json({ error: 'ID de análisis requerido' }, { status: 400 });
    }

    if (!isFirebaseAdminAvailable() || !adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Firebase Admin no disponible' }, { status: 500 });
    }

    const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisDoc.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }

    const analysisData = analysisDoc.data() as any;
    const urlByType: Record<VideoType, string | null | undefined> = {
      main: analysisData?.videoUrl,
      back: analysisData?.videoBackUrl,
      front: analysisData?.videoFrontUrl,
      left: analysisData?.videoLeftUrl,
      right: analysisData?.videoRightUrl,
    };

    const tempUrl = urlByType[type];
    if (!tempUrl || !tempUrl.startsWith('temp://')) {
      return NextResponse.json({ error: 'No hay URL temp para este tipo' }, { status: 404 });
    }

    const name = tempUrl.replace('temp://', '');
    const safeName = path.basename(name);
    if (!safeName || safeName !== name || !safeName.endsWith('.mp4')) {
      return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 });
    }

    const tempDir = path.join(process.cwd(), 'temp');
    const filePath = path.join(tempDir, safeName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Archivo no encontrado en temp' }, { status: 404 });
    }

    const bucket = adminStorage.bucket();
    const storagePath = `videos/local/${analysisId}/${safeName}`;
    const fileRef = bucket.file(storagePath);
    const buffer = await fs.promises.readFile(filePath);

    await fileRef.save(buffer, {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          analysisId,
          source: 'temp-local',
          originalName: safeName,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
    await fileRef.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const updates: Record<string, string> = {};
    if (type === 'main') updates.videoUrl = publicUrl;
    if (type === 'back') updates.videoBackUrl = publicUrl;
    if (type === 'front') updates.videoFrontUrl = publicUrl;
    if (type === 'left') updates.videoLeftUrl = publicUrl;
    if (type === 'right') updates.videoRightUrl = publicUrl;

    if (analysisData?.videoUrl === tempUrl) {
      updates.videoUrl = publicUrl;
    }

    await adminDb.collection('analyses').doc(analysisId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, url: publicUrl, type, storagePath });
  } catch (error) {
    console.error('Error resolviendo temp video:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
