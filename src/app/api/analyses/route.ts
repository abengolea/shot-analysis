import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ANALYSES] Endpoint llamado');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('🔍 [ANALYSES] userId:', userId);
    
    if (!userId) {
      console.log('❌ [ANALYSES] userId requerido');
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // Por ahora, retornar array vacío para que el dashboard funcione
    console.log('✅ [ANALYSES] Retornando array vacío');
    return NextResponse.json({
      analyses: [],
      count: 0
    });

  } catch (error) {
    console.error('❌ [ANALYSES] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}