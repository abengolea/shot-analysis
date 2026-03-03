import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";

/**
 * POST /api/account/delete
 * Elimina la cuenta del usuario y todos sus datos.
 * Requiere Authorization: Bearer <idToken>
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado. Token requerido." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // 1. Eliminar documentos de Firestore
    const batch = adminDb.batch();

    // players y coaches
    const playerRef = adminDb.collection("players").doc(uid);
    const coachRef = adminDb.collection("coaches").doc(uid);
    batch.delete(playerRef);
    batch.delete(coachRef);

    // wallet
    const walletRef = adminDb.collection("wallets").doc(uid);
    batch.delete(walletRef);

    await batch.commit();

    // 2. Eliminar análisis (playerId o coachId)
    const analysesSnap = await adminDb
      .collection("analyses")
      .where("playerId", "==", uid)
      .get();
    const analysesBatch1 = adminDb.batch();
    analysesSnap.docs.forEach((d) => analysesBatch1.delete(d.ref));
    await analysesBatch1.commit();

    const analysesCoachSnap = await adminDb
      .collection("analyses")
      .where("coachId", "==", uid)
      .get();
    const analysesBatch2 = adminDb.batch();
    analysesCoachSnap.docs.forEach((d) => analysesBatch2.delete(d.ref));
    await analysesBatch2.commit();

    // 3. Eliminar video-analysis
    const videoAnalysisSnap = await adminDb
      .collection("video-analysis")
      .where("userId", "==", uid)
      .get();
    const vaBatch = adminDb.batch();
    videoAnalysisSnap.docs.forEach((d) => vaBatch.delete(d.ref));
    await vaBatch.commit();

    // 4. Eliminar coach_unlocks donde el usuario es coach o player
    const unlocksSnap = await adminDb
      .collection("coach_unlocks")
      .where("coachId", "==", uid)
      .get();
    const unlocksBatch = adminDb.batch();
    unlocksSnap.docs.forEach((d) => unlocksBatch.delete(d.ref));
    await unlocksBatch.commit();

    const unlocksPlayerSnap = await adminDb
      .collection("coach_unlocks")
      .where("playerId", "==", uid)
      .get();
    const unlocksPlayerBatch = adminDb.batch();
    unlocksPlayerSnap.docs.forEach((d) => unlocksPlayerBatch.delete(d.ref));
    await unlocksPlayerBatch.commit();

    // 5. Eliminar archivos de Storage
    if (adminStorage) {
      const bucket = adminStorage.bucket();
      const prefixes = [
        `videos/${uid}/`,
        `shot-videos/${uid}/`,
        `profile-images/${uid}/`,
        `analysis-docs/${uid}/`,
        `training-materials/${uid}/`,
      ];

      for (const prefix of prefixes) {
        try {
          const [files] = await bucket.getFiles({ prefix });
          await Promise.all(files.map((file) => file.delete()));
        } catch (storageErr) {
          console.warn(`[account/delete] Error eliminando Storage prefix ${prefix}:`, storageErr);
        }
      }
    }

    // 6. Eliminar usuario de Firebase Auth
    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      success: true,
      message: "Cuenta eliminada correctamente.",
    });
  } catch (error: unknown) {
    console.error("[account/delete] Error:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar la cuenta";
    const status = message.includes("auth/") ? 401 : 500;
    return NextResponse.json(
      { error: message, success: false },
      { status }
    );
  }
}
