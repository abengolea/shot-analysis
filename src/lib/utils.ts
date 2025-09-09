import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Ranking utilities
export type PublicCategory = 'U11' | 'U13' | 'U15' | 'U17' | 'U21' | 'Mayores';

export function calculateAgeCategoryFromDob(dob: Date | string | undefined | null): PublicCategory | undefined {
  if (!dob) return undefined;
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (!(birth instanceof Date) || Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  if (age <= 11) return 'U11';
  if (age <= 13) return 'U13';
  if (age <= 15) return 'U15';
  if (age <= 17) return 'U17';
  if (age <= 21) return 'U21';
  return 'Mayores';
}

export type ShotTypeKey = 'libre' | 'media' | 'tres';

export function mapShotTypeToKey(shotType: string | undefined | null): ShotTypeKey | undefined {
  if (!shotType) return undefined;
  const st = shotType.toLowerCase();
  if (st.includes('libre')) return 'libre';
  if (st.includes('media') || st.includes('jump')) return 'media';
  if (st.includes('tres')) return 'tres';
  return undefined;
}
