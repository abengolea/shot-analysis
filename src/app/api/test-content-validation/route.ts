import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoFrames } from '@/ai/flows/analyze-video-frames';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[TEST] Iniciando validación de contenido...');
    
    const formData = await request.formData();
    const file = formData.get('video') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    // Validar tamaño del archivo (máximo 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Archivo muy grande. Máximo 20MB permitido.' 
      }, { status: 400 });
    }

    console.log('[TEST] Archivo validado:', file.name, file.size, 'bytes');

    console.log('[TEST] Analizando video directamente con Gemini...');

    // Usar el mismo método simple que funciona en test-gemini-reality
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 
      process.env.GOOGLE_API_KEY || 
      process.env.GOOGLE_GENAI_API_KEY || 
      'AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4'
    );
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
    Analiza este video y determina si contiene contenido de baloncesto.

    INSTRUCCIONES:
    - Busca canasta de baloncesto
    - Busca balón de baloncesto (naranja)
    - Busca movimiento de tiro
    - Busca cancha de baloncesto
    - Busca jugador con uniforme deportivo
    
    IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional:
    {
      "isBasketball": true,
      "confidence": 0.9,
      "reason": "explicación breve",
      "whatYouActuallySee": "describe exactamente lo que ves"
    }
    `;

    // Convertir el archivo a base64 (como en test-gemini-reality)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'video/mp4';

    const response = await model.generateContent([
      prompt, 
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      }
    ]);
    const text = response.response.text();
    
    console.log('[TEST] Respuesta cruda de Gemini:', text);
    
    // Parsear la respuesta JSON - extraer JSON del texto si está envuelto
    let parsedResponse;
    try {
      // Buscar JSON en el texto (puede estar envuelto en markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (e) {
      console.log('[TEST] Error parseando JSON, analizando respuesta de texto:', e);
      
      // Analizar la respuesta de texto para determinar si es baloncesto
      const isBasketball = text.toLowerCase().includes('basketball') || 
                          text.toLowerCase().includes('baloncesto') ||
                          text.toLowerCase().includes('tiro') ||
                          text.toLowerCase().includes('canasta') ||
                          text.toLowerCase().includes('aro');
      
      const isParty = text.toLowerCase().includes('party') ||
                     text.toLowerCase().includes('fiesta') ||
                     text.toLowerCase().includes('baile') ||
                     text.toLowerCase().includes('dancing');
      
      parsedResponse = {
        isBasketball: isBasketball && !isParty,
        confidence: isBasketball && !isParty ? 0.8 : 0.2,
        reason: isBasketball && !isParty ? "Contenido de baloncesto detectado en análisis de texto" : "No es contenido de baloncesto según análisis de texto",
        whatYouActuallySee: text
      };
    }

    const result = {
      isBasketballContent: parsedResponse.isBasketball,
      confidence: parsedResponse.confidence,
      recommendation: parsedResponse.isBasketball ? 'PROCEED' : 'REJECT',
      reason: parsedResponse.reason,
      detectedElements: parsedResponse.isBasketball ? ['Contenido de baloncesto detectado'] : [],
      nonBasketballIndicators: parsedResponse.isBasketball ? [] : ['No es contenido de baloncesto']
    };

    console.log('[TEST] Resultado del análisis:', result);

    return NextResponse.json({
      success: true,
      testType: 'validación de contenido',
      videoName: file.name,
      result: {
        isBasketballContent: result.isBasketballContent,
        confidence: result.confidence,
        recommendation: result.recommendation,
        reason: result.reason,
        detectedElements: result.detectedElements,
        nonBasketballIndicators: result.nonBasketballIndicators || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TEST] Error en validación:', error?.message || error);
    return NextResponse.json({ 
      success: false,
      testType: 'validación de contenido',
      videoName: 'archivo desconocido',
      result: {
        isBasketballContent: false,
        confidence: 0,
        recommendation: 'REJECT',
        reason: 'Error en la validación del video',
        detectedElements: [],
        nonBasketballIndicators: ['Error técnico']
      },
      timestamp: new Date().toISOString(),
      error: error?.message || 'Error desconocido'
    }, { status: 500 });
  }
}
