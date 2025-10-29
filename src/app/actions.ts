"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';
import { isMaintenanceMode } from '@/lib/maintenance';
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
        
        console.log('adminUpdateWallet called with:', { userId, credits, freeAnalysesUsed, redirectTo });
        
        if (!userId || credits < 0 || freeAnalysesUsed < 0) {
            console.error('Parámetros inválidos:', { userId, credits, freeAnalysesUsed });
            return { success: false, message: 'Parámetros inválidos' };
        }
        if (!adminDb) {
            console.error('Admin SDK no inicializado');
            return { success: false, message: 'Servidor sin Admin SDK' };
        }
        
        const walletRef = adminDb.collection('wallets').doc(userId);
        const nowIso = new Date().toISOString();
        const walletData = { userId, credits, freeAnalysesUsed, updatedAt: nowIso };
        
        console.log('Actualizando wallet con datos:', walletData);
        await walletRef.set(walletData, { merge: true });
        
        console.log('Wallet actualizada exitosamente, revalidando paths...');
        revalidatePath('/admin');
        revalidatePath(`/admin/players/${userId}`);
        
        // Solo redirigir si se especifica redirectTo (formularios HTML normales)
        if (redirectTo) {
            console.log('Redirigiendo a:', redirectTo);
            redirect(redirectTo);
        }
        
        console.log('adminUpdateWallet completado exitosamente');
        return { success: true };
    } catch (e: any) {
        // Si es un error de redirect de Next.js, no lo tratamos como error
        if (e?.message === 'NEXT_REDIRECT') {
            console.log('Redirección exitosa');
            throw e; // Re-lanzamos para que Next.js maneje la redirección
        }
        console.error('Error actualizando wallet:', e);
        return { success: false, message: `Error: ${e?.message || 'Error desconocido'}` };
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

// Activar y enviar link de contraseña en un solo paso
export async function adminActivateCoachAndSendPassword(_prev: any, formData: FormData) {
    try {
        const userId = String(formData.get('userId') || '');
        if (!userId) return { success: false, message: 'userId requerido' };
        if (!adminDb || !adminAuth) return { success: false, message: 'Servidor sin Admin SDK' };

        const nowIso = new Date().toISOString();
        await adminDb.collection('coaches').doc(userId).set({ status: 'active', verified: true, publicVisible: true, updatedAt: nowIso }, { merge: true });

        // Obtener email del coach
        let email = '';
        try {
            const coachDoc = await adminDb.collection('coaches').doc(userId).get();
            if (coachDoc.exists) email = String(coachDoc.data()?.email || '');
        } catch {}
        if (!email) {
            try { const userRecord = await adminAuth.getUser(userId); email = userRecord.email || ''; } catch {}
        }
        if (!email) return { success: false, message: 'Email del coach no encontrado' };

        // Generar link de restablecimiento y enviarlo por email
        const link = await adminAuth.generatePasswordResetLink(email);
        try {
            await sendCustomEmail({
                to: email,
                subject: 'Tu acceso como entrenador',
                html: `<p>Hola, tu cuenta de entrenador fue activada.</p><p>Creá tu contraseña desde este enlace: <a href="${link}">establecer contraseña</a>.</p><p>Luego ingresá a tu panel y completá tu perfil.</p>`
            });
        } catch (e) {
            console.warn('No se pudo enviar email de contraseña; devolviendo el link de fallback.');
            return { success: true, message: 'Coach activado. No se pudo enviar email; usa el link devuelto.', link };
        }

        revalidatePath('/admin');
        revalidatePath(`/admin/coaches/${userId}`);
        return { success: true, message: 'Coach activado y email enviado.' };
    } catch (e) {
        console.error('Error adminActivateCoachAndSendPassword:', e);
        return { success: false, message: 'No se pudo activar/enviar contraseña' };
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
                if (!adminDb) {
            throw new Error("Firebase Admin Firestore no está inicializado");
        }
        
        // Buscar en la colección de jugadores
        const playerDoc = await adminDb.collection('players').doc(userId).get();
        
        if (playerDoc.exists) {
            const playerData = playerDoc.data();
                        return { 
                id: userId, 
                name: playerData?.name || 'Usuario',
                playerLevel: playerData?.playerLevel || 'Por definir',
                ageGroup: playerData?.ageGroup || 'Por definir',
                ...playerData 
            };
        }
        
                return null;
    } catch (error) {
        console.error('❌ Error obteniendo usuario con Admin SDK:', error);
        return null;
    }
}

// FUNCIÓN ANTIGUA DE ANÁLISIS CON GENKIT (BACKUP)
export async function startAnalysisOld(prevState: any, formData: FormData) {
    try {
        // Verificar si el sistema está en modo mantenimiento
        const maintenanceEnabled = await isMaintenanceMode();
        if (maintenanceEnabled) {
            return { 
                message: "El sistema está en mantenimiento. El análisis de lanzamientos está temporalmente deshabilitado.", 
                error: true 
            };
        }

        console.log("🚀 Iniciando análisis OLD con Genkit (sin frames del cliente)...");
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

        // Nota: Antes se bloqueaba por perfil incompleto. Ahora permitimos continuar.

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
                    data.lastFreeAnalysisDate = null; // Reset last free analysis date for new year
                }
                
                // Check if user can use a free analysis (2 per year with 6 months separation)
                const canUseFreeAnalysis = () => {
                    const freeUsed = data.freeAnalysesUsed || 0;
                    if (freeUsed >= 2) return false;
                    
                    // If no free analysis used yet, allow it
                    if (freeUsed === 0) return true;
                    
                    // If one free analysis used, check if 6 months have passed
                    const lastFreeDate = data.lastFreeAnalysisDate;
                    if (!lastFreeDate) return false;
                    
                    const lastDate = new Date(lastFreeDate);
                    const now = new Date();
                    const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000)); // 6 months in milliseconds
                    
                    return lastDate <= sixMonthsAgo;
                };
                
                if (canUseFreeAnalysis()) {
                    data.freeAnalysesUsed = (data.freeAnalysesUsed || 0) + 1;
                    data.lastFreeAnalysisDate = new Date().toISOString();
                    data.updatedAt = new Date().toISOString();
                    tx.update(walletRef, { 
                        freeAnalysesUsed: data.freeAnalysesUsed, 
                        lastFreeAnalysisDate: data.lastFreeAnalysisDate,
                        yearInUse: data.yearInUse, 
                        updatedAt: data.updatedAt 
                    });
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
            // Check if it's because of the 6-month waiting period
            const walletSnap = await adminDb.collection('wallets').doc(userId).get();
            const walletData = walletSnap.data();
            const freeUsed = walletData?.freeAnalysesUsed || 0;
            const lastFreeDate = walletData?.lastFreeAnalysisDate;
            
            if (freeUsed === 1 && lastFreeDate) {
                const lastDate = new Date(lastFreeDate);
                const now = new Date();
                const sixMonthsFromLast = new Date(lastDate.getTime() + (6 * 30 * 24 * 60 * 60 * 1000));
                const daysUntilNext = Math.ceil((sixMonthsFromLast.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysUntilNext > 0) {
                    return {
                        message: `Usaste tu primer análisis gratis. Tu segundo análisis gratis estará disponible en ${daysUntilNext} días (después de 6 meses desde el último análisis gratuito). Mientras tanto, podés comprar un análisis o pack.`,
                        error: true,
                    };
                }
            }
            
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
            console.log('📤 Usando videos pre-subidos por el cliente...');
            videoBackUrl = uploadedBackUrl || null;
            videoFrontUrl = uploadedFrontUrl || null;
            videoLeftUrl = uploadedLeftUrl || null;
            videoRightUrl = uploadedRightUrl || null;
            videoPath = videoBackUrl || videoFrontUrl || videoLeftUrl || videoRightUrl || '';
            
            const videoCount = [videoBackUrl, videoFrontUrl, videoLeftUrl, videoRightUrl].filter(Boolean).length;
                        if (!videoPath) {
                return { message: 'No se recibió ninguna URL de video válida.', error: true };
            }
        } else {
            // Subida server-side (legacy) con mejor logging
            console.log('📤 Subiendo videos al servidor...');
            const primaryMaxSeconds = primaryIsBack ? 30 : 30;
            
            console.log(`📹 Subiendo video principal (${primaryIsBack ? 'back' : 'front'})...`);
            const uploadedPrimaryUrl = await uploadVideoToStorage(primaryFile!, currentUser.id, { maxSeconds: primaryMaxSeconds });
            videoFrontUrl = primaryIsBack ? null : uploadedPrimaryUrl;
            videoBackUrl = primaryIsBack ? uploadedPrimaryUrl : null;
            
            // Subir videos adicionales si existen
            if (videoLeft && videoLeft.size > 0) {
                                videoLeftUrl = await uploadVideoToStorage(videoLeft, currentUser.id, { maxSeconds: 30 });
            }
            if (videoRight && videoRight.size > 0) {
                                videoRightUrl = await uploadVideoToStorage(videoRight, currentUser.id, { maxSeconds: 30 });
            }
            if (primaryIsBack === false && formBack && formBack.size > 0) {
                                videoBackUrl = await uploadVideoToStorage(formBack, currentUser.id, { maxSeconds: 30 });
            }
            if (primaryIsBack === true && formFront && formFront.size > 0) {
                                videoFrontUrl = await uploadVideoToStorage(formFront, currentUser.id, { maxSeconds: 30 });
            }
            videoPath = uploadedPrimaryUrl;
            
            const totalVideos = [videoBackUrl, videoFrontUrl, videoLeftUrl, videoRightUrl].filter(Boolean).length;
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

        // Ejecutar análisis IA con prompt de producción (mismo que test-video-real)
        const { analyzeVideoSingleCall } = await import('@/utils/gemini-single-call');
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

        // Preprocesar videos con FFmpeg para optimizar análisis (hasta 4 videos)
        console.log('⚙️ Preprocesando videos con FFmpeg...');
        
        const { preprocessVideo } = await import('@/lib/gemini-video-real');
        
        // Video principal
        const videoResponse1 = await fetch(videoPath);
        const videoBuffer1 = Buffer.from(await videoResponse1.arrayBuffer());
        const { optimizedVideo: processedVideo1 } = await preprocessVideo(videoBuffer1, 'video1.mp4');
        const base64Video1 = processedVideo1.toString('base64');

        let base64Video2: string | undefined;
        let base64Video3: string | undefined;
        let base64Video4: string | undefined;

        // Video frontal
        if (videoFrontUrl) {
            const videoResponse2 = await fetch(videoFrontUrl);
            const videoBuffer2 = Buffer.from(await videoResponse2.arrayBuffer());
            const { optimizedVideo: processedVideo2 } = await preprocessVideo(videoBuffer2, 'video2.mp4');
            base64Video2 = processedVideo2.toString('base64');
        }

        // Video izquierdo
        if (videoLeftUrl) {
            const videoResponse3 = await fetch(videoLeftUrl);
            const videoBuffer3 = Buffer.from(await videoResponse3.arrayBuffer());
            const { optimizedVideo: processedVideo3 } = await preprocessVideo(videoBuffer3, 'video3.mp4');
            base64Video3 = processedVideo3.toString('base64');
        }

        // Video derecho
        if (videoRightUrl) {
            const videoResponse4 = await fetch(videoRightUrl);
            const videoBuffer4 = Buffer.from(await videoResponse4.arrayBuffer());
            const { optimizedVideo: processedVideo4 } = await preprocessVideo(videoBuffer4, 'video4.mp4');
            base64Video4 = processedVideo4.toString('base64');
        }

                // Log de tamaños de videos para debugging
        console.log(`📊 Tamaños de videos base64:`, {
            video1: `${Math.round(base64Video1.length / 1024)}KB`,
            video2: base64Video2 ? `${Math.round(base64Video2.length / 1024)}KB` : 'N/A',
            video3: base64Video3 ? `${Math.round(base64Video3.length / 1024)}KB` : 'N/A',
            video4: base64Video4 ? `${Math.round(base64Video4.length / 1024)}KB` : 'N/A'
        });
        
        let analysisResult;
        try {
            analysisResult = await analyzeVideoSingleCall(base64Video1, base64Video2, base64Video3, base64Video4);
                    } catch (error) {
            console.error('❌ Error en el análisis:', error);
            throw new Error(`Error en el análisis de video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }

        // Convertir parámetros en categorías para el frontend
        const parameters = analysisResult.technicalAnalysis?.parameters || [];

        // Función para crear un resumen descriptivo del análisis
        const createAnalysisSummary = (analysisResult: any): string => {
            const verification = analysisResult.verification || {};
            const technicalAnalysis = analysisResult.technicalAnalysis || {};
            const shotSummary = analysisResult.shotSummary || {};
            const shots = analysisResult.shots || [];
            
            let summary = `Análisis de ${shots.length} tiro${shots.length > 1 ? 's' : ''} de baloncesto`;
            
            // Agregar información del video
            if (verification.cameraAngle) {
                summary += ` desde ángulo ${verification.cameraAngle}`;
            }
            
            // Agregar información de la canasta
            if (verification.basketVisible !== undefined) {
                summary += verification.basketVisible ? ' con canasta visible' : ' sin visibilidad de canasta';
            }
            
            // Agregar puntuación general
            if (technicalAnalysis.overallScore) {
                summary += `. Puntuación general: ${technicalAnalysis.overallScore}/100`;
            }
            
            // Agregar fortalezas principales
            if (technicalAnalysis.strengths && technicalAnalysis.strengths.length > 0) {
                summary += `. Fortalezas: ${technicalAnalysis.strengths.slice(0, 2).join(', ')}`;
            }
            
            // Agregar debilidades principales
            if (technicalAnalysis.weaknesses && technicalAnalysis.weaknesses.length > 0) {
                summary += `. Áreas de mejora: ${technicalAnalysis.weaknesses.slice(0, 2).join(', ')}`;
            }
            
            return summary;
        };
        
        // Función para mapear nombres de Gemini a IDs canónicos
        const getCanonicalId = (geminiName: string): string => {
            const nameMap: Record<string, string> = {
                'Alineación de pies': 'alineacion_pies',
                'Alineación del cuerpo': 'alineacion_cuerpo',
                'Muñeca cargada': 'muneca_cargada',
                'Flexión de rodillas': 'flexion_rodillas',
                'Hombros relajados': 'hombros_relajados',
                'Enfoque visual': 'enfoque_visual',
                'Mano no dominante ascenso': 'mano_no_dominante_ascenso',
                'Codos cerca del cuerpo': 'codos_cerca_cuerpo',
                'Subida recta del balón': 'subida_recta_balon',
                'Trayectoria hasta set point': 'trayectoria_hasta_set_point',
                'Set point': 'set_point',
                'Tiempo de lanzamiento': 'tiempo_lanzamiento',
                'Mano no dominante liberación': 'mano_no_dominante_liberacion',
                'Extensión completa del brazo': 'extension_completa_brazo',
                'Giro de la pelota': 'giro_pelota',
                'Ángulo de salida': 'angulo_salida',
                'Equilibrio post-liberación y aterrizaje': 'equilibrio_post_liberacion',
                'Duración del follow-through': 'duracion_follow_through',
                'Consistencia del movimiento': 'consistencia_repetitiva',
                'Consistencia técnica': 'consistencia_tecnica',
                'Consistencia de resultados': 'consistencia_resultados'
            };
            return nameMap[geminiName] || geminiName.toLowerCase().replace(/\s+/g, '_');
        };
        
        // TEMPORAL: Mostrar TODOS los parámetros en una categoría para debug
        const detailedChecklist = [
            {
                category: "TODOS LOS PARÁMETROS (DEBUG)",
                items: parameters.map((p: any) => ({
                    id: getCanonicalId(p.name),
                    name: p.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: p.comment || '',
                    status: (() => {
                        const score = p.score || 0;
                        if (score >= 70) return 'Correcto';
                        if (score >= 36) return 'Mejorable';
                        return 'Incorrecto';
                    })(), // Forzar cálculo basado en score, ignorar status de IA
                    rating: (() => {
                        const score = p.score || 0;
                        if (score >= 90) return 5; // Excelente
                        if (score >= 70) return 4; // Correcto
                        if (score >= 50) return 3; // Mejorable
                        if (score >= 30) return 2; // Incorrecto leve
                        return 1; // Incorrecto
                    })() as 0 | 1 | 2 | 3 | 4 | 5,
                    comment: p.comment || '',
                    na: p.status === 'no_evaluable',
                    razon: p.razon || '',
                    evidencia: p.evidencia || '',
                    timestamp: p.timestamp || ''
                }))
            },
        ];

        // Adaptar el resultado del nuevo prompt al formato esperado por la UI
        const adaptedAnalysisResult = {
            ...analysisResult,
            detailedChecklist: detailedChecklist,
            keyframes: { front: [], back: [], left: [], right: [] },
            // Mapear campos del nuevo formato al formato esperado
            analysisSummary: createAnalysisSummary(analysisResult),
            overallScore: analysisResult.technicalAnalysis?.overallScore || 0,
            strengths: analysisResult.technicalAnalysis?.strengths || [],
            weaknesses: analysisResult.technicalAnalysis?.weaknesses || [],
            recommendations: analysisResult.technicalAnalysis?.recommendations || [],
            // INCLUIR VERIFICACIÓN Y OTROS CAMPOS IMPORTANTES
            verification: analysisResult.verification,
            shotSummary: analysisResult.shotSummary,
            shots: analysisResult.shots,
        };

                console.log('🔍 Debug - Videos procesados:', {
            video1: !!base64Video1,
            video2: !!base64Video2,
            video3: !!base64Video3,
            video4: !!base64Video4,
            totalVideos: [base64Video1, base64Video2, base64Video3, base64Video4].filter(Boolean).length
        });
        
                        console.log('🔍 Debug - FormData recibido:', {
            hasVideoBack: formData.has('video-back'),
            hasVideoFront: formData.has('video-front'),
            hasVideoLeft: formData.has('video-left'),
            hasVideoRight: formData.has('video-right'),
            hasUploadedBackUrl: formData.has('uploadedBackUrl'),
            hasUploadedFrontUrl: formData.has('uploadedFrontUrl'),
            hasUploadedLeftUrl: formData.has('uploadedLeftUrl'),
            hasUploadedRightUrl: formData.has('uploadedRightUrl')
        });

        // Guardar análisis mejorado con metadatos adicionales
                // Función para limpiar valores undefined
        const cleanForFirestore = (obj: any): any => {
            if (obj === null || obj === undefined) return null;
            if (typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(cleanForFirestore);
            
            const cleaned: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined) {
                    cleaned[key] = cleanForFirestore(value);
                }
            }
            return cleaned;
        };

        const updateData = cleanForFirestore({
            status: 'analyzed',
            analysisResult: adaptedAnalysisResult,
            detailedChecklist: adaptedAnalysisResult.detailedChecklist,
            keyframes: adaptedAnalysisResult.keyframes,
            coachCompleted: false,
            updatedAt: new Date().toISOString(),
            // Metadatos adicionales del análisis
            analysisMetadata: {
                totalVideos: [videoBackUrl, videoFrontUrl, videoLeftUrl, videoRightUrl].filter(Boolean).length,
                preprocessed: true,
                ffmpegOptimized: true,
                promptVersion: 'multi-session-v2',
                analysisMethod: 'gemini-2.0-flash-exp',
                processingTime: new Date().toISOString(),
                videoUrls: {
                    back: videoBackUrl,
                    front: videoFrontUrl,
                    left: videoLeftUrl,
                    right: videoRightUrl
                }
            }
        });

        await db.collection('analyses').doc(analysisRef.id).update(updateData);
                return {
            message: "Video analizado exitosamente con IA.",
            analysisId: analysisRef.id,
            videoUrl: videoPath,
            shotType,
            status: 'analyzed',
            analysisResult,
            redirectTo: `/analysis/${analysisRef.id}`
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

// 🧪 FUNCIÓN DE ANÁLISIS DE PRUEBA CON PROMPT SIMPLIFICADO
export async function startAnalysisTest(prevState: any, formData: FormData) {
    try {
        // Verificar si el sistema está en modo mantenimiento
        const maintenanceEnabled = await isMaintenanceMode();
        if (maintenanceEnabled) {
            return { 
                message: "El sistema está en mantenimiento. El análisis de lanzamientos está temporalmente deshabilitado.", 
                error: true 
            };
        }

                const userId = formData.get('userId') as string;
        const coachId = (formData.get('coachId') as string | null) || null;
        if (!userId) return { message: "ID de usuario requerido.", error: true };
        
        const shotType = formData.get('shotType') as string;
        if (!shotType) return { message: "Tipo de lanzamiento requerido.", error: true };
        
        // Valores pre-configurados para testing (como en /test-simple-prompt)
        const ageCategory = formData.get('ageCategory') as string || 'adult';
        const playerLevel = formData.get('playerLevel') as string || 'intermediate';

        // URLs ya subidas por el cliente (Firebase Storage)
        const uploadedBackUrl = (formData.get('uploadedBackUrl') as string | null) || null;
        const uploadedFrontUrl = (formData.get('uploadedFrontUrl') as string | null) || null;
        const uploadedLeftUrl = (formData.get('uploadedLeftUrl') as string | null) || null;
        const uploadedRightUrl = (formData.get('uploadedRightUrl') as string | null) || null;

        // Flujo legacy: archivos directos
        const formBack = formData.get('video-back') as File | null;
        const formFront = formData.get('video-front') as File | null;
        const videoLeft = formData.get('video-left') as File | null;
        const videoRight = formData.get('video-right') as File | null;
        
        const hasUploadedUrls = Boolean(uploadedBackUrl || uploadedFrontUrl || uploadedLeftUrl || uploadedRightUrl);
        const hasFormFiles = Boolean(formBack || formFront || videoLeft || videoRight);
        
        // Solo el video trasero es obligatorio
        if (!hasUploadedUrls && !hasFormFiles) {
            return { message: "El video trasero es obligatorio para el análisis.", error: true };
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

        // Crear referencia de análisis
        const analysisRef = db.collection('analyses').doc();
        const analysisId = analysisRef.id;

                // Datos base del análisis
        const baseAnalysisData = {
            id: analysisId,
            playerId: userId,
            coachId: coachId || null,
            status: 'processing',
            shotType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            analysisMethod: 'test-simple-prompt',
            promptVersion: 'simplified-v1',
        };

        // Guardar análisis inicial
        await analysisRef.set(baseAnalysisData);

        // Procesar videos
        let videoBackUrl: string | null = null;
        let videoFrontUrl: string | null = null;
        let videoLeftUrl: string | null = null;
        let videoRightUrl: string | null = null;

        if (hasUploadedUrls) {
            console.log('📤 Usando videos pre-subidos por el cliente...');
            videoBackUrl = uploadedBackUrl;
            videoFrontUrl = uploadedFrontUrl;
            videoLeftUrl = uploadedLeftUrl;
            videoRightUrl = uploadedRightUrl;
        } else {
                        // Verificar que al menos el video trasero esté disponible
            if (!formBack && !formFront) {
                return { message: "El video trasero es obligatorio para el análisis.", error: true };
            }

            // Subir archivos a Firebase Storage
            const bucket = adminStorage.bucket();
            const timestamp = Date.now();
            
            try {
                // Video trasero (obligatorio)
                if (formBack && formBack.size > 0) {
                    const backFileName = `videos/${userId}/back-${timestamp}.mp4`;
                    const backFile = bucket.file(backFileName);
                    await backFile.save(Buffer.from(await formBack.arrayBuffer()));
                    videoBackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(backFileName)}?alt=media`;
                                    } else if (formFront && formFront.size > 0) {
                    // Si no hay video trasero, usar el frontal como principal
                    const frontFileName = `videos/${userId}/front-${timestamp}.mp4`;
                    const frontFile = bucket.file(frontFileName);
                    await frontFile.save(Buffer.from(await formFront.arrayBuffer()));
                    videoBackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(frontFileName)}?alt=media`;
                                    }

                // Video frontal (opcional)
                if (formFront && formFront.size > 0 && formBack && formBack.size > 0) {
                    const frontFileName = `videos/${userId}/front-${timestamp}.mp4`;
                    const frontFile = bucket.file(frontFileName);
                    await frontFile.save(Buffer.from(await formFront.arrayBuffer()));
                    videoFrontUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(frontFileName)}?alt=media`;
                                    }

                // Video izquierdo (opcional)
                if (videoLeft && videoLeft.size > 0) {
                    const leftFileName = `videos/${userId}/left-${timestamp}.mp4`;
                    const leftFile = bucket.file(leftFileName);
                    await leftFile.save(Buffer.from(await videoLeft.arrayBuffer()));
                    videoLeftUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(leftFileName)}?alt=media`;
                                    }

                // Video derecho (opcional)
                if (videoRight && videoRight.size > 0) {
                    const rightFileName = `videos/${userId}/right-${timestamp}.mp4`;
                    const rightFile = bucket.file(rightFileName);
                    await rightFile.save(Buffer.from(await videoRight.arrayBuffer()));
                    videoRightUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(rightFileName)}?alt=media`;
                                    }

            } catch (uploadError) {
                console.error('❌ Error subiendo videos:', uploadError);
                return { message: "Error subiendo videos al servidor.", error: true };
            }
        }

        // Verificar que al menos un video esté disponible
        if (!videoBackUrl && !videoFrontUrl) {
            return { message: "No se pudo procesar ningún video.", error: true };
        }

        // USAR FLUJO DIRECTO como /test-simple-prompt (sin Firebase download)
        console.log('📥 Usando flujo directo (archivos → buffers) como /test-simple-prompt...');
        
        // Video principal - usar archivo directo si está disponible
        let videoBuffer1: Buffer;
        let fileName1: string;
        
        if (formBack && formBack.size > 0) {
            videoBuffer1 = Buffer.from(await formBack.arrayBuffer());
            fileName1 = formBack.name;
                    } else if (formFront && formFront.size > 0) {
            videoBuffer1 = Buffer.from(await formFront.arrayBuffer());
            fileName1 = formFront.name;
                    } else {
            throw new Error('No hay videos disponibles para procesar');
        }

        let videoBuffer2: Buffer | null = null;
        let videoBuffer3: Buffer | null = null;
        let videoBuffer4: Buffer | null = null;
        let fileName2: string | undefined;
        let fileName3: string | undefined;
        let fileName4: string | undefined;

        // Video 2 - usar archivo directo si está disponible
        if (formFront && formFront.size > 0 && formBack && formBack.size > 0) {
            videoBuffer2 = Buffer.from(await formFront.arrayBuffer());
            fileName2 = formFront.name;
                    }

        // Video 3 - usar archivo directo si está disponible
        if (videoLeft && videoLeft.size > 0) {
            videoBuffer3 = Buffer.from(await videoLeft.arrayBuffer());
            fileName3 = videoLeft.name;
                    }

        // Video 4 - usar archivo directo si está disponible
        if (videoRight && videoRight.size > 0) {
            videoBuffer4 = Buffer.from(await videoRight.arrayBuffer());
            fileName4 = videoRight.name;
                    }

                // Log de tamaños de videos para debugging
        console.log(`📊 Tamaños de videos:`, {
            video1: `${Math.round(videoBuffer1.length / 1024)}KB`,
            video2: videoBuffer2 ? `${Math.round(videoBuffer2.length / 1024)}KB` : 'N/A',
            video3: videoBuffer3 ? `${Math.round(videoBuffer3.length / 1024)}KB` : 'N/A',
            video4: videoBuffer4 ? `${Math.round(videoBuffer4.length / 1024)}KB` : 'N/A'
        });

        // Llamar a la función de análisis con prompt simplificado (igual que /test-simple-prompt)
        const { analyzeVideoSimplePrompt } = await import('@/utils/gemini-simple-prompt');
        
        let analysisResult;
        try {
            analysisResult = await analyzeVideoSimplePrompt(
                videoBuffer1,
                fileName1,
                videoBuffer2,
                fileName2,
                videoBuffer3,
                fileName3,
                ageCategory, // Usar valores reales
                playerLevel,
                shotType
            );
                    } catch (error) {
            console.error('❌ Error en el análisis:', error);
            throw new Error(`Error en el análisis de video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }

        // Adaptar el resultado al formato esperado por la UI
        const adaptedAnalysisResult = {
            detailedChecklist: analysisResult.technicalAnalysis?.parameters?.map((param: any) => ({
                id: param.name.toLowerCase().replace(/\s+/g, '_'),
                name: param.name,
                description: param.comment,
                status: (() => {
                    const score = param.score || 0;
                    if (score >= 70) return 'Correcto';
                    if (score >= 36) return 'Mejorable';
                    return 'Incorrecto';
                })(), // Forzar cálculo basado en score, ignorar status de IA
                rating: (() => {
                    const score = param.score || 0;
                    if (score >= 90) return 5; // Excelente
                    if (score >= 70) return 4; // Correcto
                    if (score >= 50) return 3; // Mejorable
                    if (score >= 30) return 2; // Incorrecto leve
                    return 1; // Incorrecto
                })(), // Convertir 0-100 a 1-5 con escala correcta
                comment: param.comment,
                na: param.status === 'no_evaluable',
                razon: param.status === 'no_evaluable' ? param.comment : null,
                evidencia: param.evidencia || 'Visible en el video',
                timestamp: null
            })) || [],
            overallScore: analysisResult.technicalAnalysis?.overallScore || 0,
            strengths: analysisResult.technicalAnalysis?.strengths || [],
            weaknesses: analysisResult.technicalAnalysis?.weaknesses || [],
            recommendations: analysisResult.technicalAnalysis?.recommendations || [],
            keyframes: [],
            analysisSummary: `Análisis de prueba con prompt simplificado. ${analysisResult.verification?.description || 'Video de baloncesto analizado.'}`,
            verification: analysisResult.verification,
            shotSummary: analysisResult.shotSummary,
            shots: analysisResult.shots
        };

        console.log('🔍 Debug - analysisResult from Gemini:', {
            hasTechnicalAnalysis: !!analysisResult.technicalAnalysis,
            hasParameters: !!analysisResult.technicalAnalysis?.parameters,
            parametersLength: analysisResult.technicalAnalysis?.parameters?.length || 0,
            parametersSample: analysisResult.technicalAnalysis?.parameters?.slice(0, 2) || 'N/A'
        });

                // Función para limpiar valores undefined antes de guardar en Firestore
        const cleanForFirestore = (obj: any): any => {
            if (obj === null || obj === undefined) return null;
            if (typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(cleanForFirestore);
            
            const cleaned: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined) {
                    cleaned[key] = cleanForFirestore(value);
                }
            }
            return cleaned;
        };

        // Guardar análisis completo en Firestore
        const updateData = cleanForFirestore({
            status: 'analyzed',
            analysisResult: adaptedAnalysisResult,
            detailedChecklist: adaptedAnalysisResult.detailedChecklist,
            keyframes: adaptedAnalysisResult.keyframes,
            coachCompleted: false,
            updatedAt: new Date().toISOString(),
            // Metadatos adicionales del análisis
            analysisMetadata: {
                totalVideos: [videoBackUrl, videoFrontUrl, videoLeftUrl, videoRightUrl].filter(Boolean).length,
                preprocessed: true,
                ffmpegOptimized: true,
                promptVersion: 'test-simple-prompt-v1',
                analysisMethod: 'gemini-2.0-flash-exp-simplified',
                processingTime: new Date().toISOString(),
                videoUrls: {
                    back: videoBackUrl,
                    front: videoFrontUrl,
                    left: videoLeftUrl,
                    right: videoRightUrl
                }
            }
        });

        await db.collection('analyses').doc(analysisRef.id).update(updateData);
                revalidatePath('/player/dashboard');
        return { 
            message: `Análisis de prueba completado exitosamente.`, 
            error: false, 
            analysisId: analysisId,
            redirectTo: `/analysis-test/${analysisId}`
        };

    } catch (error) {
        console.error('❌ Error en startAnalysisTest:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return { message: `Error en el análisis de prueba: ${message}`, error: true };
    }
}

// 🎯 FUNCIÓN PRINCIPAL DE ANÁLISIS: PROMPT OPTIMIZADO + PREPROCESAMIENTO FFMPEG + PESOS CONFIGURABLES
export async function startAnalysis(prevState: any, formData: FormData) {
    try {
        // Verificar si el sistema está en modo mantenimiento general
        const maintenanceEnabled = await isMaintenanceMode();
        if (maintenanceEnabled) {
            return { 
                message: "El sistema está en mantenimiento. El análisis de lanzamientos está temporalmente deshabilitado.", 
                error: true 
            };
        }

        const userId = formData.get('userId') as string;
        const coachId = (formData.get('coachId') as string | null) || null;
        if (!userId) return { message: "ID de usuario requerido.", error: true };
        const shotType = formData.get('shotType') as string;
        if (!shotType) return { message: "Tipo de lanzamiento requerido.", error: true };
        
        // Verificar mantenimiento específico por tipo de tiro
        const { isShotTypeInMaintenance, normalizeShotType } = await import('@/lib/maintenance');
        const normalizedShotType = normalizeShotType(shotType);
        const shotTypeMaintenance = await isShotTypeInMaintenance(normalizedShotType);
        if (shotTypeMaintenance) {
            return { 
                message: `El análisis de ${shotType} está actualmente en mantenimiento. Por favor, intenta con otro tipo de tiro o vuelve más tarde.`, 
                error: true 
            };
        }
        
        const ageCategory = formData.get('ageCategory') as string || 'adult';
        const playerLevel = formData.get('playerLevel') as string || 'intermediate';
        
        // Extraer videos (hasta 4)
        const videoFile1 = formData.get('video1') as File | null;
        const videoFile2 = formData.get('video2') as File | null;
        const videoFile3 = formData.get('video3') as File | null;
        const videoFile4 = formData.get('video4') as File | null;

        if (!videoFile1 || videoFile1.size === 0) {
            return { message: "Al menos un video es requerido.", error: true };
        }

        console.log('📹 Videos recibidos:', {
            video1: videoFile1 ? `${Math.round(videoFile1.size / 1024)}KB` : 'N/A',
            video2: videoFile2 ? `${Math.round(videoFile2.size / 1024)}KB` : 'N/A',
            video3: videoFile3 ? `${Math.round(videoFile3.size / 1024)}KB` : 'N/A',
            video4: videoFile4 ? `${Math.round(videoFile4.size / 1024)}KB` : 'N/A'
        });

        // Crear análisis en Firestore
        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        if (!adminDb) return { message: "Base de datos no disponible.", error: true };

        // Subir videos a Storage y obtener URLs permanentes
        console.log('📤 Subiendo videos a Storage...');
        const { uploadVideoToStorage } = await import('@/lib/storage-utils');
        
        // Mapeo: video1=back, video2=front, video3=left, video4=right
        let videoUrl: string | null = null;
        let videoBackUrl: string | null = null;
        let videoFrontUrl: string | null = null;
        let videoLeftUrl: string | null = null;
        let videoRightUrl: string | null = null;
        
        if (videoFile1) {
            videoBackUrl = await uploadVideoToStorage(videoFile1, userId, { maxSeconds: 30 });
            videoUrl = videoBackUrl; // El back es el video principal
                    }
        
        if (videoFile2) {
            videoFrontUrl = await uploadVideoToStorage(videoFile2, userId, { maxSeconds: 30 });
            if (!videoUrl) videoUrl = videoFrontUrl; // Si no hay back, front es el principal
                    }
        
        if (videoFile3) {
            videoLeftUrl = await uploadVideoToStorage(videoFile3, userId, { maxSeconds: 30 });
                    }
        
        if (videoFile4) {
            videoRightUrl = await uploadVideoToStorage(videoFile4, userId, { maxSeconds: 30 });
                    }

                // Guardar análisis inicial con URLs de videos
        await adminDb.collection('analyses').doc(analysisId).set({
            id: analysisId,
            playerId: userId,
            coachId,
            status: 'analyzing',
            shotType,
            ageCategory,
            playerLevel,
            createdAt: now,
            updatedAt: now,
            analysisType: 'weighted', // Análisis con pesos configurables
            videoUrl,
            videoBackUrl,
            videoFrontUrl,
            videoLeftUrl,
            videoRightUrl
        });

        // Preprocesar videos con FFmpeg (usando la misma lógica que startAnalysis)
        console.log('⚙️ Preprocesando videos con FFmpeg...');
        
        const { preprocessVideo } = await import('@/lib/gemini-video-real');
        
        // Procesar videos (solo los que existen)
        const videoBuffers: Buffer[] = [];
        const fileNames: string[] = [];
        
        if (videoFile1 && videoFile1.size > 0) {
            const buffer1 = Buffer.from(await videoFile1.arrayBuffer());
            console.log(`🎬 Procesando video1: ${Math.round(buffer1.length / 1024)}KB, nombre: ${videoFile1.name}`);
            
            // Si el video ya viene optimizado del cliente, no re-procesar
            if (videoFile1.name.includes('_optimized') || videoFile1.name.includes('-compressed')) {
                console.log('⏭️ Video1 ya optimizado en cliente, saltando preprocessing');
                videoBuffers.push(buffer1);
            } else {
                const { optimizedVideo: processed1 } = await preprocessVideo(buffer1, videoFile1.name);
                videoBuffers.push(processed1);
            }
            fileNames.push(videoFile1.name);
        }
        
        if (videoFile2 && videoFile2.size > 0) {
            const buffer2 = Buffer.from(await videoFile2.arrayBuffer());
            console.log(`🎬 Procesando video2: ${Math.round(buffer2.length / 1024)}KB, nombre: ${videoFile2.name}`);
            
            if (videoFile2.name.includes('_optimized') || videoFile2.name.includes('-compressed')) {
                console.log('⏭️ Video2 ya optimizado en cliente, saltando preprocessing');
                videoBuffers.push(buffer2);
            } else {
                const { optimizedVideo: processed2 } = await preprocessVideo(buffer2, videoFile2.name);
                videoBuffers.push(processed2);
            }
            fileNames.push(videoFile2.name);
        }
        
        if (videoFile3 && videoFile3.size > 0) {
            const buffer3 = Buffer.from(await videoFile3.arrayBuffer());
            console.log(`🎬 Procesando video3: ${Math.round(buffer3.length / 1024)}KB, nombre: ${videoFile3.name}`);
            
            if (videoFile3.name.includes('_optimized') || videoFile3.name.includes('-compressed')) {
                console.log('⏭️ Video3 ya optimizado en cliente, saltando preprocessing');
                videoBuffers.push(buffer3);
            } else {
                const { optimizedVideo: processed3 } = await preprocessVideo(buffer3, videoFile3.name);
                videoBuffers.push(processed3);
            }
            fileNames.push(videoFile3.name);
        }
        
        if (videoFile4 && videoFile4.size > 0) {
            const buffer4 = Buffer.from(await videoFile4.arrayBuffer());
            console.log(`🎬 Procesando video4: ${Math.round(buffer4.length / 1024)}KB, nombre: ${videoFile4.name}`);
            
            if (videoFile4.name.includes('_optimized') || videoFile4.name.includes('-compressed')) {
                console.log('⏭️ Video4 ya optimizado en cliente, saltando preprocessing');
                videoBuffers.push(buffer4);
            } else {
                const { optimizedVideo: processed4 } = await preprocessVideo(buffer4, videoFile4.name);
                videoBuffers.push(processed4);
            }
            fileNames.push(videoFile4.name);
        }

        console.log('🎬 Videos preprocesados con FFmpeg:', {
            count: videoBuffers.length,
            sizes: videoBuffers.map((buf, i) => `${i + 1}: ${Math.round(buf.length / 1024)}KB`)
        });

        // Llamar análisis con prompt simplificado (como test)
        const { analyzeVideoSimplePrompt } = await import('@/utils/gemini-simple-prompt');
        
        let analysisResult;
        try {
            // Pasar solo los videos que existen
            analysisResult = await analyzeVideoSimplePrompt(
                videoBuffers[0] || null,
                fileNames[0] || null,
                videoBuffers[1] || null,
                fileNames[1] || null,
                videoBuffers[2] || null,
                fileNames[2] || null,
                videoBuffers[3] || null,
                fileNames[3] || null
            );
                    } catch (error) {
            console.error('❌ Error en el análisis híbrido:', error);
            throw new Error(`Error en el análisis de video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }

                // ⚖️ CALCULAR SCORE GLOBAL CON PESOS CONFIGURABLES
                const { loadWeightsFromFirestore } = await import('@/lib/scoring');
        
        // Determinar tipo de tiro para cargar pesos correspondientes
        let shotTypeKey = 'tres';
        if (shotType.toLowerCase().includes('media')) {
            shotTypeKey = 'media';
        } else if (shotType.toLowerCase().includes('libre')) {
            shotTypeKey = 'libre';
        }
        
        const customWeights = await loadWeightsFromFirestore(shotTypeKey);
        console.log(`📊 Pesos cargados para ${shotTypeKey}:`, Object.keys(customWeights).length, 'parámetros');
        
        // Calcular score ponderado usando los pesos configurables
        const parameters = analysisResult.technicalAnalysis?.parameters || [];
        let weightedScore = 0;
        let totalWeight = 0;
        let evaluableCount = 0;
        let nonEvaluableCount = 0;
        
        // Función para normalizar el nombre del parámetro a un ID
        const normalizeParamName = (name: string): string => {
            // Primero normalizar y limpiar
            let normalized = name
                .toLowerCase()
                .trim()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
                .replace(/\s+/g, '_') // Espacios a guiones bajos
                .replace(/[^a-z0-9_]/g, ''); // Solo letras, números y guiones bajos
            
            // Mapeo específico para manejar diferencias entre nombres de IA y claves de pesos
            const mapping: Record<string, string> = {
                // PREPARACIÓN (Común para tres y libre)
                'alineacion_de_pies': 'alineacion_pies',
                'alineacion_de_los_pies': 'alineacion_pies',
                'alineacion_corporal': 'alineacion_cuerpo',
                'alineacion_del_cuerpo': 'alineacion_cuerpo',
                'alineacion_pies_cuerpo': 'alineacion_pies_cuerpo', // Para tiro libre
                'flexion_de_rodillas': 'flexion_rodillas',
                'flexion_rodillas': 'flexion_rodillas_libre', // Para tiro libre
                'muneca_cargada': 'muneca_cargada_libre', // Para tiro libre (distinta de la de tres puntos)
                'posicion_inicial_del_balon': 'posicion_inicial_balon',
                'posicion_inicial_balon': 'posicion_inicial_balon',
                'rutina_pre_tiro': 'rutina_pre_tiro', // Específico tiro libre
                'rutina_pretiro': 'rutina_pre_tiro',
                
                // ASCENSO (Común para tres y libre)
                'mano_no_dominante_en_ascenso': 'mano_no_dominante_ascenso',
                'codos_cerca_del_cuerpo': 'codos_cerca_cuerpo',
                'codos_cerca_del_cuerpo_libre': 'codos_cerca_cuerpo_libre',
                'codos_cerca_cuerpo': 'codos_cerca_cuerpo',
                'subida_recta_del_balon': 'subida_recta_balon',
                'trayectoria_del_balon_hasta_el_set_point': 'trayectoria_hasta_set_point',
                'trayectoria_del_balon_hasta_set_point': 'trayectoria_hasta_set_point',
                'trayectoria_hasta_el_set_point': 'trayectoria_hasta_set_point',
                'trayectoria_vertical': 'trayectoria_vertical_libre', // Específico tiro libre
                'trayectoria_vertical_libre': 'trayectoria_vertical_libre',
                'mano_guia': 'mano_guia_libre',
                'mano_guia_libre': 'mano_guia_libre',
                'set_point': 'set_point',
                'set_point_altura_segun_edad': 'set_point_altura_edad',
                'set_point_altura_edad': 'set_point_altura_edad',
                'tiempo_de_lanzamiento': 'tiempo_lanzamiento',
                
                // FLUIDEZ
                'tiro_en_un_solo_tiempo': 'tiro_un_solo_tiempo',
                'tiro_un_solo_tiempo': 'tiro_un_solo_tiempo',
                'tiro_un_solo_tiempo_libre': 'tiro_un_solo_tiempo_libre',
                'transferencia_energetica_sincronia_con_piernas': 'sincronia_piernas',
                'transferencia_energetica__sincronia_con_piernas': 'sincronia_piernas',
                'sincronia_con_piernas': 'sincronia_piernas',
                'sincronia_piernas': 'sincronia_piernas',
                'sincronia_piernas_libre': 'sincronia_piernas_libre',
                
                // LIBERACIÓN
                'mano_no_dominante_en_liberacion': 'mano_no_dominante_liberacion',
                'mano_no_dominante_en_la_liberacion': 'mano_no_dominante_liberacion',
                'extension_completa_del_brazo': 'extension_completa_brazo',
                'extension_completa': 'extension_completa_brazo',
                'extension_completa_brazo': 'extension_completa_brazo',
                'extension_completa_liberacion': 'extension_completa_liberacion',
                'giro_de_la_pelota': 'giro_pelota',
                'rotacion_del_balon': 'rotacion_balon', // Específico tiro libre
                'rotacion_balon': 'rotacion_balon',
                'giro_pelota': 'giro_pelota',
                'angulo_de_salida': 'angulo_salida',
                'angulo_salida': 'angulo_salida',
                'angulo_salida_libre': 'angulo_salida_libre',
                'flexion_muneca_final': 'flexion_muneca_final', // Específico tiro libre (gooseneck)
                'gooseneck': 'flexion_muneca_final',
                
                // SEGUIMIENTO
                'sin_salto': 'sin_salto_reglamentario', // Específico tiro libre
                'sin_salto_reglamentario': 'sin_salto_reglamentario',
                'pies_dentro_zona': 'pies_dentro_zona',
                'pies_dentro_de_zona': 'pies_dentro_zona',
                'balance_vertical': 'balance_vertical',
                'equilibrio_post_liberacion_y_aterrizaje': 'equilibrio_general',
                'mantenimiento_del_equilibrio': 'equilibrio_general',
                'equilibrio_en_aterrizaje': 'equilibrio_general',
                'equilibrio_en_el_aterrizaje': 'equilibrio_general',
                'equilibrio_general': 'equilibrio_general',
                'duracion_del_follow_through': 'duracion_follow_through',
                'duracion_del_followthrough': 'duracion_follow_through',
                'follow_through_completo': 'follow_through_completo_libre',
                'follow_through_completo_libre': 'follow_through_completo_libre',
                
                // CONSISTENCIA (solo para tres puntos)
                'consistencia_del_movimiento': 'consistencia_general',
                'consistencia_tecnica': 'consistencia_general',
                'consistencia_de_resultados': 'consistencia_general',
                'consistencia_repetitiva': 'consistencia_general',
                'consistencia_general': 'consistencia_general'
            };
            
            return mapping[normalized] || normalized;
        };
        
        // Set para evitar contar el mismo parámetro dos veces
        const processedParams = new Set<string>();
        
        for (const param of parameters) {
            // Usar el campo id si existe, si no, normalizar el nombre
            const paramId = param.id ? param.id.trim().toLowerCase() : normalizeParamName(param.name || '');
            
            // Si ya procesamos este parámetro, saltar (evita duplicados)
            if (processedParams.has(paramId)) {
                console.log(`⏭️ Saltando parámetro duplicado: ${paramId} (nombre original: ${param.name})`);
                continue;
            }
            
            const weight = customWeights[paramId] || 0;
            
            if (weight === 0) {
                console.warn(`⚠️ Parámetro sin peso: ${paramId} (nombre original: ${param.name})`);
                continue;
            }
            
            // Marcar como procesado
            processedParams.add(paramId);
            
            // Si el parámetro es evaluable (tiene score válido)
            if (param.status !== 'no_evaluable' && typeof param.score === 'number' && param.score > 0) {
                weightedScore += weight * param.score;
                totalWeight += weight;
                evaluableCount++;
                console.log(`✅ ${paramId}: score=${param.score}, peso=${weight}%, contribución=${(weight * param.score).toFixed(2)}`);
            } else {
                nonEvaluableCount++;
                console.log(`⚠️ ${paramId}: no evaluable (status=${param.status})`);
            }
        }
        
        // Normalizar el score final
        // Formula: Σ(peso_i × score_i) / Σ(peso_i)
        // Promedio ponderado: suma de (peso × score) dividido por suma de pesos
        const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;
        
        console.log('📊 Cálculo de score finalizado:', {
            evaluableCount,
            nonEvaluableCount,
            totalWeight: totalWeight.toFixed(2),
            weightedScore: weightedScore.toFixed(2),
            finalScore: finalScore.toFixed(2),
            originalScore: analysisResult.technicalAnalysis?.overallScore
        });

               // Guardar resultados en Firestore (mapeando correctamente desde technicalAnalysis)
               const adaptedAnalysisResult = {
                   ...analysisResult,
                   // Mapear correctamente los datos del technicalAnalysis
                   detailedChecklist: analysisResult.technicalAnalysis?.parameters || [],
                   analysisSummary: analysisResult.technicalAnalysis?.summary || 'Análisis completado',
                   strengths: analysisResult.technicalAnalysis?.strengths || [],
                   weaknesses: analysisResult.technicalAnalysis?.weaknesses || [],
                   recommendations: analysisResult.technicalAnalysis?.recommendations || [],
                   // ⚖️ Usar el score calculado con pesos personalizados
                   overallScore: Math.round(finalScore * 100) / 100,
                   score: Math.round(finalScore * 100) / 100,
                   // Agregar metadatos del cálculo
                   scoreMetadata: {
                       originalScore: analysisResult.technicalAnalysis?.overallScore || 0,
                       weightedScore: Math.round(finalScore * 100) / 100,
                       evaluableCount,
                       nonEvaluableCount,
                       totalWeight: Math.round(totalWeight * 100) / 100,
                       shotTypeKey,
                       calculatedAt: new Date().toISOString()
                   },
                   // Asegurar que technicalAnalysis también esté disponible
                   technicalAnalysis: analysisResult.technicalAnalysis
               };

                       // Limpiar valores undefined para Firestore
        const cleanForFirestore = (obj: any): any => {
            if (obj === null || obj === undefined) return null;
            if (Array.isArray(obj)) return obj.map(cleanForFirestore);
            if (typeof obj === 'object') {
                const cleaned: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value !== undefined) {
                        cleaned[key] = cleanForFirestore(value);
                    }
                }
                return cleaned;
            }
            return obj;
        };

        const cleanedResult = cleanForFirestore(adaptedAnalysisResult);

                console.log('🔍 Intentando guardar en Firestore...', {
            analysisId,
            hasAdminDb: !!adminDb,
            resultSize: JSON.stringify(cleanedResult).length
        });
        
        await adminDb.collection('analyses').doc(analysisId).update({
            status: 'analyzed',
            analysisResult: cleanedResult,
            updatedAt: new Date().toISOString()
        });

                // Keyframes tradicionales (asíncronos, no bloquean)
                console.log('🔍 Debug - videoBuffers disponibles:', {
            front: videoBuffers[0] ? `${(videoBuffers[0].length / 1024 / 1024).toFixed(2)}MB` : 'No disponible',
            back: videoBuffers[1] ? `${(videoBuffers[1].length / 1024 / 1024).toFixed(2)}MB` : 'No disponible',
            left: videoBuffers[2] ? `${(videoBuffers[2].length / 1024 / 1024).toFixed(2)}MB` : 'No disponible',
            right: videoBuffers[3] ? `${(videoBuffers[3].length / 1024 / 1024).toFixed(2)}MB` : 'No disponible'
        });
        
        // Start traditional keyframe extraction without waiting
        import('@/lib/keyframe-uploader').then(({ extractAndUploadKeyframesAsync }) => {
                        extractAndUploadKeyframesAsync({
                analysisId,
                videoBuffers: {
                    front: videoBuffers[0],
                    back: videoBuffers[1],
                    left: videoBuffers[2],
                    right: videoBuffers[3]
                },
                userId
            }).then(() => {
                            }).catch(err => {
                console.error('❌ [Keyframes] Error en extracción asíncrona:', err);
            });
        }).catch(err => {
            console.error('❌ [Keyframes] Error al cargar módulo keyframe-uploader:', err);
        });

        return {
            success: true,
            message: "Análisis completado exitosamente.",
            analysisId: analysisId,
            redirectTo: `/analysis/${analysisId}`
        };

    } catch (error) {
        console.error('❌ Error en startAnalysis:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return { message: `Error en el análisis: ${message}`, error: true };
    }
}
