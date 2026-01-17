import { adminDb, isFirebaseAdminAvailable } from '@/lib/firebase-admin';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('🔍 [SMART-KEYFRAMES] Endpoint llamado para:', id);
    
    if (!isFirebaseAdminAvailable()) {
      return Response.json({ error: 'Firebase Admin no disponible' }, { status: 500 });
    }

    // Buscar el análisis en la base de datos
    const analysisDoc = await adminDb.collection('analyses').doc(id).get();
    
    if (!analysisDoc.exists) {
      return Response.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    
    const analysisData = analysisDoc.data();
    
    // Extraer keyframes del análisis (buscar en smartKeyframes primero)
    const keyframesMetadata = (analysisData?.smartKeyframes || analysisData?.keyframes || {
      front: [],
      back: [],
      left: [],
      right: []
    }) as Record<'front' | 'back' | 'left' | 'right', any[]>;
    
    console.log('📊 [SMART-KEYFRAMES] Keyframes metadata encontrados:', {
      front: keyframesMetadata.front?.length || 0,
      back: keyframesMetadata.back?.length || 0,
      left: keyframesMetadata.left?.length || 0,
      right: keyframesMetadata.right?.length || 0
    });
    
    // Cargar las imágenes de los keyframes desde los documentos separados
    const keyframesWithImages: Record<'front' | 'back' | 'left' | 'right', any[]> = {
      front: [],
      back: [],
      left: [],
      right: []
    };
    
    const angles = ['front', 'back', 'left', 'right'] as const;
    
    for (const angle of angles) {
      const frames = keyframesMetadata[angle] || [];
      const framesWithImages = [];
      
      for (let i = 0; i < frames.length; i++) {
        try {
          // Buscar la imagen en el documento separado
          const frameDoc = await adminDb
            .collection('analyses')
            .doc(id)
            .collection('keyframes')
            .doc(angle)
            .collection('frames')
            .doc(`frame_${i}`)
            .get();
          
          if (frameDoc.exists) {
            const frameData = frameDoc.data();
            framesWithImages.push({
              ...frames[i],
              imageBuffer: frameData?.imageData || ''
            });
          } else {
            // Si no hay imagen, usar solo los metadatos
            framesWithImages.push(frames[i]);
          }
        } catch (error) {
          console.error(`❌ Error cargando frame ${i} de ${angle}:`, error);
          // Usar solo metadatos si falla la carga de imagen
          framesWithImages.push(frames[i]);
        }
      }
      
      keyframesWithImages[angle] = framesWithImages;
    }
    
    console.log('📊 [SMART-KEYFRAMES] Keyframes con imágenes cargados:', {
      front: keyframesWithImages.front?.length || 0,
      back: keyframesWithImages.back?.length || 0,
      left: keyframesWithImages.left?.length || 0,
      right: keyframesWithImages.right?.length || 0
    });
    
    return Response.json(keyframesWithImages);
  } catch (error) {
    console.error('❌ [SMART-KEYFRAMES] Error:', error);
    return Response.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}