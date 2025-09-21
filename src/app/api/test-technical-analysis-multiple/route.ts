import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[TECHNICAL-MULTIPLE] Iniciando análisis técnico múltiple...');
    
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

    console.log('[TECHNICAL-MULTIPLE] Archivo validado:', file.name, file.size, 'bytes');

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

    console.log('[TECHNICAL-MULTIPLE] Ejecutando 3 análisis del mismo video...');

    const prompt = `
    Eres un entrenador experto de baloncesto. Analiza este video de lanzamiento y evalúa los 22 parámetros técnicos del tiro.

    🎯 SISTEMA DE PESOS ACTUALIZADO (para calcular score_global):
    - FLUIDEZ: 50% peso (CRÍTICO - más importante)
    - RESTO DE CATEGORÍAS: 26.38% peso (ALTO)
    - SET POINT: 8.27% peso (MEDIO)
    - CODO: 7.24% peso (MEDIO) 
    - MANO LIBERACIÓN: 3.26% peso (BAJO)
    - MANO ASCENSO: 2.18% peso (BAJO)

    INSTRUCCIONES CRÍTICAS:
    - Analiza SOLO lo que puedes VER claramente en el video
    - NO inventes mediciones que no puedes determinar
    - Si no puedes ver algo claramente, usa un score bajo (3-5)
    - Sé conservador en tus evaluaciones
    - Da feedback específico basado en lo que realmente ves

    EVALÚA ESTOS 22 PARÁMETROS (del 1-10):

    PREPARACIÓN:
    1. Alineación de pies con el aro (¿pies paralelos al aro?)
    2. Alineación del cuerpo (¿cuerpo cuadrado al aro?)
    3. Muñeca cargada hacia atrás (¿muñeca preparada?)
    4. Flexión de rodillas (¿rodillas flexionadas 45-70°?)
    5. Hombros relajados (¿hombros no tensos?)
    6. Mirada enfocada al aro (¿mira al aro?)

    ASCENSO:
    7. Mano no dominante guía el balón (¿mano guía visible?) - PESO: 2.18%
    8. Codos cerca del cuerpo (¿codos no abiertos?) - PESO: 7.24%
    9. Balón sube en línea recta (¿trayectoria recta?)
    10. Trayectoria suave al set point (¿movimiento fluido?)
    11. Set point sobre la cabeza (¿balón sobre cabeza?) - PESO: 8.27%
    12. Timing correcto (¿no muy rápido/lento?)

    FLUIDEZ (PESO: 50% - CRÍTICO):
    13. Tiro en un solo movimiento continuo (¿movimiento fluido?)
    14. Sincronización piernas-brazos (¿todo junto?)

    LIBERACIÓN:
    15. Mano guía se retira a tiempo (¿mano guía se quita?) - PESO: 3.26%
    16. Extensión completa del brazo (¿brazo extendido?)
    17. Muñeca con snap hacia abajo (¿muñeca activa?)
    18. Ángulo de salida apropiado (¿ángulo bueno?)

    SEGUIMIENTO:
    19. Mantiene follow-through (¿follow-through visible?)
    20. Equilibrio al aterrizar (¿aterriza equilibrado?)
    21. Duración del follow-through (¿mantiene 1-2 seg?)
    22. Consistencia general del movimiento (¿movimiento consistente?)

    📋 REGLAS PARA RECOMENDACIONES AUTOMÁTICAS (por peso):
    - Si FLUIDEZ < 7: PRIORIDAD MÁXIMA (50% peso)
    - Si SET POINT < 6: PRIORIDAD ALTA (8.27% peso)
    - Si CODO < 6: PRIORIDAD ALTA (7.24% peso)
    - Si MANO LIBERACIÓN < 5: PRIORIDAD MEDIA (3.26% peso)
    - Si MANO ASCENSO < 5: PRIORIDAD MEDIA (2.18% peso)

    📋 REGLAS PARA FORTALEZAS AUTOMÁTICAS (por peso):
    - Si FLUIDEZ ≥ 8: fortaleza PRINCIPAL
    - Si SET POINT ≥ 8: fortaleza SECUNDARIA
    - Si CODO ≥ 8: fortaleza SECUNDARIA
    - Otros parámetros ≥ 8: fortalezas terciarias

    RESPONDE ÚNICAMENTE CON JSON VÁLIDO:
    {
      "preparacion": {
        "alineacion_pies": {"score": 8, "feedback": "Pies bien alineados con el aro"},
        "alineacion_cuerpo": {"score": 7, "feedback": "Cuerpo ligeramente desalineado"},
        "muneca_cargada": {"score": 6, "feedback": "Muñeca no completamente cargada"},
        "flexion_rodillas": {"score": 8, "feedback": "Buena flexión de rodillas"},
        "hombros_relajados": {"score": 9, "feedback": "Hombros muy relajados"},
        "mirada_enfoque": {"score": 8, "feedback": "Mira directamente al aro"}
      },
      "ascenso": {
        "mano_guia": {"score": 7, "feedback": "Mano guía presente pero no ideal"},
        "codos_cuerpo": {"score": 8, "feedback": "Codos bien posicionados"},
        "balon_recto": {"score": 7, "feedback": "Trayectoria ligeramente curva"},
        "trayectoria_suave": {"score": 8, "feedback": "Movimiento suave"},
        "set_point": {"score": 6, "feedback": "Set point un poco bajo"},
        "timing": {"score": 8, "feedback": "Timing correcto"}
      },
      "fluidez": {
        "movimiento_continuo": {"score": 8, "feedback": "Movimiento fluido"},
        "sincronizacion": {"score": 7, "feedback": "Buena sincronización"}
      },
      "liberacion": {
        "mano_guia_retira": {"score": 6, "feedback": "Mano guía se retira tarde"},
        "extension_completa": {"score": 8, "feedback": "Buena extensión"},
        "muneca_snap": {"score": 7, "feedback": "Snap de muñeca presente"},
        "angulo_salida": {"score": 8, "feedback": "Ángulo de salida bueno"}
      },
      "seguimiento": {
        "follow_through": {"score": 9, "feedback": "Excelente follow-through"},
        "equilibrio_aterrizaje": {"score": 8, "feedback": "Aterriza equilibrado"},
        "duracion_follow": {"score": 7, "feedback": "Follow-through adecuado"},
        "consistencia": {"score": 8, "feedback": "Movimiento consistente"}
      },
      "score_global": 7.5,
      "principales_mejoras": ["Mejoras ordenadas por peso/importancia según scores"],
      "principales_fortalezas": ["Fortalezas ordenadas por peso/importancia según scores"]
    }
    `;

    // Ejecutar las 3 pruebas
    const [response1, response2, response3] = await Promise.all([
      model.generateContent([prompt, { inlineData: { data: base64, mimeType: mimeType } }]),
      model.generateContent([prompt, { inlineData: { data: base64, mimeType: mimeType } }]),
      model.generateContent([prompt, { inlineData: { data: base64, mimeType: mimeType } }])
    ]);

    const text1 = response1.response.text();
    const text2 = response2.response.text();
    const text3 = response3.response.text();

    console.log('[TECHNICAL-MULTIPLE] Respuestas recibidas:');
    console.log('[TECHNICAL-MULTIPLE] Respuesta 1:', text1);
    console.log('[TECHNICAL-MULTIPLE] Respuesta 2:', text2);
    console.log('[TECHNICAL-MULTIPLE] Respuesta 3:', text3);

    // Parsear las respuestas
    const parseResponse = (text: string) => {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.log('[TECHNICAL-MULTIPLE] Error parseando respuesta:', e);
      }
      return null;
    };

    const result1 = parseResponse(text1);
    const result2 = parseResponse(text2);
    const result3 = parseResponse(text3);

    // Analizar consistencia
    const consistency = analyzeConsistency(result1, result2, result3);

    console.log('[TECHNICAL-MULTIPLE] Análisis de consistencia:', consistency);

    return NextResponse.json({
      success: true,
      videoName: file.name,
      result: {
        consistency: consistency,
        tests: {
          test1: result1 || createFallbackResult(),
          test2: result2 || createFallbackResult(),
          test3: result3 || createFallbackResult()
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TECHNICAL-MULTIPLE] Error en análisis técnico múltiple:', error?.message || error);
    return NextResponse.json({ 
      success: false,
      videoName: 'archivo desconocido',
      result: {
        consistency: {
          isConsistent: false,
          evidence: ['Error técnico'],
          confidence: 0
        },
        tests: {
          test1: createFallbackResult(),
          test2: createFallbackResult(),
          test3: createFallbackResult()
        }
      },
      timestamp: new Date().toISOString(),
      error: error?.message || 'Error desconocido'
    }, { status: 500 });
  }
}

function createFallbackResult() {
  return {
    preparacion: {
      alineacion_pies: { score: 0, feedback: 'Error en análisis' },
      alineacion_cuerpo: { score: 0, feedback: 'Error en análisis' },
      muneca_cargada: { score: 0, feedback: 'Error en análisis' },
      flexion_rodillas: { score: 0, feedback: 'Error en análisis' },
      hombros_relajados: { score: 0, feedback: 'Error en análisis' },
      mirada_enfoque: { score: 0, feedback: 'Error en análisis' }
    },
    ascenso: {
      mano_guia: { score: 0, feedback: 'Error en análisis' },
      codos_cuerpo: { score: 0, feedback: 'Error en análisis' },
      balon_recto: { score: 0, feedback: 'Error en análisis' },
      trayectoria_suave: { score: 0, feedback: 'Error en análisis' },
      set_point: { score: 0, feedback: 'Error en análisis' },
      timing: { score: 0, feedback: 'Error en análisis' }
    },
    fluidez: {
      movimiento_continuo: { score: 0, feedback: 'Error en análisis' },
      sincronizacion: { score: 0, feedback: 'Error en análisis' }
    },
    liberacion: {
      mano_guia_retira: { score: 0, feedback: 'Error en análisis' },
      extension_completa: { score: 0, feedback: 'Error en análisis' },
      muneca_snap: { score: 0, feedback: 'Error en análisis' },
      angulo_salida: { score: 0, feedback: 'Error en análisis' }
    },
    seguimiento: {
      follow_through: { score: 0, feedback: 'Error en análisis' },
      equilibrio_aterrizaje: { score: 0, feedback: 'Error en análisis' },
      duracion_follow: { score: 0, feedback: 'Error en análisis' },
      consistencia: { score: 0, feedback: 'Error en análisis' }
    },
    score_global: 0,
    principales_mejoras: ['Error en análisis'],
    principales_fortalezas: ['Error en análisis']
  };
}

function analyzeConsistency(result1: any, result2: any, result3: any): { isConsistent: boolean; evidence: string[]; confidence: number } {
  const evidence: string[] = [];
  let isConsistent = true;
  let confidence = 0.5;

  if (!result1 || !result2 || !result3) {
    return {
      isConsistent: false,
      evidence: ['Error en el parsing de las respuestas'],
      confidence: 0
    };
  }

  // Comparar scores globales
  const globalScore1 = result1.score_global || 0;
  const globalScore2 = result2.score_global || 0;
  const globalScore3 = result3.score_global || 0;

  const globalDifference = Math.max(
    Math.abs(globalScore1 - globalScore2),
    Math.abs(globalScore1 - globalScore3),
    Math.abs(globalScore2 - globalScore3)
  );

  if (globalDifference <= 0.5) {
    evidence.push('Scores globales muy consistentes (diferencia ≤ 0.5)');
    confidence += 0.3;
  } else if (globalDifference <= 1.0) {
    evidence.push('Scores globales moderadamente consistentes (diferencia ≤ 1.0)');
    confidence += 0.2;
  } else {
    evidence.push('Scores globales inconsistentes (diferencia > 1.0)');
    isConsistent = false;
    confidence -= 0.3;
  }

  // Comparar parámetros específicos
  const categories = ['preparacion', 'ascenso', 'fluidez', 'liberacion', 'seguimiento'];
  let totalParameters = 0;
  let consistentParameters = 0;

  for (const category of categories) {
    if (result1[category] && result2[category] && result3[category]) {
      for (const param of Object.keys(result1[category])) {
        totalParameters++;
        const score1 = result1[category][param]?.score || 0;
        const score2 = result2[category][param]?.score || 0;
        const score3 = result3[category][param]?.score || 0;

        const paramDifference = Math.max(
          Math.abs(score1 - score2),
          Math.abs(score1 - score3),
          Math.abs(score2 - score3)
        );

        if (paramDifference <= 1) {
          consistentParameters++;
        }
      }
    }
  }

  const consistencyRatio = totalParameters > 0 ? consistentParameters / totalParameters : 0;

  if (consistencyRatio >= 0.8) {
    evidence.push(`Alta consistencia en parámetros individuales (${Math.round(consistencyRatio * 100)}%)`);
    confidence += 0.3;
  } else if (consistencyRatio >= 0.6) {
    evidence.push(`Moderada consistencia en parámetros individuales (${Math.round(consistencyRatio * 100)}%)`);
    confidence += 0.1;
  } else {
    evidence.push(`Baja consistencia en parámetros individuales (${Math.round(consistencyRatio * 100)}%)`);
    isConsistent = false;
    confidence -= 0.2;
  }

  // Verificar si las mejoras y fortalezas son similares
  const improvements1 = result1.principales_mejoras || [];
  const improvements2 = result2.principales_mejoras || [];
  const improvements3 = result3.principales_mejoras || [];

  const strengths1 = result1.principales_fortalezas || [];
  const strengths2 = result2.principales_fortalezas || [];
  const strengths3 = result3.principales_fortalezas || [];

  const improvementsSimilar = areArraysSimilar([improvements1, improvements2, improvements3]);
  const strengthsSimilar = areArraysSimilar([strengths1, strengths2, strengths3]);

  if (improvementsSimilar && strengthsSimilar) {
    evidence.push('Mejoras y fortalezas consistentes entre pruebas');
    confidence += 0.2;
  } else {
    evidence.push('Mejoras y fortalezas inconsistentes entre pruebas');
    isConsistent = false;
    confidence -= 0.1;
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    isConsistent,
    evidence,
    confidence
  };
}

function areArraysSimilar(arrays: string[][]): boolean {
  if (arrays.length < 2) return true;
  
  const allItems = arrays.flat();
  const uniqueItems = new Set(allItems);
  
  // Si hay muchos elementos únicos, no son similares
  return uniqueItems.size / allItems.length <= 0.7;
}
