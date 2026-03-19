# Migración a Gemini 3.1 Flash Lite (Junio 2026)

## Contexto

Google discontinuará **Gemini 2.0 Flash** y **Gemini 2.0 Flash Lite** el **1 de junio de 2026**. Este documento describe los cambios realizados para migrar al modelo **Gemini 3.1 Flash Lite Preview**.

## Cambios realizados

### Modelo de destino
- **Nombre API:** `gemini-3.1-flash-lite-preview`
- **Formato Genkit:** `googleai/gemini-3.1-flash-lite-preview`

### Archivos actualizados

| Archivo | Modelo anterior | Modelo nuevo |
|---------|-----------------|--------------|
| `src/app/api/test-content-validation/route.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/ai/flows/analyze-basketball-strict.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/app/api/test-gemini-reality/route.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/app/api/test-technical-analysis/route.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/app/api/test-technical-analysis-multiple/route.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/app/api/test-analysis-reality/route.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/app/api/test-new-prompt/route.ts` | gemini-2.0-flash | gemini-3.1-flash-lite-preview |
| `src/app/api/test-biomechanical-transfer/route.ts` | gemini-2.0-flash-exp | gemini-3.1-flash-lite-preview |
| `src/lib/gemini-files-api.ts` | gemini-2.0-flash-lite | gemini-3.1-flash-lite-preview |
| `src/lib/gemini-optimized.ts` | gemini-2.0-flash-lite | gemini-3.1-flash-lite-preview |
| `src/lib/gemini-22-parameters.ts` | gemini-2.0-flash-lite | gemini-3.1-flash-lite-preview |
| `src/utils/gemini-simple-prompt.ts` | gemini-2.0-flash-exp | gemini-3.1-flash-lite-preview |
| `src/utils/gemini-single-call-new.ts` | gemini-2.0-flash-exp | gemini-3.1-flash-lite-preview |
| `src/utils/gemini-single-call-backup.ts` | gemini-2.0-flash-exp | gemini-3.1-flash-lite-preview |
| `src/ai/genkit (1).ts` | googleai/gemini-2.0-flash | googleai/gemini-3.1-flash-lite-preview |

### Archivos que NO se modificaron (usan modelos no deprecados)

- **`src/ai/genkit.ts`** – Usa `gemini-2.5-flash` (activo, no deprecado)
- **`src/lib/gemini-video-real.ts`** – Usa `gemini-2.5-flash`
- **`src/app/api/save-video-analysis/route.ts`** – Usa `gemini-2.5-flash`
- **`src/utils/gemini-single-call.ts`** – Usa `gemini-1.5-flash` (modelo estable distinto)

## Thought signatures (conversaciones multi-turn)

Según la guía de Google, para **conversaciones multi-turn** con Gemini 3.x debes:

1. **Capturar** los campos `id` y `thought_signature` de cada respuesta.
2. **Incluirlos** en la siguiente petición del historial de conversación.

### Cuándo aplica

- **Chat multi-turn** (ej. `reviewChatFlow` en `/api/analyses/[id]/chat`)
- **Tool calling** con múltiples turnos
- **Code execution** con seguimiento

### Cuándo NO aplica

- Llamadas **single-turn** (análisis de video, detección de frames, etc.) – no requieren thought signatures.

### Implementación con SDKs

Los SDKs oficiales de Node.js (`@google/generative-ai`) y Genkit suelen manejar la circulación de thought signatures automáticamente cuando se usa el historial de conversación. Si usas la API REST manualmente o un proxy OpenAI-compatible, debes preservar y reenviar los thought signatures explícitamente.

**Referencia:** [Gemini Thinking - Thought Signatures](https://ai.google.dev/gemini-api/docs/thinking)

## Próximos pasos

1. **Probar localmente** las rutas de test actualizadas.
2. **Validar** análisis de video con el nuevo modelo.
3. **Monitorear** costos: Gemini 3.1 Flash Lite tiene precios distintos ($0.25/1M input, $1.50/1M output).
4. **Revisar** flujos de chat multi-turn si aparecen errores 400 relacionados con thought signatures.

---

**Fecha de migración:** Marzo 2026  
**Fecha límite de Google:** 1 de junio de 2026
