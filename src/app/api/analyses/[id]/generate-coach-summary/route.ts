import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function requireCoachOrAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : undefined;
    if (role === 'coach' || role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCoachOrAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    
    const { id } = await params;
    const body = await req.json();
    const coachFeedback = body?.coachFeedback || {};
    const shotType = body?.shotType || 'tres';
    
    // Obtener datos del análisis
    const analysisSnap = await adminDb.collection('analyses').doc(id).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Análisis no encontrado' }, { status: 404 });
    }
    const analysisData = analysisSnap.data() as any;
    
    // Obtener checklist de la IA
    const iaChecklist: any[] = Array.isArray(analysisData?.detailedChecklist) ? analysisData.detailedChecklist : [];
    
    // Log para debugging
    console.log('[generate-coach-summary] iaChecklist length:', iaChecklist.length);
    console.log('[generate-coach-summary] analysisData keys:', Object.keys(analysisData || {}));
    
    // Construir contexto de calificaciones
    const ratingsContext: Array<{
      itemName: string;
      category: string;
      iaRating: number;
      coachRating: number;
      coachComment?: string;
      difference: number;
    }> = [];
    
    // Si no hay checklist estructurado, intentar obtener de otras fuentes
    if (iaChecklist.length === 0) {
      // Intentar obtener de analysisResult.technicalAnalysis.parameters
      const parameters = analysisData?.analysisResult?.technicalAnalysis?.parameters || 
                         analysisData?.analysisResult?.detailedChecklist || 
                         analysisData?.parameters || [];
      
      if (Array.isArray(parameters) && parameters.length > 0) {
        console.log('[generate-coach-summary] Usando parameters como fallback, count:', parameters.length);
        // Convertir parámetros a formato de checklist
        for (const param of parameters) {
          const itemId = String(param.name || param.id || '').trim().toLowerCase().replace(/\s+/g, '_');
          if (!itemId) continue;
          
          const coachFeedbackItem = coachFeedback[itemId];
          
          // Calcular calificación de la IA desde score o status
          let iaRating = 3; // default
          if (typeof param.rating === 'number') {
            iaRating = param.rating;
          } else if (typeof param.score === 'number') {
            const score = param.score;
            if (score >= 90) iaRating = 5;
            else if (score >= 70) iaRating = 4;
            else if (score >= 50) iaRating = 3;
            else if (score >= 30) iaRating = 2;
            else iaRating = 1;
          } else if (param.status) {
            const status = String(param.status);
            if (status === 'Incorrecto') iaRating = 1;
            else if (status === 'Incorrecto leve') iaRating = 2;
            else if (status === 'Mejorable') iaRating = 3;
            else if (status === 'Correcto') iaRating = 4;
            else if (status === 'Excelente') iaRating = 5;
          }
          
          const coachRating = (coachFeedbackItem && typeof coachFeedbackItem.rating === 'number') 
            ? coachFeedbackItem.rating 
            : iaRating;
          
          const difference = coachRating - iaRating;
          
          ratingsContext.push({
            itemName: param.name || itemId,
            category: 'Análisis Técnico',
            iaRating,
            coachRating,
            coachComment: coachFeedbackItem?.comment,
            difference,
          });
        }
      }
    } else {
      // Procesar checklist estructurado
      for (const category of iaChecklist) {
        const items = Array.isArray(category?.items) ? category.items : [];
        console.log(`[generate-coach-summary] Category: ${category?.category}, items: ${items.length}`);
        
        for (const item of items) {
          const itemId = String(item?.id || '').trim().toLowerCase();
          if (!itemId) continue;
          
          const coachFeedbackItem = coachFeedback[itemId];
          
          // Calcular calificación de la IA
          const iaRating = typeof item.rating === 'number' ? item.rating : 
            item.status === 'Incorrecto' ? 1 :
            item.status === 'Incorrecto leve' ? 2 :
            item.status === 'Mejorable' ? 3 :
            item.status === 'Correcto' ? 4 :
            item.status === 'Excelente' ? 5 : 3;
          
          // Si hay calificación del coach, usar esa; si no, usar la de la IA
          const coachRating = (coachFeedbackItem && typeof coachFeedbackItem.rating === 'number') 
            ? coachFeedbackItem.rating 
            : iaRating;
          
          const difference = coachRating - iaRating;
          
          ratingsContext.push({
            itemName: item.name || itemId,
            category: category.category || 'Sin categoría',
            iaRating,
            coachRating,
            coachComment: coachFeedbackItem?.comment,
            difference,
          });
        }
      }
    }
    
    console.log('[generate-coach-summary] ratingsContext length:', ratingsContext.length);
    
    if (ratingsContext.length === 0) {
      console.error('[generate-coach-summary] No se encontraron calificaciones. iaChecklist:', iaChecklist.length, 'analysisData keys:', Object.keys(analysisData || {}));
      return NextResponse.json({ 
        ok: false, 
        error: 'No hay calificaciones disponibles para generar resumen. El análisis no contiene datos de checklist.' 
      }, { status: 400 });
    }
    
    // Calcular estadísticas
    const totalItems = ratingsContext.length;
    const agreedItems = ratingsContext.filter(r => r.difference === 0).length;
    const higherItems = ratingsContext.filter(r => r.difference > 0).length;
    const lowerItems = ratingsContext.filter(r => r.difference < 0).length;
    const avgCoachRating = ratingsContext.reduce((sum, r) => sum + r.coachRating, 0) / totalItems;
    const avgIARating = ratingsContext.reduce((sum, r) => sum + r.iaRating, 0) / totalItems;
    
    // Verificar si hay calificaciones del coach o solo de la IA
    // Un ítem tiene calificación del coach si tiene diferencia distinta de 0 o tiene comentario
    const coachRatingsCount = ratingsContext.filter(r => r.difference !== 0 || r.coachComment).length;
    const hasCoachRatings = coachRatingsCount > 0;
    
    // Construir prompt para la IA
    const prompt = `Eres un asistente experto en análisis de técnica de básquet. ${hasCoachRatings 
      ? `Un entrenador ha calificado ${coachRatingsCount} de ${totalItems} parámetros técnicos de un lanzamiento de ${shotType}. Los demás parámetros usan las calificaciones de la IA.`
      : `Se han analizado ${totalItems} parámetros técnicos de un lanzamiento de ${shotType} usando calificaciones generadas por IA.`}

ESTADÍSTICAS:
- Total de ítems calificados: ${totalItems}
${hasCoachRatings ? `- Ítems calificados por el coach: ${coachRatingsCount}` : ''}
- De acuerdo con IA: ${agreedItems} (${Math.round(agreedItems/totalItems*100)}%)
${hasCoachRatings ? `- Calificaciones más altas que la IA: ${higherItems}` : ''}
${hasCoachRatings ? `- Calificaciones más bajas que la IA: ${lowerItems}` : ''}
- Promedio calificación IA: ${avgIARating.toFixed(2)}/5
${hasCoachRatings ? `- Promedio calificación Coach: ${avgCoachRating.toFixed(2)}/5` : ''}

CALIFICACIONES DETALLADAS:
${ratingsContext.map(r => {
  const diffText = r.difference === 0 ? '✓ Igual' : r.difference > 0 ? `↑ +${r.difference}` : `↓ ${r.difference}`;
  const coachLabel = r.difference === 0 && !r.coachComment ? 'IA' : 'Coach';
  return `- ${r.itemName} (${r.category}): IA=${r.iaRating}/5, ${coachLabel}=${r.coachRating}/5 ${diffText}${r.coachComment ? ` | Comentario: ${r.coachComment}` : ''}`;
}).join('\n')}

TAREA:
Genera un resumen profesional y estructurado del análisis ${hasCoachRatings ? 'del entrenador' : 'técnico'} que incluya:

1. **Resumen Ejecutivo** (2-3 líneas): Visión general de la evaluación
2. **Fortalezas Principales** (3-5 puntos): Aspectos donde el jugador tiene buen desempeño (calificaciones 4-5)
3. **Áreas de Mejora** (3-5 puntos): Aspectos que requieren atención (calificaciones 1-3)
${hasCoachRatings ? '4. **Discrepancias con IA** (si las hay): Explicación de dónde el entrenador difiere de la IA y por qué' : ''}
${hasCoachRatings ? '5. **Recomendaciones Prácticas** (3-5 acciones concretas): Ejercicios o ajustes específicos para mejorar' : '4. **Recomendaciones Prácticas** (3-5 acciones concretas): Ejercicios o ajustes específicos para mejorar'}

IMPORTANTE:
- Usa un tono profesional pero cercano
- Sé específico y concreto en las recomendaciones
${hasCoachRatings ? '- Menciona los comentarios del entrenador cuando sean relevantes' : ''}
${hasCoachRatings ? '- Si hay discrepancias significativas, explícalas' : ''}
- El resumen debe ser útil tanto para el jugador como para el entrenador
- Máximo 400 palabras
- Formato: Markdown simple
- Negritas con **texto**, subrayado con __texto__, cursiva con _texto_
- Listas con "-" o numeración "1."
- No uses tablas, links ni bloques de código

Genera el resumen ahora:`;

    // Generar resumen con Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text().trim();
    
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error('Error generando resumen del coach:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e instanceof Error ? e.message : 'Error interno al generar resumen' 
    }, { status: 500 });
  }
}

