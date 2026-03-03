import { adminDb } from '@/lib/firebase-admin';

export type CoachPaymentAccount = {
  coachId: string;
  mpUserId?: number;
  mpPublicKey?: string;
  mpAccessToken?: string;
  mpRefreshToken?: string;
  status?: 'pending' | 'active' | 'inactive';
  platformFeePercent?: number;
  disableMarketplaceSplit?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const COLLECTION = 'coach_payment_accounts';

export async function getCoachPaymentAccount(coachId: string): Promise<CoachPaymentAccount | null> {
  if (!adminDb) return null;
  if (!coachId) return null;
  try {
    const snap = await adminDb.collection(COLLECTION).doc(coachId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      coachId: snap.id,
      ...data,
    } as CoachPaymentAccount;
  } catch (err) {
    console.error(`Error leyendo coach payment account ${coachId}`, err);
    return null;
  }
}

export function resolvePlatformFeePercent(account?: CoachPaymentAccount | null, fallbackPercent = 30): number {
  const raw = account?.platformFeePercent;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100) {
    return raw;
  }
  return fallbackPercent;
}
