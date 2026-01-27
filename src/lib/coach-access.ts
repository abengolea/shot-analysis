import type { Firestore } from 'firebase-admin/firestore';

type CoachAccessParams = {
  adminDb: Firestore;
  coachId: string;
  playerId: string;
};

export async function hasPaidCoachAccessToPlayer({
  adminDb,
  coachId,
  playerId,
}: CoachAccessParams): Promise<boolean> {
  if (!adminDb || !coachId || !playerId) return false;

  const analysesSnap = await adminDb
    .collection('analyses')
    .where('playerId', '==', playerId)
    .get();

  return analysesSnap.docs.some((doc) => {
    const data = doc.data() as any;
    if (data?.coachId && String(data.coachId) === String(coachId)) return true;
    const access = data?.coachAccess?.[coachId];
    return access?.status === 'paid';
  });
}
