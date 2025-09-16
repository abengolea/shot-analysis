import { notFound } from "next/navigation";
import { PlayerProfileClient } from "@/components/player-profile-client";
import { adminDb } from "@/lib/firebase-admin";

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const playerSnap = await adminDb.collection('players').doc(params.id).get();
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
  const player = serialize({ id: params.id, ...(playerSnap.data() as any) });
  const analysesSnap = await adminDb.collection('analyses').where('playerId', '==', params.id).orderBy('createdAt', 'desc').limit(100).get();
  const analyses = analysesSnap.docs.map(d => serialize({ id: d.id, ...(d.data() as any) }));
  const evaluations: any[] = [];
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
