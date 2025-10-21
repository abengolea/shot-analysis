import { notFound } from "next/navigation";
import { CoachPlayerProfileClient } from "@/components/coach-player-profile-client";
import { adminDb } from "@/lib/firebase-admin";

export default async function CoachPlayerProfilePage({
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
  
      if (analyses.length > 0) {
    const latest = analyses[0];
                console.log('🔍 Server Debug - Latest analysis keys:', Object.keys(latest));
  }
  const evaluations: any[] = [];
  const comments: any[] = [];

  return (
    <CoachPlayerProfileClient 
      player={player} 
      analyses={analyses} 
      evaluations={evaluations}
      comments={comments}
    />
  );
}
