"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';
// Acción: añadir entrenador desde el formulario de registro de coaches
const AddCoachSchema = z.object({
    name: z.string().min(2, "Nombre demasiado corto"),
    experience: z.string().min(10, "Describe mejor la experiencia"),
    ratePerAnalysis: z.coerce.number().min(0, "Tarifa inválida"),
    avatarUrl: z.string().url("URL inválida").optional().or(z.literal("").transform(() => undefined)),
});

type AddCoachState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

export async function addCoach(prevState: AddCoachState, formData: FormData): Promise<AddCoachState> {
    try {
        if (!adminDb) {
            return { success: false, message: 'Servidor sin Admin SDK' };
        }
        const parsed = AddCoachSchema.safeParse({
            name: String(formData.get('name') || ''),
            experience: String(formData.get('experience') || ''),
            ratePerAnalysis: formData.get('ratePerAnalysis'),
            avatarUrl: String(formData.get('avatarUrl') || ''),
        });
        if (!parsed.success) {
            const fieldErrors: Record<string, string[]> = {};
            for (const [key, val] of Object.entries(parsed.error.flatten().fieldErrors)) {
                if (val && val.length) fieldErrors[key] = val as string[];
            }
            return { success: false, message: 'Revisa los campos del formulario.', errors: fieldErrors };
        }

        const data = parsed.data;
        const nowIso = new Date().toISOString();
        const payload = {
            name: data.name,
            experience: data.experience,
            ratePerAnalysis: Number(data.ratePerAnalysis),
            avatarUrl: data.avatarUrl || null,
            status: 'pending',
            createdAt: nowIso,
            updatedAt: nowIso,
        } as const;

        await adminDb.collection('coaches').add(payload as any);
        return { success: true, message: 'Entrenador agregado correctamente.' };
    } catch (e) {
        console.error('Error agregando entrenador:', e);
        return { success: false, message: 'No se pudo agregar el entrenador.' };
    }
}
// Regalar créditos (análisis) a un jugador desde el panel admin
export async function giftAnalyses(_prevState: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        const count = Number(formData.get('count') || 0);
        if (!userId || !count || count <= 0) {
            return { success: false, message: 'Parámetros inválidos' };
        }
        if (!adminDb) {
            return { success: false, message: 'Servidor sin Admin SDK' };
        }
        const db = adminDb!;
        const nowIso = new Date().toISOString();
        await db.runTransaction(async (tx: any) => {
            const walletRef = db.collection('wallets').doc(userId);
            const walletSnap = await tx.get(walletRef);
            const base = walletSnap.exists ? walletSnap.data() : {
                userId,
                credits: 0,
                freeAnalysesUsed: 0,
                yearInUse: new Date().getFullYear(),
                historyPlusActive: false,
                historyPlusValidUntil: null,
                currency: 'ARS',
                createdAt: nowIso,
            };
            const newCredits = (base.credits || 0) + count;
            tx.set(walletRef, { ...base, credits: newCredits, updatedAt: nowIso }, { merge: true });
        });
        return { success: true, message: `Se regalaron ${count} análisis.` };
    } catch (e) {
        console.error('Error regalando análisis:', e);
        return { success: false, message: 'Error al regalar análisis' };
    }
}

// Actualizar estado del jugador (active | pending | suspended)
export async function adminUpdatePlayerStatus(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        const status = String(formData.get('status') || '');
        if (!userId || !['active','pending','suspended'].includes(status)) {
            return { success: false, message: 'Parámetros inválidos' };
        }
        if (!adminDb) return { success: false, message: 'Servidor sin Admin SDK' };
        await adminDb.collection('players').doc(userId).set({ status, updatedAt: new Date() }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/players/${userId}`);
        return { success: true };
    } catch (e) {
        console.error('Error actualizando estado:', e);
        return { success: false };
    }
}

// Editar wallet: créditos y gratis usados
export async function adminUpdateWallet(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        const credits = Number(formData.get('credits') || 0);
        const freeAnalysesUsed = Number(formData.get('freeAnalysesUsed') || 0);
        const redirectTo = String(formData.get('redirectTo') || '');
        if (!userId || credits < 0 || freeAnalysesUsed < 0) {
            return { success: false, message: 'Parámetros inválidos' };
        }
        if (!adminDb) return { success: false, message: 'Servidor sin Admin SDK' };
        const walletRef = adminDb.collection('wallets').doc(userId);
        const nowIso = new Date().toISOString();
        await walletRef.set({ userId, credits, freeAnalysesUsed, updatedAt: nowIso }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/players/${userId}`);
        if (redirectTo) {
            redirect(redirectTo);
        }
        return { success: true };
    } catch (e) {
        console.error('Error actualizando wallet:', e);
        return { success: false };
    }
}

// Activar/desactivar History+ y fecha de vencimiento
export async function adminSetHistoryPlus(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        const active = formData.get('historyPlusActive') != null;
        const validUntilStr = String(formData.get('historyPlusValidUntil') || '');
        const validUntil = validUntilStr ? new Date(validUntilStr).toISOString() : null;
        if (!userId) return { success: false };
        if (!adminDb) return { success: false };
        const walletRef = adminDb.collection('wallets').doc(userId);
        const nowIso = new Date().toISOString();
        await walletRef.set({ userId, historyPlusActive: active, historyPlusValidUntil: validUntil, updatedAt: nowIso }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/players/${userId}`);
        return { success: true };
    } catch (e) {
        console.error('Error configurando History+:', e);
        return { success: false };
    }
}

// Enviar link de reseteo de contraseña al email del jugador
export async function adminSendPasswordReset(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        if (!userId) return { success: false };
        if (!adminDb || !adminAuth) return { success: false };
        const playerDoc = await adminDb.collection('players').doc(userId).get();
        const email = playerDoc.exists ? String(playerDoc.data()?.email || '') : '';
        if (!email) return { success: false, message: 'Email no encontrado' };
        const link = await adminAuth.generatePasswordResetLink(email);
        console.log(`🔗 Password reset link for ${email}: ${link}`);
        return { success: true, link };
    } catch (e) {
        console.error('Error enviando reset password:', e);
        return { success: false };
    }
}

import { standardizeVideoBuffer, extractKeyframesFromBuffer, segmentAttemptsByMotionFromBuffer, extractFramesBetweenDataUrlsFromBuffer } from '@/lib/ffmpeg';

// Funciones de mapeo para la IA
type AgeCategory = 'Sub-10' | 'Sub-13' | 'Sub-15' | 'Sub-18' | 'Amateur adulto' | 'Profesional';
type PlayerLevel = 'Principiante' | 'Intermedio' | 'Avanzado';

function mapAgeGroupToCategory(ageGroup: string): AgeCategory {
    switch (ageGroup) {
        case 'U10': return 'Sub-10';
        case 'U13': return 'Sub-13';
        case 'U15': return 'Sub-15';
        case 'U18': return 'Sub-18';
        case 'Amateur': return 'Amateur adulto';
        case 'SemiPro': return 'Profesional';
        case 'Pro': return 'Profesional';
        default: return 'Amateur adulto';
    }
}

function mapPlayerLevel(playerLevel: string): PlayerLevel {
    switch (playerLevel) {
        case 'Principiante': return 'Principiante';
        case 'Intermedio': return 'Intermedio';
        case 'Avanzado': return 'Avanzado';
        default: return 'Principiante';
    }
}

// Obtener usuario actual usando Firebase Admin SDK
const getCurrentUser = async (userId: string) => {
    try {
        console.log(`🔍 Obteniendo usuario actual con Admin SDK: ${userId}`);
        
        if (!adminDb) {
            throw new Error("Firebase Admin Firestore no está inicializado");
        }
        
        // Buscar en la colección de jugadores
        const playerDoc = await adminDb.collection('players').doc(userId).get();
        
        if (playerDoc.exists) {
            const playerData = playerDoc.data();
            console.log(`✅ Jugador encontrado: ${playerData?.name}`);
            return { 
                id: userId, 
                name: playerData?.name || 'Usuario',
                playerLevel: playerData?.playerLevel || 'Por definir',
                ageGroup: playerData?.ageGroup || 'Por definir',
                ...playerData 
            };
        }
        
        console.log(`❌ Usuario no encontrado: ${userId}`);
        return null;
    } catch (error) {
        console.error('❌ Error obteniendo usuario con Admin SDK:', error);
        return null;
    }
}

// Función para procesar frames reales del video
async function processVideoFrames(framesData: string, userId: string, analysisId: string): Promise<{
  keyframeUrls: { front: string[], back: string[], left: string[], right: string[] };
  keyframesForAI: Array<{ index: number; timestamp: number; description: string }>;
  framesForAIDetection: Array<{ index: number; timestamp: number; url: string; description?: string }>;
}> {
    try {
        console.log(`🎬 Procesando frames reales del video...`);
        
        // Parsear los frames del cliente
        const frames = JSON.parse(framesData) as Array<{dataUrl: string; timestamp: number; description: string}>;
        console.log(`✅ ${frames.length} frames recibidos del cliente`);
        
        const keyframeUrls = { 
            front: [] as string[], 
            back: [] as string[], 
            left: [] as string[], 
            right: [] as string[]
        };
        
        const keyframesForAI: Array<{ index: number; timestamp: number; description: string }> = [];
        const framesForAIDetection: Array<{ index: number; timestamp: number; url: string; description?: string }> = [];
        
        // Procesar cada frame
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            
            // Convertir data URL a buffer
            const base64Data = frame.dataUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Crear nombre de archivo único
            const fileName = `keyframe_${i}_${Date.now()}.jpg`;
            const storagePath = `keyframes/${userId}/${analysisId}/${fileName}`;
            
            // Subir a Firebase Storage
            if (adminStorage) {
                await adminStorage.bucket().file(storagePath).save(buffer, {
                    metadata: { contentType: 'image/jpeg' }
                });
                
                // Hacer público y obtener URL
                await adminStorage.bucket().file(storagePath).makePublic();
                const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_ADMIN_STORAGE_BUCKET}/${storagePath}`;
                
                // Agregar a keyframes front (por ahora todos van a front)
                keyframeUrls.front.push(publicUrl);
                
                // Agregar a keyframes para IA
                keyframesForAI.push({
                    index: i,
                    timestamp: frame.timestamp,
                    description: frame.description
                });
                framesForAIDetection.push({ index: i, timestamp: frame.timestamp, url: publicUrl, description: frame.description });
                
                console.log(`✅ Frame ${i} procesado y subido: ${publicUrl}`);
            }
        }
        
        console.log(`🎯 ${keyframeUrls.front.length} frames procesados exitosamente`);
        return { keyframeUrls, keyframesForAI, framesForAIDetection };
        
    } catch (error) {
        console.error('❌ Error procesando frames del video:', error);
        throw new Error(`No se pudieron procesar los frames: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

async function uploadVideoToStorage(file: File, userId: string, options: { maxSeconds?: number } = {}): Promise<string> {
    if (!file) {
        throw new Error("No file provided for upload.");
    }
    
    try {
        console.log(`Iniciando subida con Firebase Admin SDK: ${file.name} para usuario: ${userId}`);
        
        // Verificar que adminStorage esté disponible
        if (!adminStorage) {
            throw new Error("Firebase Admin Storage no está inicializado. Verifica la configuración.");
        }
        
        // Obtener el bucket
        const bucket = adminStorage.bucket();
        console.log(`🔍 Bucket de Storage: ${bucket.name}`);
        
        // Convertir File a Buffer y estandarizar a 720p/20fps con tope de duración
        const arrayBuffer = await file.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);
        const { outputBuffer, contentType } = await standardizeVideoBuffer(inputBuffer, {
            maxSeconds: options.maxSeconds ?? 30,
            targetHeight: 720,
            targetFps: 20,
            dropAudio: false,
        });
        
        // Crear referencia única para el archivo
        const timestamp = Date.now();
        const originalName = file.name || 'video';
        const baseName = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
        const fileName = `${timestamp}-${baseName}.mp4`;
        const filePath = `videos/${userId}/${fileName}`;
        
        console.log(`📁 Subiendo archivo a: ${filePath}`);
        console.log(`📊 Tamaño del archivo estandarizado: ${outputBuffer.length} bytes`);
        
        // Crear referencia en Firebase Admin Storage
        const fileRef = bucket.file(filePath);
        
        // Subir el archivo usando Firebase Admin SDK
        console.log(`Subiendo archivo a Firebase Storage con Admin SDK...`);
        await fileRef.save(outputBuffer, {
            metadata: {
                contentType: contentType || 'video/mp4',
                metadata: {
                    uploadedBy: userId,
                    originalName: originalName,
                    standardized: 'true',
                    targetProfile: `720p_20fps_${String(options.maxSeconds ?? 30)}s_h264_aac`,
                    uploadedAt: new Date().toISOString()
                }
            }
        });
        
        // Hacer el archivo público para obtener URL
        await fileRef.makePublic();
        
        // Obtener la URL pública
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        
        console.log(`✅ Video subido exitosamente con Admin SDK a: ${publicUrl}`);
        console.log(`📁 Ruta en Storage: ${filePath}`);
        
        return publicUrl;
        
    } catch (error) {
        console.error('❌ Error subiendo video con Firebase Admin SDK:', error);
        
        // Manejo específico de errores de bucket
        if (error && typeof error === 'object' && 'code' in error) {
            if ((error as any).code === 404) {
                throw new Error(`Bucket de Storage no encontrado. Verifica la configuración de FIREBASE_ADMIN_STORAGE_BUCKET en .env.local`);
            } else if ((error as any).code === 403) {
                throw new Error(`Permisos insuficientes para subir al bucket de Storage. Verifica las reglas de Storage.`);
            }
        }
        
        throw new Error(`No se pudo subir el video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

export async function startAnalysis(prevState: any, formData: FormData) {
    try {
        console.log("🚀 Iniciando análisis con frames reales...");
        
        // Verificar variables de entorno
        console.log("🔍 Variables de entorno:");
        console.log("  - GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "✅ Configurado" : "❌ No configurado");
        console.log("  - GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ Configurado" : "❌ No configurado");
        
        // Log de todos los datos recibidos
        const formDataEntries = Array.from(formData.entries());
        console.log("📝 Todos los datos del formulario:", formDataEntries);
        
        // Verificar que tenemos userId
        const userId = formData.get('userId') as string;
        if (!userId) {
            console.log("❌ No se recibió userId");
            return { message: "ID de usuario requerido.", error: true };
        }
        console.log("✅ userId recibido:", userId);

        // Verificar que tenemos shotType
        const shotType = formData.get('shotType') as string;
        if (!shotType) {
            console.log("❌ No se recibió shotType");
            return { message: "Tipo de lanzamiento requerido.", error: true };
        }
        console.log("✅ shotType recibido:", shotType);

        // Verificar que tenemos video trasero preferido o frontal como alternativa, y leer videos opcionales
        const formBack = formData.get('video-back') as File | null;
        const formFront = formData.get('video-front') as File | null;
        const videoLeft = formData.get('video-left') as File | null;
        const videoRight = formData.get('video-right') as File | null;
        const primaryFile: File | null = (formBack && formBack.size > 0) ? formBack : (formFront && formFront.size > 0 ? formFront : null);
        const primaryIsBack = !!(formBack && formBack.size > 0);
        if (!primaryFile) {
            console.log("❌ No se recibió video válido (trasero o frontal)");
            return { message: "Video trasero es obligatorio (si no tenés, subí el frontal).", error: true };
        }
        console.log("✅ Video principal recibido:", primaryFile.name, "Tamaño:", primaryFile.size, "Ángulo:", primaryIsBack ? 'back' : 'front');

        // Frames del cliente ya no son necesarios; el backend extrae con FFmpeg
        const framesData = (formData.get('frames') as string) || '[]';

        // Verificar Firebase Admin
        if (!adminDb || !adminStorage) {
            console.log("❌ Firebase Admin no está inicializado");
            return { message: "Error de configuración del servidor.", error: true };
        }
        console.log("✅ Firebase Admin inicializado");
        const db = adminDb!;
        const storage = adminStorage!;

        // Obtener usuario
        console.log("🔍 Obteniendo usuario:", userId);
        const currentUser = await getCurrentUser(userId);
        if (!currentUser) {
            console.log("❌ Usuario no encontrado");
            return { message: "Usuario no autenticado.", error: true };
        }
        console.log("✅ Usuario encontrado:", currentUser.name);

        // ENFORCE: 2 gratis por año o consumir créditos (Argentina)
        console.log("💳 Verificando límites y créditos...");
        const currentYear = new Date().getFullYear();
        let billingInfo: { type: 'free' | 'credit'; year: number } | null = null;
        try {
            await db.runTransaction(async (tx: any) => {
                const walletRef = db.collection('wallets').doc(userId);
                const walletSnap = await tx.get(walletRef);
                let data: any = walletSnap.exists ? walletSnap.data() : null;
                if (!data) {
                    data = {
                        userId,
                        credits: 0,
                        freeAnalysesUsed: 0,
                        yearInUse: currentYear,
                        historyPlusActive: false,
                        historyPlusValidUntil: null,
                        currency: 'ARS',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    tx.set(walletRef, data);
                }
                // Reset anual si cambió el año
                if (Number(data.yearInUse) !== currentYear) {
                    data.freeAnalysesUsed = 0;
                    data.yearInUse = currentYear;
                }
                if ((data.freeAnalysesUsed || 0) < 2) {
                    data.freeAnalysesUsed = (data.freeAnalysesUsed || 0) + 1;
                    data.updatedAt = new Date().toISOString();
                    tx.update(walletRef, { freeAnalysesUsed: data.freeAnalysesUsed, yearInUse: data.yearInUse, updatedAt: data.updatedAt });
                    billingInfo = { type: 'free', year: currentYear };
                } else if ((data.credits || 0) > 0) {
                    data.credits = Number(data.credits) - 1;
                    data.updatedAt = new Date().toISOString();
                    tx.update(walletRef, { credits: data.credits, updatedAt: data.updatedAt });
                    billingInfo = { type: 'credit', year: currentYear };
                } else {
                    billingInfo = null;
                }
            });
        } catch (e) {
            console.error('❌ Error verificando límites/créditos:', e);
            return { message: 'No se pudo verificar tu saldo. Intenta nuevamente.', error: true };
        }
        if (!billingInfo) {
            return {
                message: 'Alcanzaste el límite de 2 análisis gratis este año y no tenés créditos. Comprá un análisis o pack para continuar.',
                error: true,
            };
        }
        const billing = billingInfo as { type: 'free' | 'credit'; year: number };
        console.log('✅ Permiso de análisis otorgado vía', billing.type);

        // Subir videos (principal: back 40s si existe, sino front 30s; laterales y el restante a 30s)
        console.log("📤 Subiendo video principal...");
        const primaryMaxSeconds = primaryIsBack ? 40 : 30;
        const videoPath = await uploadVideoToStorage(primaryFile, currentUser.id, { maxSeconds: primaryMaxSeconds });
        console.log("✅ Video principal subido a:", videoPath);
        let videoFrontUrl: string | null = primaryIsBack ? null : videoPath;
        let videoBackUrl: string | null = primaryIsBack ? videoPath : null;
        let videoLeftUrl: string | null = null;
        let videoRightUrl: string | null = null;
        if (videoLeft && videoLeft.size > 0) {
            console.log("📤 Subiendo video lateral izquierdo...");
            videoLeftUrl = await uploadVideoToStorage(videoLeft, currentUser.id, { maxSeconds: 30 });
            console.log("✅ Lateral izquierdo:", videoLeftUrl);
        }
        if (videoRight && videoRight.size > 0) {
            console.log("📤 Subiendo video lateral derecho...");
            videoRightUrl = await uploadVideoToStorage(videoRight, currentUser.id, { maxSeconds: 30 });
            console.log("✅ Lateral derecho:", videoRightUrl);
        }
        if (primaryIsBack === false && formBack && formBack.size > 0) {
            console.log("📤 Subiendo video trasero adicional...");
            videoBackUrl = await uploadVideoToStorage(formBack, currentUser.id, { maxSeconds: 40 });
            console.log("✅ Trasero adicional:", videoBackUrl);
        }
        if (primaryIsBack === true && formFront && formFront.size > 0) {
            console.log("📤 Subiendo video frontal adicional...");
            videoFrontUrl = await uploadVideoToStorage(formFront, currentUser.id, { maxSeconds: 30 });
            console.log("✅ Frontal adicional:", videoFrontUrl);
        }

        // Guardar análisis
        console.log(`💾 Guardando análisis en Firestore...`);
        const analysisData: any = {
            playerId: currentUser.id,
            shotType: shotType,
            videoUrl: videoPath,
            videoFrontUrl: videoFrontUrl,
            videoLeftUrl: videoLeftUrl,
            videoRightUrl: videoRightUrl,
            videoBackUrl: videoBackUrl,
            status: 'uploaded',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            playerName: currentUser.name,
            playerLevel: currentUser.playerLevel || 'Por definir',
            ageGroup: currentUser.ageGroup || 'Por definir',
            billing: { type: billing.type, year: billing.year },
        };
        
        console.log("📊 Datos del análisis a guardar:", analysisData);
        const analysisRef = await db.collection('analyses').add(analysisData);
        console.log(`✅ Análisis guardado en Firestore, ID: ${analysisRef.id}`);

        // Notificar por email: nuevo video subido
        try {
            const prodBase = 'https://shot-analysis--shotanalisys.us-central1.hosted.app';
            const link = `${prodBase}/admin/revision-ia/${analysisRef.id}`;
            await sendCustomEmail({
                to: 'abengolea1@gmail.com',
                subject: 'Nuevo video subido para análisis',
                html: `<p>Se subió un nuevo video para análisis.</p>
                      <p><b>Jugador:</b> ${currentUser?.name || currentUser?.id || 'desconocido'}</p>
                      <p><b>Tipo de tiro:</b> ${shotType}</p>
                      <p><a href="${link}">Revisar en Revisión IA</a></p>`,
            });
        } catch (e) {
            console.warn('No se pudo enviar email de nuevo video:', e);
        }

        // Rango confirmado desde el cliente (opcional)
        const rangeStart = Number(formData.get('rangeStart') || '0') || 0;
        const rangeEnd = Number(formData.get('rangeEnd') || '0');
        const hasRange = rangeEnd > rangeStart + 0.05;

        // PROCESAR FRAMES REALES DEL VIDEO (igualitario por ángulo)
        try {
        console.log("🎬 Procesando frames del video (todos los ángulos disponibles)...");
        let keyframeUrls: { front: string[], back: string[], left: string[], right: string[] } = { 
            front: [], 
            back: [], 
            left: [], 
            right: [] 
        };
        
        let keyframesForAI: Array<{ index: number; timestamp: number; description: string }> = [];
        
        try {
            const bucket = adminStorage!.bucket();
            // Helper para extraer y subir
            const extractAndUpload = async (angleUrl: string | null, angleKey: 'front'|'back'|'left'|'right', framesCount: number) => {
                if (!angleUrl) return [] as string[];
                const file = bucket.file(`videos/${currentUser.id}/${angleUrl.split('/').pop()}`);
                const [buf] = await file.download();
                const extracted = await extractKeyframesFromBuffer(buf, framesCount);
                const uploadedUrls: string[] = [];
                for (const kf of extracted) {
                    const kfName = `kf_${angleKey}_${kf.index}_${Date.now()}.jpg`;
                    const storagePath = `keyframes/${currentUser.id}/${analysisRef.id}/${kfName}`;
                    await bucket.file(storagePath).save(kf.imageBuffer, { metadata: { contentType: 'image/jpeg' } });
                    await bucket.file(storagePath).makePublic();
                    uploadedUrls.push(`https://storage.googleapis.com/${process.env.FIREBASE_ADMIN_STORAGE_BUCKET}/${storagePath}`);
                }
                return uploadedUrls;
            };

            // Extraer para todos los ángulos disponibles
            keyframeUrls.front = await extractAndUpload(videoFrontUrl, 'front', 12);
            keyframeUrls.back  = await extractAndUpload(videoBackUrl,  'back',  12);
            keyframeUrls.left  = await extractAndUpload(videoLeftUrl,  'left',  12);
            keyframeUrls.right = await extractAndUpload(videoRightUrl, 'right', 12);

            // Para IA: usar keyframes del video principal como referencia temporal
            const primaryFileRef = bucket.file(`videos/${currentUser.id}/${videoPath.split('/').pop()}`);
            const [primaryBuf] = await primaryFileRef.download();
            const primaryExtracted = await extractKeyframesFromBuffer(primaryBuf, 16);
            keyframesForAI = primaryExtracted.map((e, i) => ({ index: i, timestamp: e.timestamp, description: `Frame ${i+1}` }));

            // Si no hay nada en algún ángulo pero el principal existe, no copiamos; dejamos vacío para respetar "igualitario" (no inventar)
        } catch (e) {
            console.warn('⚠️ Extracción de keyframes falló parcialmente. Continuando con lo disponible.', e);
        }

        // Segmentar intentos con heurística Lite sobre el video principal estandarizado
        let attempts: Array<{ start: number; end: number }> = [];
        try {
            const bucket = adminStorage!.bucket();
            const file = bucket.file(`videos/${currentUser.id}/${videoPath.split('/').pop()}`);
            const [buf] = await file.download();
            const heurBase = await segmentAttemptsByMotionFromBuffer(buf, { fps: 6, minSeparationSec: 1.0, peakStd: 2.2 });
            const heur = hasRange ? [{ start: Math.max(0, rangeStart), end: Math.max(rangeStart + 0.1, rangeEnd) }] : heurBase;
            const refined: Array<{ start: number; end: number }> = [];
            for (const w of heur.length ? heur : [{ start: 0, end: Math.min(30, 3) }]) {
                const thumbsStart = await extractFramesBetweenDataUrlsFromBuffer(buf, Math.max(0, w.start - 0.5), w.start + 1.0, 8);
                const thumbsEnd = await extractFramesBetweenDataUrlsFromBuffer(buf, Math.max(w.start, (w.end || w.start) - 1.0), (w.end || w.start), 8);
                let startTs = w.start;
                let endTs = w.end;
                try {
                    const { detectStartFrame } = await import('@/ai/flows/detect-start-frame');
                    const ds = await detectStartFrame({ frames: thumbsStart, shotType: shotType });
                    startTs = ds.startTimestamp;
                } catch {}
                try {
                    const { detectEndFrame } = await import('@/ai/flows/detect-end-frame');
                    const de = await detectEndFrame({ frames: thumbsEnd, shotType: shotType });
                    endTs = de.endTimestamp;
                } catch {}
                if (hasRange) {
                    startTs = Math.max(rangeStart, startTs);
                    endTs = Math.min(rangeEnd, endTs);
                }
                if (!(endTs > startTs)) {
                    endTs = Math.max(startTs + 0.6, hasRange ? rangeEnd : (w.end || startTs + 0.6));
                }
                refined.push({ start: Math.max(0, startTs), end: endTs });
            }
            refined.sort((a, b) => a.start - b.start);
            const merged: Array<{ start: number; end: number }> = [];
            for (const r of refined) {
                if (!merged.length || r.start > merged[merged.length - 1].end - 0.1) {
                    merged.push({ ...r });
                } else {
                    merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
                }
            }
            attempts = merged;
        } catch (e) {
            console.warn('⚠️ No se pudo segmentar intentos con IA (modo normal). Usando fallback si aplica.', e);
        }

        // Intentar detectar el frame inicial con IA usando los frames del principal
        let detectedStartIndex: number | null = null;
        let detectedStartTimestamp: number | null = null;
        let detectedStartConfidence: number | null = null;
        try {
            const { detectStartFrame } = await import('@/ai/flows/detect-start-frame');
            const detection = await detectStartFrame({
                frames: keyframesForAI.slice(0, 8).map((f) => ({ index: f.index, timestamp: f.timestamp, url: '', dataUrl: 'data:image/jpeg;base64,' })),
                shotType: shotType,
            });
            detectedStartIndex = detection.startIndex;
            detectedStartTimestamp = detection.startTimestamp;
            detectedStartConfidence = typeof detection?.confidence === 'number' ? detection.confidence : null;
            console.log('🤖 IA detectó inicio en frame', detectedStartIndex, 'ts', detectedStartTimestamp, 'conf', detection.confidence);
            // Notificación por "duda alta": umbral 0.6
            try {
                const conf = Number(detection?.confidence || 0);
                const threshold = 0.6;
                if (!(conf >= threshold)) {
                    await sendCustomEmail({
                        to: 'abengolea1@gmail.com',
                        subject: 'Duda alta en detección de inicio de tiro',
                        html: `<p>Se detectó <b>duda alta</b> (confianza ${conf.toFixed(2)}) en un análisis.</p>
                              <p><b>Jugador:</b> ${currentUser?.name || currentUser?.id || 'desconocido'}</p>
                              <p><b>Shot Type:</b> ${shotType}</p>
                              <p><a href="/admin/revision-ia">Ir a Revisión IA</a></p>`,
                    });
                }
            } catch (e) {
                console.warn('No se pudo enviar email de duda alta:', e);
            }
        } catch (detErr) {
            console.warn('⚠️ No se pudo ejecutar la detección IA de inicio:', detErr);
        }
        
        console.log("✅ Frames procesados exitosamente");
        
        // EJECUTAR ANÁLISIS DE IA
        console.log("🤖 Iniciando análisis de IA...");
        const { analyzeBasketballShot } = await import('@/ai/flows/analyze-basketball-shot');
        
        // Mapear los campos correctamente para la IA
        const ageCategory = mapAgeGroupToCategory(currentUser.ageGroup || 'Amateur');
        const playerLevel = mapPlayerLevel(currentUser.playerLevel || 'Principiante');
        
        console.log("📹 Analizando video con IA...");
        console.log("🔍 Parámetros para IA:", {
            videoUrl: videoPath,
            shotType: shotType,
            ageCategory: ageCategory,
            playerLevel: playerLevel,
            availableKeyframes: keyframesForAI
        });
        
        const analysisResult = await analyzeBasketballShot({
            videoUrl: videoPath,
            shotType: shotType,
            ageCategory: ageCategory,
            playerLevel: playerLevel,
            availableKeyframes: Array.isArray(keyframesForAI) ? keyframesForAI : []
        });
        console.log("✅ Análisis de IA completado:", analysisResult);
        
        // Ensamblar keyframes por ángulo (igualitario)
        const selectedKeyframeUrls = {
            front: keyframeUrls.front,
            back: keyframeUrls.back,
            left: keyframeUrls.left,
            right: keyframeUrls.right,
        };
        
        // Calcular score
        const mapStatusToRating = (s?: string): number | null => {
            if (!s) return null;
            if (s === 'Incorrecto') return 1;
            if (s === 'Incorrecto leve') return 2;
            if (s === 'Mejorable') return 3;
            if (s === 'Correcto') return 4;
            if (s === 'Excelente') return 5;
            return null;
        };
        const allRatings: number[] = (analysisResult.detailedChecklist || [])
          .flatMap((c: any) => c.items || [])
          .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
          .filter((v: any) => typeof v === 'number');
        const score: number | null = allRatings.length > 0 ? Number((allRatings.reduce((a:number,b:number)=>a+b,0)/allRatings.length).toFixed(2)) : null;
        const scoreLabel = (r:number) => r>=4.5?'Excelente':r>=4?'Correcto':r>=3?'Mejorable':r>=2?'Incorrecto leve':'Incorrecto';

        // Actualizar el análisis con resultados
        if (db) {
            await db.collection('analyses').doc(analysisRef.id).update({
                status: 'analyzed',
                analysisResult: analysisResult,
                detailedChecklist: analysisResult.detailedChecklist || [],
                keyframes: selectedKeyframeUrls,
                score: score,
                scoreLabel: score != null ? scoreLabel(score) : null,
                attempts: attempts,
                startFrameDetection: detectedStartIndex != null ? {
                    index: detectedStartIndex,
                    timestamp: detectedStartTimestamp,
                    confidence: detectedStartConfidence,
                } : null,
                keyframeAnalysis: analysisResult.keyframeAnalysis,
                updatedAt: new Date().toISOString()
            });
        }
        
        console.log("✅ Análisis actualizado con resultados de IA y frames por ángulo");
        
        const finalResult = { 
            message: "Video analizado exitosamente con IA.",
            analysisId: analysisRef.id,
            videoUrl: videoPath,
            shotType: shotType,
            status: 'analyzed',
            analysisResult: analysisResult,
            redirectTo: '/dashboard'
        };
        
        console.log("🎯 Resultado final:", finalResult);
        return finalResult;
        
        } catch (framesError) {
            console.error("❌ Error procesando frames reales:", framesError);
            console.log("⚠️ Continuando sin frames...");
            
            // Si fallan los frames, hacer análisis sin ellos
            const { analyzeBasketballShot } = await import('@/ai/flows/analyze-basketball-shot');
            const ageCategory = mapAgeGroupToCategory(currentUser.ageGroup || 'Amateur');
            const playerLevel = mapPlayerLevel(currentUser.playerLevel || 'Principiante');
            
            const analysisResult = await analyzeBasketballShot({
                videoUrl: videoPath,
                shotType: shotType,
                ageCategory: ageCategory,
                playerLevel: playerLevel,
                availableKeyframes: []
            });
            
            // Actualizar el análisis sin frames
            if (db) {
                await db.collection('analyses').doc(analysisRef.id).update({
                    status: 'analyzed',
                    analysisResult: analysisResult,
                    keyframes: { front: [], back: [], left: [], right: [] },
                    updatedAt: new Date().toISOString()
                });
            }
            
            return { 
                message: "Video analizado exitosamente con IA (sin frames). Revisa los resultados.",
                analysisId: analysisRef.id,
                videoUrl: videoPath,
                shotType: shotType,
                status: 'analyzed',
                analysisResult: analysisResult,
                redirectTo: '/dashboard'
            };
        }

    } catch (error) {
        console.error("❌ Error de Análisis:", error);
        const message = error instanceof Error ? error.message : "No se pudo iniciar el análisis. Por favor, inténtalo de nuevo.";
        return { message, error: true };
    }
}

// Acción temporal para registrar/asegurar el jugador Adrián Bengolea
export async function registerAdrian(prevState: any, _formData: FormData) {
    try {
        if (!adminDb) {
            return { success: false, message: "Firebase Admin no está inicializado" };
        }

        const playerId = 'eGQanqjLcEfez0y7MfjtEqjOaNj2';
        const playerRef = adminDb.collection('players').doc(playerId);
        const existing = await playerRef.get();

        const baseData = {
            name: 'Adrian Bengolea',
            ageGroup: 'Amateur',
            playerLevel: 'Intermedio',
            updatedAt: new Date().toISOString(),
        } as const;

        if (existing.exists) {
            await playerRef.update(baseData);
            revalidatePath('/register');
            return { success: true, message: 'Jugador actualizado correctamente.' };
        }

        await playerRef.set({
            ...baseData,
            createdAt: new Date().toISOString(),
        });

        revalidatePath('/register');
        return { success: true, message: 'Jugador registrado correctamente.' };
    } catch (error) {
        console.error('❌ Error registrando jugador temporal:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return { success: false, message: `No se pudo registrar: ${message}` };
    }
}
