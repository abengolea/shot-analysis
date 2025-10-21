import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShot22Parameters } from '@/lib/gemini-22-parameters';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

const Test22ParametersSchema = z.object({
  ageCategory: z.string(),
  playerLevel: z.string(),
  shotType: z.string(),
  playerId: z.string(),
});

export async function POST(request: NextRequest) {
  // Configurar timeout para análisis largos
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 5 minutes')), 5 * 60 * 1000);
  });

  try {
    // Usar Promise.race para aplicar timeout
    const result = await Promise.race([
      perform22ParametersAnalysis(request),
      timeoutPromise
    ]);
    
    return result;
  } catch (error) {
    console.error('❌ Error en análisis de 22 parámetros:', error);
    return NextResponse.json(
      { 
        error: 'Error en el análisis', 
        details: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}

async function perform22ParametersAnalysis(request: NextRequest) {
  const formData = await request.formData();
  const videoFile = formData.get('video') as File;
  const ageCategory = formData.get('ageCategory') as string;
  const playerLevel = formData.get('playerLevel') as string;
  const shotType = formData.get('shotType') as string;
  const playerId = formData.get('playerId') as string;

  if (!videoFile) {
    return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
  }

  // Validar inputs
  const validation = Test22ParametersSchema.safeParse({ ageCategory, playerLevel, shotType, playerId });
  if (!validation.success) {
    return NextResponse.json({ error: 'Datos de formulario inválidos', details: validation.error.errors }, { status: 400 });
  }

      // 1. ANÁLISIS CON GEMINI (22 parámetros optimizado)
  const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
  const analysisResult = await analyzeBasketballShot22Parameters(
    videoBuffer,
    videoFile.name,
    ageCategory,
    playerLevel,
    shotType
  );

    // 2. GUARDAR EN FIREBASE STORAGE PARA HISTORIAL
    if (!adminStorage) {
    throw new Error('Firebase Admin Storage no inicializado');
  }

  const bucket = adminStorage.bucket();
  const timestamp = Date.now();
  const safeFileName = videoFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const storagePath = `shot-videos/${playerId}/${timestamp}-${safeFileName}`;
  const gcsFile = bucket.file(storagePath);

  await gcsFile.save(videoBuffer, {
    metadata: {
      contentType: videoFile.type,
      metadata: {
        playerId,
        ageCategory,
        playerLevel,
        shotType,
        analysisMethod: 'gemini-22-parameters',
      },
    },
  });
  await gcsFile.makePublic(); // Hacer público para fácil acceso en el frontend
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // 3. GUARDAR RESULTADOS EN FIRESTORE
    if (!adminDb) {
    throw new Error('Firebase Admin no inicializado');
  }

  const analysisId = `${timestamp}-${safeFileName.replace(/\.[^/.]+$/, '')}`;
  const analysisData = {
    id: analysisId,
    playerId,
    createdAt: new Date().toISOString(),
    videoUrl: publicUrl,
    shotType,
    ...analysisResult.technicalAnalysis,
    shotDetection: analysisResult.shotDetection,
    videoVerification: analysisResult.videoVerification, // Nuevo: verificación anti-simulación
    // Metadatos adicionales
    storagePath,
    fileSize: videoFile.size,
    originalFileName: videoFile.name,
    analysisMethod: 'gemini-22-parameters',
  };

  const analysisRef = adminDb.collection('analyses').doc(analysisId);
  await analysisRef.set(analysisData);

    // 4. CREAR DOCUMENTO PENDIENTE (para compatibilidad con el flujo existente)
  const pendingData = {
    playerId,
    shotType,
    ageCategory,
    playerLevel,
    filePath: storagePath,
    status: 'completed',
    completedAt: new Date().toISOString(),
  };

  const pendingRef = adminDb.collection('pending_analyses').doc(analysisId);
  await pendingRef.set(pendingData);

    return NextResponse.json({ 
    success: true, 
    analysisId, 
    publicUrl, 
    analysis: analysisResult.technicalAnalysis,
    message: 'Análisis de 22 parámetros completado y guardado'
  });
}
