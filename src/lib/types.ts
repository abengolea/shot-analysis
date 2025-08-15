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

export type DetailedChecklistItem = {
  id: string;
  name: string;
  description: string;
  status: 'Correcto' | 'Mejorable' | 'Incorrecto';
  comment: string;
};

export type ChecklistCategory = {
  category: string;
  items: DetailedChecklistItem[];
};

export type KeyframeImages = {
    front: string[];
    back: string[];
    left: string[];
    right: string[];
};

export type ShotAnalysis = {
  id: string;
  playerId: string;
  createdAt: string;
  videoUrl: string; // This would be the uploaded video
  shotType: 'Tiro Libre' | 'Lanzamiento de Media Distancia (Jump Shot)' | 'Lanzamiento de Tres';
  analysisSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keyframes: KeyframeImages; // URLs or base64 strings of keyframe images, organized by angle
  detailedChecklist?: ChecklistCategory[];
  score?: number;
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

export type Author = {
    id: string;
    name: string;
    avatarUrl: string;
};

export type Comment = {
  id: string;
  author: Author;
  coachId?: string; // Optional: To link comment specifically to a coach interaction
  text: string;
  createdAt: string;
};

export type Coach = {
  id: string;
  name: string;
  avatarUrl: string;
  "data-ai-hint"?: string;
  experience: string;
  ratePerAnalysis: number; // rate per analysis in USD
  rating: number; // 0-5
  reviews: number;
  playerIds?: string[];
}
