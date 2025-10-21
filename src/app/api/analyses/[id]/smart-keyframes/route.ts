import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
        const { id: analysisId } = await params;
        if (!analysisId) {
            return NextResponse.json(
        { error: 'ID de análisis requerido' },
        { status: 400 }
      );
    }

    if (!adminDb) {
            return NextResponse.json(
        { error: 'Base de datos no disponible' },
        { status: 500 }
      );
    }

    // Obtener el análisis de Firestore
        const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
            return NextResponse.json(
        { error: 'Análisis no encontrado' },
        { status: 404 }
      );
    }

    const analysisData = analysisDoc.data();
    console.log('🔍 [API] Datos del análisis:', {
      hasSmartKeyframes: !!analysisData?.smartKeyframes,
      smartKeyframesKeys: analysisData?.smartKeyframes ? Object.keys(analysisData.smartKeyframes) : []
    });
    
    // Verificar si tiene keyframes inteligentes
    if (!analysisData?.smartKeyframes) {
            return NextResponse.json(
        { error: 'No se encontraron keyframes inteligentes para este análisis' },
        { status: 404 }
      );
    }

    // Cargar las imágenes desde la colección separada
        const keyframesWithImages = {
      front: [],
      back: [],
      left: [],
      right: []
    };

    const angles = ['front', 'back', 'left', 'right'];
    
    for (const angle of angles) {
      try {
                // Buscar en la nueva estructura: analyses/{id}/keyframes/{angle}/frames/{frame_i}
        const framesSnapshot = await adminDb.collection('analyses').doc(analysisId).collection('keyframes').doc(angle).collection('frames').get();
        
        if (!framesSnapshot.empty) {
          const frames = [];
          
                    // Procesar cada frame
          for (const frameDoc of framesSnapshot.docs) {
            const frameData = frameDoc.data();
            frames.push({
              index: frameData.index,
              timestamp: frameData.timestamp,
              description: frameData.description,
              importance: frameData.importance,
              phase: frameData.phase,
              imageBuffer: frameData.imageData // Cargar la imagen desde imageData
            });
          }
          
          // Ordenar por index
          frames.sort((a, b) => a.index - b.index);
          keyframesWithImages[angle as keyof typeof keyframesWithImages] = frames;
                  } else {
                  }
      } catch (error) {
        console.error(`❌ [API] Error cargando keyframes de ${angle}:`, error);
        // Continuar con los otros ángulos
      }
    }

    const totalFrames = Object.values(keyframesWithImages).reduce((sum, arr) => sum + arr.length, 0);
        // Retornar los keyframes inteligentes con imágenes
    return NextResponse.json(keyframesWithImages);

  } catch (error) {
    console.error('Error obteniendo keyframes inteligentes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
