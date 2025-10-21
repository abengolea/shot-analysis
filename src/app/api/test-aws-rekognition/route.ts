import { NextRequest, NextResponse } from 'next/server';
import { AWSRekognitionService } from '@/lib/aws-rekognition';

export async function POST(request: NextRequest) {
  try {
        const body = await request.json();
    const { videoUrl, ageCategory, playerLevel, shotType } = body;
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'URL de video requerida' },
        { status: 400 }
      );
    }
    
            console.log('🏀 Nivel del jugador:', playerLevel);
        // Verificar credenciales de AWS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('❌ Credenciales de AWS no configuradas');
      return NextResponse.json(
        { 
          error: 'Credenciales de AWS no configuradas. Verifica AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en .env.local',
          details: 'Necesitas configurar las credenciales de AWS para usar Rekognition'
        },
        { status: 500 }
      );
    }
    
    // Crear instancia del servicio
    const rekognitionService = new AWSRekognitionService();
    
    // Realizar análisis
    const analysisResult = await rekognitionService.analyzeBasketballVideo(videoUrl);
    
        return NextResponse.json({
      success: true,
      data: analysisResult,
      provider: 'AWS Rekognition',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('❌ Error en análisis AWS Rekognition:', error);
    
    return NextResponse.json(
      {
        error: 'Error en análisis con AWS Rekognition',
        details: error.message,
        provider: 'AWS Rekognition',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API de prueba para AWS Rekognition',
    endpoint: '/api/test-aws-rekognition',
    method: 'POST',
    requiredFields: ['videoUrl', 'ageCategory', 'playerLevel', 'shotType'],
    example: {
      videoUrl: 'https://example.com/video.mp4',
      ageCategory: 'Sub-15',
      playerLevel: 'Intermedio',
      shotType: 'Tiro libre',
    },
  });
}
