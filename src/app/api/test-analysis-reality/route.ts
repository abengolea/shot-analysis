import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    console.log('[REALITY] Archivo validado:', file.name, file.size, 'bytes');

    // Configurar Gemini
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 
      process.env.GOOGLE_API_KEY || 
      process.env.GOOGLE_GENAI_API_KEY || 
      'AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4'
    );
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Convertir el archivo a base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'video/mp4';

    console.log('[REALITY] Ejecutando 3 pruebas con el mismo video...');

    // PRUEBA 1: Le decimos que es un tiro libre
    const prompt1 = `
    Analiza este video de un TIRO LIBRE de baloncesto y evalúa la técnica del jugador.

    INSTRUCCIONES:
    - Es un tiro libre (desde la línea de tiros libres)
    - Evalúa la técnica específica para tiros libres
    - Da scores del 1-10 para cada aspecto
    - Proporciona feedback específico

    Responde con JSON:
    {
      "shotType": "tiro libre",
      "scores": {
        "preparacion": 8,
        "ascenso": 7,
        "liberacion": 9,
        "seguimiento": 8
      },
      "feedback": "Descripción específica de lo que ves en este tiro libre",
      "globalScore": 8.0
    }
    `;

    // PRUEBA 2: Le decimos que es un tiro de media distancia
    const prompt2 = `
    Analiza este video de un TIRO DE MEDIA DISTANCIA de baloncesto y evalúa la técnica del jugador.

    INSTRUCCIONES:
    - Es un tiro de media distancia (desde el perímetro)
    - Evalúa la técnica específica para tiros de media distancia
    - Da scores del 1-10 para cada aspecto
    - Proporciona feedback específico

    Responde con JSON:
    {
      "shotType": "tiro de media distancia",
      "scores": {
        "preparacion": 8,
        "ascenso": 7,
        "liberacion": 9,
        "seguimiento": 8
      },
      "feedback": "Descripción específica de lo que ves en este tiro de media distancia",
      "globalScore": 8.0
    }
    `;

    // PRUEBA 3: Le decimos que es un tiro de tres puntos
    const prompt3 = `
    Analiza este video de un TIRO DE TRES PUNTOS de baloncesto y evalúa la técnica del jugador.

    INSTRUCCIONES:
    - Es un tiro de tres puntos (desde la línea de tres)
    - Evalúa la técnica específica para tiros de tres puntos
    - Da scores del 1-10 para cada aspecto
    - Proporciona feedback específico

    Responde con JSON:
    {
      "shotType": "tiro de tres puntos",
      "scores": {
        "preparacion": 8,
        "ascenso": 7,
        "liberacion": 9,
        "seguimiento": 8
      },
      "feedback": "Descripción específica de lo que ves en este tiro de tres puntos",
      "globalScore": 8.0
    }
    `;

    // Ejecutar las 3 pruebas
    const [response1, response2, response3] = await Promise.all([
      model.generateContent([prompt1, { inlineData: { data: base64, mimeType: mimeType } }]),
      model.generateContent([prompt2, { inlineData: { data: base64, mimeType: mimeType } }]),
      model.generateContent([prompt3, { inlineData: { data: base64, mimeType: mimeType } }])
    ]);

    const text1 = response1.response.text();
    const text2 = response2.response.text();
    const text3 = response3.response.text();

    console.log('[REALITY] Respuestas recibidas:');
    console.log('[REALITY] Respuesta 1:', text1);
    console.log('[REALITY] Respuesta 2:', text2);
    console.log('[REALITY] Respuesta 3:', text3);

    // Parsear las respuestas
    const parseResponse = (text: string, shotType: string) => {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            shotType: parsed.shotType || shotType,
            response: text,
            timestamp: new Date().toISOString()
          };
        }
      } catch (e) {
        console.log('[REALITY] Error parseando respuesta:', e);
      }
      return {
        shotType: shotType,
        response: text,
        timestamp: new Date().toISOString()
      };
    };

    const result1 = parseResponse(text1, 'tiro libre');
    const result2 = parseResponse(text2, 'tiro de media distancia');
    const result3 = parseResponse(text3, 'tiro de tres puntos');

    // Analizar si está simulando
    const analysis = analyzeSimulation(result1, result2, result3);

    console.log('[REALITY] Análisis de simulación:', analysis);

    return NextResponse.json({
      success: true,
      videoName: file.name,
      testType: 'prueba de realidad',
      results: {
        prompt1: result1,
        prompt2: result2,
        prompt3: result3
      },
      analysis: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[REALITY] Error en prueba de realidad:', error?.message || error);
    return NextResponse.json({ 
      success: false,
      videoName: 'archivo desconocido',
      testType: 'prueba de realidad',
      results: {
        prompt1: { shotType: '', response: '', timestamp: '' },
        prompt2: { shotType: '', response: '', timestamp: '' },
        prompt3: { shotType: '', response: '', timestamp: '' }
      },
      analysis: {
        isSimulating: true,
        evidence: ['Error técnico'],
        confidence: 1.0
      },
      timestamp: new Date().toISOString(),
      error: error?.message || 'Error desconocido'
    }, { status: 500 });
  }
}

function analyzeSimulation(result1: any, result2: any, result3: any): { isSimulating: boolean; evidence: string[]; confidence: number } {
  const evidence: string[] = [];
  let isSimulating = false;
  let confidence = 0.5;

  // Extraer scores de las respuestas (si están en JSON)
  const extractScores = (response: string) => {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.scores || parsed;
      }
    } catch (e) {
      // Ignorar errores de parsing
    }
    return null;
  };

  const scores1 = extractScores(result1.response);
  const scores2 = extractScores(result2.response);
  const scores3 = extractScores(result3.response);

  // Si no hay scores, analizar texto
  if (!scores1 || !scores2 || !scores3) {
    // Analizar similitud en el texto
    const similarity = calculateTextSimilarity(result1.response, result2.response, result3.response);
    
    if (similarity > 0.8) {
      evidence.push('Respuestas muy similares para diferentes tipos de tiro');
      isSimulating = true;
      confidence = 0.8;
    } else if (similarity < 0.3) {
      evidence.push('Respuestas muy diferentes para el mismo video');
      isSimulating = true;
      confidence = 0.7;
    } else {
      evidence.push('Respuestas moderadamente consistentes');
      isSimulating = false;
      confidence = 0.6;
    }
  } else {
    // Analizar scores
    const scoresSimilarity = calculateScoresSimilarity(scores1, scores2, scores3);
    
    if (scoresSimilarity > 0.9) {
      evidence.push('Scores idénticos para diferentes tipos de tiro');
      isSimulating = true;
      confidence = 0.9;
    } else if (scoresSimilarity < 0.5) {
      evidence.push('Scores muy diferentes para el mismo video');
      isSimulating = true;
      confidence = 0.8;
    } else {
      evidence.push('Scores razonablemente consistentes');
      isSimulating = false;
      confidence = 0.7;
    }
  }

  // Verificar si menciona detalles específicos del tipo de tiro
  const mentionsSpecificDetails = (
    result1.response.toLowerCase().includes('línea de tiros libres') ||
    result2.response.toLowerCase().includes('perímetro') ||
    result3.response.toLowerCase().includes('línea de tres')
  );

  if (mentionsSpecificDetails) {
    evidence.push('Menciona detalles específicos del tipo de tiro');
    isSimulating = false;
    confidence = Math.max(confidence, 0.8);
  } else {
    evidence.push('No menciona detalles específicos del tipo de tiro');
    isSimulating = true;
    confidence = Math.max(confidence, 0.7);
  }

  return {
    isSimulating,
    evidence,
    confidence
  };
}

function calculateTextSimilarity(text1: string, text2: string, text3: string): number {
  // Similitud básica basada en palabras comunes
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const words3 = text3.toLowerCase().split(/\s+/);

  const commonWords12 = words1.filter(word => words2.includes(word)).length;
  const commonWords13 = words1.filter(word => words3.includes(word)).length;
  const commonWords23 = words2.filter(word => words3.includes(word)).length;

  const totalWords = Math.max(words1.length, words2.length, words3.length);
  const similarity = (commonWords12 + commonWords13 + commonWords23) / (3 * totalWords);

  return similarity;
}

function calculateScoresSimilarity(scores1: any, scores2: any, scores3: any): number {
  // Comparar scores numéricos
  const keys = Object.keys(scores1);
  let totalSimilarity = 0;
  let comparisons = 0;

  for (const key of keys) {
    if (scores2[key] && scores3[key]) {
      const s1 = scores1[key];
      const s2 = scores2[key];
      const s3 = scores3[key];

      if (typeof s1 === 'number' && typeof s2 === 'number' && typeof s3 === 'number') {
        const similarity = 1 - (Math.abs(s1 - s2) + Math.abs(s1 - s3) + Math.abs(s2 - s3)) / (3 * 10);
        totalSimilarity += Math.max(0, similarity);
        comparisons++;
      }
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}
