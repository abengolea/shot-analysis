import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Función de retry con backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
      
      // Solo reintentar en errores 429 (rate limit) o 500 (server error)
      if (error?.status === 429 || error?.status === 500) {
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`🔄 Reintento ${attempt + 1}/${maxRetries} en ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError!;
}

export async function analyzeVideoSingleCall(
  videoBase64: string,
  secondVideoBase64?: string,
  thirdVideoBase64?: string,
  fourthVideoBase64?: string
): Promise<any> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3.1-flash-lite-preview",
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    }
  });

  const prompt = secondVideoBase64 ? `
ANÁLISIS MULTI-SESIÓN - Analiza estos ${thirdVideoBase64 ? (fourthVideoBase64 ? '4' : '3') : '2'} videos de TIROS DIFERENTES y combina los 22 parámetros:

VIDEO 1: Sesión lateral - Tiros desde ángulo lateral (momento 1)
VIDEO 2: Sesión frontal - Tiros desde ángulo frontal (momento 2)  
${thirdVideoBase64 ? 'VIDEO 3: Sesión adicional - Tiros desde ángulo adicional (momento 3)' : ''}
${fourthVideoBase64 ? 'VIDEO 4: Sesión extra - Tiros desde ángulo extra (momento 4)' : ''}

IMPORTANTE: 
- Cada video contiene TIROS DIFERENTES en momentos diferentes
- NO son el mismo tiro desde diferentes ángulos
- Detecta TODOS los tiros en cada video por separado
- Marca cada tiro con su video de origen:
  * Tiros del video 1: "lateral"
  * Tiros del video 2: "frontal"
  * Tiros del video 3: "additional"
  * Tiros del video 4: "extra"
- Con ${thirdVideoBase64 ? (fourthVideoBase64 ? '4' : '3') : '2'} videos deberías detectar MÁS tiros totales
- Combina la información técnica de TODOS los tiros para análisis general

👤 DETECCIÓN DE JUGADORES (para análisis multi-sesión):
- Analiza las características físicas de cada jugador en cada video
- Compara si son el MISMO jugador o JUGADORES DIFERENTES
- Incluye en playerCharacteristics:
  * Altura relativa (alto/medio/bajo comparado con canasta)
  * Complexión corporal (delgado/medio/robusto)
  * Tono de piel (claro/medio/oscuro)
  * Color de cabello (rubio/castano/negro/otro)
  * Ropa específica (colores exactos de camiseta y pantalones)
  * Características únicas (tatuajes, accesorios, etc.)
  * Mano dominante (derecha/izquierda)
- Si hay MÚLTIPLES JUGADORES, identifica cuáles son diferentes

🔍 VERIFICACIÓN DETALLADA DE VIDEO REAL:
Para confirmar que estás analizando el video real (no simulando), incluye en verification:
- specificColors: Colores EXACTOS que ves (ej: "camiseta azul marino, pantalones negros con rayas blancas, pelota naranja")
- uniqueObjects: Objetos específicos del video (ej: "canasta Spalding, tablero transparente, líneas de cancha amarillas")
- specificEnvironment: Detalles únicos del entorno (ej: "piso de madera, iluminación fluorescente, paredes blancas con ventanas")
- specificActions: Movimientos específicos observados (ej: "jugador salta con pierna izquierda, sigue con la mano derecha")
- environment: Tipo de lugar (gimnasio/cancha exterior/otro)
- videoQuality: Calidad del video (excelente/buena/regular/mala)

Combina todos los tiros de todas las sesiones para los 22 parámetros completos.

IMPORTANTE: DEBES incluir EXACTAMENTE 22 parámetros en technicalAnalysis.parameters

🎯 SISTEMA DE PESOS ACTUALIZADO (para calcular score_global):
- FLUIDEZ: 47.5% peso (CRÍTICO - más importante)
- RESTO DE CATEGORÍAS: 25.06% peso (ALTO)
- SET POINT: 7.86% peso (MEDIO)
- CODO: 6.88% peso (MEDIO) 
- ÁNGULO CODO ESTABLE: 5% peso (MEDIO)
- MANO LIBERACIÓN: 3.10% peso (BAJO)
- MANO ASCENSO: 2.07% peso (BAJO)

🔍 REGLAS FUNDAMENTALES:
1. Si NO puedes ver claramente un parámetro, usa "no_evaluable" en lugar de inventar un score
2. Para CADA parámetro evaluable, proporciona evidencia visual específica
3. DESCRIBE LITERALMENTE lo que ves (NO interpretación)
4. SCORE basado únicamente en evidencia visual
5. Si NO es visible: score = 0 y feedback = "No visible en este ángulo"

⛔ PALABRAS PROHIBIDAS (si las usas, serás rechazado):
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"
- "general", "aproximadamente", "parece que"

✅ PALABRAS REQUERIDAS (debes usar):
- "Visible/No visible", "Parcialmente oculto"
- "Ángulo de cámara no permite ver"
- "Claramente visible", "No se puede evaluar"

⚠️ FORMATO ESTRICTO DE CAMPOS:
- comment: Descripción del análisis técnico (MÁXIMO 100 caracteres)
- evidencia: Lo que VES literalmente en el video (MÁXIMO 60 caracteres)

📋 CHECKLIST CANÓNICO CON SISTEMA "NO EVALUABLE":

Para CADA parámetro, tienes 3 opciones:
1️⃣ CLARAMENTE VISIBLE → Asigna score 1-10 con evidencia
2️⃣ PARCIALMENTE VISIBLE → Score con advertencia sobre limitaciones
3️⃣ NO EVALUABLE → score: 0, na: true, razon: explicación específica

Checklist obligatorio (22 parámetros):

1) PREPARACIÓN:
   - id: "alineacion_pies", name: "Alineación de los pies"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
     Si ves ambos pies → score + observación específica
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
   - id: "muneca_cargada", name: "Muñeca cargada"
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
   - id: "enfoque_visual", name: "Enfoque visual"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"

2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)" - PESO: 2.07%
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo" - PESO: 6.88%
   - id: "angulo_codo_fijo_ascenso", name: "Ángulo de codo estable en ascenso" - PESO: 5%
   - id: "subida_recta_balon", name: "Subida recta del balón"
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
   - id: "set_point", name: "Set point" - PESO: 7.86%
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"

3) FLUIDEZ (PESO: 47.5% - CRÍTICO):
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     CUENTA pausas > 0.2s, marca observaciones de inicio/fin
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     COMPARA extensión de piernas vs brazos

4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación" - PESO: 3.10%
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
   - id: "angulo_salida", name: "Ángulo de salida"

5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
   - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
   - id: "duracion_follow_through", name: "Duración del follow-through"
   - id: "consistencia_repetitiva", name: "Consistencia repetitiva"

6) CONSISTENCIA ENTRE TIROS (2 parámetros):
   - id: "consistencia_tecnica", name: "Consistencia técnica"
   - id: "consistencia_resultados", name: "Consistencia de resultados"

📊 CÁLCULO DE SCORE GLOBAL:
IMPORTANTE: Solo calcula el score con parámetros EVALUABLES:
score_global = Σ(peso_i × score_i) / Σ(peso_i)

Si un parámetro es "no_evaluable", NO lo incluyas en el cálculo.

🔍 VALIDACIÓN FINAL:
Lista 3 características ÚNICAS de ESTE video:
1. [Algo específico del entorno/fondo]
2. [Algo específico del jugador/ropa]
3. [Algo específico del movimiento]

Si no puedes dar estos detalles, NO estás analizando el video real.

DEVUELVE UN JSON con esta estructura exacta:
{
  "videoInfo": {
    "duration": "10",
    "quality": "good",
    "fps": 4,
    "resolution": "360p"
  },
  "verification": {
    "isReal": true,
    "confidence": 95,
    "description": "Video real de baloncesto con detalles específicos",
    "canSeeBasket": true/false,
    "cameraAngle": "frontal/lateral/diagonal",
    "basketVisible": true/false,
    "shotResultsVisible": true/false,
    "environment": "gimnasio/cancha exterior/otro",
    "videoQuality": "excelente/buena/regular/mala",
    "specificColors": "colores específicos detectados (ej: camiseta azul, pantalones negros, pelota naranja)",
    "uniqueObjects": "objetos únicos en el video (ej: marca de canasta, logos, equipamiento específico)",
    "specificEnvironment": "detalles específicos del entorno (ej: tipo de piso, iluminación, paredes)",
    "specificActions": "acciones específicas observadas (ej: movimientos únicos del jugador, secuencia de tiros)",
    "playerCharacteristics": {
      "height": "alto/medio/bajo/indeterminado",
      "build": "delgado/medio/robusto/indeterminado",
      "skinTone": "claro/medio/oscuro/indeterminado",
      "hairColor": "rubio/castano/negro/otro/indeterminado",
      "clothing": "camiseta color, pantalones color",
      "uniqueFeatures": ["característica única 1", "característica única 2"],
      "dominantHand": "derecha/izquierda/indeterminado"
    }
  },
  "shots": [
    {
      "shotNumber": 1,
      "startTime": "0:02",
      "endTime": "0:05",
      "result": "made/missed/unknown",
      "confidence": 90,
      "canSeeResult": true/false,
      "cameraAngle": "lateral/frontal/additional/all",
      "visibleIn": ["lateral", "frontal", "additional"],
      "technique": {
        "stance": 8,
        "release": 7,
        "followThrough": 9,
        "arc": 8,
        "balance": 8
      }
    }
  ],
  "shotSummary": {
    "totalShots": 6,
    "lateralShots": 3,
    "frontalShots": 3,
    "additionalShots": 3,
    "allAngles": 3,
    "lateralOnly": 0,
    "frontalOnly": 0,
    "additionalOnly": 0,
    "lateralFrontal": 0,
    "lateralAdditional": 0,
    "frontalAdditional": 0
  },
  "technicalAnalysis": {
    "overallScore": 65,
    "strengths": ["Extensión completa del brazo", "Enfoque visual correcto"],
    "weaknesses": ["Tiempo de lanzamiento muy lento", "Falta backspin en la pelota"],
    "recommendations": ["Mejorar velocidad de lanzamiento", "Practicar giro de la pelota"],
    "parameters": [
      {"name": "Alineación de pies", "score": 65, "status": "Mejorable", "comment": "Pies ligeramente desalineados", "evidencia": "Pies no paralelos al aro", "na": false},
      {"name": "Alineación del cuerpo", "score": 60, "status": "Mejorable", "comment": "Cuerpo inclinado hacia adelante", "evidencia": "Hombros adelantados", "na": false},
      {"name": "Muñeca cargada", "score": 70, "status": "Mejorable", "comment": "Muñeca no completamente cargada", "evidencia": "Ángulo de muñeca insuficiente", "na": false},
      {"name": "Flexión de rodillas", "score": 55, "status": "Incorrecto", "comment": "Flexión insuficiente para generar potencia", "evidencia": "Rodillas apenas flexionadas", "na": false},
      {"name": "Hombros relajados", "score": 75, "status": "Mejorable", "comment": "Hombros ligeramente tensos", "evidencia": "Elevación de hombros visible", "na": false},
      {"name": "Enfoque visual", "score": 80, "status": "Correcto", "comment": "Mira hacia el aro", "evidencia": "Cabeza orientada al objetivo", "na": false},
      {"name": "Mano no dominante ascenso", "score": 50, "status": "Incorrecto", "comment": "Mano guía interfiere en el ascenso", "evidencia": "Mano izquierda tira hacia abajo", "na": false},
      {"name": "Codos cerca del cuerpo", "score": 65, "status": "Mejorable", "comment": "Codos separados del cuerpo", "evidencia": "Codos abiertos hacia afuera", "na": false},
      {"name": "Subida recta del balón", "score": 60, "status": "Mejorable", "comment": "Trayectoria del balón irregular", "evidencia": "Balón se mueve en arco amplio", "na": false},
      {"name": "Trayectoria hasta set point", "score": 70, "status": "Mejorable", "comment": "Trayectoria aceptable pero mejorable", "evidencia": "Movimiento no completamente recto", "na": false},
      {"name": "Set point", "score": 75, "status": "Mejorable", "comment": "Set point ligeramente bajo", "evidencia": "Balón por debajo de la cabeza", "na": false},
      {"name": "Tiempo de lanzamiento", "score": 45, "status": "Incorrecto", "comment": "Tiempo de lanzamiento muy lento", "evidencia": "Pausa excesiva en set point", "na": false},
      {"name": "Mano no dominante liberación", "score": 55, "status": "Incorrecto", "comment": "Mano guía interfiere en la liberación", "evidencia": "Mano izquierda no se separa a tiempo", "na": false},
      {"name": "Extensión completa del brazo", "score": 80, "status": "Correcto", "comment": "Buena extensión del brazo", "evidencia": "Brazo completamente extendido", "na": false},
      {"name": "Giro de la pelota", "score": 40, "status": "Incorrecto", "comment": "Falta backspin en la pelota", "evidencia": "Pelota sin rotación visible", "na": false},
      {"name": "Ángulo de salida", "score": 70, "status": "Mejorable", "comment": "Ángulo de salida aceptable", "evidencia": "Trayectoria hacia arriba correcta", "na": false},
      {"name": "Mantenimiento del equilibrio", "score": 75, "status": "Mejorable", "comment": "Equilibrio aceptable durante el tiro", "evidencia": "Cuerpo estable durante el movimiento", "na": false},
      {"name": "Equilibrio en aterrizaje", "score": 70, "status": "Mejorable", "comment": "Aterrizaje con ligero desequilibrio", "evidencia": "Pie izquierdo adelantado al aterrizar", "na": false},
      {"name": "Duración del follow-through", "score": 60, "status": "Mejorable", "comment": "Follow through corto", "evidencia": "Mano se retira rápidamente", "na": false},
      {"name": "Consistencia del movimiento", "score": 50, "status": "Incorrecto", "comment": "Movimiento inconsistente entre tiros", "evidencia": "Variaciones en cada tiro", "na": false},
      {"name": "Consistencia técnica", "score": 55, "status": "Incorrecto", "comment": "Técnica variable entre tiros", "evidencia": "Diferentes posiciones en cada tiro", "na": false},
      {"name": "Consistencia de resultados", "score": 65, "status": "Mejorable", "comment": "Resultados variables", "evidencia": "Algunos tiros entran, otros no", "na": false}
    ]
  },
  "details": {
    "colors": "Describe EXACTAMENTE los colores que ves",
    "objects": "Lista SOLO los objetos que realmente ves",
    "actions": "Describe las acciones que realmente ves",
    "environment": "Describe el entorno que realmente ves",
    "uniqueDetails": "3 detalles únicos que solo pueden venir de este video específico"
  },
  "simulationCheck": {
    "isSimulating": true/false,
    "reason": "Por qué crees que es real o simulado",
    "evidence": "Evidencia específica del video"
  }
}

IMPORTANTE: 
- Si NO ves el aro, marca "basketVisible": false
- Si NO puedes ver si encestó, marca "result": "unknown"
- Describe SOLO lo que realmente ves, no inventes
- Si hay duda, marca "unknown" o "false"

Solo JSON, sin texto adicional.
` : `
VERIFICACIÓN ESTRICTA - Analiza este video de baloncesto y evalúa los 22 parámetros:

IMPORTANTE: DEBES incluir EXACTAMENTE 22 parámetros en technicalAnalysis.parameters

🎯 SISTEMA DE PESOS ACTUALIZADO (para calcular score_global):
- FLUIDEZ: 47.5% peso (CRÍTICO - más importante)
- RESTO DE CATEGORÍAS: 25.06% peso (ALTO)
- SET POINT: 7.86% peso (MEDIO)
- CODO: 6.88% peso (MEDIO)
- ÁNGULO CODO ESTABLE: 5% peso (MEDIO)
- MANO LIBERACIÓN: 3.10% peso (BAJO)
- MANO ASCENSO: 2.07% peso (BAJO)

🔍 REGLAS FUNDAMENTALES:
1. Si NO puedes ver claramente un parámetro, usa "no_evaluable" en lugar de inventar un score
2. Para CADA parámetro evaluable, proporciona evidencia visual específica
3. DESCRIBE LITERALMENTE lo que ves (NO interpretación)
4. SCORE basado únicamente en evidencia visual
5. Si NO es visible: score = 0 y feedback = "No visible en este ángulo"

⛔ PALABRAS PROHIBIDAS (si las usas, serás rechazado):
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"
- "general", "aproximadamente", "parece que"

✅ PALABRAS REQUERIDAS (debes usar):
- "Visible/No visible", "Parcialmente oculto"
- "Ángulo de cámara no permite ver"
- "Claramente visible", "No se puede evaluar"

⚠️ FORMATO ESTRICTO DE CAMPOS:
- comment: Descripción del análisis técnico (MÁXIMO 100 caracteres)
- evidencia: Lo que VES literalmente en el video (MÁXIMO 60 caracteres)

📋 CHECKLIST CANÓNICO CON SISTEMA "NO EVALUABLE":

Para CADA parámetro, tienes 3 opciones:
1️⃣ CLARAMENTE VISIBLE → Asigna score 1-10 con evidencia
2️⃣ PARCIALMENTE VISIBLE → Score con advertencia sobre limitaciones
3️⃣ NO EVALUABLE → score: 0, na: true, razon: explicación específica

Checklist obligatorio (22 parámetros):

1) PREPARACIÓN:
   - id: "alineacion_pies", name: "Alineación de los pies"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
     Si ves ambos pies → score + observación específica
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
   - id: "muneca_cargada", name: "Muñeca cargada"
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
   - id: "enfoque_visual", name: "Enfoque visual"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"

2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)" - PESO: 2.07%
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo" - PESO: 6.88%
   - id: "angulo_codo_fijo_ascenso", name: "Ángulo de codo estable en ascenso" - PESO: 5%
   - id: "subida_recta_balon", name: "Subida recta del balón"
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
   - id: "set_point", name: "Set point" - PESO: 7.86%
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"

3) FLUIDEZ (PESO: 47.5% - CRÍTICO):
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     CUENTA pausas > 0.2s, marca observaciones de inicio/fin
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     COMPARA extensión de piernas vs brazos

4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación" - PESO: 3.10%
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
   - id: "angulo_salida", name: "Ángulo de salida"

5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
   - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
   - id: "duracion_follow_through", name: "Duración del follow-through"
   - id: "consistencia_repetitiva", name: "Consistencia repetitiva"

6) CONSISTENCIA ENTRE TIROS (2 parámetros):
   - id: "consistencia_tecnica", name: "Consistencia técnica"
   - id: "consistencia_resultados", name: "Consistencia de resultados"

📊 CÁLCULO DE SCORE GLOBAL:
IMPORTANTE: Solo calcula el score con parámetros EVALUABLES:
score_global = Σ(peso_i × score_i) / Σ(peso_i)

Si un parámetro es "no_evaluable", NO lo incluyas en el cálculo.

🔍 VALIDACIÓN FINAL:
Lista 3 características ÚNICAS de ESTE video:
1. [Algo específico del entorno/fondo]
2. [Algo específico del jugador/ropa]
3. [Algo específico del movimiento]

Si no puedes dar estos detalles, NO estás analizando el video real.

DEVUELVE UN JSON con esta estructura exacta:
{
  "videoInfo": {
    "duration": "10",
    "quality": "good",
    "fps": 4,
    "resolution": "360p"
  },
  "verification": {
    "isReal": true,
    "confidence": 95,
    "description": "Video real de baloncesto con detalles específicos",
    "canSeeBasket": true/false,
    "cameraAngle": "frontal/lateral/diagonal",
    "basketVisible": true/false,
    "shotResultsVisible": true/false,
    "environment": "gimnasio/cancha exterior/otro",
    "videoQuality": "excelente/buena/regular/mala",
    "specificColors": "colores específicos detectados (ej: camiseta azul, pantalones negros, pelota naranja)",
    "uniqueObjects": "objetos únicos en el video (ej: marca de canasta, logos, equipamiento específico)",
    "specificEnvironment": "detalles específicos del entorno (ej: tipo de piso, iluminación, paredes)",
    "specificActions": "acciones específicas observadas (ej: movimientos únicos del jugador, secuencia de tiros)",
    "playerCharacteristics": {
      "height": "alto/medio/bajo/indeterminado",
      "build": "delgado/medio/robusto/indeterminado",
      "skinTone": "claro/medio/oscuro/indeterminado",
      "hairColor": "rubio/castano/negro/otro/indeterminado",
      "clothing": "camiseta color, pantalones color",
      "uniqueFeatures": ["característica única 1", "característica única 2"],
      "dominantHand": "derecha/izquierda/indeterminado"
    }
  },
  "shots": [
    {
      "shotNumber": 1,
      "startTime": "0:02",
      "endTime": "0:05",
      "result": "made/missed/unknown",
      "confidence": 90,
      "canSeeResult": true/false,
      "cameraAngle": "lateral/frontal/additional/all",
      "visibleIn": ["lateral", "frontal", "additional"],
      "technique": {
        "stance": 8,
        "release": 7,
        "followThrough": 9,
        "arc": 8,
        "balance": 8
      }
    }
  ],
  "shotSummary": {
    "totalShots": 6,
    "lateralShots": 3,
    "frontalShots": 3,
    "additionalShots": 3,
    "allAngles": 3,
    "lateralOnly": 0,
    "frontalOnly": 0,
    "additionalOnly": 0,
    "lateralFrontal": 0,
    "lateralAdditional": 0,
    "frontalAdditional": 0
  },
  "technicalAnalysis": {
    "overallScore": 65,
    "strengths": ["Extensión completa del brazo", "Enfoque visual correcto"],
    "weaknesses": ["Tiempo de lanzamiento muy lento", "Falta backspin en la pelota"],
    "recommendations": ["Mejorar velocidad de lanzamiento", "Practicar giro de la pelota"],
    "parameters": [
      {"name": "Alineación de pies", "score": 65, "status": "Mejorable", "comment": "Pies ligeramente desalineados", "evidencia": "Pies no paralelos al aro", "na": false},
      {"name": "Alineación del cuerpo", "score": 60, "status": "Mejorable", "comment": "Cuerpo inclinado hacia adelante", "evidencia": "Hombros adelantados", "na": false},
      {"name": "Muñeca cargada", "score": 70, "status": "Mejorable", "comment": "Muñeca no completamente cargada", "evidencia": "Ángulo de muñeca insuficiente", "na": false},
      {"name": "Flexión de rodillas", "score": 55, "status": "Incorrecto", "comment": "Flexión insuficiente para generar potencia", "evidencia": "Rodillas apenas flexionadas", "na": false},
      {"name": "Hombros relajados", "score": 75, "status": "Mejorable", "comment": "Hombros ligeramente tensos", "evidencia": "Elevación de hombros visible", "na": false},
      {"name": "Enfoque visual", "score": 80, "status": "Correcto", "comment": "Mira hacia el aro", "evidencia": "Cabeza orientada al objetivo", "na": false},
      {"name": "Mano no dominante ascenso", "score": 50, "status": "Incorrecto", "comment": "Mano guía interfiere en el ascenso", "evidencia": "Mano izquierda tira hacia abajo", "na": false},
      {"name": "Codos cerca del cuerpo", "score": 65, "status": "Mejorable", "comment": "Codos separados del cuerpo", "evidencia": "Codos abiertos hacia afuera", "na": false},
      {"name": "Subida recta del balón", "score": 60, "status": "Mejorable", "comment": "Trayectoria del balón irregular", "evidencia": "Balón se mueve en arco amplio", "na": false},
      {"name": "Trayectoria hasta set point", "score": 70, "status": "Mejorable", "comment": "Trayectoria aceptable pero mejorable", "evidencia": "Movimiento no completamente recto", "na": false},
      {"name": "Set point", "score": 75, "status": "Mejorable", "comment": "Set point ligeramente bajo", "evidencia": "Balón por debajo de la cabeza", "na": false},
      {"name": "Tiempo de lanzamiento", "score": 45, "status": "Incorrecto", "comment": "Tiempo de lanzamiento muy lento", "evidencia": "Pausa excesiva en set point", "na": false},
      {"name": "Mano no dominante liberación", "score": 55, "status": "Incorrecto", "comment": "Mano guía interfiere en la liberación", "evidencia": "Mano izquierda no se separa a tiempo", "na": false},
      {"name": "Extensión completa del brazo", "score": 80, "status": "Correcto", "comment": "Buena extensión del brazo", "evidencia": "Brazo completamente extendido", "na": false},
      {"name": "Giro de la pelota", "score": 40, "status": "Incorrecto", "comment": "Falta backspin en la pelota", "evidencia": "Pelota sin rotación visible", "na": false},
      {"name": "Ángulo de salida", "score": 70, "status": "Mejorable", "comment": "Ángulo de salida aceptable", "evidencia": "Trayectoria hacia arriba correcta", "na": false},
      {"name": "Mantenimiento del equilibrio", "score": 75, "status": "Mejorable", "comment": "Equilibrio aceptable durante el tiro", "evidencia": "Cuerpo estable durante el movimiento", "na": false},
      {"name": "Equilibrio en aterrizaje", "score": 70, "status": "Mejorable", "comment": "Aterrizaje con ligero desequilibrio", "evidencia": "Pie izquierdo adelantado al aterrizar", "na": false},
      {"name": "Duración del follow-through", "score": 60, "status": "Mejorable", "comment": "Follow through corto", "evidencia": "Mano se retira rápidamente", "na": false},
      {"name": "Consistencia del movimiento", "score": 50, "status": "Incorrecto", "comment": "Movimiento inconsistente entre tiros", "evidencia": "Variaciones en cada tiro", "na": false},
      {"name": "Consistencia técnica", "score": 55, "status": "Incorrecto", "comment": "Técnica variable entre tiros", "evidencia": "Diferentes posiciones en cada tiro", "na": false},
      {"name": "Consistencia de resultados", "score": 65, "status": "Mejorable", "comment": "Resultados variables", "evidencia": "Algunos tiros entran, otros no", "na": false}
    ]
  },
  "details": {
    "colors": "Describe EXACTAMENTE los colores que ves",
    "objects": "Lista SOLO los objetos que realmente ves",
    "actions": "Describe las acciones que realmente ves",
    "environment": "Describe el entorno que realmente ves",
    "uniqueDetails": "3 detalles únicos que solo pueden venir de este video específico"
  },
  "simulationCheck": {
    "isSimulating": true/false,
    "reason": "Por qué crees que es real o simulado",
    "evidence": "Evidencia específica del video"
  }
}

IMPORTANTE: 
- Si NO ves el aro, marca "basketVisible": false
- Si NO puedes ver si encestó, marca "result": "unknown"
- Describe SOLO lo que realmente ves, no inventes
- Si hay duda, marca "unknown" o "false"

Solo JSON, sin texto adicional.
`;

  const content = [
    {
      text: prompt
    },
    {
      inlineData: {
        mimeType: "video/mp4",
        data: videoBase64
      }
    }
  ];

  if (secondVideoBase64) {
    content.push({
      inlineData: {
        mimeType: "video/mp4",
        data: secondVideoBase64
      }
    });
  }

  if (thirdVideoBase64) {
    content.push({
      inlineData: {
        mimeType: "video/mp4",
        data: thirdVideoBase64
      }
    });
  }

  if (fourthVideoBase64) {
    content.push({
      inlineData: {
        mimeType: "video/mp4",
        data: fourthVideoBase64
      }
    });
  }

  return await retryWithBackoff(async () => {
        const result = await model.generateContent(content);

    const response = await result.response;
    const text = response.text();
    
    console.log('🤖 Respuesta de Gemini recibida:', text.substring(0, 200) + '...');
    
    // Limpiar respuesta de markdown si existe
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    console.log('🤖 Respuesta limpia de Gemini:', jsonStr.substring(0, 200) + '...');
    
        try {
      const debugParse = JSON.parse(jsonStr);
      if (debugParse.technicalAnalysis && debugParse.technicalAnalysis.parameters) {
              } else {
              }
    } catch (e) {
          }
    
    try {
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError);
      console.error('❌ Texto que causó el error:', jsonStr.substring(0, 500));
      throw new Error(`Error parseando respuesta de Gemini: ${parseError}`);
    }
  });
}
