import { NextRequest, NextResponse } from 'next/server';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';
import { analyzeBasketballVideo, ShotAnalysisResult } from '@/lib/pose-detection';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json(
        { error: 'Archivo de video es requerido' },
        { status: 400 }
      );
    }

    console.log(`[POSE-ANALYSIS] Analizando poses de baloncesto en video: ${videoFile.name}`);

    // Convertir el archivo a Buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    // Extraer frames del video
    const frames = await extractKeyframesFromBuffer(videoBuffer, 20); // 20 frames para análisis detallado
    console.log(`[POSE-ANALYSIS] Extraídos ${frames.length} frames del video`);

    if (frames.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudieron extraer frames del video'
      }, { status: 400 });
    }

    // Convertir frames a ImageData (simplificado para demo)
    const imageDataArray: ImageData[] = [];
    const mockPoseData: any[] = [];

    for (const frame of frames) {
      // En una implementación real, aquí usarías MediaPipe Pose o OpenPose
      // Para esta demo, creamos datos mock de pose
      const mockPose = {
        nose: { x: 320, y: 100, confidence: 0.9 },
        leftEye: { x: 310, y: 95, confidence: 0.9 },
        rightEye: { x: 330, y: 95, confidence: 0.9 },
        leftEar: { x: 300, y: 100, confidence: 0.8 },
        rightEar: { x: 340, y: 100, confidence: 0.8 },
        leftShoulder: { x: 280, y: 150, confidence: 0.9 },
        rightShoulder: { x: 360, y: 150, confidence: 0.9 },
        leftElbow: { x: 260, y: 200, confidence: 0.8 },
        rightElbow: { x: 380, y: 200, confidence: 0.8 },
        leftWrist: { x: 240, y: 250, confidence: 0.7 },
        rightWrist: { x: 400, y: 250, confidence: 0.7 },
        leftHip: { x: 300, y: 300, confidence: 0.9 },
        rightHip: { x: 340, y: 300, confidence: 0.9 },
        leftKnee: { x: 290, y: 400, confidence: 0.8 },
        rightKnee: { x: 350, y: 400, confidence: 0.8 },
        leftAnkle: { x: 285, y: 500, confidence: 0.7 },
        rightAnkle: { x: 355, y: 500, confidence: 0.7 }
      };
      
      mockPoseData.push(mockPose);
      
      // Crear ImageData mock (en implementación real usarías el frame real)
      const mockImageData = new ImageData(640, 480);
      imageDataArray.push(mockImageData);
    }

    // Analizar poses de baloncesto
    const analysisResult = analyzeBasketballVideo(imageDataArray, mockPoseData);

        return NextResponse.json({
      success: true,
      analysis: analysisResult,
      summary: {
        shotsDetected: analysisResult.shotCount,
        successfulShots: analysisResult.successfulShots,
        missedShots: analysisResult.missedShots,
        successRate: analysisResult.shotCount > 0 ? 
          Math.round((analysisResult.successfulShots / analysisResult.shotCount) * 100) : 0,
        framesAnalyzed: frames.length
      }
    });

  } catch (error: any) {
    console.error('[POSE-ANALYSIS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
