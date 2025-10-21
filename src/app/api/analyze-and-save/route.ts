import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShotCombined } from '@/ai/flows/analyze-basketball-shot';
import { analyzeVideoReal } from '@/lib/gemini-video-real';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

const AnalyzeAndSaveSchema = z.object({
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
      performAnalysis(request),
      timeoutPromise
    ]);
    
    return result;
  } catch (error) {
    console.error('❌ Error en análisis combinado:', error);
    return NextResponse.json(
      { 
        error: 'Error en el análisis', 
        details: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}

async function performAnalysis(request: NextRequest) {
    const formData = await request.formData();
    const videoFile1 = formData.get('video1') as File;
    const videoFile2 = formData.get('video2') as File;
    const videoFile3 = formData.get('video3') as File;
    const ageCategory = formData.get('ageCategory') as string;
    const playerLevel = formData.get('playerLevel') as string;
    const shotType = formData.get('shotType') as string;
    const playerId = formData.get('playerId') as string;

    // Validar datos
    const validation = AnalyzeAndSaveSchema.safeParse({
      ageCategory,
      playerLevel,
      shotType,
      playerId,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    if (!videoFile1) {
      return NextResponse.json({ error: 'Video principal requerido' }, { status: 400 });
    }

        // 1. ANÁLISIS DIRECTO A GEMINI
        // Convertir videos a buffers
    const videoBuffer1 = Buffer.from(await videoFile1.arrayBuffer());
    const videoBuffer2 = videoFile2 ? Buffer.from(await videoFile2.arrayBuffer()) : null;
    const videoBuffer3 = videoFile3 ? Buffer.from(await videoFile3.arrayBuffer()) : null;
    
    // Análisis multi-video con preprocesamiento FFmpeg
        const analysisResult = await analyzeVideoReal(
      videoBuffer1,
      videoFile1.name,
      videoBuffer2,
      videoFile2?.name,
      videoBuffer3,
      videoFile3?.name
    );

        // 2. GUARDAR VIDEOS EN FIREBASE STORAGE PARA HISTORIAL
        if (!adminStorage) {
      throw new Error('Firebase Storage no inicializado');
    }

    const bucket = adminStorage.bucket();
    const timestamp = Date.now();
    const videoUrls: string[] = [];
    
    // Guardar video principal
    const safeFileName1 = videoFile1.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storagePath1 = `videos/${playerId}/${timestamp}-1-${safeFileName1}`;
    const gcsFile1 = bucket.file(storagePath1);
    await gcsFile1.save(videoBuffer1, { 
      metadata: { 
        contentType: videoFile1.type,
        metadata: {
          playerId,
          shotType,
          ageCategory,
          playerLevel,
          analyzedAt: new Date().toISOString(),
          videoIndex: 1
        }
      } 
    });
    await gcsFile1.makePublic();
    videoUrls.push(`https://storage.googleapis.com/${bucket.name}/${storagePath1}`);
    
    // Guardar video 2 si existe
    if (videoFile2 && videoBuffer2) {
      const safeFileName2 = videoFile2.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const storagePath2 = `videos/${playerId}/${timestamp}-2-${safeFileName2}`;
      const gcsFile2 = bucket.file(storagePath2);
      await gcsFile2.save(videoBuffer2, { 
        metadata: { 
          contentType: videoFile2.type,
          metadata: {
            playerId,
            shotType,
            ageCategory,
            playerLevel,
            analyzedAt: new Date().toISOString(),
            videoIndex: 2
          }
        } 
      });
      await gcsFile2.makePublic();
      videoUrls.push(`https://storage.googleapis.com/${bucket.name}/${storagePath2}`);
    }
    
    // Guardar video 3 si existe
    if (videoFile3 && videoBuffer3) {
      const safeFileName3 = videoFile3.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const storagePath3 = `videos/${playerId}/${timestamp}-3-${safeFileName3}`;
      const gcsFile3 = bucket.file(storagePath3);
      await gcsFile3.save(videoBuffer3, { 
        metadata: { 
          contentType: videoFile3.type,
          metadata: {
            playerId,
            shotType,
            ageCategory,
            playerLevel,
            analyzedAt: new Date().toISOString(),
            videoIndex: 3
          }
        } 
      });
      await gcsFile3.makePublic();
      videoUrls.push(`https://storage.googleapis.com/${bucket.name}/${storagePath3}`);
    }

        // 3. GUARDAR ANÁLISIS EN FIRESTORE
        if (!adminDb) {
      throw new Error('Firebase Admin no inicializado');
    }

    const analysisId = `${timestamp}-${safeFileName1.replace(/\.[^/.]+$/, '')}`;
    const analysisData = {
      id: analysisId,
      playerId,
      createdAt: new Date().toISOString(),
      videoUrl: videoUrls[0], // URL del video principal
      videoUrls: videoUrls, // Array con todas las URLs
      shotType,
      ...analysisResult.technicalAnalysis,
      shotDetection: analysisResult.shotDetection,
      verification: analysisResult.verification,
      // Metadatos adicionales
      totalVideos: videoUrls.length,
      fileSize: videoFile1.size + (videoFile2?.size || 0) + (videoFile3?.size || 0),
      originalFileNames: {
        video1: videoFile1.name,
        video2: videoFile2?.name || null,
        video3: videoFile3?.name || null
      },
      analysisMethod: 'gemini-multi-video-ffmpeg',
      // No guardar videoBase64 en Firestore (demasiado grande)
    };

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    await analysisRef.set(analysisData);

        // 4. CREAR DOCUMENTO PENDIENTE (para compatibilidad con el flujo existente)
    const pendingData = {
      playerId,
      shotType,
      ageCategory,
      playerLevel,
      filePath: videoUrls[0], // Usar URL principal
      videoUrls: videoUrls, // Incluir todas las URLs
      status: 'completed',
      completedAt: new Date().toISOString(),
      totalVideos: videoUrls.length
    };

    const pendingRef = adminDb.collection('pending_analyses').doc(analysisId);
    await pendingRef.set(pendingData);

        const videoCount = videoUrls.length;
    return NextResponse.json({
      success: true,
      analysisId,
      videoUrl: videoUrls[0], // URL principal para compatibilidad
      videoUrls: videoUrls, // Todas las URLs
      totalVideos: videoCount,
      analysis: analysisResult,
      message: videoCount > 1 ? `Análisis multi-video (${videoCount} videos) completado y guardado en historial` : 'Análisis completado y guardado en historial',
    });
}
