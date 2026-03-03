import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { hasPaidCoachAccessToPlayer } from "@/lib/coach-access";
import { fetchPoseFramesFromService } from "@/lib/economy-evidence";

export const dynamic = "force-dynamic";

const clampTargetFrames = (value: number) => {
  if (!Number.isFinite(value)) return 12;
  return Math.max(10, Math.min(30, Math.round(value)));
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Admin SDK no inicializado" }, { status: 500 });
    }

    const { id: analysisId } = await params;
    if (!analysisId) {
      return NextResponse.json({ error: "ID de análisis es requerido" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    let uid: string | null = null;
    let role: string | null = null;
    let coachSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;

      const coachDoc = await adminDb.collection("coaches").doc(uid).get();
      coachSnap = coachDoc;
      const coachData = coachDoc.exists ? (coachDoc.data() as any) : null;
      role = coachData?.role || null;
    }

    const analysisDoc = await adminDb.collection("analyses").doc(analysisId).get();
    if (!analysisDoc.exists) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const analysisData = analysisDoc.data() as any;
    const analysisPlayerId = analysisData?.playerId;
    const analysisUserId = analysisData?.userId;
    if (uid) {
      const coachAccess = analysisData?.coachAccess || {};
      const coachAccessForUser = coachAccess?.[uid];
      const isAdmin = role === "admin";
      const isOwnerPlayer =
        (analysisPlayerId && String(analysisPlayerId) === String(uid)) ||
        (analysisUserId && String(analysisUserId) === String(uid));
      const hasPaidCoachAccess = coachSnap?.exists && coachAccessForUser?.status === "paid";
      const hasPlayerPaidAccess = !hasPaidCoachAccess && analysisPlayerId && coachSnap?.exists
        ? await hasPaidCoachAccessToPlayer({
            adminDb,
            coachId: uid,
            playerId: String(analysisPlayerId),
          })
        : false;
      if (!isAdmin && !isOwnerPlayer && !hasPaidCoachAccess && !hasPlayerPaidAccess) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const sourceUrl =
      analysisData?.videoFrontUrl ||
      analysisData?.videoBackUrl ||
      analysisData?.videoUrl ||
      "";
    if (!sourceUrl) {
      return NextResponse.json({ error: "Video no disponible" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const targetFrames = clampTargetFrames(Number(searchParams.get("targetFrames")));
    const frames = await fetchPoseFramesFromService(sourceUrl, targetFrames);

    return NextResponse.json({
      frames: frames ?? [],
      sourceUrl,
      targetFrames,
    });
  } catch (error) {
    console.error("❌ Error al obtener pose frames:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
