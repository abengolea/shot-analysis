export type Player = {
  id: string;
  name: string;
  email?: string;
  dob?: Date;
  country?: string;
  phone?: string;
  avatarUrl: string;
  "data-ai-hint"?: string;
  ageGroup: 'U10' | 'U13' | 'U15' | 'U18' | 'Amateur' | 'SemiPro' | 'Pro';
  playerLevel: 'Principiante' | 'Intermedio' | 'Avanzado';
  coachId?: string;
  status: 'active' | 'suspended';
};

export type ShotAnalysis = {
  id: string;
  playerId: string;
  createdAt: string;
  videoUrl: string; // This would be the uploaded video
  shotType: 'Tiro Libre' | 'Tiro de Media Distancia (Jump Shot)' | 'Tiro de Tres';
  analysisSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keyframes: string[]; // URLs or base64 strings of keyframe images
};

export type Drill = {
  name: string;
  targetIssue: string;
  instructions: string[];
  setsReps: string;
  progression: string;
  successCriteria: string;
  safety: string;
  ageVariants?: Record<string, string>;
};

export type Comment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

export type Coach = {
  id: string;
  name: string;
  avatarUrl: string;
  "data-ai-hint"?: string;
  specialties: string[];
  experience: string;
  ratePerAnalysis: number; // rate per analysis in USD
  rating: number; // 0-5
  reviews: number;
  playerIds?: string[];
}
