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

    console.log('[TEST-NEW-PROMPT] Archivo validado:', file.name, file.size, 'bytes');

    // Configurar Gemini con configuración estricta
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 
      process.env.GOOGLE_API_KEY || 
      process.env.GOOGLE_GENAI_API_KEY || 
      'AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4'
    );
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite-preview',
      generationConfig: {
        temperature: 0.1,  // Mínima creatividad
        topP: 0.8,
        topK: 10,
        maxOutputTokens: 8192,
      }
    });

    // Convertir el archivo a base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'video/mp4';

    console.log('[TEST-NEW-PROMPT] Enviando video a Gemini con prompt definitivo...');

    const prompt = `
🚨 ANÁLISIS FORENSE DE VIDEO - MODO ESTRICTO ANTI-SIMULACIÓN

VERIFICACIÓN INICIAL OBLIGATORIA:
Antes de analizar, DEMUESTRA que ves el video respondiendo:
1. Duración exacta del video en segundos
2. ¿El jugador tira con mano derecha o izquierda?
3. ¿Salta durante el tiro? (sí/no)
4. ¿Se ve la canasta en el video? (sí/no)
5. ¿Desde qué ángulo está grabado? (frontal/lateral/diagonal)
6. ¿Qué elementos del entorno son visibles? (pared, suelo, otros objetos)

⚡ OPTIMIZACIÓN PARA VIDEOS LARGOS:
- Enfócate en los primeros 10-15 segundos del video para el análisis técnico
- Si el video es muy largo, analiza solo el primer lanzamiento completo
- No es necesario analizar cada frame, solo los momentos clave del tiro

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
2. Para CADA parámetro evaluable, proporciona TIMESTAMP exacto donde lo observas
3. DESCRIBE LITERALMENTE lo que ves (NO interpretación)
4. SCORE basado únicamente en evidencia visual
5. Si NO es visible: score = 0 y feedback = "No visible en este ángulo"

⛔ PALABRAS PROHIBIDAS (si las usas, serás rechazado):
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"
- "general", "aproximadamente", "parece que"

✅ PALABRAS REQUERIDAS (debes usar):
- "En el segundo X.X", "Entre X.Xs y X.Xs"
- "Visible/No visible", "Parcialmente oculto"
- "Ángulo de cámara no permite ver"

📋 CHECKLIST CANÓNICO CON SISTEMA "NO EVALUABLE":

Para CADA parámetro, tienes 3 opciones:
1️⃣ CLARAMENTE VISIBLE → Asigna score 1-5 con evidencia y timestamp
2️⃣ PARCIALMENTE VISIBLE → Score con advertencia sobre limitaciones
3️⃣ NO EVALUABLE → score: 0, na: true, razon: explicación específica

Checklist obligatorio (22 parámetros):

1) PREPARACIÓN:
   - id: "alineacion_pies", name: "Alineación de los pies"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
     Si ves ambos pies → score + timestamp + observación específica
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
   - id: "muneca_cargada", name: "Muñeca cargada"
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
   - id: "enfoque_visual", name: "Enfoque visual"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"

2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)"
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo"
   - id: "angulo_codo_fijo_ascenso", name: "Ángulo de codo estable en ascenso"
   - id: "subida_recta_balon", name: "Subida recta del balón"
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
   - id: "set_point", name: "Set point"
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"

3) FLUIDEZ (PESO: 47.5% - CRÍTICO):
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     CUENTA pausas > 0.2s, marca timestamps de inicio/fin
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     COMPARA timestamps de extensión de piernas vs brazos

4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación"
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
   - id: "angulo_salida", name: "Ángulo de salida"

5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
   - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
   - id: "duracion_follow_through", name: "Duración del follow-through"
   - id: "consistencia_repetitiva", name: "Consistencia repetitiva"

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

FORMATO DE RESPUESTA OBLIGATORIO:
{
  "verificacion_inicial": {
    "duracion_video": "X.XXs",
    "mano_tiro": "derecha/izquierda",
    "salta": true/false,
    "canasta_visible": true/false,
    "angulo_camara": "descripción específica",
    "elementos_entorno": ["lista de objetos visibles"]
  },
  
  "analysisSummary": "Resumen basado SOLO en parámetros evaluables",
  "strengths": ["Fortalezas basadas en evidencia visual específica"],
  "weaknesses": ["Debilidades basadas en evidencia visual específica"],
  "recommendations": ["Recomendaciones específicas con timestamps"],
  
  "selectedKeyframes": [1, 4, 7, 10, 2, 9],
  "keyframeAnalysis": "Explicación de por qué estos keyframes fueron seleccionados",
  
  "detailedChecklist": [
    {
      "category": "Preparación",
      "items": [
        {
          "id": "alineacion_pies",
          "name": "Alineación de los pies",
          "status": "Correcto/Mejorable/Incorrecto/no_evaluable",
          "rating": [1-5] o 0 si no_evaluable,
          "na": true/false,
          "comment": "En X.Xs, observo... / No evaluable: pies fuera de encuadre",
          "timestamp": "X.Xs",
          "evidencia": "Descripción literal de lo que VES"
        }
        // ... resto de parámetros con mismo formato
      ]
    }
    // ... resto de categorías
  ],
  
  "resumen_evaluacion": {
    "parametros_evaluados": X,
    "parametros_no_evaluables": Y,
    "lista_no_evaluables": ["parámetro: razón específica"],
    "score_global": X.X,
    "nota": "Score calculado solo con X de 22 parámetros evaluables",
    "confianza_analisis": "alta/media/baja"
  },
  
  "caracteristicas_unicas": [
    "El jugador usa [descripción específica de ropa]",
    "En el fondo se ve [descripción específica]",
    "El movimiento incluye [detalle específico]"
  ]
}

⚠️ ADVERTENCIA FINAL:
Si tu análisis podría aplicar a CUALQUIER video de baloncesto, será RECHAZADO.
Cada análisis debe ser TAN específico que SOLO aplique a ESTE video.

Si más del 50% de parámetros son "no_evaluables", incluye:
"advertencia": "Análisis limitado por calidad/ángulo del video. Se recomienda nuevo video con mejores condiciones."

RESPONDE ÚNICAMENTE CON JSON VÁLIDO. NO incluyas texto adicional fuera del JSON.
`;

    // Ejecutar análisis con timeout más largo para videos grandes
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: El análisis tardó más de 3 minutos')), 180000); // 3 minutos
    });

    const analysisPromise = model.generateContent([
      prompt, 
      { inlineData: { data: base64, mimeType: mimeType } }
    ]);

    const response = await Promise.race([analysisPromise, timeoutPromise]) as any;
    const text = response.response.text();

    console.log('[TEST-NEW-PROMPT] Respuesta recibida de Gemini:', text.length, 'caracteres');

    // Parsear respuesta JSON
    let result;
    try {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON válido en la respuesta');
      }
    } catch (parseError) {
      console.error('[TEST-NEW-PROMPT] Error parseando JSON:', parseError);
      console.error('[TEST-NEW-PROMPT] Respuesta completa:', text);
      
      // Crear resultado de fallback
      result = {
        verificacion_inicial: {
          duracion_video: "Error de parsing",
          mano_tiro: "No determinado",
          salta: false,
          canasta_visible: false,
          angulo_camara: "No determinado",
          elementos_entorno: []
        },
        analysisSummary: "Error al parsear respuesta de Gemini",
        strengths: [],
        weaknesses: ["Error técnico en el análisis"],
        recommendations: ["Reintentar con otro video"],
        selectedKeyframes: [],
        keyframeAnalysis: "No disponible debido a error de parsing",
        detailedChecklist: [],
        resumen_evaluacion: {
          parametros_evaluados: 0,
          parametros_no_evaluables: 22,
          lista_no_evaluables: ["Error de parsing de respuesta"],
          score_global: 0,
          nota: "Error técnico - no se pudo calcular score",
          confianza_analisis: "baja"
        },
        caracteristicas_unicas: [],
        advertencia: "Error técnico en el análisis. Por favor, reintenta."
      };
    }

    console.log('[TEST-NEW-PROMPT] Análisis completado exitosamente');

    return NextResponse.json({
      success: true,
      videoName: file.name,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TEST-NEW-PROMPT] Error en análisis:', error?.message || error);
    return NextResponse.json({ 
      success: false,
      videoName: 'archivo desconocido',
      result: null,
      timestamp: new Date().toISOString(),
      error: error?.message || 'Error desconocido'
    }, { status: 500 });
  }
}
