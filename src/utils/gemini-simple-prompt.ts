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

// Función helper para detectar si es tiro libre
function detectTiroLibre(shotType: string): boolean {
  if (!shotType) return false;
  const tipo = shotType.toLowerCase();
  return tipo.includes('libre') || tipo.includes('free') || tipo.includes('ft');
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
    model: 'gemini-3.1-flash-lite-preview',
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  // Detectar si es tiro libre y construir prompt apropiado
  const esTiroLibre = detectTiroLibre(shotType);
  console.log(`🎯 [ANÁLISIS] Tipo de tiro: ${shotType}, esTiroLibre: ${esTiroLibre}`);
  
  // Si es tiro libre, usar prompt específico
  if (esTiroLibre) {
    console.log('✅ [ANÁLISIS] Usando prompt ESPECÍFICO de tiro libre');
    const librePrompt = `Eres un sistema experto de análisis de TIRO LIBRE en baloncesto.

🚨 VERIFICACIÓN OBLIGATORIA DEL TIPO DE TIRO 🚨
ANTES de analizar, CONFIRMA que esto es un TIRO LIBRE verificando:
1. ¿El jugador está en la LÍNEA DE TIRO LIBRE? (línea a 4.57m del aro)
2. ¿Los pies están DENTRO de la zona de tiro libre (no pisando la línea)?
3. ¿El jugador NO salta (o salta mínimamente DESPUÉS del toque del aro)?
4. ¿La distancia es CORTA (4.57m desde el aro)?
5. ¿El movimiento es más VERTICAL y CONTROLADO que un tiro de tres puntos?

⚠️ Si el jugador salta ANTES del toque, está lejos del aro, o el movimiento es de tres puntos → 
   MENCIONA la discrepancia en verification.description pero analiza como tiro libre según las instrucciones.

INFORMACIÓN DEL JUGADOR
${ageCategory ? `- Categoría de edad: ${ageCategory}` : '- Presumir edad basándose en tamaño corporal, proporciones, altura relativa al aro y contexto'}

SISTEMA DE PESOS PARA TIRO LIBRE:

🎯 PREPARACIÓN: 28%
├─ Rutina pre-tiro (8.4%): Secuencia repetible antes del tiro (botes, respiraciones, tiempo)
├─ Alineación pies/cuerpo (7.0%): Posición del cuerpo para tiro recto
├─ Muñeca cargada (5.6%): Flexión dorsal AL TOMAR el balón (ANTES del movimiento)
├─ Flexión rodillas (4.2%): Flexión 90-110° para generar potencia
└─ Posición inicial balón (2.8%): Ubicación correcta al inicio

🎯 ASCENSO: 23%
├─ Set point altura según edad (9.2%): CRÍTICO - Altura varía por edad
│  • 6-8 años: Pecho/Hombros | • 9-11 años: Hombros/Mentón
│  • 12-14 años: Frente/Ojos | • 15-17 años: Sobre cabeza | • 18+: Extensión completa
│  TAMBIÉN: Trayectoria VERTICAL (no va atrás)
├─ Codos cerca del cuerpo (6.9%): No abiertos durante ascenso
├─ Trayectoria vertical (4.6%): Línea recta, sin desviaciones
└─ Mano guía (2.3%): Solo guía/estabiliza, no empuja

🎯 FLUIDEZ: 12%
├─ Tiro en un solo tiempo (7.2%): Continuo sin pausas. NOTA: Menos crítico que tres puntos
└─ Sincronía con piernas (4.8%): Balón sube coordinado con extensión de piernas

🎯 LIBERACIÓN: 22%
├─ Extensión completa (8.8%): Brazo Y cuerpo elongados en liberación
├─ Ángulo de salida (7.7%): 45-52° óptimo
├─ Flexión muñeca final (3.3%): "Gooseneck" - muñeca caída después de liberar
└─ Rotación balón (2.2%): Backspin (puede ser no_evaluable)

🎯 SEGUIMIENTO: 15%
├─ Equilibrio y Estabilidad (9.75%):
│  ├─ SIN SALTO (3.9%): Pies NO despegan ANTES del toque del aro
│  │  ⚠️ INFRACCIÓN GRAVE si salta antes del toque
│  ├─ Pies dentro zona (2.93%): No pisar línea antes del toque
│  │  ⚠️ INFRACCIÓN si pisa línea
│  └─ Balance vertical (2.93%): Sin movimientos laterales significativos
└─ Follow-through completo (5.25%): Brazo extendido post-liberación (0.5-1s)

⚠️ DIFERENCIACIÓN CRÍTICA:
1. Muñeca CARGADA (Preparación): Flexión DORSAL al tomar el balón
2. Muñeca FINAL (Liberación): Flexión hacia ABAJO (gooseneck) después de soltar

Analiza este video de TIRO LIBRE y devuelve EXACTAMENTE este JSON:

🚨 CRÍTICO: USA EXACTAMENTE ESTOS 19 NOMBRES DE PARÁMETROS (sin variaciones):

PREPARACIÓN (5 parámetros):
1. "Rutina pre-tiro"
2. "Alineación pies/cuerpo"
3. "Muñeca cargada"
4. "Flexión rodillas"
5. "Posición inicial balón"

ASCENSO (4 parámetros):
6. "Set point altura según edad"
7. "Codos cerca del cuerpo"
8. "Trayectoria vertical"
9. "Mano guía"

FLUIDEZ (2 parámetros):
10. "Tiro en un solo tiempo"
11. "Sincronía con piernas"

LIBERACIÓN (4 parámetros):
12. "Extensión completa"
13. "Ángulo de salida"
14. "Flexión muñeca final"
15. "Rotación balón"

SEGUIMIENTO (4 parámetros):
16. "SIN SALTO"
17. "Pies dentro zona"
18. "Balance vertical"
19. "Follow-through completo"

{
  "verification": {
    "isReal": true,
    "confidence": 95,
    "description": "Descripción breve del video de tiro libre",
    "canSeeBasket": true/false,
    "cameraAngle": "frontal/lateral/diagonal",
    "basketVisible": true/false,
    "shotResultsVisible": true/false,
    "environment": "gimnasio/cancha exterior/otro",
    "videoQuality": "excelente/buena/regular/mala",
    "playerCharacteristics": {
      "height": "alto/medio/bajo",
      "build": "delgado/medio/robusto",
      "dominantHand": "derecha/izquierda"
    }
  },
  "shotSummary": {
    "totalShots": 1,
    "lateralShots": 0,
    "frontalShots": 1,
    "additionalShots": 0
  },
  "shots": [
    {
      "id": 1,
      "videoSource": "frontal",
      "shotType": "free_throw",
      "basketVisible": true,
      "result": "unknown"
    }
  ],
  "technicalAnalysis": {
    "summary": "Análisis específico del tiro libre - describe lo que observas",
    "parameters": [
      {"name": "Rutina pre-tiro", "score": 0, "status": "Mejorable", "comment": "Evaluar", "evidencia": "Visible"},
      {"name": "Alineación pies/cuerpo", "score": 0, "status": "Mejorable", "comment": "Evaluar", "evidencia": "Visible"},
      {"name": "Muñeca cargada", "score": 0, "status": "Mejorable", "comment": "Flexión dorsal ANTES del movimiento", "evidencia": "Visible"},
      {"name": "Flexión rodillas", "score": 0, "status": "Mejorable", "comment": "90-110°", "evidencia": "Visible"},
      {"name": "Posición inicial balón", "score": 0, "status": "Mejorable", "comment": "Evaluar", "evidencia": "Visible"},
      {"name": "Set point altura según edad", "score": 0, "status": "Mejorable", "comment": "CRÍTICO - varía por edad", "evidencia": "Visible"},
      {"name": "Codos cerca del cuerpo", "score": 0, "status": "Mejorable", "comment": "No abiertos", "evidencia": "Visible"},
      {"name": "Trayectoria vertical", "score": 0, "status": "Mejorable", "comment": "Línea recta", "evidencia": "Visible"},
      {"name": "Mano guía", "score": 0, "status": "Mejorable", "comment": "Solo guía", "evidencia": "Visible"},
      {"name": "Tiro en un solo tiempo", "score": 0, "status": "Mejorable", "comment": "Continuo", "evidencia": "Visible"},
      {"name": "Sincronía con piernas", "score": 0, "status": "Mejorable", "comment": "Coordinado", "evidencia": "Visible"},
      {"name": "Extensión completa", "score": 0, "status": "Mejorable", "comment": "Brazo y cuerpo", "evidencia": "Visible"},
      {"name": "Ángulo de salida", "score": 0, "status": "Mejorable", "comment": "45-52°", "evidencia": "Visible"},
      {"name": "Flexión muñeca final", "score": 0, "status": "Mejorable", "comment": "Gooseneck", "evidencia": "Visible"},
      {"name": "Rotación balón", "score": 0, "status": "Mejorable", "comment": "Backspin", "evidencia": "Visible"},
      {"name": "SIN SALTO", "score": 0, "status": "Mejorable", "comment": "Pies NO despegan", "evidencia": "Visible"},
      {"name": "Pies dentro zona", "score": 0, "status": "Mejorable", "comment": "No pisar línea", "evidencia": "Visible"},
      {"name": "Balance vertical", "score": 0, "status": "Mejorable", "comment": "Sin movimientos laterales", "evidencia": "Visible"},
      {"name": "Follow-through completo", "score": 0, "status": "Mejorable", "comment": "Brazo extendido 0.5-1s", "evidencia": "Visible"}
    ],
    "overallScore": 0,
    "strengths": [],
    "weaknesses": [],
    "recommendations": []
  }
}

🚨🚨🚨 CRÍTICO - SISTEMA DE PUNTUACIÓN PARA TIRO LIBRE 🚨🚨🚨:

⚠️ SOLO DEVUELVE ESTOS 19 PARÁMETROS (NO MÁS, NO MENOS):
1. Rutina pre-tiro
2. Alineación pies/cuerpo
3. Muñeca cargada
4. Flexión rodillas
5. Posición inicial balón
6. Set point altura según edad
7. Codos cerca del cuerpo
8. Trayectoria vertical
9. Mano guía
10. Tiro en un solo tiempo
11. Sincronía con piernas
12. Extensión completa
13. Ángulo de salida
14. Flexión muñeca final
15. Rotación balón
16. SIN SALTO
17. Pies dentro zona
18. Balance vertical
19. Follow-through completo

⛔ PROHIBIDO INCLUIR ESTOS PARÁMETROS DE TRES PUNTOS:
- "Hombros relajados"
- "Enfoque visual"
- "Subida recta del balón"
- "Trayectoria hasta set point"
- "Tiempo de lanzamiento"
- "Mano no dominante en ascenso"
- "Mano no dominante en liberación"
- "Giro de la pelota" (usa "Rotación balón" en su lugar)
- "Equilibrio general"
- "Duración del follow-through" (usa "Follow-through completo")
- "Consistencia general"

✅ USA PUNTUACIONES REALES Y PRECISAS (1-100):
- 90-100: PERFECTO - Técnica impecable
- 80-89: EXCELENTE - Muy bien ejecutado
- 70-79: CORRECTO - Bien ejecutado
- 60-69: MEJORABLE - Aceptable pero necesita trabajo
- 50-59: DEFICIENTE - Problemas evidentes
- 30-49: INCORRECTO - Errores significativos
- 10-29: MUY INCORRECTO - Técnica muy deficiente
- 1-9: CRÍTICO - Requiere corrección total

🚨 REGLA CRÍTICA: NO INVENTAR CALIFICACIONES
- Si NO puedes ver claramente un parámetro desde los ángulos disponibles → USA "no_evaluable"
- NO califiques parámetros que requieren ver detalles que no están visibles
- Es MEJOR marcar como "no_evaluable" que inventar una calificación incorrecta
- Parámetros que pueden requerir "no_evaluable":
  * "Pies dentro zona" - si no puedes ver la línea o el momento del toque
  * "SIN SALTO" - si no puedes ver claramente si despega antes o después del toque
  * "Rotación balón" - si no puedes ver el backspin claramente
  * Cualquier parámetro donde la visibilidad sea limitada

🔴 CRÍTICO: Evalúa "Set point altura según edad" considerando la edad del jugador

🚨🚨🚨 CRITERIOS ESTRICTOS PARA INFRACCIONES REGLAMENTARIAS 🚨🚨🚨

🔴 PARÁMETRO: "SIN SALTO" - INFRACCIÓN REGLAMENTARIA GRAVE
CRITERIO: Los pies NO deben despegar ANTES de que el balón toque el aro. 
          En tiro libre profesional, NO se salta. Si salta, incluso después, indica falta de control.

🚨 EVALUABILIDAD CRÍTICA:
- Para evaluar este parámetro, NECESITAS ver CLARAMENTE:
  1. Los PIES del jugador durante todo el movimiento
  2. El MOMENTO del TOQUE del balón al aro (o al menos poder estimarlo con precisión)
  3. Si los pies despegan antes o después del toque
- Si el video es solo de COSTADO o solo de FRENTE, puede que NO puedas ver:
  - El momento exacto del toque del aro claramente
  - Si los pies despegan antes o después del toque

⚠️ REGLA ESTRICTA: Si NO puedes ver CLARAMENTE los pies Y el momento del toque:
   → USA "no_evaluable" en status
   → NO inventes una calificación
   → Comenta: "No evaluable - No se puede determinar claramente si los pies despegan antes o después del toque del balón desde los ángulos disponibles"

EVALUACIÓN (SOLO si puedes ver claramente):
- ✅ 90-100: NO hay salto en absoluto - pies permanecen en contacto con el suelo durante todo el tiro (PERFECTO)
- ✅ 85-89: Mínimo levantamiento de talones pero pies NO despegan completamente (excelente)
- ⚠️ 70-84: Pies despegan SOLO DESPUÉS del toque del aro (técnicamente no es infracción, pero no es óptimo)
- ❌ 50-69: Pies despegan JUSTO en el momento del toque (límite - califica BAJO)
- ❌ 30-49: Pies despegan CLARAMENTE ANTES del toque (INFRACCIÓN - califica MUY BAJO)
- ❌ 1-29: Salto VISIBLE y MARCADO antes del toque (INFRACCIÓN GRAVE - califica EXTREMADAMENTE BAJO)

⚠️ IMPORTANTE: 
   - Si NO puedes ver el momento del toque claramente → "no_evaluable" (NO califiques)
   - En tiro libre, la técnica CORRECTA es NO saltar. Si salta (incluso después), califica más bajo.
   - Si salta ANTES del toque → INFRACCIÓN GRAVE → 1-49 puntos (NO "Correcto")
   - Si salta DESPUÉS del toque → No es infracción, pero mala técnica → 70-84 puntos máximo
   - Comenta específicamente: "INFRACCIÓN: Los pies despegan antes del toque" O "Mala técnica: Salta después del toque"

🔴 PARÁMETRO: "Pies dentro zona" - INFRACCIÓN REGLAMENTARIA
CRITERIO: Los pies NO deben pisar la línea de tiro libre ANTES del toque del aro.
          En tiro libre profesional, los pies se mantienen dentro durante todo el movimiento.
          Si invade después del toque, indica desequilibrio y mala técnica.

🚨 EVALUABILIDAD CRÍTICA:
- Para evaluar este parámetro, NECESITAS ver CLARAMENTE:
  1. La LÍNEA de tiro libre
  2. Los PIES del jugador
  3. El MOMENTO del TOQUE del balón al aro (o al menos poder estimarlo)
- Si el video es solo de COSTADO o solo de FRENTE, puede que NO puedas ver:
  - La línea completa
  - El momento exacto del toque del aro
  - Si los pies tocan la línea antes o después del toque

⚠️ REGLA ESTRICTA: Si NO puedes ver CLARAMENTE la línea Y el momento del toque:
   → USA "no_evaluable" en status
   → NO inventes una calificación
   → Comenta: "No evaluable - No se puede ver claramente la línea de tiro libre o el momento del toque del balón desde los ángulos disponibles"

EVALUACIÓN (SOLO si puedes ver claramente):
- ✅ 90-100: Pies completamente dentro, nunca tocan la línea, permanecen dentro durante todo el movimiento (PERFECTO)
- ✅ 85-89: Pies dentro con espacio visible desde la línea, se mantienen dentro (excelente)
- ⚠️ 70-84: Pies muy cerca de la línea pero sin pisarla, o tocan/invaden SOLO DESPUÉS del toque (técnicamente no es infracción, pero mala técnica)
- ❌ 50-69: Pies muy cerca de la línea, límite aceptable (mejorable)
- ❌ 30-49: Un pie TOCA la línea antes del toque (INFRACCIÓN - califica MUY BAJO)
- ❌ 1-29: Pies CLARAMENTE pisando o sobrepasando la línea ANTES del toque (INFRACCIÓN GRAVE - califica EXTREMADAMENTE BAJO)

⚠️ IMPORTANTE: 
   - Si NO puedes ver la línea o el momento del toque → "no_evaluable" (NO califiques)
   - Si pisa la línea ANTES del toque → INFRACCIÓN → 1-49 puntos (NO "Correcto")
   - Si invade SOLO DESPUÉS del toque → No es infracción, pero mala técnica → 70-84 puntos máximo
   - La técnica correcta es mantener los pies dentro durante todo el movimiento
   - Comenta específicamente: "INFRACCIÓN: Pie(s) pisan/tocan la línea antes del toque" O "Mala técnica: Invade la línea después del toque"

🔴 PARÁMETRO: "Balance vertical" - Estabilidad en tiro libre
CRITERIO: Sin movimientos laterales significativos durante y después del tiro.
          Este parámetro captura problemas de equilibrio, incluyendo saltos o invasiones de línea DESPUÉS del toque.

EVALUACIÓN ESTRICTA:
- ✅ 90-100: Perfectamente balanceado, sin movimientos laterales, sin saltos, sin invasión de línea
- ✅ 80-89: Balanceado con movimientos laterales mínimos, control total
- ⚠️ 60-79: Movimientos laterales visibles o salta después del toque o invade línea después → Problemas de control
- ⚠️ 36-59: Pérdida de equilibrio significativa, movimientos laterales marcados
- ❌ 0-35: Pérdida de balance grave, desequilibrio evidente

⚠️ NOTA: 
   - Si salta o invade línea DESPUÉS del toque, esto se refleja en este parámetro (60-79 puntos máximo)
   - Si hay desequilibrio durante el tiro, califica bajo también aquí
   - Comenta: "Desequilibrio: Salta/invade después del toque" o "Pérdida de balance durante el movimiento"

Si incluyes parámetros de tres puntos o más/menos de 19 parámetros, el análisis será RECHAZADO.

Video proporcionado.`;

    const content = [
      { text: librePrompt },
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

    const result = await model.generateContent({ contents: [{ role: 'user', parts: content }] });
    const response = result.response;
    const jsonText = response.text();
    const parsed = JSON.parse(jsonText);
    return parsed;
  }

  // PROMPT SIMPLIFICADO - Solo lo esencial para los 22 parámetros (tres puntos)
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
- "Ángulo de codo estable en ascenso": En video lateral suele ser evaluable; busca cambios antes del set point
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
      {"name": "Ángulo de codo estable en ascenso", "score": 61, "status": "Mejorable", "comment": "El ángulo del codo varía antes del set point", "evidencia": "Visible en el video"},
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
- Devuelve EXACTAMENTE 22 parámetros en technicalAnalysis.parameters
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
