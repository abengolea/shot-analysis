"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeBasketballShot, type AnalyzeBasketballShotOutput } from "@/ai/flows/analyze-basketball-shot";
import { generatePersonalizedDrills, type GeneratePersonalizedDrillsOutput } from "@/ai/flows/generate-personalized-drills";
import { moderateContent } from '@/ai/flows/content-moderation';
import type { Coach, Player, DetailedChecklistItem } from "@/lib/types";
import { auth, db, storage, adminAuth, adminDb, adminStorage } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Readable } from 'stream';

// Assume we know who the logged-in user is. For now, it's the first player.
const getCurrentUser = async () => {
    // This is a placeholder. In a real app, you'd get this from the session.
    // For now, we will rely on client side auth checks.
    if (auth.currentUser) {
        // NOTE: This will only work in environments where auth state is persisted across server actions
        // which might not be the case here. This is a simplification.
        // A real implementation would use session cookies or JWTs.
        const playerDoc = await getDoc(doc(db, "players", auth.currentUser.uid));
        if (playerDoc.exists()) {
             return { id: auth.currentUser.uid, ...playerDoc.data() } as Player;
        }
    }
    // Fallback to a mock user if no one is logged in on the client.
    // This part of the code might not be reached if UI prevents unauthed access.
    const fallbackPlayerDoc = await getDoc(doc(db, "players", "1"));
    if (fallbackPlayerDoc.exists()) {
        return { id: "1", ...fallbackPlayerDoc.data() } as Player;
    }
    return null; // Should not happen if data is seeded
}

const analysisSchema = z.object({
  shotType: z.enum(['Tiro Libre', 'Lanzamiento de Media Distancia (Jump Shot)', 'Lanzamiento de Tres']),
  'video-front': z.instanceof(File).refine(file => file.size > 0, 'El video frontal es requerido.'),
  // Add other videos later, for now one is enough to prove the concept
});

const coachSchema = z.object({
    name: z.string().min(3, "El nombre es requerido."),
    experience: z.string().min(10, "La experiencia es requerida."),
    ratePerAnalysis: z.coerce.number().min(1, "La tarifa debe ser positiva."),
    avatarUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')),
});

const registerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  dob: z.coerce.date({ required_error: "La fecha de nacimiento es obligatoria.", invalid_type_error: "La fecha de nacimiento no es válida." }),
  country: z.string().min(2, "Por favor, selecciona un país."),
  phone: z.string().min(5, "Por favor, introduce un número de teléfono válido."),
});

const loginSchema = z.object({
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(1, "La contraseña es requerida."),
  role: z.enum(['player', 'coach'])
});


async function uploadVideoToStorage(file: File, userId: string): Promise<string> {
    if (!file) {
        throw new Error("No file provided for upload.");
    }
    if (!adminStorage) {
        throw new Error("Admin Storage not initialized. Make sure FIREBASE_SERVICE_ACCOUNT is set.");
    }

    const storageBucket = adminStorage.bucket();
    const filePath = `videos/${userId}/${Date.now()}-${file.name}`;
    const fileRef = storageBucket.file(filePath);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream the buffer to Firebase Storage
    const stream = fileRef.createWriteStream({
        metadata: {
            contentType: file.type,
        },
    });

    return new Promise((resolve, reject) => {
        stream.on('error', (err) => {
            console.error('Error subiendo a Firebase Storage:', err);
            reject('No se pudo subir el video.');
        });

        stream.on('finish', async () => {
            console.log(`Video ${file.name} subido a ${filePath}.`);
            // The Cloud Function will be triggered on finalize. We resolve with the gs:// path.
            const gsPath = `gs://${storageBucket.name}/${filePath}`;
            resolve(gsPath);
        });

        stream.end(buffer);
    });
}



export async function startAnalysis(prevState: any, formData: FormData) {
  try {
    const validatedFields = analysisSchema.safeParse({
      shotType: formData.get("shotType"),
      'video-front': formData.get('video-front'),
    });

    if (!validatedFields.success) {
      console.log(validatedFields.error.flatten().fieldErrors);
      return { message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
    }
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { message: "Usuario no autenticado." };
    }

    const videoFile = validatedFields.data['video-front'];
    // This now returns the gs:// path
    const videoPath = await uploadVideoToStorage(videoFile, currentUser.id);

    // The Cloud Function will now handle the AI analysis.
    // We just need to create aplaceholder/pending analysis document
    // that the function can update later.
    // The id of this doc can be derived from the video path to link them.
    const docId = videoPath.split('/').pop()?.replace(/\.[^/.]+$/, "") || `${Date.now()}`;
    const analysisCollection = collection(adminDb!, "pending_analyses");
    
    await setDoc(doc(analysisCollection, docId), {
        playerId: currentUser.id,
        shotType: validatedFields.data.shotType,
        videoPath: videoPath,
        status: 'uploaded',
        createdAt: new Date().toISOString(),
    });
    
    // Redirect to dashboard, the new analysis will appear once processed.
    revalidatePath(`/dashboard`);
    redirect(`/dashboard?status=processing`);

  } catch (error) {
    console.error("Error de Análisis:", error);
    const message = error instanceof Error ? error.message : "No se pudo iniciar el análisis. Por favor, inténtalo de nuevo.";
    return { message };
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
        
        const currentUser = await getCurrentUser();
        if (!currentUser) return { message: "Debes iniciar sesión para comentar." };

        const commentData = {
            analysisId,
            text,
            author: {
                id: currentUser.id,
                name: currentUser.name,
                avatarUrl: currentUser.avatarUrl,
            },
            createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, "comments"), commentData);

        console.log(`Comentario añadido al análisis ${analysisId}: "${text}"`);

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
            experience: formData.get("experience"),
            ratePerAnalysis: formData.get("ratePerAnalysis"),
            avatarUrl: formData.get("avatarUrl"),
        });

        if (!validatedFields.success) {
            console.log(validatedFields.error.flatten().fieldErrors);
            return { success: false, message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
        }

        const newCoachData = {
             ...validatedFields.data,
            avatarUrl: validatedFields.data.avatarUrl || 'https://placehold.co/128x128.png',
            'data-ai-hint': 'male coach', // default hint
            rating: 0,
            reviews: 0,
            playerIds: [],
        };

        const docRef = await addDoc(collection(db, "coaches"), newCoachData);
        console.log("Nuevo entrenador añadido con ID: ", docRef.id);
        
        revalidatePath('/coaches');
        revalidatePath('/admin');
        return { success: true, message: `Entrenador ${newCoachData.name} añadido con éxito.` };

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
    const rawData = Object.fromEntries(formData.entries());
    const validatedFields = registerSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Datos de formulario inválidos.",
            errors: validatedFields.error.flatten().fieldErrors,
            inputValues: rawData,
        };
    }

    const { name, email, password, dob, country, phone } = validatedFields.data;

    try {
        if (!adminAuth) {
          throw new Error("La configuración de autenticación de administrador no está disponible.");
        }
        
        console.log('Intentando crear usuario con (Admin SDK):', email);
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: name,
        });

        const newPlayer: Omit<Player, 'id'> = {
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

        await setDoc(doc(db, "players", userRecord.uid), newPlayer);
        console.log("Nuevo jugador registrado y guardado en Firestore con UID: ", userRecord.uid);
        
        // After successful creation, we can't redirect directly because the client needs
        // to be signed in. We can't set a client-side session from the server action directly
        // in this simplified setup.
        // A full implementation would use custom tokens, but for now we redirect to login.
        // Or even better, just sign in the user on the client after we know creation was successful.
        // Let's try redirecting to dashboard. The client-side auth state might just work.

    } catch (error: any) {
        console.error("Error específico de Firebase:", error.code, error.message);
        let message = `No se pudo completar el registro. Por favor, inténtelo de nuevo más tarde.`;
        if (error.code === 'auth/email-already-exists') {
            message = "Este email ya está en uso. Por favor, utiliza otro."
        } else if (error.message) {
            message = `Error de Firebase: ${error.message}`;
        }
        return { success: false, message, errors: null, inputValues: rawData };
    }
    
    // If creation was successful, attempt to sign the user in on the client side
    // then redirect. The login action handles the redirection.
    await signInWithEmailAndPassword(auth, email, password);
    redirect('/');
}

export async function registerAdrian(prevState: any, formData: FormData) {
    try {
        const email = 'adrian.bengolea@example.com';
        const password = 'adrian1234';

         if (!adminAuth) {
          throw new Error("La configuración de autenticación de administrador no está disponible.");
        }
        
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: 'Adrian Bengolea',
        });
        
        const dob = new Date("1985-01-01");
        const newPlayer: Omit<Player, 'id'> = {
            name: 'Adrian Bengolea',
            email,
            dob,
            country: 'AR',
            phone: '+54-911-555-1234',
            ageGroup: getAgeGroup(dob),
            playerLevel: 'Intermedio',
            status: 'active',
            avatarUrl: `https://placehold.co/100x100.png`,
            "data-ai-hint": "male portrait",
        };

        await setDoc(doc(db, "players", userRecord.uid), newPlayer);
        console.log("Usuario Adrián Bengolea creado con éxito con UID:", userRecord.uid);
        
        revalidatePath('/register');
        return { success: true, message: `Usuario creado: ${email} / ${password}` };
    } catch (error: any) {
        console.error("Error creando a Adrian:", error);
        let message = "No se pudo crear el usuario.";
        if (error.code === 'auth/email-already-exists') {
            message = "El email para Adrián ya existe."
        }
        return { success: false, message };
    }
}


export async function updateAnalysisScore(prevState: any, formData: FormData) {
    const analysisId = formData.get('analysisId') as string;
    const scoreRaw = formData.get('score');

    const score = Number(scoreRaw);

    if (isNaN(score) || score < 0 || score > 100) {
        return { success: false, message: "La puntuación debe ser un número entre 0 y 100." };
    }
    
    const analysisRef = doc(db, 'analyses', analysisId);

    try {
        await updateDoc(analysisRef, { score: score });
        console.log(`Puntuación actualizada para el análisis ${analysisId}: ${score}`);
        
        const analysisDoc = await getDoc(analysisRef);
        const playerId = analysisDoc.data()?.playerId;
        
        revalidatePath(`/players/${playerId}`);
        revalidatePath(`/analysis/${analysisId}`);
        return { success: true, message: `Puntuación guardada: ${score}` };
    } catch (error) {
        console.error("Error al actualizar la puntuación:", error);
        return { success: false, message: "Análisis no encontrado o no se pudo actualizar." };
    }
}

export async function login(prevState: any, formData: FormData) {
    const validatedFields = loginSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { success: false, message: "Datos de formulario inválidos.", errors: validatedFields.error.flatten().fieldErrors };
    }

    const { email, password, role } = validatedFields.data;

    try {
        // As with registration, this is a simplified auth flow for this environment.
        await signInWithEmailAndPassword(auth, email, password);
        console.log(`Iniciando sesión como ${role} con email: ${email}`);

        // In a real app, you would also check if the user's role matches.
        // For example, check a 'role' field in their Firestore document.

        if (role === 'coach') {
            redirect('/coach/dashboard');
        } else {
            redirect('/dashboard');
        }

    } catch (error: any) {
        console.error("Error de Inicio de Sesión:", error);
         if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
            throw error;
        }
        let message = "No se pudo iniciar sesión. Por favor, revisa tus credenciales.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Email o contraseña incorrectos."
        }
        return { success: false, message };
    }
}

    