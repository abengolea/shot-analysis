import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[TEST] Iniciando request...');
    
    const formData = await request.formData();
    console.log('[TEST] FormData recibido');
    
    const file = formData.get('video') as File;
    const testType = formData.get('testType') as string;
    
    console.log('[TEST] File:', file?.name, file?.size);
    console.log('[TEST] TestType:', testType);

    if (!file) {
      console.log('[TEST] ERROR: No se proporcionó archivo');
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    // Validar tamaño del archivo (máximo 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      console.log('[TEST] ERROR: Archivo muy grande:', file.size, 'bytes');
      return NextResponse.json({ 
        error: 'Archivo muy grande. Máximo 20MB permitido.' 
      }, { status: 400 });
    }

    console.log('[TEST] Archivo validado. Tamaño:', file.size, 'bytes');

    // Configurar Gemini
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 
      process.env.GOOGLE_API_KEY || 
      process.env.GOOGLE_GENAI_API_KEY || 
      'AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4'
    );
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log('[TEST] Iniciando prueba de realidad de Gemini...');
    console.log('[TEST] Tipo de prueba:', testType);
    console.log('[TEST] Archivo:', file.name, '(', file.size, 'bytes)');

    let result;

    // Agregar timeout de 60 segundos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: La operación tardó más de 60 segundos')), 60000);
    });

    const testPromise = (async () => {
      if (testType === 'party-video') {
        // PRUEBA CRÍTICA: Video de fiesta (debería rechazar)
        return await testPartyVideo(model, file);
      } else if (testType === 'basketball-video') {
        // PRUEBA POSITIVA: Video de baloncesto (debería aprobar)
        return await testBasketballVideo(model, file);
      } else {
        // PRUEBA GENERAL
        return await testGeneralAnalysis(model, file);
      }
    })();

    result = await Promise.race([testPromise, timeoutPromise]);

    return NextResponse.json({
      success: true,
      testType,
      videoUrl: file.name,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TEST] Error en prueba de Gemini:', error?.message || error);
    return NextResponse.json({ 
      success: false,
      error: 'Error en la prueba',
      details: error?.message 
    }, { status: 500 });
  }
}

async function testPartyVideo(model: any, file: File) {
  console.log('[TEST] Probando video de FIESTA (debería rechazar)...');
  console.log('[TEST] Archivo recibido:', file.name, file.size, 'bytes');
  
  const prompt = `
  CRÍTICO: Analiza este video y determina si contiene baloncesto.

  INSTRUCCIONES MUY ESTRICTAS:
  - Si ves CUALQUIER indicio de fiesta, baile, música, celebración: RECHAZA
  - Si NO ves una canasta de baloncesto CLARA: RECHAZA  
  - Si NO ves un balón de baloncesto CLARO: RECHAZA
  - Si NO ves movimiento de tiro: RECHAZA
  
  NO INVENTES CONTENIDO QUE NO ESTÉ PRESENTE.
  
  Responde SOLO con:
  {
    "isBasketball": true/false,
    "confidence": 0-1,
    "reason": "explicación breve",
    "whatYouActuallySee": "describe exactamente lo que ves"
  }
  `;

  try {
    // Convertir el archivo a buffer y luego a base64
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
    
    console.log('[TEST] Respuesta de Gemini para video de fiesta:', text);
    
    return {
      prompt: 'Video de fiesta (debería rechazar)',
      response: text,
      expectedResult: 'REJECT',
      actualResult: text.includes('false') ? 'REJECT' : 'APPROVE'
    };
  } catch (error: any) {
    return {
      prompt: 'Video de fiesta (debería rechazar)',
      error: error.message,
      expectedResult: 'REJECT',
      actualResult: 'ERROR'
    };
  }
}

async function testBasketballVideo(model: any, file: File) {
  console.log('[TEST] Probando video de BALONCESTO (debería aprobar)...');
  
  const prompt = `
  Analiza este video y determina si contiene baloncesto.

  INSTRUCCIONES:
  - Busca canasta de baloncesto
  - Busca balón de baloncesto (naranja)
  - Busca movimiento de tiro
  - Busca cancha de baloncesto
  
  Responde SOLO con:
  {
    "isBasketball": true/false,
    "confidence": 0-1,
    "reason": "explicación breve",
    "whatYouActuallySee": "describe exactamente lo que ves"
  }
  `;

  try {
    // Convertir el archivo a buffer y luego a base64
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
    
    console.log('[TEST] Respuesta de Gemini para video de baloncesto:', text);
    
    return {
      prompt: 'Video de baloncesto (debería aprobar)',
      response: text,
      expectedResult: 'APPROVE',
      actualResult: text.includes('true') ? 'APPROVE' : 'REJECT'
    };
  } catch (error: any) {
    return {
      prompt: 'Video de baloncesto (debería aprobar)',
      error: error.message,
      expectedResult: 'APPROVE',
      actualResult: 'ERROR'
    };
  }
}

async function testGeneralAnalysis(model: any, file: File) {
  console.log('[TEST] Prueba general de análisis...');
  
  const prompt = `
  Analiza este video y describe exactamente lo que ves.
  
  IMPORTANTE: Solo describe lo que realmente ves, NO inventes contenido.
  
  Incluye:
  - ¿Qué tipo de actividad es?
  - ¿Qué objetos ves?
  - ¿Qué personas hay?
  - ¿Qué está pasando?
  `;

  try {
    // Convertir el archivo a buffer y luego a base64
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
    
    console.log('[TEST] Respuesta general de Gemini:', text);
    
    return {
      prompt: 'Análisis general',
      response: text
    };
  } catch (error: any) {
    return {
      prompt: 'Análisis general',
      error: error.message
    };
  }
}
