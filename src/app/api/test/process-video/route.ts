import { NextRequest, NextResponse } from 'next/server';
import { processUploadedVideo } from '@/ai/flows/process-uploaded-video';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, filePath } = await request.json();

    if (!videoUrl || !filePath) {
      return NextResponse.json(
        { error: 'videoUrl y filePath son requeridos' },
        { status: 400 }
      );
    }

        // Simular el flujo de procesamiento
    await processUploadedVideo({
      videoUrl,
      filePath,
    });

    return NextResponse.json({
      success: true,
      message: 'Video procesado correctamente',
    });
  } catch (error: any) {
    console.error('[TEST] Error procesando video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
