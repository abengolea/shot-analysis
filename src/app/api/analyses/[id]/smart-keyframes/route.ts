export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('🔍 [SMART-KEYFRAMES] Endpoint llamado para:', id);
    
    // Por ahora, retornar estructura vacía
    return Response.json({
      front: [],
      back: [],
      left: [],
      right: []
    });
  } catch (error) {
    console.error('❌ [SMART-KEYFRAMES] Error:', error);
    return Response.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}