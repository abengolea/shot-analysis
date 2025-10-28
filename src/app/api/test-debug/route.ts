import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShotSimple } from '@/ai/flows/analyze-basketball-shot';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  let videoRef: any = null;
  
  try {
        const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type debe ser multipart/form-data' }, { status: 400 });
    }
    
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    console.log('📁 Archivo recibido:', {
      name: videoFile.name,
      size: videoFile.size,
      type: videoFile.type,
      lastModified: videoFile.lastModified
    });

    // Convertir el archivo a buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
        // Subir el video a Firebase Storage
    const videoId = `debug-${uuidv4()}`;
    const videoFileName = `test-videos/${videoId}.mp4`;
    
    console.log('📤 Subiendo video a Firebase...');
    videoRef = adminStorage.bucket().file(videoFileName);
    await videoRef.save(videoBuffer, {
      metadata: {
        contentType: videoFile.type,
        metadata: {
          originalName: videoFile.name,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Generar URL pública del video
    const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${videoFileName}`;
        // Probar la IA con un prompt MUY simple
    console.log('🤖 Probando IA con prompt simple...');
    
    try {
      const analysis = await analyzeBasketballShotSimple({
        videoUrl,
        ageCategory: 'Sub-15' as any,
        playerLevel: 'Avanzado',
        shotType: 'Lanzamiento de Tres',
        availableKeyframes: [],
      });
      
                  return NextResponse.json({
        success: true,
        debug_info: {
          archivo: {
            name: videoFile.name,
            size: videoFile.size,
            type: videoFile.type
          },
          firebase: {
            url: videoUrl,
            uploaded: true
          },
          ia: {
            responded: true,
            duracion: analysis.verificacion_inicial?.duracion_video,
            tiros: analysis.verificacion_inicial?.tiros_detectados,
            summary: analysis.analysisSummary
          }
        },
        analysis: analysis
      });

    } catch (iaError: any) {
      console.error('❌ Error en la IA:', iaError);
      
      return NextResponse.json({
        success: false,
        debug_info: {
          archivo: {
            name: videoFile.name,
            size: videoFile.size,
            type: videoFile.type
          },
          firebase: {
            url: videoUrl,
            uploaded: true
          },
          ia: {
            responded: false,
            error: iaError.message,
            stack: iaError.stack
          }
        },
        error: 'La IA falló al procesar el video'
      });
    }

  } catch (error: any) {
    console.error('❌ Error general en debug:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error general en debug', 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  } finally {
    // NO eliminar el video - lo necesitamos para análisis
      }
}





