"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { scheduleKeyframesExtraction } from '@/lib/keyframes-backfill';
import { getVideoDurationSecondsFromBuffer } from '@/lib/ffmpeg';
import { buildEconomyEvidenceFromVideoUrl } from '@/lib/economy-evidence';
import { detectShotsFromPoseService } from '@/lib/pose-shot-detection';
import { sendAdminNotification, sendCustomEmail, sendPasswordResetEmail, sendVerificationEmail } from '@/lib/email-service';
import { getAppBaseUrl } from '@/lib/app-url';
import { buildScoreMetadata, loadWeightsFromFirestore } from '@/lib/scoring';
import { generateAnalysisSummary } from '@/lib/ai-summary';
import { verifyHasShotsWithLlmFromVideoUrl } from '@/lib/llm-shot-verify';
import { buildNoShotsAnalysis, buildUnverifiedShotAnalysis } from '@/lib/analysis-fallbacks';
import type { ChecklistCategory, DetailedChecklistItem } from '@/lib/types';
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

const normalizeDetailedChecklist = (input: any[]): ChecklistCategory[] => {
    if (!Array.isArray(input)) return [];
    const toRating = (value: any): DetailedChecklistItem['rating'] => {
        if (value === 0) return 0;
        if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
        const rounded = Math.round(value);
        if (rounded <= 0) return 0;
        if (rounded >= 5) return 5;
        return rounded as 1 | 2 | 3 | 4;
    };
    return input.map((cat) => ({
        category: String(cat?.category || 'SIN CATEGORIA'),
        items: Array.isArray(cat?.items)
            ? cat.items.map((it: any) => ({
                id: String(it?.id || ''),
                name: String(it?.name || ''),
                description: String(it?.description || ''),
                status: (it?.status as DetailedChecklistItem['status']) || 'Mejorable',
                rating: toRating(it?.rating),
                na: Boolean(it?.na),
                comment: String(it?.comment || ''),
                timestamp: typeof it?.timestamp === 'string' ? it.timestamp : undefined,
                evidencia: typeof it?.evidencia === 'string' ? it.evidencia : undefined,
                razon: typeof it?.razon === 'string' ? it.razon : undefined,
                coachComment: typeof it?.coachComment === 'string' ? it.coachComment : undefined,
            }))
            : [],
    }));
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
            await sendAdminNotification({
                subject: `Nueva solicitud de entrenador (admin): ${data.name}`,
                html: `<p>Email: ${data.email}</p><p>Nombre: ${data.name}</p><p>Bio: ${data.experience}</p><p>Foto: ${photoUrl || '-'}</p><p>ID: ${ref.id}</p>`,
                fallbackTo: 'abengolea1@gmail.com',
            });
        } catch (e) {}

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
        } catch (e) {
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

// Crear club desde el panel admin (alta solo-admin)
type AdminCreateClubState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
    userId?: string;
};

export async function adminCreateClub(_prevState: AdminCreateClubState, formData: FormData): Promise<AdminCreateClubState> {
    try {
        if (!adminDb || !adminAuth) {
            return { success: false, message: 'Servidor sin Admin SDK' };
        }

        const normalizeClubName = (value: string) =>
            value
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .trim();

        const name = String(formData.get('name') || '').trim();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const city = String(formData.get('city') || '').trim();
        const province = String(formData.get('province') || '').trim();
        const nameLower = normalizeClubName(name);

        const fieldErrors: Record<string, string[]> = {};
        if (!name || name.length < 2) fieldErrors.name = ['Nombre demasiado corto'];
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = ['Email inválido'];
        if (!city) fieldErrors.city = ['Ciudad requerida'];
        if (!province) fieldErrors.province = ['Provincia requerida'];
        if (Object.keys(fieldErrors).length) {
            return { success: false, message: 'Revisa los campos del formulario.', errors: fieldErrors };
        }

        // Crear o recuperar usuario en Auth por email
        let userId: string;
        try {
            const existing = await adminAuth.getUserByEmail(email);
            userId = existing.uid;
        } catch (e) {
            const created = await adminAuth.createUser({ email, displayName: name });
            userId = created.uid;
        }

        const nowIso = new Date().toISOString();
        const clubData = {
            userId,
            name,
            nameLower,
            email,
            role: 'club' as const,
            status: 'active' as const,
            avatarUrl: 'https://placehold.co/100x100.png',
            city,
            province,
            createdAt: nowIso,
            updatedAt: nowIso,
            createdByAdminId: null as string | null,
        };
        await adminDb.collection('clubs').doc(userId).set(clubData, { merge: true });

        return { success: true, message: 'Club creado correctamente.', userId };
    } catch (e: any) {
        console.error('Error adminCreateClub:', e);
        return { success: false, message: e?.message || 'No se pudo crear el club.' };
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
                freeCoachReviews: 0,
                historyPlusActive: false,
                historyPlusValidUntil: null,
                currency: 'ARS',
                createdAt: nowIso,
            };
            const newCredits = (base.credits || 0) + count;
            tx.set(walletRef, { ...base, credits: newCredits, updatedAt: nowIso }, { merge: true });
        });
        revalidatePath('/admin');
        revalidatePath(`/admin/players/${userId}`);
        return { success: true, message: `Se regalaron ${count} análisis.` };
    } catch (e) {
        console.error('Error regalando análisis:', e);
        return { success: false, message: 'Error al regalar análisis' };
    }
}

// Regalar revisiones de coach gratis a un jugador desde el panel admin
export async function giftCoachReviews(_prevState: any, formData: FormData) {
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
                freeCoachReviews: 0,
                historyPlusActive: false,
                historyPlusValidUntil: null,
                currency: 'ARS',
                createdAt: nowIso,
            };
            const newFreeReviews = (base.freeCoachReviews || 0) + count;
            tx.set(walletRef, { ...base, freeCoachReviews: newFreeReviews, updatedAt: nowIso }, { merge: true });
        });
        revalidatePath('/admin');
        revalidatePath(`/admin/players/${userId}`);
        return { success: true, message: `Se regalaron ${count} revisiones de coach.` };
    } catch (e) {
        console.error('Error regalando revisiones de coach:', e);
        return { success: false, message: 'Error al regalar revisiones de coach' };
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
        revalidatePath('/coaches');
        revalidatePath('/coach/coaches');
        revalidatePath('/player/coaches');
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
        const freeCoachReviews = Number(formData.get('freeCoachReviews') || 0);
        const redirectTo = String(formData.get('redirectTo') || '');
        if (!userId || credits < 0 || freeAnalysesUsed < 0 || freeCoachReviews < 0) {
            return { success: false, message: 'Parámetros inválidos' };
        }
        if (!adminDb) return { success: false, message: 'Servidor sin Admin SDK' };
        const walletRef = adminDb.collection('wallets').doc(userId);
        const nowIso = new Date().toISOString();
        await walletRef.set({ userId, credits, freeAnalysesUsed, freeCoachReviews, updatedAt: nowIso }, { merge: true });
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

// Olvidé contraseña: envía email con link (template + continueUrl del entorno actual)
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { success: false, message: 'Email inválido' };
  }
  try {
    const sent = await sendPasswordResetEmail(normalized);
    if (sent) return { success: true, message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.' };
    return { success: false, message: 'No se pudo enviar el email. Revisá la configuración del servidor.' };
  } catch (e) {
    console.error('requestPasswordReset:', e);
    return { success: false, message: 'Error al enviar el email. Intentá más tarde.' };
  }
}

// Reenviar verificación: envía email de verificación (template + continueUrl del entorno actual)
export async function requestVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { success: false, message: 'Email inválido' };
  }
  if (!adminAuth) return { success: false, message: 'Servidor no disponible.' };
  try {
    const userRecord = await adminAuth.getUserByEmail(normalized);
    const sent = await sendVerificationEmail(userRecord.uid, normalized);
    if (sent) return { success: true, message: 'Te enviamos un nuevo email de verificación. Revisá tu bandeja y spam.' };
    return { success: false, message: 'No se pudo enviar el email. Intentá más tarde.' };
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') return { success: false, message: 'Este email no está registrado.' };
    console.error('requestVerificationEmail:', e);
    return { success: false, message: 'Error al enviar el email. Intentá más tarde.' };
  }
}

// Enviar link de reseteo de contraseña al email del jugador (admin; devuelve link, no envía email)
// Usado con form action (1 arg: FormData) o wrapper (2 args: prev, FormData)
export async function adminSendPasswordReset(_prev: any, formData?: FormData) {
    try {
        const fd = (formData && typeof (formData as any).get === 'function') ? formData : _prev;
        if (!fd || typeof (fd as any).get !== 'function') return { success: false };
        const userId = String((fd as FormData).get('userId') || '');
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
            const clubDoc = await adminDb.collection('clubs').doc(userId).get();
            if (clubDoc.exists) email = String(clubDoc.data()?.email || '');
        }
        if (!email) {
            try {
                const userRecord = await adminAuth.getUser(userId);
                email = userRecord.email || '';
            } catch (e) {}
        }
        if (!email) return { success: false, message: 'Email no encontrado' };
        const baseUrl = getAppBaseUrl();
        const actionCodeSettings = baseUrl ? { url: baseUrl } : undefined;
        const link = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
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
        } catch (e) {}
        if (!email) {
            try { const userRecord = await adminAuth.getUser(userId); email = userRecord.email || ''; } catch (e) {}
        }
        if (!email) return { success: false, message: 'Email del coach no encontrado' };

        // Generar link de restablecimiento y enviarlo por email (redirect al entorno actual)
        const baseUrl = getAppBaseUrl();
        const actionCodeSettings = baseUrl ? { url: baseUrl } : undefined;
        const link = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
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

        await adminDb.collection('coaches').doc(userId).set({
            photoUrl,
            avatarUrl: photoUrl,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        revalidatePath('/admin');
        revalidatePath(`/admin/coaches/${userId}`);
        return { success: true, message: 'Foto actualizada', photoUrl };
    } catch (e: any) {
        console.error('Error subiendo foto de coach:', e);
        return { success: false, message: 'No se pudo subir la foto' };
    }
}

import { standardizeVideoBuffer } from '@/lib/ffmpeg';

// Funciones de mapeo para la IA
type AgeCategory = 'Sub-10' | 'Sub-13' | 'Sub-15' | 'Sub-18' | 'Amateur adulto' | 'Profesional';
type PlayerLevel = 'Principiante' | 'Intermedio' | 'Avanzado';

function _mapAgeGroupToCategory(ageGroup: string): AgeCategory {
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

function _mapPlayerLevel(playerLevel: string): PlayerLevel {
    switch (playerLevel) {
        case 'Principiante': return 'Principiante';
        case 'Intermedio': return 'Intermedio';
        case 'Avanzado': return 'Avanzado';
        default: return 'Principiante';
    }
}

type ShotTypesMaintenance = {
    tres: boolean;
    media: boolean;
    libre: boolean;
};

const DEFAULT_MAINTENANCE = {
    enabled: false,
    title: '🔧 SITIO EN MANTENIMIENTO',
    message: 'El sistema está en mantenimiento. Intenta nuevamente más tarde.',
    shotTypesMaintenance: {
        tres: false,
        media: false,
        libre: false,
    } as ShotTypesMaintenance,
};

function normalizeShotTypesMaintenance(input: any): ShotTypesMaintenance {
    const base: ShotTypesMaintenance = { ...DEFAULT_MAINTENANCE.shotTypesMaintenance };
    if (input && typeof input === 'object') {
        base.tres = Boolean((input as any).tres);
        base.media = Boolean((input as any).media);
        base.libre = Boolean((input as any).libre);
    }
    return base;
}

function mapShotTypeToKey(shotType: string): keyof ShotTypesMaintenance | null {
    const value = String(shotType || '').toLowerCase();
    if (value.includes('tres')) return 'tres';
    if (value.includes('media')) return 'media';
    if (value.includes('libre')) return 'libre';
    return null;
}

// Obtener usuario actual usando Firebase Admin SDK
const _getCurrentUser = async (userId: string) => {
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
        const analysisMode = String(formData.get('analysisMode') || 'standard');

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

        // Validar mantenimiento global o por tipo de tiro
        try {
            const maintenanceRef = db.collection('config').doc('maintenance');
            const maintenanceSnap = await maintenanceRef.get();
            const maintenanceData = maintenanceSnap.exists ? maintenanceSnap.data() as any : {};
            const maintenanceEnabled = Boolean(maintenanceData?.enabled);
            const normalizedShotTypes = normalizeShotTypesMaintenance(maintenanceData?.shotTypesMaintenance);

            if (maintenanceEnabled) {
                return {
                    message: maintenanceData?.message || DEFAULT_MAINTENANCE.message,
                    error: true,
                };
            }

            const shotKey = mapShotTypeToKey(shotType);
            if (shotKey && normalizedShotTypes[shotKey]) {
                const available: string[] = [];
                if (!normalizedShotTypes.tres) available.push('Lanzamiento de Tres');
                if (!normalizedShotTypes.media) available.push('Lanzamiento de Media Distancia');
                if (!normalizedShotTypes.libre) available.push('Tiro Libre');
                const availableText = available.length > 0
                    ? `Tipos disponibles: ${available.join(', ')}.`
                    : 'No hay tipos disponibles en este momento.';
                return {
                    message: `El tipo "${shotType}" está en mantenimiento. ${availableText}`,
                    error: true,
                };
            }
        } catch (e) {
            console.warn('No se pudo validar mantenimiento:', e);
        }

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

        // Enforce créditos / gratis (excepto modo BIOMECH PRO de prueba)
        const currentYear = new Date().getFullYear();
        let billingInfo: { type: 'free' | 'credit' | 'biomech-pro'; year: number } | null = null;
        if (analysisMode === 'biomech-pro') {
            billingInfo = { type: 'biomech-pro', year: currentYear };
        } else {
            try {
                await db.runTransaction(async (tx: any) => {
                    const walletRef = db.collection('wallets').doc(userId);
                    const walletSnap = await tx.get(walletRef);
                    const nowIso = new Date().toISOString();
                    let data: any = walletSnap.exists ? walletSnap.data() : null;
                    if (!data) {
                        data = {
                            userId,
                            credits: 0,
                            freeAnalysesUsed: 0,
                            yearInUse: currentYear,
                            freeCoachReviews: 0,
                            lastFreeAnalysisDate: null,
                            historyPlusActive: false,
                            historyPlusValidUntil: null,
                            currency: 'ARS',
                            createdAt: nowIso,
                            updatedAt: nowIso,
                        };
                        tx.set(walletRef, data);
                    }
                    if (Number(data.yearInUse) !== currentYear) {
                        data.freeAnalysesUsed = 0;
                        data.yearInUse = currentYear;
                        data.lastFreeAnalysisDate = null;
                    }
                    if ((data.freeAnalysesUsed || 0) < 2) {
                        data.freeAnalysesUsed = (data.freeAnalysesUsed || 0) + 1;
                        data.updatedAt = nowIso;
                        data.lastFreeAnalysisDate = nowIso;
                        tx.update(walletRef, {
                            freeAnalysesUsed: data.freeAnalysesUsed,
                            yearInUse: data.yearInUse,
                            lastFreeAnalysisDate: data.lastFreeAnalysisDate,
                            updatedAt: data.updatedAt
                        });
                        billingInfo = { type: 'free', year: currentYear };
                    } else if ((data.credits || 0) > 0) {
                        data.credits = Number(data.credits) - 1;
                        data.updatedAt = nowIso;
                        tx.update(walletRef, { credits: data.credits, updatedAt: data.updatedAt });
                        billingInfo = { type: 'credit', year: currentYear };
                    } else {
                        billingInfo = null;
                    }
                });
            } catch (e) {
                return { message: 'No se pudo verificar tu saldo. Intenta nuevamente.', error: true };
            }
        }
        if (!billingInfo) {
            return {
                message: 'Alcanzaste el límite de 2 análisis gratis este año y no tenés créditos. Comprá un análisis o pack para continuar.',
                error: true,
            };
        }
        const billing = billingInfo as { type: 'free' | 'credit' | 'biomech-pro'; year: number };

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
            analysisMode,
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
            const appBaseUrl = getAppBaseUrl();
            const link = appBaseUrl ? `${appBaseUrl}/admin/revision-ia/${analysisRef.id}` : '';
            await sendAdminNotification({
                subject: 'Nuevo video subido para análisis',
                html: `<p>Se subió un nuevo video para análisis.</p>
                      <p><b>Jugador:</b> ${currentUser?.name || currentUser?.id || 'desconocido'}</p>
                      <p><b>Tipo de tiro:</b> ${shotType}</p>
                      ${link ? `<p><a href="${link}">Revisar en Revisión IA</a></p>` : ''}`,
                fallbackTo: 'abengolea@hotmail.com',
            });
        } catch (e) {}

        // Ejecutar análisis IA sin frames del cliente
        const { analyzeBasketballShot, detectShots } = await import('@/ai/flows/analyze-basketball-shot');
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

        const durationCache = new Map<string, number>();
        const getDurationForUrl = async (url: string): Promise<number> => {
            if (!url) return 0;
            if (durationCache.has(url)) return durationCache.get(url) || 0;
            try {
                const resp = await fetch(url);
                if (!resp.ok) return 0;
                const ab = await resp.arrayBuffer();
                const buf = Buffer.from(ab);
                const durationSec = await getVideoDurationSecondsFromBuffer(buf);
                durationCache.set(url, durationSec);
                return durationSec;
            } catch (e) {
                return 0;
            }
        };
        const chooseTargetFrames = (durationSec: number): number => {
            if (!durationSec || durationSec <= 0) return 48;
            if (durationSec <= 4.5) return 72;
            if (durationSec <= 8) return 56;
            if (durationSec <= 12) return 40;
            return 32;
        };

        let skipDomainCheck = false;
        let detectedShotsCount: number | undefined = undefined;
        try {
            const durationSec = await getDurationForUrl(videoPath);
            const targetFrames = chooseTargetFrames(durationSec);
            const primaryDetection =
                (await detectShotsFromPoseService(videoPath, targetFrames)) ||
                (await detectShots({
                    videoUrl: videoPath,
                    shotType,
                    ageCategory,
                    playerLevel,
                    availableKeyframes: [],
                }));
            const count = typeof primaryDetection?.shots_count === 'number'
                ? primaryDetection.shots_count
                : Array.isArray(primaryDetection?.shots)
                    ? primaryDetection.shots.length
                    : 0;
            skipDomainCheck = count > 0;
            detectedShotsCount = typeof count === 'number' ? count : undefined;
        } catch (e) {}

        let availableKeyframes: Array<{ index: number; timestamp: number; description: string }> = [];
        try {
            const evidence = await buildEconomyEvidenceFromVideoUrl(videoPath, { targetFrames: 8 });
            availableKeyframes = Array.isArray(evidence?.availableKeyframes) ? evidence.availableKeyframes : [];
        } catch (e) {}

        let shotFramesUrl: string | null = null;
        let shotFramesForPrompt: Array<{ idx: number; start_ms: number; release_ms: number; frames: string[] }> = [];
        const detectionByLabel: Array<{ label: string; url: string; result: any }> = [];
        const scrubSummaryText = (text: string) => {
            if (!text) return '';
            return String(text)
                .replace(/\b\d+(\.\d+)?\s*s\b/gi, '')
                .replace(/\b\d+(\.\d+)?\s*segundos?\b/gi, '')
                .replace(/\b\d+(\.\d+)?\s*s-\d+(\.\d+)?\s*s\b/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
        };
        const sanitizeAiSummary = (text: string | null, totalShots: number) => {
            if (!text) return '';
            if (totalShots === 0) return '';
            const cleaned = scrubSummaryText(text);
            if (!cleaned) return '';
            const contradictsZero = totalShots === 0 && /se detect|un tiro|1 tiro|uno tiro/i.test(cleaned);
            const contradictsPositive =
                totalShots > 0 && /no se detectaron tiros|no se detecto tiros|no se detectaron lanzamientos/i.test(cleaned);
            if (contradictsZero || contradictsPositive) return '';
            return cleaned;
        };
        const buildDeterministicSummary = ({
            totalShots,
            byLabel,
            baseSummary,
            aiSummary,
            strengths,
            weaknesses,
        }: {
            totalShots: number;
            byLabel: Array<{ label: string; count: number }>;
            baseSummary?: string;
            aiSummary?: string | null;
            strengths?: string[];
            weaknesses?: string[];
        }) => {
            const breakdown = byLabel
                .filter((item) => typeof item.count === 'number')
                .map((item) => `${item.label}: ${item.count}`)
                .join(', ');
            const shotWord = totalShots === 1 ? 'tiro' : 'tiros';
            const videoCount = byLabel.length;
            const videoWord = videoCount === 1 ? 'video' : 'videos';
            const intro =
                totalShots > 0
                    ? `Se analizaron ${totalShots} ${shotWord} en ${videoCount} ${videoWord}${breakdown ? ` (${breakdown})` : ''}.`
                    : 'No se detectaron tiros completos en los videos analizados.';
            const noEval = (analysisResultWithScore?.resumen_evaluacion?.parametros_no_evaluables || 0) > 0
                ? `Se dejaron ${analysisResultWithScore?.resumen_evaluacion?.parametros_no_evaluables} parámetros sin evaluar por limitaciones del video.`
                : '';
            const cleanCounts = (text: string) =>
                text
                    .split(/(?<=\.)\s+/)
                    .filter((sentence) => !/se detectaron|se analizaron|total de tiros|tiros detectados/i.test(sentence))
                    .join(' ')
                    .trim();
            const strengthText = Array.isArray(strengths) && strengths.length > 0
                ? `Fortalezas: ${strengths.slice(0, 2).join('; ')}.`
                : '';
            const weaknessText = Array.isArray(weaknesses) && weaknesses.length > 0
                ? `Debilidades: ${weaknesses.slice(0, 2).join('; ')}.`
                : '';
            const aiClean = sanitizeAiSummary(aiSummary || null, totalShots);
            const baseClean = sanitizeAiSummary(baseSummary || '', totalShots);
            const narrative = cleanCounts(aiClean || baseClean);
            return [intro, noEval, strengthText, weaknessText, narrative].filter(Boolean).join(' ');
        };
        const buildShotsSummary = async (original: string, totalShots: number, byLabel: Array<{ label: string; count: number }>) => {
            const aiSummary = await generateAnalysisSummary({
                baseSummary: original,
                verificacion_inicial: analysisResultWithScore?.verificacion_inicial,
                strengths: analysisResultWithScore?.strengths,
                weaknesses: analysisResultWithScore?.weaknesses,
                recommendations: analysisResultWithScore?.recommendations,
                resumen_evaluacion: analysisResultWithScore?.resumen_evaluacion,
                shots: { total: totalShots, byLabel },
            });
            return buildDeterministicSummary({
                totalShots,
                byLabel,
                baseSummary: original,
                aiSummary,
                strengths: analysisResultWithScore?.strengths,
                weaknesses: analysisResultWithScore?.weaknesses,
            });
        };
        const normalizeDetectionResult = (result: any, durationSec: number | null) => {
            const shots = Array.isArray(result?.shots) ? result.shots : [];
            if (!durationSec || durationSec <= 0) return result;
            const maxMs = durationSec * 1000 + 250;
            let filtered = shots.filter((shot: any) => {
                const endMs = Number(shot?.end_ms ?? shot?.release_ms ?? 0);
                const startMs = Number(shot?.start_ms ?? 0);
                return startMs <= maxMs && endMs <= maxMs;
            });
            if (durationSec <= 4.5 && filtered.length > 1) {
                filtered = [filtered[0]];
            }
            return {
                ...result,
                shots: filtered,
                shots_count: filtered.length,
            };
        };

        try {
            if (adminStorage) {
                const sources = [
                    { label: 'back', url: videoBackUrl },
                    { label: 'front', url: videoFrontUrl },
                    { label: 'left', url: videoLeftUrl },
                    { label: 'right', url: videoRightUrl },
                ].filter((s): s is { label: string; url: string } => Boolean(s.url));

                for (const source of sources) {
                    const durationSec = await getDurationForUrl(source.url);
                    const targetFrames = chooseTargetFrames(durationSec);
                    const result =
                        (await detectShotsFromPoseService(source.url, targetFrames)) ||
                        (await detectShots({
                            videoUrl: source.url,
                            shotType,
                            ageCategory,
                            playerLevel,
                            availableKeyframes: [],
                        }));
                    const normalized = normalizeDetectionResult(result, durationSec);
                    detectionByLabel.push({ label: source.label, url: source.url, result: normalized });
                }

                const primary = detectionByLabel.find((d) => d.label === (videoBackUrl ? 'back' : 'front'))
                    || detectionByLabel[0];
                const shots = Array.isArray(primary?.result?.shots) ? primary.result.shots : [];
                if (primary && shots.length > 0) {
                    const resp = await fetch(primary.url);
                    if (resp.ok) {
                        const { extractFramesBetweenDataUrlsFromBuffer } = await import('@/lib/ffmpeg');
                        const ab = await resp.arrayBuffer();
                        const videoBuffer = Buffer.from(ab);
                        const durationSec = await getVideoDurationSecondsFromBuffer(videoBuffer);
                        const normalizedPrimary = normalizeDetectionResult(primary.result, durationSec);
                        primary.result = normalizedPrimary;
                        const preFrames = 4;
                        const postFrames = 3;
                        const shotFrames = [];
                        const normalizedShots = Array.isArray(normalizedPrimary?.shots) ? normalizedPrimary.shots : shots;
                        for (const shot of normalizedShots) {
                            const startSec = Math.max(0, Number(shot.start_ms || 0) / 1000);
                            const releaseSec = Math.max(startSec + 0.05, Number(shot.release_ms || 0) / 1000);
                            const endMs = Number(shot.end_ms || 0);
                            const endSecRaw = endMs > 0 ? endMs / 1000 : releaseSec + 0.45;
                            const endSec = Math.max(releaseSec + 0.1, Math.min(endSecRaw, durationSec || endSecRaw));
                            const pre = await extractFramesBetweenDataUrlsFromBuffer(
                                videoBuffer,
                                startSec,
                                releaseSec,
                                preFrames
                            );
                            const post = await extractFramesBetweenDataUrlsFromBuffer(
                                videoBuffer,
                                releaseSec,
                                endSec,
                                postFrames
                            );
                            const frames = Array.from(new Set([...(pre || []), ...(post || [])])).filter(Boolean);
                            shotFrames.push({
                                idx: shot.idx,
                                start_ms: shot.start_ms,
                                release_ms: shot.release_ms,
                                frames,
                            });
                        }
                        const bucket = adminStorage.bucket();
                        const filePath = `analysis-evidence/${analysisRef.id}/shot-frames.json`;
                        const fileRef = bucket.file(filePath);
                        await fileRef.save(JSON.stringify({
                            analysisId: analysisRef.id,
                            createdAt: new Date().toISOString(),
                            source: primary.label,
                            shots: shotFrames,
                        }), { contentType: 'application/json' });
                        await fileRef.makePublic();
                        shotFramesUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                        shotFramesForPrompt = shotFrames.slice(0, 2).map((shot) => ({
                            ...shot,
                            frames: Array.isArray(shot.frames)
                                ? shot.frames
                                    .map((frame) => typeof frame === 'string' ? frame : frame?.dataUrl)
                                    .filter((frame): frame is string => typeof frame === 'string' && frame.length > 0)
                                    .slice(0, 5)
                                : [],
                        }));
                    }
                }
            }
        } catch (e) {
            console.warn('No se pudieron extraer frames por tiro', e);
        }

        let llmShotVerification: { has_shot_attempt: boolean; confidence?: number; reasoning?: string } | null = null;
        if (detectedShotsCount === 0) {
            llmShotVerification = await verifyHasShotsWithLlmFromVideoUrl(videoPath);
        }

        const analysisResult = detectedShotsCount === 0
            ? (llmShotVerification?.has_shot_attempt
                ? buildUnverifiedShotAnalysis(llmShotVerification.reasoning, llmShotVerification.confidence)
                : buildNoShotsAnalysis())
            : await analyzeBasketballShot({
                videoUrl: videoPath,
                shotType,
                ageCategory,
                playerLevel,
                availableKeyframes,
                ...(skipDomainCheck ? { skipDomainCheck: true } : {}),
                ...(typeof detectedShotsCount === 'number' ? { detectedShotsCount } : {}),
                ...(shotFramesForPrompt.length > 0
                    ? { shotFrames: { sourceAngle: videoBackUrl ? 'back' : 'front', shots: shotFramesForPrompt } }
                    : {}),
            });

        const detailedChecklist = Array.isArray(analysisResult?.detailedChecklist) ? analysisResult.detailedChecklist : [];
        let scoreMetadata = undefined;
        if (detailedChecklist.length > 0) {
            const weights = await loadWeightsFromFirestore(shotType);
            const normalizedChecklist = normalizeDetailedChecklist(detailedChecklist);
            scoreMetadata = buildScoreMetadata(normalizedChecklist, shotType, weights);
        }

        let analysisResultWithScore = scoreMetadata
            ? { ...analysisResult, scoreMetadata }
            : analysisResult;

        if (detectionByLabel.length > 0 && analysisResultWithScore?.verificacion_inicial) {
            let totalShots = 0;
            const tirosIndividuales: Array<{ numero: number; timestamp: string; descripcion: string }> = [];
            const shotsByLabel: Array<{ label: string; count: number }> = [];
            let seq = 1;
            for (const det of detectionByLabel) {
                const shots = Array.isArray(det?.result?.shots) ? det.result.shots : [];
                const shotsCount = typeof det?.result?.shots_count === 'number'
                    ? det.result.shots_count
                    : shots.length;
                totalShots += shotsCount;
                shotsByLabel.push({ label: det.label, count: shotsCount });
                shots.forEach((shot: any, _idx: number) => {
                    const startMs = Number(shot?.start_ms || 0);
                    const releaseMs = Number(shot?.release_ms || 0);
                    const startLabel = `${(startMs / 1000).toFixed(2)}s`;
                    const releaseLabel = `${(releaseMs / 1000).toFixed(2)}s`;
                    const notes = Array.isArray(shot?.notes) ? shot.notes.filter(Boolean) : [];
                    tirosIndividuales.push({
                        numero: seq++,
                        timestamp: `${det.label} ${startLabel}-${releaseLabel}`,
                        descripcion: `${det.label}: ${notes.length > 0 ? notes.join('; ') : 'Tiro detectado'}`,
                    });
                });
            }

            const primary = detectionByLabel.find((d) => d.label === (videoBackUrl ? 'back' : 'front'))
                || detectionByLabel[0];
            let tirosPorSegundo: number | undefined = undefined;
            if (detectionByLabel.length === 1 && primary?.result) {
                const fps = Number(primary.result?.diagnostics?.fps_assumed || 0);
                const framesTotal = Number(primary.result?.diagnostics?.frames_total || 0);
                const durationSec = fps > 0 && framesTotal > 0 ? framesTotal / fps : null;
                tirosPorSegundo = durationSec ? Number((totalShots / durationSec).toFixed(3)) : undefined;
            }

            const noShots = totalShots === 0;
            if (noShots) {
                const fallback = llmShotVerification?.has_shot_attempt
                    ? buildUnverifiedShotAnalysis(llmShotVerification.reasoning, llmShotVerification.confidence)
                    : buildNoShotsAnalysis();
                if (!llmShotVerification?.has_shot_attempt) {
                    fallback.verificacion_inicial.deteccion_ia = {
                        angulo_detectado: 'sin_tiros',
                        estrategia_usada: detectionByLabel.length > 1 ? 'detectShots.multi' : 'detectShots',
                        tiros_individuales: [],
                        total_tiros: 0,
                    };
                }
                analysisResultWithScore = fallback;
            } else {
                const verificacion = {
                    ...analysisResultWithScore.verificacion_inicial,
                    tiros_detectados: totalShots,
                    ...(typeof tirosPorSegundo === 'number' ? { tiros_por_segundo: tirosPorSegundo } : {}),
                    deteccion_ia: {
                        angulo_detectado: detectionByLabel.length > 1
                            ? 'multi'
                            : (analysisResultWithScore.verificacion_inicial?.angulo_camara || 'desconocido'),
                        estrategia_usada: detectionByLabel.length > 1 ? 'detectShots.multi' : 'detectShots',
                        tiros_individuales: tirosIndividuales,
                        total_tiros: totalShots,
                    },
                };

                const summary = await buildShotsSummary(analysisResultWithScore.analysisSummary, totalShots, shotsByLabel);
                analysisResultWithScore = {
                    ...analysisResultWithScore,
                    verificacion_inicial: verificacion,
                    analysisSummary: summary,
                };
            }
        }

        await db.collection('analyses').doc(analysisRef.id).update({
            status: 'analyzed',
            analysisResult: analysisResultWithScore,
            detailedChecklist: analysisResult.detailedChecklist || [],
            shotFramesUrl,
            keyframes: { front: [], back: [], left: [], right: [] },
            keyframesStatus: 'pending',
            keyframesUpdatedAt: new Date().toISOString(),
            coachCompleted: false,
            updatedAt: new Date().toISOString(),
        });

        scheduleKeyframesExtraction({
            analysisId: analysisRef.id,
            playerId: currentUser.id,
            videoUrl: videoPath,
            videoFrontUrl,
            videoLeftUrl,
            videoRightUrl,
            videoBackUrl,
        });

        return {
            message: "Video analizado exitosamente con IA.",
            analysisId: analysisRef.id,
            videoUrl: videoPath,
            shotType,
            status: 'analyzed',
            analysisResult: analysisResultWithScore,
            redirectTo: analysisMode === 'biomech-pro'
                ? `/biomech-pro/analysis/${analysisRef.id}`
                : '/dashboard'
        };

    } catch (error) {
        console.error("❌ Error de Análisis:", error);
        const message = error instanceof Error ? error.message : "No se pudo iniciar el análisis. Por favor, inténtalo de nuevo.";
        return { message, error: true };
    }
}

// Acción temporal para registrar/asegurar el jugador Adrián Bengolea
export async function registerAdrian(_prevState: any, _formData: FormData) {
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
