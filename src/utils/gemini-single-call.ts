import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeVideoSingleCall(
  videoBase64: string,
  secondVideoBase64?: string,
  thirdVideoBase64?: string,
  fourthVideoBase64?: string
) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    }
  });

  const prompt = secondVideoBase64 ? `
ANALIZA ESTOS VIDEOS DE BALONCESTO Y DEVUELVE UN JSON CON ESTA ESTRUCTURA EXACTA:

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
  * Color de pelo (rubio/castano/negro/otro)
  * Ropa específica (colores, marcas, detalles)
  * Características únicas (tatuajes, accesorios, etc.)
  * Mano dominante (derecha/izquierda)

🔍 VERIFICACIÓN DETALLADA DE VIDEO REAL:
Para confirmar que estás analizando el video real (no simulando), incluye en verification:
- specificColors: Colores EXACTOS que ves (ej: "camiseta azul marino, pantalones negros con rayas blancas, pelota naranja")
- uniqueObjects: Objetos específicos del video (ej: "canasta Spalding, tablero transparente, líneas de cancha amarillas")
- specificEnvironment: Detalles únicos del entorno (ej: "piso de madera, iluminación fluorescente, paredes blancas con ventanas")
- specificActions: Movimientos específicos observados (ej: "jugador salta con pierna izquierda, sigue con la mano derecha")
- environment: Tipo de lugar (gimnasio/cancha exterior/otro)
- videoQuality: Calidad del video (excelente/buena/regular/mala)

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
     descripcion: "Posición y orientación de pies respecto al aro"
     evaluar: "Separación ancho de hombros ±5cm, pie dominante 10-15° hacia aro, pie no dominante paralelo, peso distribuido 50-50 o 60-40 hacia pie dominante"
     score_10: "Pies ancho hombros, pie dominante ligeramente adelantado 10cm, dedos apuntan al aro"
     score_5: "Separación correcta pero pies muy paralelos o muy abiertos (>30°)"
     score_1: "Pies juntos (<20cm) o muy separados (>ancho hombros +15cm)"
     evidencia_requerida: "Distancia entre pies en cm, ángulo de cada pie"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
     descripcion: "Postura del torso y hombros hacia el aro"
     evaluar: "Hombros cuadrados al aro ±10°, torso con ligera inclinación forward 5-10°, cadera alineada con hombros"
     score_10: "Hombros paralelos al aro, torso erguido con ligera inclinación atlética"
     score_5: "Rotación de hombros 10-20° o torso muy rígido"
     score_1: "Rotación >30° o torso inclinado lateral"
     evidencia_requerida: "Ángulo hombros respecto al aro, inclinación torso"
   
   - id: "muneca_cargada", name: "Muñeca cargada"
     descripcion: "Flexión dorsal de muñeca pre-tiro (cocking)"
     evaluar: "Muñeca flexionada 70-90° hacia atrás, balón descansa en yemas no palma, sin temblor o tensión excesiva"
     score_10: "Muñeca 80-90° flexión dorsal, balón en plataforma de dedos"
     score_5: "Flexión 60-70° o >90°, balón parcialmente en palma"
     score_1: "Flexión <60°, balón en palma completa"
     evidencia_requerida: "Ángulo muñeca-antebrazo, espacio visible bajo balón"
   
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     descripcion: "Grado de flexión para generar potencia"
     evaluar: "Flexión 100-120° (muslo-pantorrilla), ambas rodillas flexión similar ±5°, rodillas sobre dedos de pies no colapsan hacia dentro"
     score_10: "Flexión 110° simétrica, rodillas estables sobre pies"
     score_5: "Flexión 90° o 130°, ligera asimetría <10°"
     score_1: "Flexión <80° o >140°, rodillas colapsadas (valgo)"
     evidencia_requerida: "Ángulo de flexión cada rodilla, alineación rodilla-tobillo"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
     descripcion: "Tensión muscular en hombros y trapecio"
     evaluar: "Hombros en posición natural no elevados, ambos hombros misma altura ±2cm, sin contracción visible en trapecio"
     score_10: "Hombros bajos y nivelados, cuello visible y relajado"
     score_5: "Un hombro ligeramente elevado 2-4cm"
     score_1: "Hombros elevados >4cm, tensión visible en cuello"
     evidencia_requerida: "Distancia hombro-oreja, simetría, tensión muscular visible"
   
   - id: "enfoque_visual", name: "Enfoque visual"
     descripcion: "Dirección y fijación de la mirada"
     evaluar: "Ojos fijos en aro (borde frontal o centro), mirada sostenida >1 segundo pre-tiro, sin movimiento de ojos durante preparación"
     score_10: "Ojos fijos en mismo punto del aro >1.5s"
     score_5: "Mirada al aro pero con movimientos <1s fijación"
     score_1: "Ojos no miran aro o múltiples cambios de foco"
     evidencia_requerida: "Dirección mirada, tiempo de fijación, punto específico del aro"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"

2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)" - PESO: 2.07%
     descripcion: "Función de guía sin interferencia"
     evaluar: "Posición lateral del balón dedos apuntan arriba, contacto ligero no empuja, permanece hasta 80% del ascenso"
     score_10: "Mano al costado, pulgar a 90° del balón, solo guía"
     score_5: "Mano muy adelante o atrás, algo de presión"
     score_1: "Mano debajo o empujando el balón"
     evidencia_requerida: "Posición relativa al balón, ángulo del pulgar"
   
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo" - PESO: 6.88%
     descripcion: "Alineación del codo dominante"
     evaluar: "Codo a <15cm del torso, codo bajo balón y hacia el aro, codo forma L de 90° en set point"
     score_10: "Codo directamente bajo balón, separación 10-15cm del cuerpo"
     score_5: "Codo 15-25cm separado o desalineado 10-20°"
     score_1: "Codo >30cm (chicken wing) o desalineado >30°"
     evidencia_requerida: "Distancia codo-torso, ángulo codo, alineación con aro"
   
   - id: "angulo_codo_fijo_ascenso", name: "Ángulo de codo estable en ascenso" - PESO: 5%
     descripcion: "Mantener el ángulo del codo fijo hasta el set point"
     evaluar: "Ángulo de codo estable desde la toma del balón hasta el set point"
     score_10: "Ángulo se mantiene sin variaciones visibles"
     score_5: "Variaciones leves en el ángulo antes del set point"
     score_1: "Ángulo cambia claramente durante el ascenso"
     evidencia_requerida: "Comparación de ángulo en frames del ascenso"
   
   - id: "subida_recta_balon", name: "Subida recta del balón"
     descripcion: "Trayectoria vertical del balón"
     evaluar: "Línea recta vertical ±10cm lateralmente, aceleración constante sin pausas, sube en plano sagital del cuerpo"
     score_10: "Subida perfectamente vertical por línea media del cuerpo"
     score_5: "Desviación lateral 10-20cm o ligero loop"
     score_1: "Desviación >20cm o movimiento circular"
     evidencia_requerida: "Trayectoria frame a frame, desviación máxima en cm"
   
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
     descripcion: "Eficiencia del movimiento al punto de disparo"
     evaluar: "Movimiento directo sin rodeos, 0.3-0.4 segundos desde inicio, sin cambios bruscos de dirección"
     score_10: "Línea directa, 0.35s, aceleración suave"
     score_5: "Pequeño desvío <10cm o 0.4-0.5s"
     score_1: "Ruta indirecta >20cm desvío o >0.5s"
     evidencia_requerida: "Tiempo en segundos, path tracking, # de cambios dirección"
   
   - id: "set_point", name: "Set point" - PESO: 7.86%
     descripcion: "Posición óptima pre-liberación"
     evaluar: "Balón entre frente y corona, 20-25cm de la cara, ángulos codo 90° muñeca cargada 80°"
     score_10: "Balón sobre ojo dominante, codo 90°, muñeca 80-90°"
     score_5: "Balón altura ojos o muy alto, codo 75-85°"
     score_1: "Balón bajo barbilla o codo <75°"
     evidencia_requerida: "Altura relativa a cara, ángulo codo, ángulo muñeca"
   
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"
     descripcion: "Velocidad total de ejecución"
     evaluar: "Catch to release en 0.4-0.6s, ascenso 0.25-0.35s, liberación 0.15-0.25s"
     score_10: "0.45-0.55s total, ritmo fluido"
     score_5: "0.6-0.8s, ritmo aceptable"
     score_1: ">0.8s, muy lento para defensa NBA"
     evidencia_requerida: "Tiempo exacto en ms, desglose por fases"

3) FLUIDEZ (PESO: 47.5% - CRÍTICO):
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     descripcion: "Continuidad sin pausas del movimiento"
     peso: 25%
     evaluar: "Identificar stops >0.1s, aceleración continua, transiciones suaves entre fases"
     score_10: "Zero pausas, curva de aceleración suave"
     score_5: "1 micro-pausa 0.1-0.2s"
     score_1: "Pausa >0.2s o múltiples stops"
     evidencia_requerida: "Frame exacto de pausas, duración en ms, gráfica de velocidad"
     CUENTA pausas > 0.2s, marca observaciones de inicio/fin
   
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     descripcion: "Coordinación piernas-brazos para transferencia de energía"
     peso: 25%
     evaluar: "Extensión piernas precede brazos por 0.05-0.1s, cadena tobillo→rodilla→cadera→hombro→codo→muñeca, uso de piernas para tiros largos"
     score_10: "Perfecta cadena cinética, piernas inician 0.08s antes"
     score_5: "Ligero desfase 0.1-0.15s o secuencia alterada"
     score_1: "Sin conexión piernas-brazos o >0.2s desfase"
     evidencia_requerida: "Frame inicio extensión piernas vs brazos, % extensión simultanea"
     COMPARA extensión de piernas vs brazos

4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación" - PESO: 3.10%
     descripcion: "Separación limpia sin interferencia"
     evaluar: "Se separa 0.02-0.05s antes de soltar, se retira lateralmente no empuja, separación >10cm del balón"
     score_10: "Separación lateral limpia 0.03s antes, sin afectar rotación"
     score_5: "Separación tardía o ligero empuje"
     score_1: "Empuja el balón o no se separa"
     evidencia_requerida: "Frame de separación, distancia en cm, efecto en rotación"
   
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
     descripcion: "Follow-through completo del brazo dominante"
     evaluar: "Brazo 170-180° (casi recto), mano termina >45° sobre horizontal, muñeca flexión completa (gooseneck)"
     score_10: "Brazo 175°, muñeca apunta al suelo, dedos al aro"
     score_5: "Brazo 150-170°, muñeca parcial"
     score_1: "Brazo <150°, sin follow-through"
     evidencia_requerida: "Ángulo final brazo, ángulo muñeca, altura mano"
   
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
     descripcion: "Rotación hacia atrás óptima"
     evaluar: "2-3 revoluciones por segundo, rotación pura backspin no lateral, rotación uniforme en vuelo"
     score_10: "2.5 rev/s, backspin puro, sin wobble"
     score_5: "1.5-2 rev/s o ligero sidespin <10°"
     score_1: "<1 rev/s o sidespin >20°"
     evidencia_requerida: "Revoluciones contadas, eje de rotación, wobble detectado"
   
   - id: "angulo_salida", name: "Ángulo de salida"
     descripcion: "Ángulo óptimo para distancia 3pt"
     evaluar: "45-52° desde horizontal, ±3° entre tiros, mayor ángulo para mayor distancia"
     score_10: "48-50° para 3pt línea, arc alto"
     score_5: "43-47° o 51-55°, arc medio"
     score_1: "<43° (plano) o >55° (arcoíris)"
     evidencia_requerida: "Ángulo medido primeros 3 frames, altura máxima estimada"

5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
     descripcion: "Control corporal durante el tiro"
     evaluar: "Masa corporal centrada en ascenso, movimiento forward/back <10cm, sin inclinación lateral"
     score_10: "Perfectamente vertical, drift <5cm"
     score_5: "Drift 10-20cm o ligera inclinación"
     score_1: "Drift >20cm o pérdida de balance"
     evidencia_requerida: "Desplazamiento en cm, ángulo de inclinación"
   
   - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
     descripcion: "Estabilidad post-tiro"
     evaluar: "Aterrizaje mismo punto ±20cm, mantiene verticalidad, listo para siguiente acción <0.5s"
     score_10: "Aterrizaje mismo punto, balance inmediato"
     score_5: "Desplazamiento 20-40cm, recovery 0.5-1s"
     score_1: "Desplazamiento >40cm o tambaleo"
     evidencia_requerida: "Distancia desplazamiento, tiempo recuperación"
   
   - id: "duracion_follow_through", name: "Duración del follow-through"
     descripcion: "Tiempo manteniendo posición final"
     evaluar: "Mantener >0.5s post-liberación, muñeca y dedos en posición, ojos siguen el balón"
     score_10: "Hold >0.7s, forma perfecta"
     score_5: "Hold 0.3-0.5s"
     score_1: "Hold <0.3s o baja inmediato"
     evidencia_requerida: "Tiempo exacto hold, última posición visible"
   
   - id: "consistencia_repetitiva", name: "Consistencia repetitiva"
     descripcion: "Repetibilidad de la mecánica"
     evaluar: "Diferencias entre tiros <10%, mismo ritmo ±0.05s, mismos ángulos ±5°"
     score_10: "Variación <5% en todos los parámetros"
     score_5: "Variación 10-15%"
     score_1: "Variación >20%, mecánica inconsistente"
     evidencia_requerida: "Comparación mínimo 3 tiros, % variación calculado"
     na_condition: "Solo 1 tiro visible"

6) CONSISTENCIA ENTRE TIROS (2 parámetros):
   - id: "consistencia_tecnica", name: "Consistencia técnica"
     descripcion: "Variación técnica entre tiros"
     evaluar: "Comparar mecánica entre tiros, identificar patrones consistentes vs variables"
     score_10: "Mecánica idéntica en todos los tiros"
     score_5: "Ligeras variaciones <15%"
     score_1: "Variaciones >25%, técnica inconsistente"
     evidencia_requerida: "Comparación frame a frame, % variación técnica"
   
   - id: "consistencia_resultados", name: "Consistencia de resultados"
     descripcion: "Variación en resultados"
     evaluar: "Porcentaje de aciertos, patrón de errores, distancia de errores"
     score_10: "Resultados muy consistentes (>80% aciertos)"
     score_5: "Resultados moderadamente consistentes (60-80%)"
     score_1: "Resultados muy variables (<60%)"
     evidencia_requerida: "Conteo de aciertos/errores, patrón de errores"

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
      {"name": "Equilibrio general", "score": 75, "status": "Mejorable", "comment": "Equilibrio aceptable durante el tiro y aterrizaje con ligero desequilibrio", "evidencia": "Cuerpo estable durante el movimiento, pie izquierdo adelantado al aterrizar", "na": false},
      {"name": "Duración del follow-through", "score": 60, "status": "Mejorable", "comment": "Follow through corto", "evidencia": "Mano se retira rápidamente", "na": false},
      {"name": "Consistencia general", "score": 50, "status": "Incorrecto", "comment": "Movimiento y técnica inconsistentes entre tiros", "evidencia": "Variaciones en cada tiro, diferentes posiciones en cada tiro", "na": false},
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

  try {
    const result = await retryWithBackoff(async () => {
      return await model.generateContent({
        contents: [{ role: 'user', parts: content }]
      });
    });

    const response = await result.response;
    const text = response.text();
    
    // Limpiar el texto de respuesta
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('🔍 Debug - Gemini response cleaned:', {
      length: cleanedText.length,
      startsWith: cleanedText.substring(0, 100),
      endsWith: cleanedText.substring(cleanedText.length - 100)
    });

            console.log('🔍 Debug - First 500 chars:', cleanedText.substring(0, 500));
    console.log('🔍 Debug - Last 500 chars:', cleanedText.substring(cleanedText.length - 500));

    const analysisResult = JSON.parse(cleanedText);
    
        console.log('🔍 Debug - analysisResult COMPLETO:', JSON.stringify(analysisResult, null, 2));
    
    // 🔧 ARREGLO: Si Gemini devuelve un array, lo convertimos al formato esperado
    if (Array.isArray(analysisResult)) {
            // Crear un objeto con la estructura esperada
      const convertedResult = {
        verification: analysisResult[0]?.verification || {},
        shots: analysisResult.map((item, index) => ({
          id: index + 1,
          videoSource: item.videoSource,
          shotType: item.shotType,
          basketVisible: item.basketVisible,
          result: item.result,
          playerCharacteristics: item.playerCharacteristics
        })),
        technicalAnalysis: {
          parameters: [], // Vacío por ahora
          overallScore: 0,
          strengths: [],
          weaknesses: [],
          recommendations: []
        },
        shotSummary: {
          totalShots: analysisResult.length,
          lateralShots: analysisResult.filter(item => item.videoSource === 'lateral').length,
          frontalShots: analysisResult.filter(item => item.videoSource === 'frontal').length,
          additionalShots: analysisResult.filter(item => item.videoSource === 'additional').length
        }
      };
      
      console.log('✅ Resultado convertido:', JSON.stringify(convertedResult, null, 2));
      return convertedResult;
    }

    return analysisResult;
  } catch (error) {
    console.error('❌ Error en analyzeVideoSingleCall:', error);
    throw error;
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      console.log(`🔄 Intento ${attempt}/${maxRetries} falló:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Solo reintentar en errores 429 o 500
      if (error.status === 429 || error.status === 500) {
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