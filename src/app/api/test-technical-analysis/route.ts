import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[TECHNICAL] Iniciando análisis técnico de lanzamiento...');
    
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

    console.log('[TECHNICAL] Archivo validado:', file.name, file.size, 'bytes');

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

    console.log('[TECHNICAL] Analizando técnica del lanzamiento...');

    const prompt = `
    Eres un entrenador experto de baloncesto. Analiza este video de lanzamiento y evalúa los 22 parámetros técnicos del tiro.

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
    7. Mano no dominante guía el balón (¿mano guía visible?)
    8. Codos cerca del cuerpo (¿codos no abiertos?)
    9. Balón sube en línea recta (¿trayectoria recta?)
    10. Trayectoria suave al set point (¿movimiento fluido?)
    11. Set point sobre la cabeza (¿balón sobre cabeza?)
    12. Timing correcto (¿no muy rápido/lento?)

    FLUIDEZ:
    13. Tiro en un solo movimiento continuo (¿movimiento fluido?)
    14. Sincronización piernas-brazos (¿todo junto?)

    LIBERACIÓN:
    15. Mano guía se retira a tiempo (¿mano guía se quita?)
    16. Extensión completa del brazo (¿brazo extendido?)
    17. Muñeca con snap hacia abajo (¿muñeca activa?)
    18. Ángulo de salida apropiado (¿ángulo bueno?)

    SEGUIMIENTO:
    19. Mantiene follow-through (¿follow-through visible?)
    20. Equilibrio al aterrizar (¿aterriza equilibrado?)
    21. Duración del follow-through (¿mantiene 1-2 seg?)
    22. Consistencia general del movimiento (¿movimiento consistente?)

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
      "principales_mejoras": ["Mano guía se retira tarde", "Set point un poco bajo"],
      "principales_fortalezas": ["Excelente follow-through", "Buena flexión de rodillas", "Hombros relajados"]
    }
    `;

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
    
    console.log('[TECHNICAL] Respuesta cruda de Gemini:', text);
    
    // Parsear la respuesta JSON
    let parsedResponse;
    try {
      // Buscar JSON en el texto
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (e) {
      console.log('[TECHNICAL] Error parseando JSON:', e);
      
      // Fallback: análisis básico
      parsedResponse = {
        preparacion: {
          alineacion_pies: { score: 5, feedback: "No se pudo determinar claramente" },
          alineacion_cuerpo: { score: 5, feedback: "No se pudo determinar claramente" },
          muneca_cargada: { score: 5, feedback: "No se pudo determinar claramente" },
          flexion_rodillas: { score: 5, feedback: "No se pudo determinar claramente" },
          hombros_relajados: { score: 5, feedback: "No se pudo determinar claramente" },
          mirada_enfoque: { score: 5, feedback: "No se pudo determinar claramente" }
        },
        ascenso: {
          mano_guia: { score: 5, feedback: "No se pudo determinar claramente" },
          codos_cuerpo: { score: 5, feedback: "No se pudo determinar claramente" },
          balon_recto: { score: 5, feedback: "No se pudo determinar claramente" },
          trayectoria_suave: { score: 5, feedback: "No se pudo determinar claramente" },
          set_point: { score: 5, feedback: "No se pudo determinar claramente" },
          timing: { score: 5, feedback: "No se pudo determinar claramente" }
        },
        fluidez: {
          movimiento_continuo: { score: 5, feedback: "No se pudo determinar claramente" },
          sincronizacion: { score: 5, feedback: "No se pudo determinar claramente" }
        },
        liberacion: {
          mano_guia_retira: { score: 5, feedback: "No se pudo determinar claramente" },
          extension_completa: { score: 5, feedback: "No se pudo determinar claramente" },
          muneca_snap: { score: 5, feedback: "No se pudo determinar claramente" },
          angulo_salida: { score: 5, feedback: "No se pudo determinar claramente" }
        },
        seguimiento: {
          follow_through: { score: 5, feedback: "No se pudo determinar claramente" },
          equilibrio_aterrizaje: { score: 5, feedback: "No se pudo determinar claramente" },
          duracion_follow: { score: 5, feedback: "No se pudo determinar claramente" },
          consistencia: { score: 5, feedback: "No se pudo determinar claramente" }
        },
        score_global: 5.0,
        principales_mejoras: ["Error en el análisis técnico"],
        principales_fortalezas: ["Error en el análisis técnico"]
      };
    }

    console.log('[TECHNICAL] Análisis completado:', parsedResponse);

    return NextResponse.json({
      success: true,
      videoName: file.name,
      result: parsedResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TECHNICAL] Error en análisis técnico:', error?.message || error);
    return NextResponse.json({ 
      success: false,
      videoName: 'archivo desconocido',
      result: {
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
        principales_mejoras: ['Error técnico'],
        principales_fortalezas: ['Error técnico']
      },
      timestamp: new Date().toISOString(),
      error: error?.message || 'Error desconocido'
    }, { status: 500 });
  }
}
