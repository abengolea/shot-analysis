"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeBasketballShot, type AnalyzeBasketballShotOutput } from "@/ai/flows/analyze-basketball-shot";
import { generatePersonalizedDrills, type GeneratePersonalizedDrillsOutput } from "@/ai/flows/generate-personalized-drills";
import { moderateContent } from '@/ai/flows/content-moderation';
import { mockAnalyses, mockCoaches, mockPlayers } from "@/lib/mock-data";
import type { Coach, Player } from "@/lib/types";

// Assume we know who the logged-in user is. For now, it's the first player.
const getCurrentUser = async () => {
    return mockPlayers[0];
}

const analysisSchema = z.object({
  shotType: z.enum(['Tiro Libre', 'Tiro de Media Distancia (Jump Shot)', 'Tiro de Tres']),
});

const coachSchema = z.object({
    name: z.string().min(3, "El nombre es requerido."),
    specialties: z.string().min(3, "Las especialidades son requeridas."),
    experience: z.string().min(10, "La experiencia es requerida."),
    ratePerAnalysis: z.coerce.number().min(1, "La tarifa debe ser positiva."),
    avatarUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')),
});

const registerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  dob: z.coerce.date({ required_error: "La fecha de nacimiento es obligatoria." }),
  country: z.string().min(2, "Por favor, selecciona un país."),
  phone: z.string().min(5, "Por favor, introduce un número de teléfono válido."),
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
      shotType: formData.get("shotType"),
    });

    if (!validatedFields.success) {
      return { message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
    }
    
    const currentUser = await getCurrentUser();

    // In a real app, you would upload the video and get a URL.
    // For this demo, we'll use a placeholder.
    const videoUrl = "https://placehold.co/1280x720.png";

    const aiInput = {
      videoUrl,
      // The AI flow expects a different age category format.
      ageCategory: currentUser.ageGroup === 'Amateur' ? 'Amateur adulto' : `Sub-${currentUser.ageGroup.replace('U','')}` as any,
      playerLevel: currentUser.playerLevel,
      shotType: validatedFields.data.shotType,
    };
    
    // For demonstration, we'll return a mock analysis immediately.
    // In a real app, you might call the AI flow like this:
    const analysisResult: AnalyzeBasketballShotOutput = await analyzeBasketballShot(aiInput);
    
    const newAnalysisData = {
        playerId: currentUser.id,
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


export async function addCoach(prevState: any, formData: FormData) {
    try {
        const validatedFields = coachSchema.safeParse({
            name: formData.get("name"),
            specialties: formData.get("specialties"),
            experience: formData.get("experience"),
            ratePerAnalysis: formData.get("ratePerAnalysis"),
            avatarUrl: formData.get("avatarUrl"),
        });

        if (!validatedFields.success) {
            console.log(validatedFields.error.flatten().fieldErrors);
            return { success: false, message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
        }

        const newCoach: Coach = {
            id: `c${mockCoaches.length + 1}`,
            ...validatedFields.data,
            specialties: validatedFields.data.specialties.split(',').map(s => s.trim()),
            avatarUrl: validatedFields.data.avatarUrl || 'https://placehold.co/128x128.png',
            'data-ai-hint': 'male coach', // default hint
            rating: 0,
            reviews: 0,
        };

        // In a real app, you would save the coach to the database here.
        console.log("(Simulado) Añadiendo nuevo entrenador:", newCoach);
        mockCoaches.push(newCoach);
        
        revalidatePath('/coaches');
        revalidatePath('/admin');
        return { success: true, message: `Entrenador ${newCoach.name} añadido con éxito.` };

    } catch (error) {
        console.error("Error al añadir entrenador:", error);
        return { success: false, message: "No se pudo añadir el entrenador. Por favor, inténtalo de nuevo." };
    }
}

function getAgeGroup(dob: Date): Player['ageGroup'] {
    const age = new Date().getFullYear() - dob.getFullYear();
    if (age < 10) return 'U10';
    if (age < 13) return 'U13';
    if (age < 15) return 'U15';
    if (age < 18) return 'U18';
    return 'Amateur';
}


export async function registerPlayer(prevState: any, formData: FormData) {
    try {
        const validatedFields = registerSchema.safeParse(Object.fromEntries(formData.entries()));

        if (!validatedFields.success) {
             return { success: false, message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
        }
        
        // In a real app, you would hash the password here.
        const { name, email, dob, password, country, phone } = validatedFields.data;

        const newPlayer: Player = {
            id: `p${mockPlayers.length + 1}`,
            name,
            email,
            dob,
            country,
            phone,
            ageGroup: getAgeGroup(dob),
            playerLevel: 'Principiante',
            status: 'active',
            avatarUrl: `https://placehold.co/100x100.png`
        };

        // Simulate saving the new player
        console.log("(Simulado) Registrando nuevo jugador:", newPlayer);
        mockPlayers.push(newPlayer);
        
        // In a real app, you would also create a session and log the user in.

    } catch (error) {
        console.error("Error de Registro:", error);
        return { success: false, message: "No se pudo completar el registro. Por favor, inténtalo de nuevo." };
    }

    revalidatePath('/admin');
    redirect('/'); // Redirect to dashboard after successful registration
}
