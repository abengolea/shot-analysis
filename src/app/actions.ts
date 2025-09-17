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
    email: z.string().email("Email inválido"),
    // avatarFile se valida en tiempo de ejecución por tamaño/tipo
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
            email: String(formData.get('email') || ''),
        });
        if (!parsed.success) {
            const fieldErrors: Record<string, string[]> = {};
            for (const [key, val] of Object.entries(parsed.error.flatten().fieldErrors)) {
                if (val && val.length) fieldErrors[key] = val as string[];
            }
            return { success: false, message: 'Revisa los campos del formulario.', errors: fieldErrors };
        }

        const data = parsed.data as { name: string; experience: string; email: string };

        // Validar y subir archivo de foto si existe
        let photoUrl: string | null = null;
        const file = formData.get('avatarFile') as File | null;
        if (file && file.size > 0) {
            const allowed = ['image/jpeg', 'image/png', 'image/webp'];
            const maxBytes = 5 * 1024 * 1024; // 5MB
            if (!allowed.includes(file.type)) {
                return { success: false, message: 'Tipo de imagen no permitido', errors: { avatarFile: ['Usa JPG, PNG o WEBP'] } };
            }
            if (file.size > maxBytes) {
                return { success: false, message: 'Imagen muy pesada', errors: { avatarFile: ['Máx 5MB'] } };
            }
            if (!adminStorage) return { success: false, message: 'Storage no inicializado' };
            const bucket = adminStorage.bucket();
            const buffer = Buffer.from(await file.arrayBuffer());
            const safeName = (file.name || 'photo').replace(/[^a-zA-Z0-9_.-]/g, '_');
            const path = `profile-images/admin-added/${Date.now()}-${safeName}`;
            const gcsFile = bucket.file(path);
            await gcsFile.save(buffer, { metadata: { contentType: file.type } });
            await gcsFile.makePublic();
            photoUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
        }

        const nowIso = new Date().toISOString();
        const application = {
            userId: null,
            email: data.email.toLowerCase(),
            name: data.name,
            bio: data.experience,
            photoUrl: photoUrl,
            status: 'pending' as const,
            createdAt: nowIso,
            updatedAt: nowIso,
        };
        const ref = await adminDb.collection('coach_applications').add(application as any);

        try {
            await sendCustomEmail({
                to: 'abengolea1@gmail.com',
                subject: `Nueva solicitud de entrenador (admin): ${data.name}`,
                html: `<p>Email: ${data.email}</p><p>Nombre: ${data.name}</p><p>Bio: ${data.experience}</p><p>Foto: ${photoUrl || '-'}</p><p>ID: ${ref.id}</p>`
            });
        } catch {}

        return { success: true, message: 'Solicitud enviada para aprobación.' };
    } catch (e) {
        console.error('Error agregando entrenador:', e);
        return { success: false, message: 'No se pudo agregar el entrenador.' };
    }
}

// Crear entrenador desde el panel admin (alta solo-admin)
type AdminCreateCoachState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
    userId?: string;
};

export async function adminCreateCoach(prevState: AdminCreateCoachState, formData: FormData): Promise<AdminCreateCoachState> {
    try {
        if (!adminDb || !adminAuth) {
            return { success: false, message: 'Servidor sin Admin SDK' };
        }

        const name = String(formData.get('name') || '').trim();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const bio = String(formData.get('experience') || '').trim();
        const file = formData.get('avatarFile') as File | null;

        const fieldErrors: Record<string, string[]> = {};
        if (!name || name.length < 2) fieldErrors.name = ['Nombre demasiado corto'];
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = ['Email inválido'];
        if (!file || file.size === 0) fieldErrors.avatarFile = ['La foto es obligatoria'];
        if (Object.keys(fieldErrors).length) {
            return { success: false, message: 'Revisa los campos del formulario.', errors: fieldErrors };
        }

        // Validación de la imagen
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const maxBytes = 5 * 1024 * 1024; // 5MB
        if (!allowed.includes(file!.type)) {
            return { success: false, message: 'Tipo de imagen no permitido', errors: { avatarFile: ['Usa JPG, PNG o WEBP'] } };
        }
        if (file!.size > maxBytes) {
            return { success: false, message: 'Imagen muy pesada (máx 5MB)', errors: { avatarFile: ['Máx 5MB'] } };
        }

        // Crear o recuperar usuario en Auth por email
        let userId: string;
        try {
            const existing = await adminAuth.getUserByEmail(email);
            userId = existing.uid;
        } catch {
            const created = await adminAuth.createUser({ email, displayName: name });
            userId = created.uid;
        }

        // Subir foto al Storage
        if (!adminStorage) return { success: false, message: 'Storage no inicializado' };
        const bucket = adminStorage.bucket();
        const buffer = Buffer.from(await file!.arrayBuffer());
        const safeName = (file!.name || 'photo').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const path = `profile-images/coaches/${userId}/${Date.now()}-${safeName}`;
        const gcsFile = bucket.file(path);
        await gcsFile.save(buffer, { metadata: { contentType: file!.type } });
        await gcsFile.makePublic();
        const photoUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

        // Crear/actualizar documento del coach
        const nowIso = new Date().toISOString();
        const coachData = {
            userId,
            name,
            email,
            bio,
            photoUrl,
            role: 'coach' as const,
            status: 'pending' as const,
            verified: true, // verificación automática al tener foto
            publicVisible: true, // visible al crear
            createdAt: nowIso,
            updatedAt: nowIso,
            // Auditoría básica (sin sesión del admin en server action)
            createdByAdminId: null as string | null,
        };
        await adminDb.collection('coaches').doc(userId).set(coachData, { merge: true });

        // Ticket interno de notificación
        try {
            const subject = `Alta de entrenador creada por admin: ${name}`;
            const description = `Nombre: ${name}\nEmail: ${email}\nBio: ${bio || '-'}\nFoto: ${photoUrl}`;
            const ticketNow = new Date().toISOString();
            const ticketData = {
                userId,
                userEmail: email,
                subject,
                category: 'coach_admin_create',
                description,
                status: 'open' as const,
                priority: 'normal' as const,
                adminAssigneeId: null as string | null,
                unreadForAdmin: 1,
                unreadForUser: 0,
                lastMessageAt: ticketNow,
                lastSenderRole: 'admin' as const,
                firstResponseAt: null as string | null,
                resolutionAt: null as string | null,
                createdAt: ticketNow,
                updatedAt: ticketNow,
            };
            const ticketRef = await adminDb.collection('tickets').add(ticketData as any);
            await adminDb.collection('tickets').doc(ticketRef.id).collection('messages').add({
                ticketId: ticketRef.id,
                senderId: userId,
                senderRole: 'admin' as const,
                text: description,
                attachments: [] as string[],
                createdAt: ticketNow,
            } as any);
        } catch (e) {
            console.warn('No se pudo crear ticket de alta de coach', e);
        }

        return { success: true, message: 'Entrenador creado correctamente.', userId };
    } catch (e: any) {
        console.error('Error adminCreateCoach:', e);
        return { success: false, message: e?.message || 'No se pudo crear el entrenador.' };
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

// Actualizar estado del coach (active | pending | suspended)
export async function adminUpdateCoachStatus(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        const status = String(formData.get('status') || '');
        if (!userId || !['active','pending','suspended'].includes(status)) {
            return { success: false, message: 'Parámetros inválidos' };
        }
        if (!adminDb) return { success: false, message: 'Servidor sin Admin SDK' };
        await adminDb.collection('coaches').doc(userId).set({ status, updatedAt: new Date().toISOString() }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/coaches/${userId}`);
        return { success: true };
    } catch (e) {
        console.error('Error actualizando estado de coach:', e);
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
        let email = '';
        // Buscar email en players o coaches; fallback a Auth
        const playerDoc = await adminDb.collection('players').doc(userId).get();
        if (playerDoc.exists) {
            email = String(playerDoc.data()?.email || '');
        }
        if (!email) {
            const coachDoc = await adminDb.collection('coaches').doc(userId).get();
            if (coachDoc.exists) email = String(coachDoc.data()?.email || '');
        }
        if (!email) {
            try {
                const userRecord = await adminAuth.getUser(userId);
                email = userRecord.email || '';
            } catch {}
        }
        if (!email) return { success: false, message: 'Email no encontrado' };
        const link = await adminAuth.generatePasswordResetLink(email);
        console.log(`🔗 Password reset link for ${email}: ${link}`);
        return { success: true, link };
    } catch (e) {
        console.error('Error enviando reset password:', e);
        return { success: false };
    }
}

// Actualizar perfil del coach: nombre, bio, tarifa, email de pagos, verificado
export async function adminUpdateCoachProfile(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        if (!userId) return { success: false, message: 'userId requerido' };
        if (!adminDb) return { success: false, message: 'Servidor sin Admin SDK' };
        const name = String(formData.get('name') || '').trim();
        const bio = String(formData.get('bio') || '').trim();
        const payoutEmail = String(formData.get('payoutEmail') || '').trim();
        const ratePerAnalysisRaw = String(formData.get('ratePerAnalysis') || '').trim();
        const verified = formData.get('verified') != null;
        const publicVisible = formData.get('publicVisible') != null;
        const phone = String(formData.get('phone') || '').trim();
        const website = String(formData.get('website') || '').trim();
        const twitter = String(formData.get('twitter') || '').trim();
        const instagram = String(formData.get('instagram') || '').trim();
        const youtube = String(formData.get('youtube') || '').trim();
        const update: any = { updatedAt: new Date().toISOString() };
        if (name) update.name = name;
        if (bio || bio === '') update.bio = bio;
        if (payoutEmail || payoutEmail === '') update.payoutEmail = payoutEmail;
        if (ratePerAnalysisRaw !== '') {
            const r = Number(ratePerAnalysisRaw);
            if (!Number.isNaN(r) && r >= 0) update.ratePerAnalysis = r;
        }
        update.verified = verified;
        update.publicVisible = publicVisible;
        if (phone || phone === '') update.phone = phone;
        update.links = {
            ...(website ? { website } : {}),
            ...(twitter ? { twitter } : {}),
            ...(instagram ? { instagram } : {}),
            ...(youtube ? { youtube } : {}),
        };
        await adminDb.collection('coaches').doc(userId).set(update, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/coaches/${userId}`);
        return { success: true };
    } catch (e) {
        console.error('Error actualizando perfil de coach:', e);
        return { success: false };
    }
}

// Activar ya (status=active, verified=true, publicVisible=true)
export async function adminActivateCoachNow(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        if (!userId) return { success: false };
        if (!adminDb) return { success: false };
        const nowIso = new Date().toISOString();
        await adminDb.collection('coaches').doc(userId).set({ status: 'active', verified: true, publicVisible: true, updatedAt: nowIso }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/coaches/${userId}`);
        return { success: true };
    } catch (e) {
        console.error('Error activando coach:', e);
        return { success: false };
    }
}

// Subir/actualizar foto del coach
export async function adminUpdateCoachPhoto(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        const file = formData.get('avatarFile') as File | null;
        if (!userId || !file || file.size === 0) {
            return { success: false, message: 'Archivo requerido' };
        }
        if (!adminDb || !adminStorage) {
            return { success: false, message: 'Servidor sin Admin SDK/Storage' };
        }
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const maxBytes = 5 * 1024 * 1024; // 5MB
        if (!allowed.includes(file.type)) {
            return { success: false, message: 'Tipo de imagen no permitido' };
        }
        if (file.size > maxBytes) {
            return { success: false, message: 'Imagen muy pesada (máx 5MB)' };
        }
        const bucket = adminStorage.bucket();
        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = (file.name || 'photo').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const path = `profile-images/coaches/${userId}/${Date.now()}-${safeName}`;
        const gcsFile = bucket.file(path);
        await gcsFile.save(buffer, { metadata: { contentType: file.type } });
        await gcsFile.makePublic();
        const photoUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

        await adminDb.collection('coaches').doc(userId).set({ photoUrl, updatedAt: new Date().toISOString() }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/coaches/${userId}`);
        return { success: true, photoUrl };
    } catch (e) {
        console.error('Error subiendo foto de coach:', e);
        return { success: false };
    }
}

import { standardizeVideoBuffer } from '@/lib/ffmpeg';

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

export async function startAnalysis(prevState: any, formData: FormData) {
    try {
        console.log("🚀 Iniciando análisis (sin frames del cliente)...");
        console.log("🔍 Variables de entorno:");
        console.log("  - GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "✅ Configurado" : "❌ No configurado");
        console.log("  - GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ Configurado" : "❌ No configurado");

        const userId = formData.get('userId') as string;
        const coachId = (formData.get('coachId') as string | null) || null;
        if (!userId) return { message: "ID de usuario requerido.", error: true };
        const shotType = formData.get('shotType') as string;
        if (!shotType) return { message: "Tipo de lanzamiento requerido.", error: true };

        // Nuevo flujo: aceptar URLs ya subidas por el cliente (Firebase Storage)
        const uploadedBackUrl = (formData.get('uploadedBackUrl') as string | null) || null;
        const uploadedFrontUrl = (formData.get('uploadedFrontUrl') as string | null) || null;
        const uploadedLeftUrl = (formData.get('uploadedLeftUrl') as string | null) || null;
        const uploadedRightUrl = (formData.get('uploadedRightUrl') as string | null) || null;

        // Flujo legacy: archivos directos
        const formBack = formData.get('video-back') as File | null;
        const formFront = formData.get('video-front') as File | null;
        const videoLeft = formData.get('video-left') as File | null;
        const videoRight = formData.get('video-right') as File | null;
        const primaryFile: File | null = (formBack && formBack.size > 0) ? formBack : (formFront && formFront.size > 0 ? formFront : null);
        const primaryIsBack = !!(formBack && formBack.size > 0);
        const hasUploadedUrls = Boolean(uploadedBackUrl || uploadedFrontUrl || uploadedLeftUrl || uploadedRightUrl);
        if (!primaryFile && !hasUploadedUrls) {
            return { message: "Video trasero es obligatorio (si no tenés, subí el frontal).", error: true };
        }

        if (!adminDb || !adminStorage) {
            return { message: "Error de configuración del servidor.", error: true };
        }
        const db = adminDb;

        // Obtener usuario
        const playerDoc = await db.collection('players').doc(userId).get();
        const currentUser = playerDoc.exists ? { id: userId, ...(playerDoc.data() as any) } : null;
        if (!currentUser) return { message: "Usuario no autenticado.", error: true };

        // Validación de relación coach-jugador si se envía coachId
        if (coachId) {
            const assignedCoachId = (currentUser as any).coachId || null;
            if (!assignedCoachId || String(assignedCoachId) !== String(coachId)) {
                return { message: 'No estás autorizado para iniciar análisis de este jugador.', error: true };
            }
        }

        // Validación de perfil completo (antes de tocar créditos)
        const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
        const hasDob = Boolean((currentUser as any).dob);
        const heightOk = (() => {
            const h = (currentUser as any).height;
            if (typeof h === 'number') return h > 0;
            const n = Number(h);
            return !Number.isNaN(n) && n > 0;
        })();
        const wingspanOk = (() => {
            const w = (currentUser as any).wingspan;
            if (typeof w === 'number') return w > 0;
            const n = Number(w);
            return !Number.isNaN(n) && n > 0;
        })();
        const profileComplete = (
            isNonEmptyString((currentUser as any).name) &&
            hasDob &&
            isNonEmptyString((currentUser as any).country) &&
            isNonEmptyString((currentUser as any).ageGroup) &&
            isNonEmptyString((currentUser as any).playerLevel) &&
            isNonEmptyString((currentUser as any).position) &&
            heightOk &&
            wingspanOk
        );
        if (!profileComplete) {
            return {
                message: 'Tu perfil está incompleto. Completá nombre, fecha de nacimiento, país, grupo de edad, nivel, posición, altura y envergadura antes de iniciar un análisis.',
                error: true,
            };
        }

        // Enforce créditos / gratis
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
            return { message: 'No se pudo verificar tu saldo. Intenta nuevamente.', error: true };
        }
        if (!billingInfo) {
            return {
                message: 'Alcanzaste el límite de 2 análisis gratis este año y no tenés créditos. Comprá un análisis o pack para continuar.',
                error: true,
            };
        }
        const billing = billingInfo as { type: 'free' | 'credit'; year: number };

        // Helper para estandarizar y subir a Storage (solo cuando recibimos archivos binarios)
        const uploadVideoToStorage = async (file: File, userId: string, options: { maxSeconds?: number } = {}): Promise<string> => {
            const bucket = adminStorage!.bucket();
            const arrayBuffer = await file.arrayBuffer();
            const inputBuffer = Buffer.from(arrayBuffer);
            const { outputBuffer, contentType } = await standardizeVideoBuffer(inputBuffer, {
                maxSeconds: options.maxSeconds ?? 30,
                targetHeight: 720,
                targetFps: 20,
                dropAudio: false,
            });
            const timestamp = Date.now();
            const originalName = file.name || 'video';
            const baseName = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
            const fileName = `${timestamp}-${baseName}.mp4`;
            const filePath = `videos/${userId}/${fileName}`;
            const fileRef = bucket.file(filePath);
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
            await fileRef.makePublic();
            return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        };

        let videoPath: string = '';
        let videoFrontUrl: string | null = null;
        let videoBackUrl: string | null = null;
        let videoLeftUrl: string | null = null;
        let videoRightUrl: string | null = null;

        if (hasUploadedUrls) {
            // Usar URLs ya subidas por el cliente (resumable upload)
            videoBackUrl = uploadedBackUrl || null;
            videoFrontUrl = uploadedFrontUrl || null;
            videoLeftUrl = uploadedLeftUrl || null;
            videoRightUrl = uploadedRightUrl || null;
            videoPath = videoBackUrl || videoFrontUrl || videoLeftUrl || videoRightUrl || '';
            if (!videoPath) {
                return { message: 'No se recibió ninguna URL de video válida.', error: true };
            }
        } else {
            // Subida server-side (legacy)
            const primaryMaxSeconds = primaryIsBack ? 40 : 30;
            const uploadedPrimaryUrl = await uploadVideoToStorage(primaryFile!, currentUser.id, { maxSeconds: primaryMaxSeconds });
            videoFrontUrl = primaryIsBack ? null : uploadedPrimaryUrl;
            videoBackUrl = primaryIsBack ? uploadedPrimaryUrl : null;
            if (videoLeft && videoLeft.size > 0) {
                videoLeftUrl = await uploadVideoToStorage(videoLeft, currentUser.id, { maxSeconds: 30 });
            }
            if (videoRight && videoRight.size > 0) {
                videoRightUrl = await uploadVideoToStorage(videoRight, currentUser.id, { maxSeconds: 30 });
            }
            if (primaryIsBack === false && formBack && formBack.size > 0) {
                videoBackUrl = await uploadVideoToStorage(formBack, currentUser.id, { maxSeconds: 40 });
            }
            if (primaryIsBack === true && formFront && formFront.size > 0) {
                videoFrontUrl = await uploadVideoToStorage(formFront, currentUser.id, { maxSeconds: 30 });
            }
            videoPath = uploadedPrimaryUrl;
        }

        // Guardar análisis
        const analysisData: any = {
            playerId: currentUser.id,
            shotType: shotType,
            videoUrl: videoPath,
            videoFrontUrl: videoFrontUrl,
            videoLeftUrl: videoLeftUrl,
            videoRightUrl: videoRightUrl,
            videoBackUrl: videoBackUrl,
            status: 'uploaded',
            coachCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            playerName: currentUser.name || 'Usuario',
            playerLevel: currentUser.playerLevel || 'Por definir',
            ageGroup: currentUser.ageGroup || 'Por definir',
            billing: { type: billing.type, year: billing.year },
            coachId: coachId || (currentUser as any).coachId || null,
        };
        const analysisRef = await db.collection('analyses').add(analysisData);

        // Notificar por email
        try {
            const prodBase = 'https://shot-analysis--shotanalisys.us-central1.hosted.app';
            const link = `${prodBase}/admin/revision-ia/${analysisRef.id}`;
            await sendCustomEmail({
                to: 'abengolea@hotmail.com',
                subject: 'Nuevo video subido para análisis',
                html: `<p>Se subió un nuevo video para análisis.</p>
                      <p><b>Jugador:</b> ${currentUser?.name || currentUser?.id || 'desconocido'}</p>
                      <p><b>Tipo de tiro:</b> ${shotType}</p>
                      <p><a href="${link}">Revisar en Revisión IA</a></p>`,
            });
        } catch {}

        // Ejecutar análisis IA sin frames del cliente
        const { analyzeBasketballShot } = await import('@/ai/flows/analyze-basketball-shot');
        const mapAgeGroupToCategory = (ageGroup: string) => {
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
        };
        const mapPlayerLevel = (pl: string) => (pl === 'Intermedio' || pl === 'Avanzado' ? pl : 'Principiante');
        const ageCategory = mapAgeGroupToCategory(currentUser.ageGroup || 'Amateur');
        const playerLevel = mapPlayerLevel(currentUser.playerLevel || 'Principiante');

        const analysisResult = await analyzeBasketballShot({
            videoUrl: videoPath,
            shotType,
            ageCategory,
            playerLevel,
            availableKeyframes: [],
        });

        await db.collection('analyses').doc(analysisRef.id).update({
            status: 'analyzed',
            analysisResult,
            detailedChecklist: analysisResult.detailedChecklist || [],
            keyframes: { front: [], back: [], left: [], right: [] },
            coachCompleted: false,
            updatedAt: new Date().toISOString(),
        });

        return {
            message: "Video analizado exitosamente con IA.",
            analysisId: analysisRef.id,
            videoUrl: videoPath,
            shotType,
            status: 'analyzed',
            analysisResult,
            redirectTo: '/dashboard'
        };

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
