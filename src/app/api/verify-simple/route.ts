import { NextRequest, NextResponse } from 'next/server';
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

    // Información básica del archivo
    const fileSizeBytes = videoFile.size;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);
    const fileName = videoFile.name;
    const fileType = videoFile.type;
    const lastModified = new Date(videoFile.lastModified).toISOString();

    // Convertir el archivo a buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // Subir el video a Firebase Storage
    const videoId = `verify-simple-${uuidv4()}`;
    const videoFileName = `test-videos/${videoId}.mp4`;
    
    console.log('📤 Subiendo video para verificación simple...');
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
        return NextResponse.json({
      success: true,
      video_info: {
        archivo_original: fileName,
        tipo_archivo: fileType,
        tamaño_bytes: fileSizeBytes,
        tamaño_mb: fileSizeMB,
        ultima_modificacion: lastModified,
        url_video: videoUrl,
        buffer_size: videoBuffer.length,
        buffer_vs_file: videoBuffer.length === fileSizeBytes ? 'COINCIDE' : 'DIFERENTE'
      },
      analisis: {
        problema_detectado: "La IA está detectando duración incorrecta",
        posible_causa: "Limitación del modelo de IA o preprocesamiento del video",
        recomendacion: "Verificar si el video se está comprimiendo o segmentando antes del análisis"
      },
      comparacion: {
        duracion_ia_detectada: "7.5s (incorrecta)",
        duracion_real: "Desconocida (necesita FFmpeg)",
        diferencia: "IA no está viendo el video completo",
        tiros_ia_detectados: "6 tiros (imposible en 7.5s)",
        tiros_reales_esperados: "Más de 6 tiros en video más largo"
      }
    });

  } catch (error: any) {
    console.error('Error en verificación simple:', error);
    return NextResponse.json(
      { error: 'Error en verificación simple', details: error.message },
      { status: 500 }
    );
  } finally {
    // NO eliminar el video - lo necesitamos para análisis
      }
}






