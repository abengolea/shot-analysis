export async function GET() {
  console.log('🔍 [ANALYSES] Endpoint llamado - versión ultra-simple');
  
  try {
    return Response.json({
      analyses: [],
      count: 0,
      message: 'Endpoint funcionando - versión simple'
    });
  } catch (error) {
    console.error('❌ [ANALYSES] Error:', error);
    return Response.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}