import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

/**
 * Endpoint para refrescar la URL del video de un análisis
 * Útil cuando las signed URLs han expirado
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const videoType = searchParams.get('type') || 'main'; // main, back, front, left, right

    if (!analysisId) {
      return NextResponse.json(
        { error: 'ID de análisis es requerido' },
        { status: 400 }
      );
    }

    // Obtener el análisis desde Firestore
    const analysisDoc = await adminDb
      .collection('analyses')
      .doc(analysisId)
      .get();

    if (!analysisDoc.exists) {
      return NextResponse.json(
        { error: 'Análisis no encontrado' },
        { status: 404 }
      );
    }

    const analysisData = analysisDoc.data();
    
    // Determinar qué URL usar según el tipo
    let videoUrl: string | undefined;
    let storagePath = '';

    if (videoType === 'back') {
      videoUrl = analysisData?.videoBackUrl || analysisData?.videoUrl;
    } else if (videoType === 'front') {
      videoUrl = analysisData?.videoFrontUrl;
    } else if (videoType === 'left') {
      videoUrl = analysisData?.videoLeftUrl;
    } else if (videoType === 'right') {
      videoUrl = analysisData?.videoRightUrl;
    } else {
      // 'main' o por defecto
      videoUrl = analysisData?.videoUrl || analysisData?.videoBackUrl;
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No se encontró URL de video para este tipo' },
        { status: 404 }
      );
    }

    // Extraer el path del archivo desde la URL
    const storage = getStorage();
    const bucketName = 'shotanalisys.firebasestorage.app';
    
    if (videoUrl.includes('storage.googleapis.com')) {
      // Signed URL o Public URL: https://storage.googleapis.com/bucket/path...
      const url = new URL(videoUrl);
      storagePath = url.pathname;
      if (storagePath.startsWith('/')) {
        storagePath = storagePath.substring(1);
      }
      const bucketPrefix = `${bucketName}/`;
      if (storagePath.startsWith(bucketPrefix)) {
        storagePath = storagePath.substring(bucketPrefix.length);
      }
    } else if (videoUrl.includes('firebasestorage.googleapis.com')) {
      // URL pública: https://firebasestorage.googleapis.com/v0/b/bucket/o/path?alt=media
      const match = videoUrl.match(/\/o\/(.*)\?/);
      storagePath = match ? decodeURIComponent(match[1]) : '';
    } else if (videoUrl.startsWith('gs://')) {
      // GCS URI: gs://bucket/path
      const match = videoUrl.match(/gs:\/\/.*?\/(.+)$/);
      storagePath = match ? match[1] : '';
    } else {
      // Asumir que es el path directo
      storagePath = videoUrl;
    }

    if (!storagePath) {
      return NextResponse.json(
        { error: 'No se pudo extraer el path del archivo de la URL' },
        { status: 400 }
      );
    }

    // Verificar que el archivo existe
    const bucket = storage.bucket(bucketName);
    const fileRef = bucket.file(storagePath);
    
    const [exists] = await fileRef.exists();
    if (!exists) {
      return NextResponse.json(
        { error: 'El archivo de video no existe en Storage' },
        { status: 404 }
      );
    }

    // Generar nueva signed URL válida por 7 días
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    return NextResponse.json({
      url: signedUrl,
      expiresIn: 7 * 24 * 60 * 60 * 1000, // milisegundos
      storagePath
    });

  } catch (error) {
    console.error('Error al refrescar URL del video:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al refrescar la URL' },
      { status: 500 }
    );
  }
}

