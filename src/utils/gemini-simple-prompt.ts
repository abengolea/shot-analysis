import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Función de retry con backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
            if (attempt === maxRetries) {
        throw error;
      }
      
      // Solo reintentar en errores 429 (rate limit) o 500 (server error)
      if (error.message?.includes('429') || error.message?.includes('500')) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`⏳ Esperando ${Math.round(delay)}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Máximo número de reintentos alcanzado');
}

// Schema simplificado para la respuesta
const SimpleAnalysisSchema = z.object({
  verification: z.object({
    isReal: z.boolean(),
    confidence: z.number(),
    description: z.string(),
    canSeeBasket: z.boolean().optional(),
    cameraAngle: z.string().optional(),
    basketVisible: z.boolean().optional(),
    shotResultsVisible: z.boolean().optional(),
    environment: z.string().optional(),
    videoQuality: z.string().optional(),
    specificColors: z.string().optional(),
    uniqueObjects: z.string().optional(),
    specificEnvironment: z.string().optional(),
    specificActions: z.string().optional(),
    playerCharacteristics: z.object({
      height: z.string().optional(),
      build: z.string().optional(),
      skinTone: z.string().optional(),
      hairColor: z.string().optional(),
      clothing: z.string().optional(),
      uniqueFeatures: z.array(z.string()).optional(),
      dominantHand: z.string().optional(),
    }).optional(),
  }),
  shotSummary: z.object({
    totalShots: z.number(),
    lateralShots: z.number(),
    frontalShots: z.number(),
    additionalShots: z.number(),
  }),
  shots: z.array(z.object({
    id: z.number(),
    videoSource: z.string(),
    shotType: z.string(),
    basketVisible: z.boolean(),
    result: z.string(),
    playerCharacteristics: z.any().optional(),
  })),
  technicalAnalysis: z.object({
    summary: z.string().describe('Resumen general del análisis en prosa, destacando aspectos más importantes según su peso'),
    parameters: z.array(z.object({
      name: z.string(),
      score: z.number(),
      status: z.string(),
      comment: z.string(),
      evidencia: z.string().optional(),
    })),
    overallScore: z.number(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
});

export async function analyzeVideoSimplePrompt(
  videoBuffer1: Buffer,
  fileName1: string,
  videoBuffer2?: Buffer | null,
  fileName2?: string | null,
  videoBuffer3?: Buffer | null,
  fileName3?: string | null,
  ageCategory: string = 'adult',
  playerLevel: string = 'intermediate',
  shotType: string = 'jump_shot'
) {
  try {
        // Preprocesar videos con FFmpeg
    const { preprocessVideo } = await import('@/lib/gemini-video-real');
    
    console.log('⚙️ Preprocesando videos...');
    const { optimizedVideo: processedVideo1 } = await preprocessVideo(videoBuffer1, fileName1);
    const base64Video1 = processedVideo1.toString('base64');

    // Keyframes de IA removidos para mejorar rendimiento
    // (mantener versión anterior rápida)
    
    let base64Video2: string | null = null;
    let base64Video3: string | null = null;
    
    if (videoBuffer2) {
      const { optimizedVideo: processedVideo2 } = await preprocessVideo(videoBuffer2, fileName2 || 'video2.mp4');
      base64Video2 = processedVideo2.toString('base64');
    }
    
    if (videoBuffer3) {
      const { optimizedVideo: processedVideo3 } = await preprocessVideo(videoBuffer3, fileName3 || 'video3.mp4');
      base64Video3 = processedVideo3.toString('base64');
    }

    console.log('📊 Tamaños de videos base64:', {
      video1: `${Math.round(base64Video1.length / 1024)}KB`,
      video2: base64Video2 ? `${Math.round(base64Video2.length / 1024)}KB` : 'N/A',
      video3: base64Video3 ? `${Math.round(base64Video3.length / 1024)}KB` : 'N/A'
    });

    // VALIDACIÓN CRÍTICA: Verificar que el video principal no esté vacío
    if (base64Video1.length === 0 || base64Video1.length < 1000) {
      throw new Error(`Video principal está vacío o corrupto (${base64Video1.length} bytes). Por favor, sube un video válido.`);
    }

    // Llamar a Gemini con prompt simplificado
    const analysisResult = await analyzeWithGeminiSimple(
      base64Video1,
      base64Video2,
      base64Video3,
      ageCategory,
      playerLevel,
      shotType
    );

        return analysisResult;
  } catch (error) {
    console.error('❌ Error en analyzeVideoSimplePrompt:', error);
    throw error;
  }
}

async function analyzeWithGeminiSimple(
  videoBase64: string,
  secondVideoBase64?: string | null,
  thirdVideoBase64?: string | null,
  ageCategory: string = 'adult',
  playerLevel: string = 'intermediate',
  shotType: string = 'jump_shot'
) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  // PROMPT SIMPLIFICADO - Solo lo esencial para los 22 parámetros
  const prompt = `Analiza este video de baloncesto y devuelve EXACTAMENTE este JSON:

🚨 INSTRUCCIONES CRÍTICAS PARA TODOS LOS PARÁMETROS:

REGLA GENERAL: Sé MUY ESTRICTO con TODOS los parámetros. Solo usa "Correcto" (70+ puntos) cuando sea REALMENTE correcto, no cuando sea "casi perfecto".

CRITERIOS ESPECÍFICOS:
- "Equilibrio general": Busca CUALQUIER desequilibrio en el aterrizaje
- "Tiro en un solo tiempo": Busca CUALQUIER pausa en el set point
- "Mano no dominante en ascenso": Busca CUALQUIER interferencia de la mano guía
- "Alineación de pies": Busca CUALQUIER desalineación
- "Alineación corporal": Busca CUALQUIER desalineación del cuerpo
- "Muñeca cargada": Busca CUALQUIER carga prematura de muñeca
- "Flexión de rodillas": Busca CUALQUIER flexión insuficiente
- "Hombros relajados": Busca CUALQUIER tensión en hombros
- "Enfoque visual": Busca CUALQUIER pérdida de enfoque
- "Codos cerca del cuerpo": Busca CUALQUIER separación excesiva
- "Subida recta del balón": Busca CUALQUIER desviación
- "Trayectoria hasta set point": Busca CUALQUIER trayectoria incorrecta
- "Set point": Busca CUALQUIER posición incorrecta
- "Tiempo de lanzamiento": Busca CUALQUIER timing incorrecto
- "Transferencia energética": Busca CUALQUIER descoordinación
- "Mano no dominante en liberación": Busca CUALQUIER interferencia
- "Extensión completa del brazo": Busca CUALQUIER extensión incompleta
- "Giro de la pelota": Busca CUALQUIER falta de backspin
- "Ángulo de salida": Busca CUALQUIER ángulo incorrecto
- "Duración del follow-through": Busca CUALQUIER follow-through corto
- "Consistencia general": Busca CUALQUIER inconsistencia

REGLAS DE PUNTUACIÓN:
- ✅ 90-100: EXCELENTE - Perfecto, sin errores visibles
- ✅ 70-89: CORRECTO - Bueno, errores mínimos... SOLO si es REALMENTE correcto
- ⚠️ 36-69: MEJORABLE - Errores visibles pero controlados
- ❌ 0-35: INCORRECTO - Errores claros y marcados
- 🚫 no_evaluable: No se puede evaluar

⚠️ ADVERTENCIA GENERAL: Si hay CUALQUIER error visible, NO uses "Correcto" (70-89) - usa "Mejorable" (36-69) o "Incorrecto" (0-35)

📊 CLASIFICACIÓN AUTOMÁTICA POR PUNTUACIÓN:
- 90-100 puntos → "Excelente"
- 70-89 puntos → "Correcto" 
- 36-69 puntos → "Mejorable"
- 0-35 puntos → "Incorrecto"

{
  "verification": {
    "isReal": true,
    "confidence": 95,
    "description": "Descripción breve del video",
    "canSeeBasket": true/false,
    "cameraAngle": "frontal/lateral/diagonal",
    "basketVisible": true/false,
    "shotResultsVisible": true/false,
    "environment": "gimnasio/cancha exterior/otro",
    "videoQuality": "excelente/buena/regular/mala",
    "specificColors": "colores específicos que ves",
    "uniqueObjects": "objetos únicos en el video",
    "specificEnvironment": "detalles del entorno",
    "specificActions": "acciones específicas observadas",
    "playerCharacteristics": {
      "height": "alto/medio/bajo",
      "build": "delgado/medio/robusto",
      "skinTone": "claro/medio/oscuro",
      "hairColor": "rubio/castano/negro/otro",
      "clothing": "descripción de la ropa",
      "uniqueFeatures": ["característica 1", "característica 2"],
      "dominantHand": "derecha/izquierda"
    }
  },
  "shotSummary": {
    "totalShots": 2,
    "lateralShots": 1,
    "frontalShots": 1,
    "additionalShots": 0
  },
  "shots": [
    {
      "id": 1,
      "videoSource": "lateral",
      "shotType": "jump_shot",
      "basketVisible": true,
      "result": "unknown",
      "playerCharacteristics": {}
    }
  ],
  "technicalAnalysis": {
    "summary": "El jugador muestra una técnica con aspectos destacables pero también áreas críticas de mejora. En cuanto a fluidez, presenta un movimiento continuo y buena sincronía con las piernas (74-79 puntos). Sin embargo, la muñeca cargada (58 puntos) es una debilidad importante ya que se carga durante el ascenso en lugar de estar preparada desde el inicio, lo que genera inconsistencia. Los codos se alejan del cuerpo (52 puntos), lo cual afecta la precisión. Por el lado positivo, destaca en equilibrio (86 puntos), extensión del brazo (82 puntos) y flexión de rodillas (81 puntos). Las principales áreas de mejora son: la preparación de la muñeca antes del ascenso, mantener los codos más pegados al cuerpo, y extender el follow-through para mayor consistencia.",
    "parameters": [
      {"name": "Alineación de pies", "score": 67, "status": "Mejorable", "comment": "Los pies no están alineados correctamente con el aro", "evidencia": "Visible en el video"},
      {"name": "Alineación corporal", "score": 68, "status": "Mejorable", "comment": "El cuerpo está bien alineado con el aro", "evidencia": "Visible en el video"},
      {"name": "Muñeca cargada", "score": 58, "status": "Deficiente", "comment": "La muñeca se carga durante el ascenso, no antes - genera ruido", "evidencia": "Visible en el video"},
      {"name": "Flexión de rodillas", "score": 81, "status": "Excelente", "comment": "Excelente flexión de rodillas en preparación", "evidencia": "Visible en el video"},
      {"name": "Hombros relajados", "score": 68, "status": "Mejorable", "comment": "Los hombros mantienen tensión adecuada sin rigidez", "evidencia": "Visible en el video"},
      {"name": "Enfoque visual", "score": 88, "status": "Excelente", "comment": "Mantiene foco constante en el aro durante todo el tiro", "evidencia": "Visible en el video"},
      {"name": "Mano no dominante en ascenso", "score": 58, "status": "Mejorable", "comment": "La mano guía interfiere ligeramente durante el ascenso", "evidencia": "Visible en el video"},
      {"name": "Codos cerca del cuerpo", "score": 52, "status": "Deficiente", "comment": "Los codos se abren excesivamente alejándose del cuerpo", "evidencia": "Visible en el video"},
      {"name": "Subida recta del balón", "score": 64, "status": "Mejorable", "comment": "El balón sube en trayectoria mayormente recta", "evidencia": "Visible en el video"},
      {"name": "Trayectoria hasta set point", "score": 84, "status": "Excelente", "comment": "Trayectoria fluida y controlada hasta el set point", "evidencia": "Visible en el video"},
      {"name": "Set point", "score": 69, "status": "Mejorable", "comment": "El set point está ligeramente bajo para la distancia", "evidencia": "Visible en el video"},
      {"name": "Tiempo de lanzamiento", "score": 66, "status": "Mejorable", "comment": "El timing es adecuado para el tipo de tiro", "evidencia": "Visible en el video"},
      {"name": "Tiro en un solo tiempo", "score": 62, "status": "Mejorable", "comment": "Pausa visible en el set point que interrumpe la fluidez del movimiento", "evidencia": "Visible en el video"},
      {"name": "Transferencia energética – sincronía con piernas", "score": 68, "status": "Mejorable", "comment": "Buena coordinación entre la extensión de piernas y el lanzamiento del balón", "evidencia": "Visible en el video"},
      {"name": "Mano no dominante en liberación", "score": 63, "status": "Mejorable", "comment": "La mano guía empuja ligeramente el balón en la liberación", "evidencia": "Visible en el video"},
      {"name": "Extensión completa del brazo", "score": 82, "status": "Excelente", "comment": "Extensión completa y fluida del brazo hacia el objetivo", "evidencia": "Visible en el video"},
      {"name": "Giro de la pelota", "score": 64, "status": "Mejorable", "comment": "Backspin adecuado pero podría mejorar", "evidencia": "Visible en el video"},
      {"name": "Ángulo de salida", "score": 69, "status": "Mejorable", "comment": "Ángulo apropiado para la distancia del tiro", "evidencia": "Visible en el video"},
      {"name": "Equilibrio general", "score": 45, "status": "Incorrecto", "comment": "Aterrizaje con desequilibrio - pie derecho adelantado y ligera inclinación corporal", "evidencia": "Visible en el video"},
      {"name": "Duración del follow-through", "score": 68, "status": "Mejorable", "comment": "El follow through es muy breve, debería mantenerse más tiempo", "evidencia": "Visible en el video"},
      {"name": "Consistencia general", "score": 68, "status": "Mejorable", "comment": "Algunas variaciones en la mecánica entre tiros pero mantiene técnica similar", "evidencia": "Visible en el video"}
    ],
    "overallScore": 71,
    "strengths": [
      "Buena alineación corporal",
      "Mantiene el enfoque visual",
      "Extensión completa del brazo",
      "Equilibrio general estable"
    ],
    "weaknesses": [
      "Alineación de pies necesita mejora",
      "Los codos se separan demasiado",
      "La mano guía interfiere en la liberación",
      "Consistencia general mejorable"
    ],
    "recommendations": [
      "Trabajar en la alineación de los pies",
      "Mantener los codos más cerca del cuerpo",
      "Mejorar la liberación de la mano guía",
      "Trabajar en la consistencia del movimiento"
    ],
  }
}

IMPORTANTE - SISTEMA DE PUNTUACIÓN:
- Devuelve EXACTAMENTE 21 parámetros en technicalAnalysis.parameters
- **CRÍTICO: USA EXACTAMENTE ESTOS NOMBRES DE PARÁMETROS:**
  * "Equilibrio general" (NO uses "Mantenimiento del equilibrio" ni "Equilibrio en el aterrizaje")
  * "Duración del follow-through" (con guión, NO "Duración del follow through")
  * "Consistencia general" (NO uses "Consistencia repetitiva" ni "Consistencia del movimiento")
- **PROHIBIDO usar nombres antiguos como "Mantenimiento del equilibrio", "Equilibrio en el aterrizaje", "Consistencia repetitiva"**
- **USA EXACTAMENTE los nombres del ejemplo JSON de arriba**
- USA PUNTUACIONES REALES Y PRECISAS (1-100):
  * 90-100: PERFECTO - Técnica impecable, nivel profesional
  * 80-89: EXCELENTE - Muy bien ejecutado, mínimas mejoras
  * 70-79: CORRECTO - Bien ejecutado, algunas áreas de mejora
  * 60-69: MEJORABLE - Técnica aceptable pero necesita trabajo
  * 50-59: DEFICIENTE - Problemas evidentes que afectan rendimiento
  * 30-49: INCORRECTO - Errores significativos
  * 10-29: MUY INCORRECTO - Técnica muy deficiente
  * 1-9: CRÍTICO - Requiere corrección total

- USA NÚMEROS VARIADOS Y PRECISOS: 73, 81, 67, 54, 92, etc. (NO uses solo múltiplos de 5)
- Si está MAL, califica MAL (no hay "realismo suave")
- Si está PERFECTO, califica PERFECTO (90-100)
- Describe lo que ves en el video
- Si no puedes evaluar algo, usa "no_evaluable" en status
- **CRÍTICO: El comentario debe ser CONSISTENTE con la puntuación. Si puntúas 74, el comentario debe reflejar exactamente lo que significa esa puntuación según los criterios específicos.**
- Devuelve SOLO el JSON, sin texto adicional
- **VERIFICACIÓN FINAL: Antes de enviar, asegúrate de que NO hay parámetros con nombres "Mantenimiento del equilibrio", "Equilibrio en el aterrizaje", o "Consistencia repetitiva". Usa solo "Equilibrio general" y "Consistencia general".**

RESUMEN EN PROSA (technicalAnalysis.summary):
- Escribe un resumen general del análisis en 3-5 oraciones
- PRIORIZA aspectos según su importancia:
  * Fluidez: Tiro en un solo tiempo y sincronía con piernas
  * Preparación: Especialmente muñeca cargada y flexión de rodillas
  * Ascenso: Codos, trayectoria, set point
  * Liberación: Extensión, mano guía, backspin
  * Seguimiento: Equilibrio, follow-through
- Menciona PRIMERO los aspectos más importantes (fluidez)
- Luego los puntos fuertes más destacados
- Finalmente las principales áreas de mejora
- Usa lenguaje claro y directo en español
- NO uses bullet points, escribe en PROSA CONTINUA
- NO menciones pesos o porcentajes en el texto

CRITERIO ESPECÍFICO PARA "Muñeca cargada":
- La muñeca debe estar FLEXIONADA HACIA ATRÁS (cargada) ANTES de iniciar el ascenso del balón
- Evalúa TANTO el momento de carga COMO el grado de flexión:

PUNTUACIÓN:
- ✅ 85-95: Muñeca cargada DESDE LA PREPARACIÓN + excelente flexión + backspin perfecto
- ✅ 70-84: Muñeca cargada desde preparación + buena flexión
- ⚠️ 55-69: Muñeca cargada desde preparación PERO flexión insuficiente; O bien flexionada PERO se carga un poco tarde
- ⚠️ 40-54: Muñeca se carga DURANTE el ascenso (genera ruido) pero con flexión aceptable
- ❌ 20-39: Muñeca rígida + carga tardía (durante ascenso)
- ❌ 1-19: Sin carga de muñeca, rígida completamente
- 🚫 no_evaluable: No se puede ver la muñeca en la preparación

IMPORTANTE: La carga de muñeca durante el ascenso (no desde preparación) genera RUIDO y afecta la consistencia del tiro

🚨 CRITERIO CRÍTICO PARA "Tiro en un solo tiempo" - SER MUY ESTRICTO:

IMPORTANTE: Si hay CUALQUIER pausa visible en el set point, NO marques como "Correcto".

BUSCA ESPECÍFICAMENTE ESTOS ERRORES:
1. ¿El balón se DETIENE o hace pausa en el set point?
2. ¿Hay INTERRUPCIÓN en el flujo del movimiento?
3. ¿El gesto se divide en DOS TIEMPOS separados?
4. ¿Se pierde la energía continua del movimiento?

PUNTUACIÓN ESTRICTA:
- ✅ 90-100: Movimiento PERFECTAMENTE fluido, sin pausas, energía continua
- ✅ 70-89: Movimiento fluido con pausa MUY breve o casi imperceptible
- ⚠️ 36-69: Pausa VISIBLE en el set point pero luego continúa
- ❌ 0-35: Pausa MARCADA que interrumpe el flujo de energía o movimiento en DOS TIEMPOS
- 🚫 no_evaluable: No se puede ver claramente la transición

⚠️ ADVERTENCIA: Si hay pausa visible en el set point, NO uses "Correcto"

🔧 PROMPT ACTUALIZADO - VERSIÓN CORREGIDA PARA EQUILIBRIO 🔧

🚨 CRITERIO CRÍTICO PARA "Equilibrio general" - SER MUY ESTRICTO:

IMPORTANTE: Si ves CUALQUIER desequilibrio en el aterrizaje, NO marques como "Correcto".

BUSCA ESPECÍFICAMENTE ESTOS ERRORES:
1. ¿Un pie aterriza ANTES que el otro?
2. ¿Un pie está MÁS ADELANTE que el otro al aterrizar?
3. ¿El cuerpo se INCLINA hacia un lado?
4. ¿Hay GIRO del cuerpo durante el aterrizaje?
5. ¿El peso se carga MÁS en un pie que en el otro?
6. ¿Hay MOVIMIENTO COMPENSATORIO para recuperar el equilibrio?

PUNTUACIÓN ESTRICTA:
- ✅ 90-100: Aterrizaje PERFECTO - ambos pies aterrizan SIMULTÁNEAMENTE, perfectamente alineados, sin inclinaciones
- ✅ 70-89: Aterrizaje BUENO - pies casi alineados, cuerpo estable, distribución equilibrada
- ⚠️ 36-69: Aterrizaje REGULAR - pequeñas desalineaciones, ligera inclinación, pero controlado
- ❌ 0-35: Aterrizaje MALO - un pie adelantado, inclinación visible, desequilibrio claro o MUY MALO
- 🚫 no_evaluable: No se puede ver claramente el aterrizaje

⚠️ ADVERTENCIA: Si hay CUALQUIER desequilibrio visible, NO uses "Correcto" ni "Bueno"

🚨 CRITERIO CRÍTICO PARA "Mano no dominante en ascenso" - SER MUY ESTRICTO:

IMPORTANTE: Si la mano guía interfiere o empuja durante el ascenso, NO marques como "Correcto".

BUSCA ESPECÍFICAMENTE ESTOS ERRORES:
1. ¿La mano guía EMPUJA o ejerce fuerza hacia arriba?
2. ¿La mano guía INTERFIERE con el movimiento natural del balón?
3. ¿La mano guía se MUEVE de forma independiente del balón?
4. ¿Hay TENSIÓN visible en la mano guía durante el ascenso?

PUNTUACIÓN ESTRICTA:
- ✅ 90-100: Mano guía PERFECTAMENTE pasiva, solo acompaña sin interferir
- ✅ 70-89: Mano guía mayormente pasiva, interferencia mínima
- ⚠️ 36-69: Mano guía interfiere LIGERAMENTE durante el ascenso
- ❌ 0-35: Mano guía empuja o interfiere de forma VISIBLE o EMPUJA activamente
- 🚫 no_evaluable: No se puede ver claramente la mano guía

⚠️ ADVERTENCIA: Si la mano guía interfiere, NO uses "Correcto"

CRITERIO ESPECÍFICO PARA "Transferencia energética – sincronía con piernas":
- El balón debe llegar al set point COORDINADO con la extensión de las piernas
- Las piernas deben alcanzar ~70-80% de extensión cuando el balón llega al set point
- La energía de las piernas se transfiere al tiro
- EVALÚA: El balón llega al set point coordinado con la extensión de las piernas, 
  alcanzando ~70–80% de extensión en ese instante. COMPARA timestamps de extensión 
  de piernas vs llegada del balón al set point. Busca coordinación temporal precisa 
  donde ambas acciones ocurren simultáneamente.

PUNTUACIÓN:
- ✅ 85-95: Sincronía perfecta, piernas al 70-80% cuando balón llega a set point
- ✅ 70-84: Buena sincronía, coordinación evidente
- ⚠️ 55-69: Sincronía aceptable pero podría mejorar timing
- ❌ 40-54: Piernas se extienden demasiado pronto o demasiado tarde
- ❌ 20-39: Sin coordinación, movimientos independientes
- 🚫 no_evaluable: No se puede ver la extensión de piernas
`;

  const content = [
    { text: prompt },
    {
      inlineData: {
        mimeType: 'video/mp4',
        data: videoBase64,
      },
    },
  ];

  if (secondVideoBase64) {
    content.push({
      inlineData: {
        mimeType: 'video/mp4',
        data: secondVideoBase64,
      },
    });
  }

  if (thirdVideoBase64) {
    content.push({
      inlineData: {
        mimeType: 'video/mp4',
        data: thirdVideoBase64,
      },
    });
  }

  console.log('🤖 Enviando a Gemini con prompt simplificado...');
  
  const result = await retryWithBackoff(async () => {
    return await model.generateContent({
      contents: [{ role: 'user', parts: content }],
    });
  });

  const response = await result.response;
  const text = response.text();
  
  console.log('📝 Respuesta de Gemini (primeros 500 chars):', text.substring(0, 500));

  // Limpiar la respuesta
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  console.log('🔍 Debug - Respuesta limpia (primeros 500 chars):', cleanedText.substring(0, 500));

  const analysisResult = JSON.parse(cleanedText);
  
    console.log('🔍 Debug - analysisResult structure:', {
    hasTechnicalAnalysis: !!analysisResult.technicalAnalysis,
    hasParameters: !!analysisResult.technicalAnalysis?.parameters,
    parametersType: typeof analysisResult.technicalAnalysis?.parameters,
    parametersLength: analysisResult.technicalAnalysis?.parameters?.length || 0,
    parametersSample: analysisResult.technicalAnalysis?.parameters?.slice(0, 2) || 'N/A',
    overallScore: analysisResult.technicalAnalysis?.overallScore
  });
  
    // Arreglar respuesta de Gemini si viene como array
  let resultToValidate = analysisResult;
  if (Array.isArray(analysisResult) && analysisResult.length > 0) {
    resultToValidate = analysisResult[0];
      }

  // Validar con Zod
  const validatedResult = SimpleAnalysisSchema.parse(resultToValidate);
  
    return validatedResult;
}
