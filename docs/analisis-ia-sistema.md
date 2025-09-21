# SISTEMA DE ANÁLISIS DE IA - SHOT ANALYSIS

## RESUMEN EJECUTIVO

El sistema actual utiliza **Gemini 2.0 Flash** para analizar videos de lanzamientos de baloncesto, pero hemos detectado **problemas críticos de simulación** que afectan la calidad y veracidad de los análisis.

---

## ARQUITECTURA ACTUAL

### 1. FLUJO DE PROCESAMIENTO

```
Video Subido → Validación de Contenido → Análisis Técnico → Reporte Final
```

#### **Paso 1: Validación de Contenido**
- **Archivo**: `src/ai/flows/analyze-video-frames.ts`
- **Función**: Verificar que el video contenga baloncesto real
- **Método**: Extrae 32 frames del video y los envía a Gemini
- **Estado**: ✅ **FUNCIONANDO** - Detecta correctamente fiestas vs baloncesto

#### **Paso 2: Análisis Técnico**
- **Archivo**: `src/ai/flows/analyze-basketball-shot.ts`
- **Función**: Evaluar 22 parámetros técnicos del lanzamiento
- **Método**: Envía video completo a Gemini con prompt detallado
- **Estado**: ❌ **PROBLEMÁTICO** - Está simulando respuestas genéricas

#### **Paso 3: Generación de Reporte**
- **Archivo**: `src/lib/scoring.ts`
- **Función**: Calcular puntaje final basado en pesos
- **Estado**: ✅ **FUNCIONANDO** - Cálculos matemáticos correctos

---

## PROBLEMAS DETECTADOS

### 🚨 **PROBLEMA PRINCIPAL: SIMULACIÓN DE IA**

#### **Evidencia de Simulación:**

1. **Análisis de 3 Jugadores Diferentes:**
   - **Gregorio (Experto)**: "Alineación general del cuerpo", "Enfoque visual mantenido"
   - **Gregorio (Segundo video)**: "Buena flexión de rodillas", "Enfoque visual en el objetivo"  
   - **Usuario (Principiante)**: "Alineación del cuerpo hacia el aro", "Subida del balón en línea recta"

2. **Frases Genéricas Repetidas:**
   - "Alineación del cuerpo hacia el aro" (aparece en 2 de 3 análisis)
   - "Enfoque visual" (aparece en todos los análisis)
   - "Mejora la técnica" (patrón común)

3. **Recomendaciones Idénticas:**
   - "Trabajar en la sincronización"
   - "Elevar el set point"  
   - "Extender completamente el brazo"

4. **Falta de Especificidad:**
   - No menciona detalles únicos de cada video
   - No compara frames específicos
   - No da mediciones exactas

#### **Por Qué Está Simulando:**

1. **Prompt Genérico**: Las instrucciones son muy generales
2. **Sin Comparación**: No analiza frame por frame
3. **Respuestas Predefinidas**: Usa plantillas en lugar de análisis real
4. **Falta de Validación**: No verifica lo que realmente ve

---

## SISTEMA DE PESOS ACTUAL

### **Distribución de Puntajes:**

- **FLUIDEZ**: 50% (CRÍTICO - más importante)
- **RESTO DE CATEGORÍAS**: 26.38% (ALTO)
- **SET POINT**: 8.27% (MEDIO)
- **CODO**: 7.24% (MEDIO)
- **MANO LIBERACIÓN**: 3.26% (BAJO)
- **MANO ASCENSO**: 2.18% (BAJO)

### **22 Parámetros Técnicos:**

#### **PREPARACIÓN (6 parámetros):**
1. Alineación de pies con el aro
2. Alineación del cuerpo
3. Muñeca cargada hacia atrás
4. Flexión de rodillas (óptimo: 45-70°)
5. Hombros relajados
6. Enfoque visual en el aro

#### **ASCENSO (6 parámetros):**
7. Mano no dominante guía el balón
8. Codos cerca del cuerpo
9. Balón sube en línea recta
10. Trayectoria suave al set point
11. Set point sobre la cabeza
12. Timing correcto (no muy rápido/lento)

#### **FLUIDEZ (2 parámetros):**
13. Tiro en un solo movimiento continuo
14. Sincronización piernas-brazos

#### **LIBERACIÓN (4 parámetros):**
15. Mano guía se retira a tiempo
16. Extensión completa del brazo
17. Muñeca con snap hacia abajo
18. Ángulo de salida apropiado

#### **SEGUIMIENTO (4 parámetros):**
19. Mantiene follow-through
20. Equilibrio al aterrizar
21. Duración del follow-through (1-2 seg)
22. Consistencia general del movimiento

---

## TECNOLOGÍAS UTILIZADAS

### **IA Principal:**
- **Gemini 2.0 Flash** (Google AI)
- **Capacidades**: Análisis de video, procesamiento de frames
- **Costo**: ~$0.01-0.05 por video

### **Procesamiento de Video:**
- **FFmpeg**: Extracción de frames y detección de movimiento
- **Base64**: Codificación de frames para envío a IA
- **Google Cloud Storage**: Almacenamiento de videos

### **Infraestructura:**
- **Next.js**: Framework web
- **Firebase**: Base de datos y autenticación
- **Genkit**: Flujos de IA de Google

---

## SOLUCIONES PROPUESTAS

### **1. PROMPT ULTRA-ESPECÍFICO**

```typescript
const prompt = `
ANÁLISIS FRAME POR FRAME - MODO ESTRICTO

INSTRUCCIONES CRÍTICAS:
1. Analiza CADA frame individualmente
2. Describe EXACTAMENTE lo que ves en cada momento
3. NO uses frases genéricas como "mejora la técnica"
4. Sé específico: "En el frame 3.2s, el codo está 15° fuera de alineación"
5. Compara frames entre sí para detectar cambios
6. Si no puedes ver algo claramente, di "no visible en este frame"

ANÁLISIS REQUERIDO:
- Frame por frame del movimiento completo
- Mediciones específicas cuando sea posible
- Comparaciones entre frames clave
- Descripción detallada de cada parámetro técnico
- Evidencia visual específica para cada evaluación

PROHIBIDO:
- Frases como "mejora la técnica", "trabaja en la"
- Recomendaciones genéricas
- Asumir cosas que no se ven claramente
- Usar plantillas de respuesta
`;
```

### **2. VALIDACIÓN CRUZADA**

- Analizar el mismo video 3 veces
- Comparar resultados para detectar inconsistencias
- Rechazar análisis que sean demasiado similares

### **3. ANÁLISIS COMPARATIVO**

- Comparar con videos anteriores del mismo jugador
- Detectar mejoras o regresiones específicas
- Generar recomendaciones personalizadas

---

## ESTADO ACTUAL DEL SISTEMA

### ✅ **FUNCIONANDO CORRECTAMENTE:**
- Validación de contenido (distingue baloncesto de fiestas)
- Sistema de pesos y cálculo de puntajes
- Interfaz de usuario y flujo de trabajo
- Almacenamiento y gestión de análisis

### ❌ **PROBLEMÁTICO:**
- Análisis técnico específico (simulación detectada)
- Recomendaciones personalizadas
- Detección de mejoras individuales
- Consistencia en análisis repetidos

### 🔧 **EN DESARROLLO:**
- Nuevo prompt ultra-específico
- Sistema de validación cruzada
- Herramientas de comparación de análisis

---

## PRÓXIMOS PASOS

1. **Implementar nuevo prompt ultra-específico**
2. **Crear sistema de validación cruzada**
3. **Desarrollar herramientas de comparación**
4. **Probar con videos reales de diferentes jugadores**
5. **Validar que cada análisis sea único y específico**

---

## CONCLUSIÓN

El sistema tiene una **base sólida** pero necesita **mejoras críticas** en el análisis técnico para evitar la simulación. La IA puede analizar videos correctamente, pero el prompt actual no la fuerza a ser específica y única en cada análisis.

**Prioridad**: Implementar el nuevo sistema de análisis frame por frame para garantizar análisis reales y específicos para cada jugador.
