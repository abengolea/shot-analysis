"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeBasketballShot, type AnalyzeBasketballShotOutput } from "@/ai/flows/analyze-basketball-shot";
import { generatePersonalizedDrills, type GeneratePersonalizedDrillsOutput } from "@/ai/flows/generate-personalized-drills";
import { moderateContent } from '@/ai/flows/content-moderation';
import { mockAnalyses } from "@/lib/mock-data";

const analysisSchema = z.object({
  playerId: z.string(),
  ageGroup: z.enum(['U10', 'U13', 'U15', 'U18', 'Amateur', 'SemiPro', 'Pro']),
  playerLevel: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
  shotType: z.enum(['Tiro Libre', 'Tiro de Media Distancia', 'Tiro de Tres', 'Bandeja']),
});

// This is a placeholder for a database write
async function saveAnalysis(analysisData: any) {
  console.log("Guardando datos de análisis (simulado):", analysisData);
  const newId = (mockAnalyses.length + 101).toString();
  const newAnalysis = {
      ...analysisData,
      id: newId,
      createdAt: new Date().toISOString(),
      // In a real app, keyframes would come from video processing
      keyframes: [
          "https://placehold.co/640x360.png",
          "https://placehold.co/640x360.png",
          "https://placehold.co/640x360.png",
          "https://placehold.co/640x360.png",
      ],
  };
  mockAnalyses.push(newAnalysis);
  return newAnalysis;
}


export async function startAnalysis(prevState: any, formData: FormData) {
  try {
    const validatedFields = analysisSchema.safeParse({
      playerId: formData.get("playerId"),
      ageGroup: formData.get("ageGroup"),
      playerLevel: formData.get("playerLevel"),
      shotType: formData.get("shotType"),
    });

    if (!validatedFields.success) {
      return { message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
    }

    // In a real app, you would upload the video and get a URL.
    // For this demo, we'll use a placeholder.
    const videoUrl = "https://placehold.co/1280x720.png";

    const aiInput = {
      videoUrl,
      // The AI flow expects a different age category format.
      ageCategory: validatedFields.data.ageGroup === 'Amateur' ? 'Amateur adulto' : `Sub-${validatedFields.data.ageGroup.replace('U','')}` as any,
      playerLevel: validatedFields.data.playerLevel,
      shotType: validatedFields.data.shotType,
    };
    
    // For demonstration, we'll return a mock analysis immediately.
    // In a real app, you might call the AI flow like this:
    // const analysisResult: AnalyzeBasketballShotOutput = await analyzeBasketballShot(aiInput);
    const analysisResult: AnalyzeBasketballShotOutput = {
        analysisSummary: "Este es un análisis de prueba. El jugador muestra buen potencial pero necesita trabajar en la continuación del tiro. El arco del tiro es un poco plano.",
        strengths: ["Buena postura", "Lanzamiento rápido"],
        weaknesses: ["Arco plano", "Continuación inconsistente"],
        recommendations: ["Practicar tiros con más arco.", "Concentrarse en mantener la posición de continuación."],
        keyframes: [],
    };
    
    const newAnalysisData = {
        playerId: validatedFields.data.playerId,
        shotType: validatedFields.data.shotType,
        ...analysisResult,
    };

    const savedAnalysis = await saveAnalysis(newAnalysisData);
    
    revalidatePath(`/players/${savedAnalysis.playerId}`);
    redirect(`/analysis/${savedAnalysis.id}`);

  } catch (error) {
    console.error("Error de Análisis:", error);
    return { message: "No se pudo iniciar el análisis. Por favor, inténtalo de nuevo." };
  }
}

export async function getDrills(
    analysisSummary: string, 
    ageGroup: 'U10' | 'U13' | 'U15' | 'U18' | 'Amateur' | 'SemiPro' | 'Pro'
): Promise<{ drills?: GeneratePersonalizedDrillsOutput['drills']; error?: string }> {
    try {
        const result = await generatePersonalizedDrills({
            analysisJson: JSON.stringify({ summary: analysisSummary }),
            resources: "Conos, balón de baloncesto, pared",
            ageGroup: ageGroup,
        });
        return { drills: result.drills };
    } catch (error) {
        console.error("Error de Generación de Ejercicios:", error);
        return { error: "No se pudieron generar los ejercicios." };
    }
}

export async function moderateAndAddComment(prevState: any, formData: FormData) {
    const text = formData.get('comment') as string;
    const analysisId = formData.get('analysisId') as string;

    if (!text || text.trim().length === 0) {
        return { message: 'El comentario no puede estar vacío.' };
    }

    try {
        const moderationResult = await moderateContent({ text });
        if (moderationResult.isHarmful) {
            return { message: `El comentario no pudo ser publicado: ${moderationResult.reason}` };
        }

        // In a real app, you would save the comment to the database here.
        console.log(`(Simulado) Añadiendo comentario al análisis ${analysisId}: "${text}"`);

        revalidatePath(`/analysis/${analysisId}`);
        return { message: 'Comentario publicado con éxito.', comment: text };
    } catch (error) {
        console.error('Error de moderación de comentario:', error);
        return { message: 'No se pudo publicar el comentario.' };
    }
}
