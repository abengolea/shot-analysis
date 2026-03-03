import { notFound } from "next/navigation";
import { PlayerProfileClient } from "@/components/player-profile-client";
import { adminDb } from "@/lib/firebase-admin";
import { backfillKeyframesForAnalyses } from "@/lib/keyframes-backfill";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerSnap = await adminDb.collection('players').doc(id).get();
  if (!playerSnap.exists) {
    notFound();
  }
  const serialize = (val: any): any => {
    if (val == null) return val;
    if (Array.isArray(val)) return val.map(serialize);
    if (typeof val === 'object') {
      if (typeof (val as any).toDate === 'function') {
        try { return (val as any).toDate().toISOString(); } catch { return String((val as any)); }
      }
      const out: any = {};
      for (const [k, v] of Object.entries(val)) out[k] = serialize(v);
      return out;
    }
    return val;
  };
  const player = serialize({ id, ...(playerSnap.data() as any) });
  const analysesSnap = await adminDb.collection('analyses').where('playerId', '==', id).orderBy('createdAt', 'desc').limit(100).get();
  const analyses = analysesSnap.docs.map(d => serialize({ id: d.id, ...(d.data() as any) }));
  try {
    void backfillKeyframesForAnalyses(analyses, 5);
  } catch {}
  const evaluationsCollections = ['player_evaluations', 'playerEvaluations'];
  const evaluationsById = new Map<string, any>();
  for (const collectionName of evaluationsCollections) {
    try {
      const evalSnap = await adminDb
        .collection(collectionName)
        .where('playerId', '==', id)
        .get();
      evalSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const key = `${collectionName}:${doc.id}`;
        const normalized = { id: doc.id, ...(data as any) } as any;
        if (!normalized.evaluationDate && normalized.createdAt) {
          normalized.evaluationDate = normalized.createdAt;
        }
        evaluationsById.set(key, serialize(normalized));
      });
    } catch {
      // colección inexistente o sin permisos: ignorar
    }
  }
  const evaluations = Array.from(evaluationsById.values());
  const comments: any[] = [];

  // player ya validado

  return (
    <PlayerProfileClient 
      player={player} 
      analyses={analyses} 
      evaluations={evaluations}
      comments={comments}
    />
  );
}
