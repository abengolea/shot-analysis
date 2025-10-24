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
    
    // Extraer keyframes del análisis
    const keyframes = analysisData?.keyframes || {
      front: [],
      back: [],
      left: [],
      right: []
    };
    
    console.log('📊 [SMART-KEYFRAMES] Keyframes encontrados:', {
      front: keyframes.front?.length || 0,
      back: keyframes.back?.length || 0,
      left: keyframes.left?.length || 0,
      right: keyframes.right?.length || 0
    });
    
    return Response.json(keyframes);
  } catch (error) {
    console.error('❌ [SMART-KEYFRAMES] Error:', error);
    return Response.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}