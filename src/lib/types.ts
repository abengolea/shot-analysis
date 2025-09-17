export type UserRole = 'player' | 'coach' | 'admin';

export type BaseUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: Date;
  updatedAt: Date;
};

export type Player = BaseUser & {
  role: 'player';
  // Campos opcionales que se pueden completar después
  dob?: Date;
  country?: string;
  phone?: string;
  "data-ai-hint"?: string;
  ageGroup?: 'U10' | 'U13' | 'U15' | 'U18' | 'Amateur' | 'SemiPro' | 'Pro';
  playerLevel?: 'Principiante' | 'Intermedio' | 'Avanzado';
  coachId?: string;
  // Campos específicos del jugador (opcionales)
  position?: 'Base' | 'Escolta' | 'Alero' | 'Ala-Pívot' | 'Pívot';
  height?: number; // en centímetros
  wingspan?: number; // en centímetros
  weight?: number; // en kilogramos
  dominantHand?: 'Derecha' | 'Izquierda' | 'Ambidiestro';
  // Configuración de ranking público (opt-in voluntario)
  publicRankingOptIn?: boolean;
  publicAlias?: string;
  publicShowCountry?: boolean;
  publicShowClub?: boolean;
  club?: string;
  // Agregados públicos para rankings
  publicCategory?: 'U11' | 'U13' | 'U15' | 'U17' | 'U21' | 'Mayores';
  publicHighestScore?: number; // mejor puntuación histórica (0..100)
  publicGeneralAverageScore?: number; // promedio general de todas las puntuaciones
  publicBestByShot?: { libre?: number; media?: number; tres?: number };
  publicBestDates?: { libre?: string; media?: string; tres?: string; overall?: string };
  publicUpdatedAt?: string; // ISO
};

export type DetailedChecklistItem = {
  id: string;
  name: string;
  description: string;
  // Nuevo sistema de 5 niveles (1..5)
  rating: 1 | 2 | 3 | 4 | 5;
  // Marcar cuando no se puede evaluar por falta de datos (no contar en el cálculo)
  na?: boolean;
  // Para el ítem especial "Fluidez / Armonía (transferencia energética)" (1..10)
  rating10?: number;
  // Campo legacy (opcional) para compatibilidad con datos antiguos
  status?: 'Incorrecto' | 'Incorrecto leve' | 'Mejorable' | 'Correcto' | 'Excelente';
  comment: string;
  // Comentario opcional del entrenador (visible para jugador y entrenador; editable solo por entrenador)
  coachComment?: string;
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
  // Puntuación 1..10 de la categoría principal "Fluidez / Armonía (transferencia energética)"
  fluidezScore10?: number;
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

export type Coach = BaseUser & {
  role: 'coach';
  // Campos opcionales que se pueden completar después
  experience?: string;
  ratePerAnalysis?: number; // rate per analysis in USD
  showRate?: boolean; // si es false, ocultar tarifa al público
  rating?: number; // 0-5
  reviews?: number;
  playerIds?: string[];
  // Campos adicionales del entrenador (opcionales)
  certifications?: string[];
  specialties?: string[];
  yearsOfExperience?: number;
  education?: string;
  bio?: string;
  availability?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
};

export type ConnectionRequest = {
  id: string;
  playerId: string;
  playerName: string;
  playerEmail: string;
  playerAvatarUrl?: string;
  coachId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  playerLevel?: string;
  position?: string;
  ageGroup?: string;
  country?: string;
};

// Mensajería simple entre usuarios (jugador ↔ entrenador)
export type Message = {
  id: string;
  fromId: string;
  fromName?: string;
  fromAvatarUrl?: string;
  toId: string;
  toName?: string;
  text: string;
  createdAt: string; // ISO
  read: boolean;
  readAt?: string; // ISO
  // Archivado por el coach (ocultar en su panel)
  archivedForCoach?: boolean;
  archivedAt?: string; // ISO
};

export type PlayerEvaluation = {
  id: string;
  playerId: string;
  coachId: string;
  coachName: string;
  coachAvatarUrl?: string;
  evaluationDate: Date;
  overallScore: number; // 1-10
  technicalScore: number; // 1-10
  physicalScore: number; // 1-10
  mentalScore: number; // 1-10
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  notes: string;
  nextSteps: string[];
};

export type PlayerComment = {
  id: string;
  playerId: string;
  coachId: string;
  coachName: string;
  coachAvatarUrl?: string;
  comment: string;
  createdAt: Date;
  isPublic: boolean;
};

// Pagos y billetera (jugadores)
export type Wallet = {
  userId: string;
  credits: number; // créditos disponibles para análisis pagos
  freeAnalysesUsed: number; // cuántos gratis usados en el añoEnCurso
  yearInUse: number; // año calendario de referencia para freeAnalysesUsed
  historyPlusActive?: boolean;
  historyPlusValidUntil?: string; // ISO string
  currency: 'ARS';
  updatedAt: string; // ISO
  createdAt: string; // ISO
};

export type ProductId = 'analysis_1' | 'pack_3' | 'pack_10' | 'history_plus_annual';

export type PaymentRecord = {
  id: string; // doc id
  userId: string;
  provider: 'mercadopago' | 'stripe';
  providerPaymentId: string;
  productId: ProductId;
  status: 'created' | 'approved' | 'rejected' | 'refunded' | 'pending';
  currency: 'ARS' | 'USD';
  amount: number; // monto total cobrado en la moneda
  raw?: any; // payload/response del proveedor
  createdAt: string;
  updatedAt: string;
};

export type BillingType = 'free' | 'credit' | 'subscription';

export type AnalysisBillingInfo = {
  type: BillingType;
  year: number;
  creditTransactionId?: string;
};

// --- Admin Feedback (Revisión IA) ---

// Versión inicial (v1) de taxonomía de errores técnicos en español
export type AdminFeedbackIssueId =
  | 'set_point'
  | 'alineacion_codo'
  | 'base_pies'
  | 'timing'
  | 'tronco_postura'
  | 'mirada_enfoque'
  | 'trayectoria_brazo'
  | 'equilibrio_salto'
  | 'mano_no_dominante_ascenso'
  | 'mano_no_dominante_liberacion'
  | 'liberacion_muneca'
  | 'alineacion_pies_hombros'
  | 'finalizacion'
  | 'otros';

export type AdminFeedbackSeverity = 'bajo' | 'medio' | 'alto';

export type AdminFeedbackIssue = {
  id: AdminFeedbackIssueId;
  name?: string; // opcional, para mostrar etiqueta amigable si hace falta
  description?: string; // detalle opcional
  severity?: AdminFeedbackSeverity; // prioridad percibida por el admin
  rating?: 1 | 2 | 3 | 4 | 5; // valoración del ítem si aplica (compatible con checklist)
  commentForAI?: string; // explicación dirigida a la IA (no visible al jugador)
};

export type AdminFeedbackCorrections = {
  startFrame?: number;
  endFrame?: number;
  angles?: Record<string, number>; // ángulos corregidos por clave (p. ej. codo, muñeca)
  keypoints?: Record<string, { x: number; y: number }>; // puntos clave opcionales
};

export type AdminFeedbackStatus = 'borrador' | 'listo'; // "Listo" cuando el admin marca OK

export type AdminFeedback = {
  id?: string; // id del feedback (doc id si se usa subcolección)
  analysisId: string;
  playerId: string;
  createdAt: string; // ISO
  createdBy: string; // uid admin
  updatedAt?: string; // ISO
  taxonomyVersion: 'v1';
  visibility: 'admin_only';
  issues: AdminFeedbackIssue[];
  corrections?: AdminFeedbackCorrections;
  commentForAI?: string; // comentario general para IA
  status: AdminFeedbackStatus; // borrador | listo
};
