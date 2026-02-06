"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
// import { getDrills } from "@/app/actions";
import type {
  ShotAnalysis,
  Player,
  Drill,
  ChecklistCategory,
  DetailedChecklistItem,
  Coach,
  Message,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormattedText } from "@/components/formatted-text";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Loader2,
  Sparkles,
  ShieldAlert,
  Bot,
  FilePenLine,
  Dumbbell,
  Camera,
  MessageSquare,
  Move,
  Minus,
  Pencil,
  Circle as CircleIcon,
  Eraser,
  ListChecks,
  Users,
  Star,
  Maximize2,
  Minimize2,
  UserCircle,
  ShoppingCart,
} from "lucide-react";
import { DrillCard } from "./drill-card";
import { DetailedChecklist } from "./detailed-checklist";
import { CANONICAL_CATEGORIES, CANONICAL_CATEGORIES_LIBRE } from "@/lib/canonical-checklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getAuth, getIdToken } from "firebase/auth";
import ShareButtons from "@/components/share-buttons";
import { useToast } from "@/hooks/use-toast";
import { getItemWeight, getDefaultWeights } from "@/lib/scoring-client";
import { normalizeVideoUrl } from "@/lib/video-url";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, doc, getDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Briefcase, Clock, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { buildConversationId, getMessageType } from "@/lib/message-utils";
import { resolveMessageLinkToCurrentEnv } from "@/lib/app-url";

interface AnalysisViewProps {
  analysis: ShotAnalysis;
  player: Player;
  viewerRole?: string | null;
}

export function AnalysisView({ analysis, player, viewerRole }: AnalysisViewProps) {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isClearingScore, setIsClearingScore] = useState(false);
  const currentUserId = user?.uid || userProfile?.id;
      // Funciones auxiliares para visualización
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-green-600';
    if (score >= 36) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'correcto': return 'text-green-600 bg-green-50';
      case 'mejorable': return 'text-yellow-600 bg-yellow-50';
      case 'incorrecto': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderStars = (score: number) => {
    const stars = Math.round(score / 20); // Convertir 0-100 a 0-5 estrellas
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium">{stars}/5</span>
      </div>
    );
  };

  // Asegurar que keyframes tenga la estructura correcta
  const safeKeyframes = analysis.keyframes || {
    front: [],
    back: [],
    left: [],
    right: []
  };

  const [localKeyframes, setLocalKeyframes] = useState<typeof safeKeyframes>(safeKeyframes);

  // Estado para indicar si los keyframes se están cargando
  const [keyframesLoading, setKeyframesLoading] = useState(false);

  // Estado para smart keyframes
  const [smartKeyframes, setSmartKeyframes] = useState<{
    front: Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }>;
    back: Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }>;
    left: Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }>;
    right: Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }>;
  }>({
    front: [],
    back: [],
    left: [],
    right: []
  });

  // Estado para indicar si los smart keyframes se están cargando
  const [smartKeyframesLoading, setSmartKeyframesLoading] = useState(false);

  // Función para cargar smart keyframes desde el API
  const loadSmartKeyframes = useCallback(async () => {
    if (!analysis.id || !user) {
      console.log('⚠️ [AnalysisView] No hay analysis.id o usuario, no se cargarán keyframes');
      return;
    }
    
    console.log(`🔍 [AnalysisView] Cargando smart keyframes para análisis: ${analysis.id}`);
    
    try {
      setSmartKeyframesLoading(true);
      const url = `/api/analyses/${analysis.id}/smart-keyframes`;
      console.log(`🔍 [AnalysisView] Llamando a: ${url}`);
      
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const token = currentUser ? await getIdToken(currentUser, true) : null;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      console.log(`🔍 [AnalysisView] Respuesta recibida:`, response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ [AnalysisView] Keyframes no encontrados (404) para análisis: ${analysis.id}`);
          setSmartKeyframesLoading(false);
          return;
        }
        const errorText = await response.text();
        console.error(`❌ [AnalysisView] Error ${response.status} cargando keyframes:`, errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ [AnalysisView] Keyframes cargados:`, {
        front: data.front?.length || 0,
        back: data.back?.length || 0,
        left: data.left?.length || 0,
        right: data.right?.length || 0
      });
      
      setSmartKeyframes(data);
      setSmartKeyframesLoading(false);
    } catch (error) {
      console.error('❌ [AnalysisView] Error cargando smart keyframes:', error);
      setSmartKeyframesLoading(false);
    }
  }, [analysis.id, user]);

  // Cargar smart keyframes al montar el componente
  useEffect(() => {
    loadSmartKeyframes();
  }, [loadSmartKeyframes]);

  // Sincronizar estado local si llegan keyframes desde el análisis después del primer render
  useEffect(() => {
    const kf = analysis.keyframes;
    if (!kf || typeof kf !== 'object') return;
    const expectedKeys: Array<'front'|'back'|'left'|'right'> = ['front','back','left','right'];
    const anyIncoming = expectedKeys.some((k) => Array.isArray((kf as any)[k]) && (kf as any)[k].length > 0);
    const anyLocal = expectedKeys.some((k) => Array.isArray((localKeyframes as any)[k]) && (localKeyframes as any)[k].length > 0);
    
    if (anyIncoming && !anyLocal) {
      setLocalKeyframes({
        front: Array.isArray((kf as any).front) ? (kf as any).front : [],
        back: Array.isArray((kf as any).back) ? (kf as any).back : [],
        left: Array.isArray((kf as any).left) ? (kf as any).left : [],
        right: Array.isArray((kf as any).right) ? (kf as any).right : [],
      });
    }
    setKeyframesLoading(false);
  }, [analysis.keyframes, localKeyframes, analysis]); // Incluir analysis para detectar videos

  // Solo mostrar ángulos que tengan keyframes disponibles (preferir smart keyframes, luego tradicionales)
  const knownAngles: Array<'front'|'back'|'left'|'right'> = ['front','back','left','right'];
  const hasAngleAvailable = (angle: 'front'|'back'|'left'|'right'): boolean => {
    // Verificar smart keyframes primero
    const smartKfs = (smartKeyframes as any)[angle];
    const hasSmartKfs = Array.isArray(smartKfs) && smartKfs.length > 0;
    
    // Verificar keyframes tradicionales como fallback
    const kfs = (localKeyframes as any)[angle];
    const hasKfs = Array.isArray(kfs) && kfs.length > 0;
    
    const anyObj = analysis as any;
    const hasVideo = angle === 'front'
      ? Boolean(anyObj?.videoUrl || anyObj?.videoFrontUrl)
      : angle === 'back'
        ? Boolean(anyObj?.videoBackUrl)
        : angle === 'left'
          ? Boolean(anyObj?.videoLeftUrl)
          : Boolean(anyObj?.videoRightUrl);
    
        return hasSmartKfs || hasKfs || hasVideo;
  };
  const availableAngles = knownAngles.filter((a) => hasAngleAvailable(a));

  // Verificar si el análisis es parcial (menos de 2 ángulos)
  // Solo mostrar como parcial si hay menos de 2 videos, no 4
  const isPartialAnalysis = availableAngles.length < 2;
  const missingAngles = knownAngles.filter((angle) => !availableAngles.includes(angle));
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [partialModalDismissed, setPartialModalDismissed] = useState(false);

  useEffect(() => {
    if (isPartialAnalysis && !partialModalDismissed) {
      setPartialModalOpen(true);
      return;
    }
    if (!isPartialAnalysis) {
      setPartialModalOpen(false);
      setPartialModalDismissed(false);
    }
  }, [isPartialAnalysis, partialModalDismissed]);

      // Estado del checklist (usar directamente lo que venga en analysis)
  const normalizeChecklist = (input: any): ChecklistCategory[] => {
            if (Array.isArray(input) && input.length > 0) {
          }

    // Si es un array de items individuales (no categorías), convertirlo
    let items: DetailedChecklistItem[] = [];
    if (Array.isArray(input)) {
      if (input.length > 0 && 'name' in input[0]) {
        // Es un array de items individuales (puede tener 'id' o no)
                // Función para normalizar IDs (convertir nombre a id)
        const normalizeIdFromName = (name: string): string => {
          return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/\s+/g, '_') // Espacios a guiones bajos
            .replace(/[^a-z0-9_]/g, ''); // Solo letras, números y guiones bajos
        };
        
        items = input.map((item, index) => {
          const mappedItem: DetailedChecklistItem = {
            id: item.id || normalizeIdFromName(item.name),
            name: item.name,
            score: item.score || 0,
            status: item.status || 'no_evaluable',
            comment: item.comment || '',
            evidencia: item.evidencia || '',
            rating: item.rating, // Usar el rating de la IA, undefined si no existe
            description: item.comment || '', // Usar comment como description
            na: Boolean(item.na || item.status === 'no_evaluable'),
            razon: item.razon || '',
            timestamp: item.timestamp || ''
          };
                    return mappedItem;
        });
      } else if (input.length > 0 && 'items' in input[0]) {
        // Es un array de categorías, extraer todos los items
                for (const cat of input) {
          if (cat.items && Array.isArray(cat.items)) {
            items.push(...cat.items);
          }
        }
      }
    }

    // Función para normalizar IDs (remover acentos, convertir a formato canónico)
    const normalizeId = (id: string): string => {
      return id
        .toLowerCase()
        .trim()
        .replace(/á/g, 'a')
        .replace(/é/g, 'e')
        .replace(/í/g, 'i')
        .replace(/ó/g, 'o')
        .replace(/ú/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    };

    // Determinar tipo de tiro primero (antes de mapear)
    const shotType = (analysis as any).shotType || 
                     (analysis as any).scoreMetadata?.shotTypeKey || 
                     (analysis as any).scoreMetadata?.shotType || 
                     '';
    const isLibre = shotType && (
      shotType.toLowerCase().includes('libre') || 
      shotType.toLowerCase().includes('free') || 
      shotType === 'libre'
    );
    
    // Función para mapear IDs de Gemini a IDs canónicos
    const mapGeminiToCanonical = (geminiId: string): string => {
      const normalized = normalizeId(geminiId);
      
      // Mapeo específico de IDs problemáticos
      const mapping: Record<string, string> = {
        // Tres puntos
        'alineacion_de_pies': 'alineacion_pies',
        'alineacion_corporal': 'alineacion_cuerpo',
        'flexion_de_rodillas': 'flexion_rodillas',
        'mano_no_dominante_en_ascenso': 'mano_no_dominante_ascenso',
        'codos_cerca_del_cuerpo': isLibre ? 'codos_cerca_cuerpo_libre' : 'codos_cerca_cuerpo',
        'subida_recta_del_balon': 'subida_recta_balon',
        'tiempo_de_lanzamiento': 'tiempo_lanzamiento',
        'tiro_en_un_solo_tiempo': isLibre ? 'tiro_un_solo_tiempo_libre' : 'tiro_un_solo_tiempo',
        'transferencia_energetica_sincronia_con_piernas': isLibre ? 'sincronia_piernas_libre' : 'sincronia_piernas',
        'sincronia_con_piernas': isLibre ? 'sincronia_piernas_libre' : 'sincronia_piernas',
        'mano_no_dominante_en_liberacion': 'mano_no_dominante_liberacion',
        'extension_completa_del_brazo': isLibre ? 'extension_completa_liberacion' : 'extension_completa_brazo',
        'extension_completa': isLibre ? 'extension_completa_liberacion' : 'extension_completa_brazo',
        'giro_de_la_pelota': 'giro_pelota',
        'rotacion_balon': 'rotacion_balon',
        'angulo_de_salida': isLibre ? 'angulo_salida_libre' : 'angulo_salida',
        'mantenimiento_del_equilibrio': 'equilibrio_general',
        'mantenimiento_equilibrio': 'equilibrio_general',
        'equilibrio_en_aterrizaje': 'equilibrio_general',
        'equilibrio_aterrizaje': 'equilibrio_general',
        'equilibrio_general': 'equilibrio_general',
        'duracion_del_follow_through': isLibre ? 'follow_through_completo_libre' : 'duracion_follow_through',
        'duracion_del_followthrough': isLibre ? 'follow_through_completo_libre' : 'duracion_follow_through',
        'follow_through_completo': isLibre ? 'follow_through_completo_libre' : 'duracion_follow_through',
        'consistencia_del_movimiento': 'consistencia_general',
        'consistencia_tecnica': 'consistencia_general',
        'consistencia_de_resultados': 'consistencia_general',
        'consistencia_repetitiva': 'consistencia_general',
        'consistencia_general': 'consistencia_general',
        // Tiro libre específicos
        'rutina_pre_tiro': 'rutina_pre_tiro',
        'alineacion_pies_cuerpo': 'alineacion_pies_cuerpo',
        'alineacion_piescuerpo': 'alineacion_pies_cuerpo',
        'muneca_cargada': isLibre ? 'muneca_cargada_libre' : 'muneca_cargada',
        'flexion_rodillas': isLibre ? 'flexion_rodillas_libre' : 'flexion_rodillas',
        'posicion_inicial_balon': 'posicion_inicial_balon',
        'set_point_altura_segun_edad': 'set_point_altura_edad',
        'set_point_altura_edad': 'set_point_altura_edad',
        'set_point': isLibre ? 'set_point_altura_edad' : 'set_point',
        'trayectoria_vertical': 'trayectoria_vertical_libre',
        'mano_guia': 'mano_guia_libre',
        'flexion_muneca_final': 'flexion_muneca_final',
        'sin_salto': 'sin_salto_reglamentario',
        'pies_dentro_zona': 'pies_dentro_zona',
        'balance_vertical': 'balance_vertical',
      };
      
      return mapping[normalized] || normalized;
    };

    // Construir mapa de ítems IA por id (normalizados)
    const iaItemById: Record<string, DetailedChecklistItem> = {};
    for (const item of items) {
      const originalId = String(item.id || '').trim();
      const mappedId = mapGeminiToCanonical(originalId);
            if (!mappedId) continue;
      const s = (item.status as unknown as string | undefined);
      const normalizedRating =
        typeof item.rating === 'number'
          ? item.rating
          : s === 'Incorrecto'
            ? 1
            : s === 'Incorrecto leve'
              ? 2
              : s === 'Mejorable'
                ? 3
                : s === 'Correcto'
                  ? 4
                  : s === 'Excelente'
                    ? 5
                    : 3;
      iaItemById[mappedId] = {
        ...item,
        id: originalId, // Mantener ID original para referencia
        rating: normalizedRating as DetailedChecklistItem['rating'],
      } as DetailedChecklistItem;
    }

    // Usar isLibre ya determinado arriba
    const canonicalCategories = isLibre ? CANONICAL_CATEGORIES_LIBRE : CANONICAL_CATEGORIES;
    
    console.log(`📋 [CHECKLIST] Tipo de tiro: ${shotType}, esLibre: ${isLibre}, usando ${isLibre ? 'LIBRE' : 'TRES'} checklist`);
    
    // Construir checklist canónico y superponer datos de IA por id (sin agregar otros ítems)
    const canonical = canonicalCategories.map((cat) => {
      const items = cat.items.map((def) => {
        const canonicalId = def.id.trim().toLowerCase();
        const fromIA = iaItemById[canonicalId];
        
                if (fromIA) {
          return {
            id: def.id,
            name: def.name, // mantener nombre canónico
            description: def.description,
            rating: (fromIA.rating ?? 3) as DetailedChecklistItem['rating'],
            comment: String(fromIA.comment || ''),
            coachComment: fromIA.coachComment,
            na: Boolean((fromIA as any).na),
            // Preservar score y status de la IA
            score: (fromIA as any).score,
            status: (fromIA as any).status,
            evidencia: (fromIA as any).evidencia,
          } as DetailedChecklistItem;
        }
        // Ítem faltante en IA → mostrar como N/A sin penalizar
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          rating: 3,
          comment: '',
          na: true,
        } as DetailedChecklistItem;
      });
      return { category: cat.category, items } as ChecklistCategory;
    });
    
        return canonical;
  };

  const analysisResult: any = (analysis as any).analysisResult || {};
  const [remoteAnalysisResult, setRemoteAnalysisResult] = useState<any | null>(null);
  const [shotFrames, setShotFrames] = useState<Array<any>>([]);
  const [shotFramesLoading, setShotFramesLoading] = useState(false);
  const [shotFramesError, setShotFramesError] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<ChecklistCategory[]>(() => {
        if (analysis.detailedChecklist && Array.isArray(analysis.detailedChecklist)) {
      const normalized = normalizeChecklist(analysis.detailedChecklist);
      return normalized;
    }
    return [];
  });
  const [remoteChecklist, setRemoteChecklist] = useState<ChecklistCategory[] | null>(null);

  useEffect(() => {
    const hasLocalChecklist = Array.isArray(analysis.detailedChecklist) && analysis.detailedChecklist.length > 0;
    const checklistUrl =
      (analysis as any).detailedChecklistUrl ||
      analysisResult?.detailedChecklistUrl ||
      (analysis as any)?.analysisResult?.detailedChecklistUrl;
    if (hasLocalChecklist || remoteChecklist || !checklistUrl) return;

    const loadChecklist = async () => {
      try {
        const resp = await fetch(String(checklistUrl));
        if (!resp.ok) return;
        const data = await resp.json();
        const checklist = Array.isArray(data?.detailedChecklist) ? data.detailedChecklist : data;
        if (Array.isArray(checklist)) {
          const normalized = normalizeChecklist(checklist);
          setRemoteChecklist(normalized);
          setChecklistState(normalized);
        }
      } catch {}
    };
    loadChecklist();
  }, [analysis, analysisResult, remoteChecklist]);

  useEffect(() => {
    const analysisUrl =
      (analysis as any).analysisResultUrl ||
      analysisResult?.analysisResultUrl ||
      (analysis as any)?.analysisResult?.analysisResultUrl;
    if (remoteAnalysisResult || !analysisUrl) return;

    const loadAnalysis = async () => {
      try {
        const resp = await fetch(String(analysisUrl));
        if (!resp.ok) return;
        const data = await resp.json();
        const result = data?.analysisResult ?? data;
        if (result && typeof result === 'object') {
          setRemoteAnalysisResult(result);
        }
      } catch {}
    };
    loadAnalysis();
  }, [analysis, analysisResult, remoteAnalysisResult]);

  useEffect(() => {
    const shotFramesUrl =
      (analysis as any).shotFramesUrl ||
      analysisResult?.shotFramesUrl ||
      (analysis as any)?.analysisResult?.shotFramesUrl;
    if (!shotFramesUrl || shotFramesLoading || shotFrames.length > 0) return;

    const loadShotFrames = async () => {
      try {
        setShotFramesLoading(true);
        const resp = await fetch(String(shotFramesUrl));
        if (!resp.ok) {
          setShotFramesError('No se pudieron cargar los frames por tiro.');
          setShotFramesLoading(false);
          return;
        }
        const data = await resp.json();
        const shots = Array.isArray(data?.shots) ? data.shots : [];
        setShotFrames(shots);
        setShotFramesError(null);
        setShotFramesLoading(false);
      } catch (e) {
        setShotFramesError('No se pudieron cargar los frames por tiro.');
        setShotFramesLoading(false);
      }
    };

    loadShotFrames();
  }, [analysis, analysisResult, shotFramesLoading, shotFrames.length]);

  // ===== Feedback del entrenador (privado para jugador y coach) =====
  const [coachFeedbackByItemId, setCoachFeedbackByItemId] = useState<Record<string, { rating?: number; comment?: string }>>({});
  const [coachSummary, setCoachSummary] = useState<string>("");
  const seededCoachSummaryRef = useRef(false);
  const [coachFeedbackCoachName, setCoachFeedbackCoachName] = useState<string | null>(null);
  const [coachFeedbackCoachId, setCoachFeedbackCoachId] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [savingCoachFeedback, setSavingCoachFeedback] = useState(false);
  const [isEditingCoachFeedback, setIsEditingCoachFeedback] = useState(false);
  const [hasExistingCoachFeedback, setHasExistingCoachFeedback] = useState(false);
  const roleForPermissions = viewerRole || (userProfile as any)?.role;
  const isAdmin = roleForPermissions === 'admin';
  const isCoachRole = roleForPermissions === 'coach';
  const authUserId = user?.uid ? String(user.uid) : '';
  const profileId = (userProfile as any)?.id ? String((userProfile as any).id) : '';
  const userIds = [authUserId, profileId].filter(Boolean);
  const isCoach = isCoachRole || isAdmin;
  const viewerId = authUserId || profileId;
  const hasPaidCoachAccess = userIds.some((id) => (analysis as any)?.coachAccess?.[id]?.status === 'paid');
  const isAssignedCoach = userIds.some((id) => id === (player?.coachId || ''));
  const [hasPlayerCoachAccess, setHasPlayerCoachAccess] = useState(false);
  const canEdit = Boolean(
    isAdmin || (isCoachRole && userIds.length > 0 && (isAssignedCoach || hasPaidCoachAccess || hasPlayerCoachAccess))
  );
  const canComment = Boolean(
    isAdmin || (isCoachRole && (!player?.coachId || isAssignedCoach || hasPaidCoachAccess || hasPlayerCoachAccess))
  );
  const fallbackCoachSummary = (() => {
    const raw =
      (analysis as any)?.coachSummary ??
      (analysis as any)?.coachFeedback?.coachSummary ??
      (analysis as any)?.coachFeedback?.summary ??
      (analysis as any)?.coachSummaryText ??
      "";
    return typeof raw === "string" ? raw : "";
  })();
  const resolvedCoachSummary =
    coachSummary.trim().length > 0 ? coachSummary : fallbackCoachSummary;

  const hasCoachFeedback = useMemo(() => {
    const hasItems = Object.values(coachFeedbackByItemId).some((entry) => {
      if (!entry) return false;
      const hasRating = typeof entry.rating === 'number';
      const hasComment = typeof entry.comment === 'string' && entry.comment.trim().length > 0;
      return hasRating || hasComment;
    });
    return hasItems || resolvedCoachSummary.trim().length > 0;
  }, [coachFeedbackByItemId, resolvedCoachSummary]);
  const showCoachChecklistTab = isCoach || hasCoachFeedback || analysis.coachCompleted === true;
  const isCoachCompleted = analysis.coachCompleted === true || hasCoachFeedback;
  const analysisTabLabel = isCoachCompleted ? "Análisis" : "Análisis IA";
  const analysisSummaryTitle = isCoachCompleted ? "Resumen del Análisis" : "Resumen del Análisis de IA";
  const [analysisMessages, setAnalysisMessages] = useState<Message[]>([]);
  const [analysisMessageText, setAnalysisMessageText] = useState("");
  const [sendingAnalysisMessage, setSendingAnalysisMessage] = useState(false);
  const getAnalysisMessageOriginLabel = (m: Message) => {
    if (m.fromId === "system") return "Sistema";
    if (viewerId && m.fromId === viewerId) return "Tú";
    return isCoach ? "Jugador" : "Entrenador";
  };
  const isKeyframeMessage = (m: Message) =>
    Boolean(m.keyframeUrl || m.angle || typeof m.index === "number");

  const toMessageDate = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value?._seconds === "number") {
      return new Date(value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1e6));
    }
    return null;
  };
  const getMessageTime = (value: any) => toMessageDate(value)?.getTime() ?? 0;
  const formatMessageDate = (value: any) => {
    const d = toMessageDate(value);
    return d ? d.toLocaleString() : "Fecha desconocida";
  };
  const renderMessageText = (text: string) => {
    if (!text) return null;
    const urlPattern = /https?:\/\/\S+/g;
    const segments: Array<{ type: "text" | "link"; value: string }> = [];
    let lastIndex = 0;
    for (const match of text.matchAll(urlPattern)) {
      const matchText = match[0];
      const matchIndex = match.index ?? 0;
      if (matchIndex > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
      }
      segments.push({ type: "link", value: matchText });
      lastIndex = matchIndex + matchText.length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments.map((segment, idx) => {
      if (segment.type === "link") {
        const href = resolveMessageLinkToCurrentEnv(segment.value);
        return (
          <a
            key={`link-${idx}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline break-all"
          >
            {href}
          </a>
        );
      }
      return <span key={`text-${idx}`}>{segment.value}</span>;
    });
  };

  useEffect(() => {
    if (seededCoachSummaryRef.current) return;
    if (coachSummary.trim().length > 0) {
      seededCoachSummaryRef.current = true;
      return;
    }
    if (fallbackCoachSummary.trim().length > 0) {
      setCoachSummary(fallbackCoachSummary);
      seededCoachSummaryRef.current = true;
    }
  }, [coachSummary, fallbackCoachSummary]);

  useEffect(() => {
    if (!analysis?.id || !user) {
      setAnalysisMessages([]);
      return;
    }
    try {
      const q = query(
        collection(db as any, "messages"),
        where("analysisId", "==", analysis.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
        const filtered = isCoach
          ? incoming
          : incoming.filter((m) => m.fromId === user.uid || m.toId === user.uid);
        setAnalysisMessages(filtered.sort((a, b) => getMessageTime(b.createdAt) - getMessageTime(a.createdAt)));
      });
      return () => unsub();
    } catch (e) {
      console.error("Error cargando mensajes del lanzamiento:", e);
    }
  }, [analysis?.id, isCoach, user]);

  useEffect(() => {
    // Cargar feedback del coach para todos los usuarios (coach, admin y jugador)
    const load = async () => {
      try {
        const auth = getAuth();
        const u = auth.currentUser;
        if (!u) {
          console.log(`[CoachFeedback] ⚠️ Usuario no autenticado, esperando...`);
          return;
        }
        const token = await getIdToken(u);
        console.log(`[CoachFeedback] 🔄 Cargando feedback para análisis ${analysis.id}...`);
        const res = await fetch(`/api/analyses/${analysis.id}/coach-feedback`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.log(`[CoachFeedback] ❌ Error en respuesta: ${res.status} ${res.statusText}`);
          return;
        }
        const data = await res.json();
        const fb = data?.feedback;
        console.log(`[CoachFeedback] 📦 Datos recibidos:`, { hasFeedback: !!fb, hasSummary: !!(fb?.coachSummary) });
        if (fb) {
          // Normalizar los IDs del feedback cargado (lowercase y trim)
          const normalizedItems: Record<string, { rating?: number; comment?: string }> = {};
          for (const [key, value] of Object.entries(fb.items || {})) {
            const normalizedKey = String(key).trim().toLowerCase();
            normalizedItems[normalizedKey] = value as { rating?: number; comment?: string };
          }
          console.log(`[CoachFeedback] 📥 Feedback cargado:`, {
            originalKeys: Object.keys(fb.items || {}),
            normalizedKeys: Object.keys(normalizedItems),
            itemCount: Object.keys(normalizedItems).length
          });
          setCoachFeedbackByItemId(normalizedItems);
          const summaryValue = fb.coachSummary || "";
          console.log(`[CoachFeedback] 📝 CoachSummary cargado:`, {
            hasSummary: summaryValue.trim().length > 0,
            summaryLength: summaryValue.length,
            summaryPreview: summaryValue.substring(0, 100)
          });
          setCoachSummary(summaryValue);
          const coachId = String(fb?.createdBy || fb?.id || "").trim();
          setCoachFeedbackCoachId(coachId || null);
          const coachNameFromFeedback = typeof fb?.coachName === "string" ? fb.coachName.trim() : "";
          if (coachNameFromFeedback) {
            setCoachFeedbackCoachName(coachNameFromFeedback);
          } else {
            if (coachId) {
              try {
                const coachSnap = await getDoc(doc(db as any, "coaches", coachId));
                const coachData = coachSnap.exists() ? (coachSnap.data() as any) : null;
                const coachName = typeof coachData?.name === "string" ? coachData.name.trim() : "";
                setCoachFeedbackCoachName(coachName || null);
              } catch (e) {
                console.warn("[CoachFeedback] ⚠️ No se pudo cargar el nombre del coach:", e);
                setCoachFeedbackCoachName(null);
              }
            } else {
              setCoachFeedbackCoachName(null);
            }
          }
          // Detectar si ya hay feedback guardado (si hay items o summary)
          const hasItems = Object.keys(normalizedItems).length > 0;
          const hasSummary = summaryValue.trim().length > 0;
          setHasExistingCoachFeedback(hasItems || hasSummary);
          // Si hay feedback existente, solo permitir edición si tiene permisos
          setIsEditingCoachFeedback(canEdit && !(hasItems || hasSummary));
        } else {
          // No hay feedback, iniciar en modo edición
          console.log(`[CoachFeedback] ⚠️ No se encontró feedback para el análisis ${analysis.id}`);
          setHasExistingCoachFeedback(false);
          setIsEditingCoachFeedback(canEdit);
          setCoachFeedbackCoachName(null);
          setCoachFeedbackCoachId(null);
        }
      } catch (e) {
        console.error('[CoachFeedback] ❌ Error cargando feedback:', e);
      }
    };
    if (user) {
      void load();
    }
  }, [analysis.id, user?.uid, canEdit]);

  const onCoachFeedbackChange = (itemId: string, next: { rating?: number; comment?: string }) => {
    // Normalizar el ID al guardar (lowercase y trim para consistencia)
    const normalizedId = String(itemId).trim().toLowerCase();
    setCoachFeedbackByItemId((prev) => ({ ...prev, [normalizedId]: { rating: next.rating, comment: next.comment } }));
  };

  // Guardar feedback del entrenador
  const saveCoachFeedback = async () => {
    try {
      if (!canEdit) {
        toast({ title: 'Sin permisos', description: 'No tenés permisos para guardar esta revisión.', variant: 'destructive' });
        return;
      }
      setSavingCoachFeedback(true);
      const auth = getAuth();
      const u = auth.currentUser;
      if (!u) {
        toast({ title: 'No autenticado', description: 'Iniciá sesión para guardar feedback', variant: 'destructive' });
        return;
      }
      const token = await getIdToken(u);
      const res = await fetch(`/api/analyses/${analysis.id}/coach-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: coachFeedbackByItemId, coachSummary }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'No se pudo guardar el feedback.');
      }
      toast({ title: 'Feedback guardado', description: 'Se enviaron discrepancias a revisión de IA si correspondía.' });
      setHasExistingCoachFeedback(true);
      setIsEditingCoachFeedback(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar el feedback.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSavingCoachFeedback(false);
    }
  };

  // Generar resumen con IA basado en las calificaciones del coach
  const generateCoachSummary = async () => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    try {
      if (!canEdit) {
        toast({ title: 'Sin permisos', description: 'No tenés permisos para generar el comentario global.', variant: 'destructive' });
        return;
      }
      setGeneratingSummary(true);
      const auth = getAuth();
      const u = auth.currentUser;
      if (!u) {
        toast({ title: 'No autenticado', description: 'Iniciá sesión para generar resumen', variant: 'destructive' });
        return;
      }

      const token = await getIdToken(u);
      const shotType = (analysis as any).shotType || (analysis as any).scoreMetadata?.shotTypeKey || 'tres';

      timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`/api/analyses/${analysis.id}/generate-coach-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          coachFeedback: coachFeedbackByItemId,
          shotType
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || 'Error generando resumen');
      }

      if (data.ok && data.summary) {
        setCoachSummary(data.summary);
        const hasCoachRatings = Object.values(coachFeedbackByItemId).some(
          (cf) => cf && typeof cf.rating === 'number'
        );
        toast({
          title: 'Resumen generado',
          description: hasCoachRatings
            ? 'La IA ha generado un resumen basado en tus calificaciones. Podés editarlo si querés.'
            : 'La IA ha generado un resumen basado en el análisis automático. Podés editarlo si querés.'
        });
      } else {
        throw new Error('No se recibió el resumen');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo generar el resumen.';
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      console.error('Error generando resumen:', e);
      toast({
        title: 'Error',
        description: isAbort ? 'La generación tardó demasiado y se canceló. Intentá de nuevo.' : message,
        variant: 'destructive'
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setGeneratingSummary(false);
    }
  };

  // Derivados del checklist basados en rating 1..5 (ordenados por importancia)
  const flatChecklistItems = checklistState.flatMap((c) => c.items);

  const isEvaluableChecklistItem = (item: DetailedChecklistItem) =>
    !item.na && item.status !== "no_evaluable";

  const checklistStrengths = flatChecklistItems
    .filter((item) => isEvaluableChecklistItem(item) && (item.rating || 3) >= 4)
    .sort((a, b) => (b.rating || 3) - (a.rating || 3)) // 5 primero, luego 4
    .map((item) => item.name);

  const checklistWeaknesses = flatChecklistItems
    .filter((item) => isEvaluableChecklistItem(item) && (item.rating || 3) <= 2)
    .sort((a, b) => (a.rating || 3) - (b.rating || 3)) // 1 primero, luego 2
    .map((item) => item.name);

  const scrubTimestamps = (text: string) =>
    text.replace(/\b\d+(\.\d+)?s\b/g, '').replace(/\b\d+(\.\d+)?s-\d+(\.\d+)?s\b/g, '').trim();

  const checklistRecommendations = flatChecklistItems
    .filter(
      (item) =>
        isEvaluableChecklistItem(item) &&
        (item.rating || 3) <= 3 &&
        String(item.comment || '').trim() !== ""
    )
    .sort((a, b) => {
      const ra = a.rating || 3;
      const rb = b.rating || 3;
      if (ra !== rb) return ra - rb; // peor primero
      const la = String(a.comment || '').length;
      const lb = String(b.comment || '').length;
      return lb - la; // comentario más sustancioso primero
    })
    .map((item) => scrubTimestamps(`${item.name}: ${item.comment}`));

  // Evaluación final: promedio 1..5 (usa rating; si falta, mapea status legacy)
  const mapStatusToRating = (status?: DetailedChecklistItem["status"] | string): number | null => {
    if (!status) return null;
    if (status === "Incorrecto") return 1;
    if (status === "Incorrecto leve") return 2;
    if (status === "Mejorable") return 3;
    if (status === "Correcto") return 4;
    if (status === "Excelente") return 5;
    return null;
  };
  // Usar checklist renderizado; si está vacío, intentar con el de analysisResult luego
  let allRatings: number[] = checklistState
    .flatMap((c) => c.items)
    .map((it) => (typeof it.rating === "number" ? it.rating : mapStatusToRating(it.status)))
    .filter((v): v is number => typeof v === "number");
  const avgRating: number | null = allRatings.length > 0
    ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
    : null;
  const scoreLabel = (r: number) => (r >= 4.5 ? "Excelente" : r >= 4 ? "Correcto" : r >= 3 ? "Mejorable" : r >= 2 ? "Incorrecto leve" : "Incorrecto");

  // Asegurar que otros campos opcionales existan (tomando de analysisResult si es necesario)
  const resolvedAnalysisResult = remoteAnalysisResult || analysisResult;
  if (allRatings.length === 0 && Array.isArray(resolvedAnalysisResult.detailedChecklist)) {
    allRatings = (resolvedAnalysisResult.detailedChecklist as any[])
      .flatMap((c: any) => c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
      .filter((v: any) => typeof v === 'number');
  }
  const derivedSummary: string = analysis.analysisSummary || resolvedAnalysisResult.analysisSummary || 'Análisis completado';
  // Preferir valores del análisis; si no, usar los derivados del checklist; si tampoco, usar analysisResult
  const strengthsFromChecklist = checklistStrengths || [];
  const weaknessesFromChecklist = checklistWeaknesses || [];
  const recommendationsFromChecklist = checklistRecommendations || [];
  const derivedStrengths: string[] = (analysis.strengths && analysis.strengths.length > 0)
    ? analysis.strengths
    : (strengthsFromChecklist.length > 0 ? strengthsFromChecklist : (resolvedAnalysisResult.strengths || []));
  const derivedWeaknesses: string[] = (analysis.weaknesses && analysis.weaknesses.length > 0)
    ? analysis.weaknesses
    : (weaknessesFromChecklist.length > 0 ? weaknessesFromChecklist : (resolvedAnalysisResult.weaknesses || []));
  const derivedRecommendations: string[] = (analysis.recommendations && analysis.recommendations.length > 0)
    ? analysis.recommendations
    : (recommendationsFromChecklist.length > 0 ? recommendationsFromChecklist : (resolvedAnalysisResult.recommendations || []));
  const derivedKeyframeAnalysis: string | null = (analysis as any).keyframeAnalysis || analysisResult.keyframeAnalysis || null;

  const toPct = (score: number): number => {
    if (score <= 10) return Math.round(score * 10);
    if (score <= 5) return Math.round((score / 5) * 100);
    return Math.round(score);
  };

  const formatMs = (value?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
    return `${(value / 1000).toFixed(2)}s`;
  };

  const ownerId = (analysis as any)?.playerId || (player as any)?.id;
  const isOwnerPlayer = Boolean(viewerId && ownerId && String(viewerId) === String(ownerId));
  const nonBasketballWarning =
    (analysis as any).advertencia || (analysisResult as any).advertencia || '';
  const isNonBasketballVideo =
    /no corresponde a basquet|no detectamos/i.test(nonBasketballWarning || derivedSummary);
  const canClearScore = Boolean(isOwnerPlayer && viewerId);
  const hasStrengths = derivedStrengths.length > 0;
  const hasWeaknesses = derivedWeaknesses.length > 0;
  const hasRecommendations = derivedRecommendations.length > 0;

  const safeAnalysis = {
    ...analysis,
    keyframes: safeKeyframes,
    detailedChecklist: analysis.detailedChecklist || [],
    score: typeof analysis.score === 'number' ? toPct(analysis.score) : 0,
    strengths: derivedStrengths,
    weaknesses: derivedWeaknesses,
    recommendations: derivedRecommendations,
    analysisSummary: derivedSummary,
  };

  useEffect(() => {
    let active = true;
    const checkCoachAccess = async () => {
      if (!isCoachRole || !safeAnalysis?.id) {
        setHasPlayerCoachAccess(false);
        return;
      }
      try {
        const auth = getAuth();
        const cu = auth.currentUser;
        if (!cu) return;
        const token = await getIdToken(cu, true);
        const res = await fetch(`/api/analyses/${safeAnalysis.id}/coach-access`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (active) setHasPlayerCoachAccess(false);
          return;
        }
        const data = await res.json();
        if (active) setHasPlayerCoachAccess(Boolean(data?.hasCoachAccess));
      } catch {
        if (active) setHasPlayerCoachAccess(false);
      }
    };
    void checkCoachAccess();
    return () => {
      active = false;
    };
  }, [isCoachRole, safeAnalysis?.id]);

  const attempts: Array<{ start: number; end: number }> = Array.isArray((analysis as any).attempts)
    ? ((analysis as any).attempts as Array<{ start: number; end: number }>)
    : [];
  const [attemptsState, setAttemptsState] = useState(attempts);

  const [drills, setDrills] = useState<Drill[]>([]);
  const [isLoadingDrills, setIsLoadingDrills] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fluidez / Armonía (transferencia energética) — 1..10
  const [fluidezScore10, setFluidezScore10] = useState<number | undefined>(
    typeof (analysis as any).fluidezScore10 === 'number' ? (analysis as any).fluidezScore10 : undefined
  );

  const saveFluidez = async (value: number | undefined) => {
    if (!canEdit) return;
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      await fetch(`/api/analyses/${safeAnalysis.id}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ detailedChecklist: checklistState, fluidezScore10: value })
      });
    } catch (e) { console.warn('No se pudo guardar fluidezScore10', e); }
  };

  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<'front' | 'back' | 'left' | 'right' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentKeyframes, setCurrentKeyframes] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Estados para el diálogo de selección de entrenadores
  const [coachSelectionDialogOpen, setCoachSelectionDialogOpen] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachSearchTerm, setCoachSearchTerm] = useState("");
  
  // Estados para el diálogo de mensaje
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedCoachForMessage, setSelectedCoachForMessage] = useState<Coach | null>(null);
  const [messageText, setMessageText] = useState("Entrenador, me gustaría que analices mis tiros. ¿Podés ayudarme?");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Estados para el pago
  const [unlockCoach, setUnlockCoach] = useState<Coach | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [creatingUnlock, setCreatingUnlock] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'mercadopago' | 'dlocal'>('mercadopago');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const getDisplayRate = useCallback((coach: Coach) => {
    if (typeof coach.ratePerAnalysis === 'number') return coach.ratePerAnalysis;
    const name = (coach.name || '').trim().toLowerCase();
    if (name === 'esteban daniel velasco') return 25000;
    return null;
  }, []);

  // Filtrar entrenadores por búsqueda
  const filteredCoaches = useMemo(() => {
    // Filtrar coaches ocultos primero
    const visibleCoaches = coaches.filter(coach => coach.hidden !== true);
    const excludedCoachId = coachFeedbackCoachId?.trim();
    const selectableCoaches = excludedCoachId
      ? visibleCoaches.filter((coach) => String(coach.id || '').trim() !== excludedCoachId)
      : visibleCoaches;
    
    if (!coachSearchTerm) return selectableCoaches;
    const term = coachSearchTerm.toLowerCase();
    return selectableCoaches.filter(coach => 
      coach.name.toLowerCase().includes(term) ||
      coach.bio?.toLowerCase().includes(term) ||
      coach.specialties?.some(s => s.toLowerCase().includes(term))
    );
  }, [coaches, coachSearchTerm, coachFeedbackCoachId]);

  // Función para renderizar estrellas de rating
  const renderCoachStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-500"
            : i < rating
            ? "fill-yellow-400/50 text-yellow-500"
            : "text-gray-300"
        }`}
      />
    ));
  };

  // Función para enviar mensaje al entrenador
  const handleSendMessage = async () => {
    if (!selectedCoachForMessage || !user) {
      if (!user) {
        router.push('/login');
      }
      return;
    }
    try {
      setSendingMessage(true);
      const colRef = collection(db as any, 'messages');
      const payload = {
        fromId: user.uid,
        fromName: (userProfile as any)?.name || user.displayName || 'Jugador',
        fromAvatarUrl: (userProfile as any)?.avatarUrl || '',
        toId: selectedCoachForMessage.id,
        toCoachDocId: selectedCoachForMessage.id,
        toName: selectedCoachForMessage.name,
        text: messageText,
        analysisId: analysis.id || null,
        createdAt: serverTimestamp(),
        read: false,
        messageType: getMessageType({ fromId: user.uid, analysisId: analysis.id || null }),
        conversationId: buildConversationId({
          fromId: user.uid,
          toId: selectedCoachForMessage.id,
          analysisId: analysis.id || null,
        }),
      };
      await addDoc(colRef, payload as any);
      setMessageDialogOpen(false);
      setSelectedCoachForMessage(null);
      setMessageText("Entrenador, me gustaría que analices mis tiros. ¿Podés ayudarme?");
      toast({
        title: 'Mensaje enviado',
        description: `Tu mensaje fue enviado a ${selectedCoachForMessage.name}`,
      });
    } catch (e) {
      console.error('Error enviando mensaje:', e);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const sendAnalysisMessage = async () => {
    if (!user || !analysis?.id || !analysisMessageText.trim()) return;
    const targetCoachId = (analysis as any)?.coachId || player?.coachId;
    const toId = isCoach ? player?.id : targetCoachId;
    if (!toId) {
      toast({
        title: "Falta destinatario",
        description: "No hay entrenador asignado para este lanzamiento.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSendingAnalysisMessage(true);
      const token = await user.getIdToken();
      const res = await fetch(`/api/analyses/${analysis.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: analysisMessageText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      setAnalysisMessageText("");
      if (isCoach) {
        toast({
          title: "Mensaje enviado",
          description: "El jugador recibirá un correo con tu mensaje.",
        });
      }
    } catch (e) {
      console.error("Error enviando mensaje del lanzamiento:", e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
    } finally {
      setSendingAnalysisMessage(false);
    }
  };

  // Función para abrir diálogo de pago
  const handleRequestReview = async (coach: Coach) => {
    console.log('🔍 handleRequestReview llamado con:', coach);
    console.log('🔍 Usuario actual:', user?.uid);
    if (!user) {
      console.log('❌ No hay usuario, redirigiendo a login');
      router.push('/login');
      return;
    }
    console.log('✅ Usuario encontrado, abriendo diálogo');
    console.log('✅ Coach ratePerAnalysis:', coach.ratePerAnalysis);
    console.log('✅ Coach showRate:', coach.showRate);
    setUnlockCoach(coach);
    setPaymentProvider('mercadopago'); // Reset al abrir
    setUnlockDialogOpen(true);
    setUnlockError(null);
    
    // Verificar si ya está pagado o tiene un pago pendiente
    try {
      const token = await user.getIdToken();
      const unlockCheckRes = await fetch(`/api/analyses/${analysis.id}/unlock-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (unlockCheckRes.ok) {
        const unlockData = await unlockCheckRes.json();
        const paidCoachIds = unlockData.paidCoachIds || [];
        const pendingCoachIds = unlockData.pendingCoachIds || [];
        const otherPending = pendingCoachIds.filter((c: any) => c.coachId !== coach.id);
        const otherPaid = paidCoachIds.filter((c: any) => c.coachId !== coach.id);
        if (otherPending.length > 0 || otherPaid.length > 0) {
          const pendingNames = otherPending.map((c: any) => c.coachName || 'Entrenador');
          const paidNames = otherPaid.map((c: any) => c.coachName || 'Entrenador');
          const parts: string[] = [];
          if (pendingNames.length > 0) {
            parts.push(`Pago pendiente con ${pendingNames.join(', ')}.`);
          }
          if (paidNames.length > 0) {
            parts.push(`Pago ya realizado con ${paidNames.join(', ')}.`);
          }
          parts.push('Si solicitás otra revisión, se generará un nuevo pago.');
          toast({
            title: 'Revisión pendiente con otro entrenador',
            description: parts.join(' '),
            variant: 'default',
          });
        }
        
        // Verificar si este coach ya está en la lista de pagados o pendientes
        const isPaid = paidCoachIds.some((c: any) => c.coachId === coach.id);
        const isPending = pendingCoachIds.some((c: any) => c.coachId === coach.id);
        
        if (isPaid) {
          console.log('✅ Coach ya tiene pago completado');
          toast({
            title: 'Ya pagaste',
            description: `Ya pagaste para que ${coach.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.`,
            variant: 'default',
          });
        } else if (isPending) {
          console.log('⚠️ Coach tiene pago pendiente');
          setUnlockError('Ya tienes un pago pendiente para este entrenador. Espera a que se complete o contacta soporte si necesitas ayuda.');
        }
      }
    } catch (error) {
      console.error('Error verificando estado de unlock:', error);
      // Si falla la verificación, continuar normalmente
    }
    
    // Forzar re-render para asegurar que el diálogo se abra
    setTimeout(() => {
      console.log('🔍 Después de setTimeout, unlockDialogOpen debería ser true');
    }, 100);
  };

  // Función para crear unlock y redirigir a pago
  const handleCreateUnlock = async () => {
    if (!unlockCoach || !analysis?.id) return;
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      setCreatingUnlock(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-unlocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          coachId: unlockCoach.id,
          paymentProvider: paymentProvider,
        }),
      });
      console.log('📤 Enviando request con paymentProvider:', paymentProvider);
      console.log('📤 Body completo:', JSON.stringify({
        analysisId: analysis.id,
        coachId: unlockCoach.id,
        paymentProvider: paymentProvider,
      }, null, 2));
      const data = await res.json();
      console.log('📥 Respuesta completa del servidor:', JSON.stringify(data, null, 2));
      console.log('📥 Tipo de data:', typeof data);
      console.log('📥 data.ok:', data?.ok);
      console.log('📥 data.initPoint:', data?.initPoint);
      console.log('📥 data.sandboxInitPoint:', data?.sandboxInitPoint);
      
      if (!res.ok) {
        if (res.status === 409) {
          toast({
            title: 'Ya pagado',
            description: 'Ya pagaste para que este entrenador analice tu lanzamiento.',
          });
          setUnlockDialogOpen(false);
          return;
        }
        // Si es error de monto mínimo, mostrar mensaje específico
        if (res.status === 400 && data?.code === 'AMOUNT_TOO_LOW') {
          setUnlockError(data?.error || 'El monto es demasiado bajo para pagos con tarjeta. Por favor, usa MercadoPago para este monto.');
          toast({
            title: 'Monto mínimo requerido',
            description: data?.error || 'El monto es demasiado bajo para pagos con tarjeta. Por favor, selecciona MercadoPago.',
            variant: 'destructive',
          });
          // Cambiar automáticamente a MercadoPago
          setPaymentProvider('mercadopago');
          return;
        }
        throw new Error(data?.error || 'No se pudo iniciar el pago.');
      }
      
      // Manejar diferentes proveedores de pago
      // El servidor devuelve camelCase: initPoint, sandboxInitPoint, checkoutUrl, redirectUrl
      const redirectUrl = data?.initPoint || 
                         data?.sandboxInitPoint || 
                         data?.checkoutUrl || 
                         data?.redirectUrl ||
                         // También buscar en snake_case por compatibilidad
                         data?.init_point || 
                         data?.sandbox_init_point || 
                         data?.checkout_url;
      
      console.log('🔗 URL de redirección encontrada:', redirectUrl);
      console.log('🔗 Tipo de redirectUrl:', typeof redirectUrl);
      console.log('📋 Todos los campos disponibles:', {
        initPoint: data?.initPoint,
        sandboxInitPoint: data?.sandboxInitPoint,
        checkoutUrl: data?.checkoutUrl,
        redirectUrl: data?.redirectUrl,
        // snake_case (legacy)
        init_point: data?.init_point,
        sandbox_init_point: data?.sandbox_init_point,
        checkout_url: data?.checkout_url,
      });
      
      if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.length > 0) {
        console.log('✅ Redirigiendo a:', redirectUrl);
        console.log('✅ paymentProvider usado:', paymentProvider);
        console.log('✅ window.location.href será:', redirectUrl);
        // Redirigir inmediatamente - no esperar
        window.location.href = redirectUrl;
      } else {
        console.error('❌ No se encontró URL de redirección en la respuesta');
        console.error('❌ redirectUrl es:', redirectUrl);
        console.error('❌ Tipo:', typeof redirectUrl);
        console.error('📋 Datos completos:', data);
        toast({
          title: 'Error',
          description: 'No se pudo obtener la URL de pago. Por favor, intenta de nuevo.',
          variant: 'destructive',
        });
        setUnlockError('No se pudo obtener la URL de pago. Verifica la consola para más detalles.');
      }
    } catch (error: any) {
      setUnlockError(error?.message || 'Error inesperado al iniciar el pago.');
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo iniciar el pago.',
        variant: 'destructive',
      });
    } finally {
      setCreatingUnlock(false);
    }
  };

  // Función para simular pago (solo desarrollo)
  const handleSimulatePayment = async () => {
    if (!unlockCoach || !analysis?.id) return;
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      setSimulatingPayment(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-unlocks/simulate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          coachId: unlockCoach.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({
            title: 'Ya pagado',
            description: 'Ya pagaste para que este entrenador analice tu lanzamiento.',
          });
          setUnlockDialogOpen(false);
          return;
        }
        throw new Error(data?.error || 'No se pudo simular el pago.');
      }
      toast({
        title: 'Pago simulado',
        description: 'El análisis está desbloqueado. El entrenador puede verlo ahora.',
      });
      setUnlockDialogOpen(false);
      // Recargar la página para actualizar el estado
      router.refresh();
    } catch (error: any) {
      setUnlockError(error?.message || 'Error inesperado al simular el pago.');
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo simular el pago.',
        variant: 'destructive',
      });
    } finally {
      setSimulatingPayment(false);
    }
  };

  // Calcular tarifas para el unlock
  const unlockDisplayRate = unlockCoach ? getDisplayRate(unlockCoach) : null;
  const unlockShowRate = unlockCoach ? unlockCoach.showRate !== false : false;
  const coachRate = unlockShowRate && typeof unlockDisplayRate === 'number' ? unlockDisplayRate : null;
  const platformFee = coachRate != null ? Math.max(1, Math.round(coachRate * 0.3)) : null;
  const totalAmount = coachRate != null && platformFee != null ? coachRate + platformFee : null;

  const [completing, setCompleting] = useState(false);
  
  // Validar que todos los checklist estén completos y el comentario global tenga mínimo 50 palabras
  const canMarkCompleted = useMemo(() => {
    if (!canEdit || !isEditingCoachFeedback) return false;
    
    // Obtener todos los items del checklist (excluyendo los marcados como N/A)
    const allItems = checklistState.flatMap((c) => c.items).filter(item => !item.na);
    
    if (allItems.length === 0) return false;
    
    // Verificar que todos los items tengan calificación del coach
    const allItemsHaveRating = allItems.every(item => {
      const itemId = item.id.trim().toLowerCase();
      const feedback = coachFeedbackByItemId[itemId];
      return feedback && typeof feedback.rating === 'number';
    });
    
    // Verificar que el comentario global tenga mínimo 50 palabras
    const summaryWords = coachSummary.trim().split(/\s+/).filter(w => w.length > 0);
    const hasMinWords = summaryWords.length >= 50;
    
    return allItemsHaveRating && hasMinWords;
  }, [canEdit, isEditingCoachFeedback, checklistState, coachFeedbackByItemId, coachSummary]);
  
  // Calcular qué falta para poder marcar como terminado
  const completionStatus = useMemo(() => {
    const allItems = checklistState.flatMap((c) => c.items).filter(item => !item.na);
    const itemsWithRating = allItems.filter(item => {
      const itemId = item.id.trim().toLowerCase();
      const feedback = coachFeedbackByItemId[itemId];
      return feedback && typeof feedback.rating === 'number';
    });
    const missingItems = allItems.length - itemsWithRating.length;
    
    const summaryWords = coachSummary.trim().split(/\s+/).filter(w => w.length > 0);
    const missingWords = Math.max(0, 50 - summaryWords.length);
    
    return { missingItems, missingWords, totalItems: allItems.length };
  }, [checklistState, coachFeedbackByItemId, coachSummary]);
  
  const markCompleted = async () => {
    if (!canEdit || !canMarkCompleted) {
      const { missingItems, missingWords } = completionStatus;
      const messages = [];
      if (missingItems > 0) {
        messages.push(`${missingItems} ${missingItems === 1 ? 'ítem del checklist' : 'ítems del checklist'} sin calificar`);
      }
      if (missingWords > 0) {
        messages.push(`Faltan ${missingWords} ${missingWords === 1 ? 'palabra' : 'palabras'} en el comentario global (mínimo 50)`);
      }
      toast({ 
        title: 'Revisión incompleta', 
        description: messages.join('. ') + '.', 
        variant: 'destructive' 
      });
      return;
    }
    try {
      setCompleting(true);
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo marcar como terminado');
      toast({ title: 'Análisis marcado como terminado', description: 'El jugador será notificado.' });
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo marcar como terminado', variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  };
  const [rebuilding, setRebuilding] = useState(false);
  const [uploadingFromClient, setUploadingFromClient] = useState(false);
  const [keyframesGenStatus, setKeyframesGenStatus] = useState<string | null>(null);

  type KeyframeComment = { id?: string; comment: string; coachName?: string; createdAt: string };
  const [keyframeComments, setKeyframeComments] = useState<KeyframeComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const isCommentFocusedRef = useRef(false);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [commentAiOpen, setCommentAiOpen] = useState(false);
  const [commentAiLoading, setCommentAiLoading] = useState(false);
  const [commentAiSuggestion, setCommentAiSuggestion] = useState("");

  type KeyframeAnnotation = { id?: string; overlayUrl: string; createdAt: string };
  const [annotations, setAnnotations] = useState<KeyframeAnnotation[]>([]);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [annotationStatus, setAnnotationStatus] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const [imageLayout, setImageLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageNaturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Canvas overlay refs y estado de herramienta
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const toolRef = useRef<'move' | 'pencil' | 'circle' | 'line' | 'eraser'>("move");
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const canvasSnapshotRef = useRef<ImageData | null>(null);
  const [drawColor, setDrawColor] = useState("#ef4444");

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasSnapshotRef.current = null;
  }, []);

  const beginDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsCommentFocused(false);
    if (toolRef.current === 'move') return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    if (imageLayout) {
      if (x < imageLayout.x || y < imageLayout.y || x > imageLayout.x + imageLayout.width || y > imageLayout.y + imageLayout.height) {
        return;
      }
    }
    drawingRef.current = true; startPointRef.current = { x, y };
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx || !canvasRef.current) return;
    if (toolRef.current === 'pencil' || toolRef.current === 'eraser') {
      ctx.lineWidth = toolRef.current === 'eraser' ? 16 : 3;
      ctx.strokeStyle = toolRef.current === 'eraser' ? 'rgba(0,0,0,1)' : drawColor;
      ctx.globalCompositeOperation = toolRef.current === 'eraser' ? 'destination-out' : 'source-over';
      if (imageLayout) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(imageLayout.x, imageLayout.y, imageLayout.width, imageLayout.height);
        ctx.clip();
      }
      ctx.beginPath(); ctx.moveTo(x, y);
      return;
    }
    if (toolRef.current === 'line' || toolRef.current === 'circle') {
      try {
        canvasSnapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      } catch {}
      ctx.lineWidth = 3;
      ctx.strokeStyle = drawColor;
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    if (toolRef.current === 'pencil' || toolRef.current === 'eraser') {
      if (imageLayout) {
        if (x < imageLayout.x || y < imageLayout.y || x > imageLayout.x + imageLayout.width || y > imageLayout.y + imageLayout.height) {
          return;
        }
      }
      ctx.lineTo(x, y); ctx.stroke();
    } else if (toolRef.current === 'circle' || toolRef.current === 'line') {
      const sp = startPointRef.current; if (!sp || !canvasRef.current) return;
      if (canvasSnapshotRef.current) {
        ctx.putImageData(canvasSnapshotRef.current, 0, 0);
      }
      if (imageLayout) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(imageLayout.x, imageLayout.y, imageLayout.width, imageLayout.height);
        ctx.clip();
      }
      ctx.beginPath();
      if (toolRef.current === 'line') {
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(x, y);
      } else {
        const radius = Math.hypot(x - sp.x, y - sp.y);
        ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
      }
      ctx.stroke();
      if (imageLayout) {
        ctx.restore();
      }
    }
  };
  const endDraw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && toolRef.current === 'pencil') {
      ctx.closePath();
      if (imageLayout) ctx.restore();
    }
    drawingRef.current = false;
    startPointRef.current = null;
    canvasSnapshotRef.current = null;
  };

  const loadCommentsAndAnnotations = useCallback(async () => {
    if (!selectedKeyframe) return;
    const keyframeForQuery = normalizeKeyframeUrl(selectedKeyframe);
    console.log('🔄 loadCommentsAndAnnotations - usando POST (nuevo código)');
    try {
      // Usar POST para evitar error 431 cuando keyframeUrl es muy largo (data URL base64)
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyframeUrl: keyframeForQuery, action: 'list' }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeyframeComments(Array.isArray(data.comments) ? data.comments : []);
      } else { setKeyframeComments([]); }
    } catch { setKeyframeComments([]); }
    try {
      // Usar POST para evitar error 431 cuando keyframeUrl es muy largo (data URL base64)
      console.log('🔄 Cargando anotaciones - usando POST (nuevo código)');
      const res2 = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyframeUrl: keyframeForQuery, action: 'list' }),
      });
      if (res2.ok) {
        const data2 = await res2.json();
        setAnnotations(Array.isArray(data2.annotations) ? data2.annotations : []);
      } else { setAnnotations([]); }
    } catch { setAnnotations([]); }
  }, [selectedKeyframe, safeAnalysis.id]);

  useEffect(() => {
    if (isModalOpen) { void loadCommentsAndAnnotations(); }
  }, [isModalOpen, loadCommentsAndAnnotations]);

  useEffect(() => {
    if (!isModalOpen) return;
    void loadCommentsAndAnnotations();
    // Enfocar el textarea para comentar al cambiar de fotograma
    window.setTimeout(() => {
      commentInputRef.current?.focus();
    }, 0);
  }, [selectedKeyframe, isModalOpen, loadCommentsAndAnnotations]);

  useEffect(() => {
    if (!isModalOpen) return;
    const container = imageContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      clearCanvas();
    }
    const natural = imageNaturalSizeRef.current;
    if (natural?.width && natural?.height) {
      const scale = Math.min(nextWidth / natural.width, nextHeight / natural.height);
      const displayW = Math.round(natural.width * scale);
      const displayH = Math.round(natural.height * scale);
      const offsetX = Math.round((nextWidth - displayW) / 2);
      const offsetY = Math.round((nextHeight - displayH) / 2);
      setImageLayout({ x: offsetX, y: offsetY, width: displayW, height: displayH });
    } else {
      setImageLayout(null);
    }
  }, [isModalOpen, isExpanded, selectedKeyframe, clearCanvas]);

  // Cargar entrenadores cuando se abre el diálogo
  useEffect(() => {
    if (!coachSelectionDialogOpen) return;
    
    try {
      const colRef = collection(db as any, 'coaches');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as any;
          const rawRate = data.ratePerAnalysis;
          const parsedRate = typeof rawRate === 'number'
            ? rawRate
            : typeof rawRate === 'string'
              ? Number(rawRate.replace(/[^0-9.-]/g, ''))
              : undefined;
          const rawShowRate = data.showRate;
          const parsedShowRate = typeof rawShowRate === 'boolean'
            ? rawShowRate
            : typeof rawShowRate === 'string'
              ? rawShowRate.toLowerCase() === 'true'
              : rawShowRate;
          return {
            id: d.id,
            ...data,
            ratePerAnalysis: Number.isFinite(parsedRate) ? parsedRate : undefined,
            showRate: parsedShowRate,
          } as Coach;
        });
        setCoaches(list);
        setCoachesLoading(false);
      }, (err) => {
        console.error('Error cargando entrenadores:', err);
        setCoachesLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error inicializando carga de entrenadores:', e);
      setCoachesLoading(false);
    }
  }, [coachSelectionDialogOpen]);

  // Panel: subir JSON y analizar
  const [jsonFileName, setJsonFileName] = useState<string>("");
  const [jsonFrames, setJsonFrames] = useState<any[] | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<any | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  const onJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setJsonFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(data.frames)) {
          setJsonFrames(data.frames);
          setAnalyzeResult(null);
        } else {
          alert("JSON inválido: falta frames");
        }
      } catch {
        alert("No se pudo parsear JSON");
      }
    };
    reader.readAsText(f);
  };

  const analyzeJsonFrames = async () => {
    if (!jsonFrames) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: jsonFrames }),
      });
      const data = await res.json();
      setAnalyzeResult(data);
    } finally {
      setAnalyzing(false);
    }
  };

  const openKeyframeModal = (keyframeUrl: string, angleKey: 'front'|'back'|'left'|'right', index: number) => {
        console.log(`🔍 Keyframes disponibles para ${angleKey}:`, (localKeyframes as any)[angleKey]);
    console.log(`🧠 Smart keyframes disponibles para ${angleKey}:`, (smartKeyframes as any)[angleKey]);
    // Resetear herramienta para no confundir al comentar
    toolRef.current = 'pencil';
    setIsCommentFocused(false);
    
    setSelectedKeyframe(keyframeUrl);
    setSelectedAngle(angleKey);
    setSelectedIndex(index);
    
    // Guardar la serie completa de keyframes para navegación
    // Priorizar smart keyframes, luego keyframes tradicionales
    const smartAngleKeyframes = (smartKeyframes as any)[angleKey] as Array<{ imageBuffer: string }> | undefined;
    const traditionalAngleKeyframes = (localKeyframes as any)[angleKey] as string[] | undefined;
    
    let angleKeyframes: string[] = [];
    
    if (Array.isArray(smartAngleKeyframes) && smartAngleKeyframes.length > 0) {
      // Usar smart keyframes (data URLs)
      angleKeyframes = smartAngleKeyframes
        .map(kf => normalizeImageSrc(kf.imageBuffer))
        .filter((src) => Boolean(src));
    } else if (Array.isArray(traditionalAngleKeyframes) && traditionalAngleKeyframes.length > 0) {
      // Usar keyframes tradicionales (URLs)
      angleKeyframes = traditionalAngleKeyframes.map((kf) => normalizeKeyframeUrl(kf));
          }
    
        if (angleKeyframes.length > 0) {
      setCurrentKeyframes(angleKeyframes);
          } else {
            setCurrentKeyframes([]);
    }
    
    setIsModalOpen(true);
  };


  const generateKeyframesFromClient = async () => {
    try {
      setUploadingFromClient(true);
      setKeyframesGenStatus('Iniciando generación de fotogramas…');
      const isDev = process.env.NODE_ENV !== 'production';

      const generateKeyframesOnServer = async () => {
        const res = await fetch(`/api/analyses/${safeAnalysis.id}/rebuild-keyframes/dev`, { method: 'POST' });
        const data = await res.json();
        const hasAny = data?.keyframes && ['front','back','left','right'].some((k: string) => Array.isArray(data.keyframes[k]) && data.keyframes[k].length > 0);
        if (!res.ok || !data?.keyframes || !hasAny) {
          throw new Error(data?.error || 'No se pudieron generar fotogramas en el servidor.');
        }
        setLocalKeyframes(data.keyframes);
        setKeyframesGenStatus('Fotogramas generados en servidor.');
        return true;
      };

      if (isDev) {
        try {
          const ok = await generateKeyframesOnServer();
          if (ok) return;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'No se pudieron generar en el servidor.';
          setKeyframesGenStatus(`Servidor falló: ${message}. Probando desde el video…`);
          toast({
            title: 'Fallback a cliente',
            description: `${message} Intentando extraer desde el video…`,
            variant: 'destructive',
          });
        }
      }

      const findCandidateVideo = () => {
        const tagged = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-analysis-video]'));
        const visibleTagged = tagged.filter((el) => el.offsetParent !== null);
        const fromTagged = (visibleTagged.length ? visibleTagged : tagged).find((el) => el.currentSrc || el.src);
        if (fromTagged) return fromTagged;
        const fallback = document.querySelector('video') as HTMLVideoElement | null;
        return fallback || null;
      };

      // Intentar extraer 12 frames desde el video visible del DOM
      const videoEl = findCandidateVideo();
      if (!videoEl) {
        setKeyframesGenStatus('No se encontró un video visible para extraer fotogramas.');
        toast({
          title: 'Sin video',
          description: 'No se encontró un video visible para extraer fotogramas.',
          variant: 'destructive',
        });
        return;
      }
      const hasSrc = Boolean(videoEl.currentSrc || videoEl.src);
      if (!hasSrc) {
        setKeyframesGenStatus('El video todavía no tiene fuente válida.');
        toast({
          title: 'Video no cargado',
          description: 'El video no tiene una fuente válida todavía.',
          variant: 'destructive',
        });
        return;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setKeyframesGenStatus('No se pudo crear el canvas para extraer fotogramas.');
        toast({
          title: 'Error',
          description: 'No se pudo crear el canvas para extraer fotogramas.',
          variant: 'destructive',
        });
        return;
      }
      await new Promise<void>((resolve, reject) => {
        if (videoEl.readyState >= 2) return resolve();
        const onLoaded = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('No se pudo cargar el video')); };
        const cleanup = () => {
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          videoEl.removeEventListener('error', onError);
        };
        videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
        videoEl.addEventListener('error', onError, { once: true });
      });
      if (!Number.isFinite(videoEl.duration) || videoEl.duration <= 0) {
        setKeyframesGenStatus('La duracion del video no es valida para extraer fotogramas.');
        toast({
          title: 'Video inválido',
          description: 'La duración del video no es válida para extraer fotogramas.',
          variant: 'destructive',
        });
        return;
      }
      const count = 12; const urls: Array<{ dataUrl: string; timestamp: number }> = [];
      canvas.width = Math.max(160, videoEl.videoWidth/4|0); canvas.height = Math.max(160, (videoEl.videoHeight/videoEl.videoWidth*canvas.width)|0);
      const interval = Math.max(0.1, Math.min( (videoEl.duration||6)/(count+1), 2 ));
      for (let i=1;i<=count;i++){
        const t = Math.min(videoEl.duration-0.001, i*interval);
        videoEl.pause();
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => { cleanup(); resolve(); };
          const onError = () => { cleanup(); reject(new Error('Error al posicionar el video')); };
          const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error('Timeout al posicionar el video'));
          }, 5000);
          const cleanup = () => {
            window.clearTimeout(timeoutId);
            videoEl.removeEventListener('seeked', onSeeked);
            videoEl.removeEventListener('error', onError);
          };
          videoEl.addEventListener('seeked', onSeeked);
          videoEl.addEventListener('error', onError);
          videoEl.currentTime = t;
        });
        ctx.drawImage(videoEl, 0,0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        urls.push({ dataUrl, timestamp: t });
      }
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframes/upload`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ angle:'front', frames: urls }) });
      const data = await res.json();
      if (res.ok && data?.keyframes) {
        setLocalKeyframes(data.keyframes);
        setKeyframesGenStatus('Fotogramas generados y guardados.');
      }
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudieron guardar los fotogramas.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron generar los fotogramas.';
      setKeyframesGenStatus(message);
      if (process.env.NODE_ENV !== 'production' && message.toLowerCase().includes('tainted')) {
        try {
          await fetch(`/api/analyses/${safeAnalysis.id}/rebuild-keyframes/dev`, { method: 'POST' });
          return;
        } catch {}
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally { setUploadingFromClient(false); }
  };

  // Funciones de navegación entre keyframes
  const navigateToKeyframe = (direction: 'prev' | 'next') => {
    console.log(`🔄 Navegando ${direction}:`, {
      selectedIndex,
      currentKeyframesLength: currentKeyframes.length,
      currentKeyframes: currentKeyframes
    });
    
    if (selectedIndex === null || currentKeyframes.length === 0) {
            return;
    }
    
    let newIndex = selectedIndex;
    if (direction === 'prev') {
      newIndex = Math.max(0, selectedIndex - 1);
    } else {
      newIndex = Math.min(currentKeyframes.length - 1, selectedIndex + 1);
    }
    
    console.log(`📍 Nuevo índice: ${newIndex} (era ${selectedIndex})`);
    
    if (newIndex !== selectedIndex && currentKeyframes[newIndex]) {
            setSelectedKeyframe(currentKeyframes[newIndex]);
      setSelectedIndex(newIndex);
      // Limpiar canvas al cambiar de keyframe
      clearCanvas();
    } else {
          }
  };

  // Variables calculadas para navegación
  const canNavigatePrev = selectedIndex !== null && selectedIndex > 0;
  const canNavigateNext = selectedIndex !== null && selectedIndex < currentKeyframes.length - 1;
  
      // Navegación con teclado
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isModalOpen) return;
      const target = event.target as HTMLElement | null;
      if (isCommentFocused) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      
      if (event.key === 'ArrowLeft' && canNavigatePrev) {
        event.preventDefault();
        navigateToKeyframe('prev');
      } else if (event.key === 'ArrowRight' && canNavigateNext) {
        event.preventDefault();
        navigateToKeyframe('next');
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModalOpen, canNavigatePrev, canNavigateNext, navigateToKeyframe, isCommentFocused]);

  const saveComment = async () => {
    if (!canComment || !selectedKeyframe) return;
    const text = newComment.trim(); if (!text) return;
    try {
      toolRef.current = 'move';
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      const body: any = { keyframeUrl: normalizeKeyframeUrl(selectedKeyframe), comment: text };
      if (selectedAngle) body.angle = selectedAngle; if (typeof selectedIndex === 'number') body.index = selectedIndex;
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body)
      });
      if (res.ok) {
        setNewComment("");
        await loadCommentsAndAnnotations();
        return;
      }
      let errorMessage = 'No se pudo guardar el comentario.';
      try {
        const errorData = await res.json();
        errorMessage = errorData?.error || errorMessage;
      } catch {
        const errorText = await res.text().catch(() => '');
        if (errorText) errorMessage = errorText;
      }
      toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
    } catch (e: any) {
      toast({
        title: 'Error al guardar',
        description: e?.message || 'No se pudo guardar el comentario.',
        variant: 'destructive',
      });
    }
  };

  const saveAnnotation = async () => {
    setIsCommentFocused(false);
    if (!canEdit) {
      setAnnotationStatus('Sin permisos para guardar.');
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para editar este análisis.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedKeyframe) {
      setAnnotationStatus('No hay fotograma seleccionado.');
      toast({
        title: 'Error',
        description: 'No hay fotograma seleccionado.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!canvasRef.current) {
      setAnnotationStatus('No se pudo acceder al canvas.');
      toast({
        title: 'Error',
        description: 'Error al acceder al canvas de dibujo.',
        variant: 'destructive',
      });
      return;
    }

    if (!drawingRef.current && toolRef.current === 'move') {
      setAnnotationStatus('Selecciona una herramienta para dibujar.');
      toast({
        title: 'Selecciona una herramienta',
        description: 'Elegí lápiz, línea o círculo para dibujar antes de guardar.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar si el canvas tiene contenido
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({
        title: 'Error',
        description: 'Error al acceder al contexto del canvas.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar dimensiones del canvas
    if (canvas.width === 0 || canvas.height === 0) {
      toast({
        title: 'Error',
        description: 'El canvas no tiene dimensiones válidas.',
        variant: 'destructive',
      });
      console.error('Canvas dimensions:', { width: canvas.width, height: canvas.height });
      return;
    }

    // Verificar si hay píxeles dibujados (canvas no está vacío)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let hasContent = false;
    // Verificar todos los canales (R, G, B, A) para detectar cualquier contenido dibujado
    // Un canvas vacío tendría todos los valores en 0
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      // Si hay algún píxel con contenido (alpha > 0 o cualquier color)
      if (a > 0 || r > 0 || g > 0 || b > 0) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      setAnnotationStatus('Canvas vacío. Dibuja algo primero.');
      toast({
        title: 'Canvas vacío',
        description: 'No hay nada dibujado para guardar. Dibuja algo primero.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingAnnotation(true);
      setAnnotationStatus('Guardando dibujo…');
      console.log('Iniciando guardado de anotación...', {
        analysisId: safeAnalysis.id,
        keyframeUrl: selectedKeyframe,
        canvasSize: { width: canvas.width, height: canvas.height }
      });

      const overlayDataUrl = canvas.toDataURL('image/png');
      if (!overlayDataUrl || !overlayDataUrl.startsWith('data:image/png')) {
        throw new Error('Error al generar la imagen del canvas');
      }

      // Verificar tamaño del body antes de enviar
      const bodySizeEstimate = overlayDataUrl.length + (selectedKeyframe?.length || 0);
      const maxSize = 10 * 1024 * 1024; // 10MB límite aproximado
      if (bodySizeEstimate > maxSize) {
        throw new Error(`El dibujo es demasiado grande (${(bodySizeEstimate / 1024 / 1024).toFixed(2)}MB). Intenta dibujar algo más simple.`);
      }

      const auth = getAuth();
      const cu = auth.currentUser;
      
      if (!cu) {
        setAnnotationStatus('Debes iniciar sesión para guardar.');
        toast({
          title: 'Sin autenticación',
          description: 'Debes iniciar sesión para guardar dibujos.',
          variant: 'destructive',
        });
        return;
      }

      const token = await getIdToken(cu, true);
      if (!token) {
        setAnnotationStatus('No se pudo obtener token.');
        throw new Error('No se pudo obtener el token de autenticación');
      }

      const body: any = { keyframeUrl: normalizeKeyframeUrl(selectedKeyframe), overlayDataUrl };
      
      if (selectedAngle) body.angle = selectedAngle;
      if (typeof selectedIndex === 'number') body.index = selectedIndex;

      const bodyString = JSON.stringify(body);
      console.log('Enviando petición a API...', {
        url: `/api/analyses/${safeAnalysis.id}/keyframe-annotations`,
        hasAngle: !!selectedAngle,
        hasIndex: typeof selectedIndex === 'number',
        overlayDataUrlLength: overlayDataUrl.length,
        keyframeUrlLength: selectedKeyframe?.length || 0,
        bodySize: bodyString.length,
        bodySizeMB: (bodyString.length / 1024 / 1024).toFixed(2)
      });
      
      let res: Response;
      try {
        res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-annotations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: bodyString
        });
      } catch (fetchError: any) {
        console.error('Error en fetch:', fetchError);
        // Capturar errores de conexión específicos
        if (fetchError?.message?.includes('431') || fetchError?.message?.includes('Request Header Fields Too Large')) {
          throw new Error('El dibujo es demasiado grande. Por favor, dibuja algo más simple.');
        }
        if (fetchError?.message?.includes('413') || fetchError?.message?.includes('Payload Too Large')) {
          throw new Error('El dibujo es demasiado grande. Por favor, dibuja algo más simple.');
        }
        throw new Error(`Error de conexión: ${fetchError?.message || 'Desconocido'}`);
      }

      console.log('Respuesta del servidor:', { status: res.status, ok: res.ok, statusText: res.statusText });

      if (!res.ok) {
        let errorData: any;
        try {
          errorData = await res.json();
        } catch (jsonError) {
          // Si no se puede parsear JSON, leer como texto
          const textError = await res.text().catch(() => 'Error desconocido');
          errorData = { error: textError || `Error ${res.status}: ${res.statusText}` };
        }
        console.error('Error del servidor:', { status: res.status, errorData });
        
        // Manejar errores específicos
        if (res.status === 431) {
          throw new Error('El dibujo es demasiado grande. Por favor, dibuja algo más simple.');
        }
        if (res.status === 413) {
          throw new Error('El dibujo es demasiado grande. Por favor, dibuja algo más simple.');
        }
        
        throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      console.log('Anotación guardada exitosamente:', result);
      
      clearCanvas();
      await loadCommentsAndAnnotations();
      setAnnotationStatus('Dibujo guardado correctamente.');
      
      toast({
        title: 'Dibujo guardado',
        description: 'El dibujo se ha guardado correctamente.',
      });
    } catch (e) {
      console.error('Error guardando anotación:', e);
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido al guardar el dibujo';
      setAnnotationStatus(errorMessage);
      toast({
        title: 'Error al guardar',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSavingAnnotation(false);
    }
  };

  const deleteLatestAnnotation = async () => {
    if (!canEdit) {
      toast({
        title: 'Sin permisos',
        description: 'No tenés permisos para eliminar anotaciones.',
        variant: 'destructive',
      });
      return;
    }
    const latest = annotations[0];
    if (!latest?.id) {
      toast({
        title: 'Sin anotaciones',
        description: 'No hay anotaciones guardadas para eliminar.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) return;
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          annotationId: latest.id,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'No se pudo eliminar la anotación.');
      }
      setAnnotationStatus('Anotación eliminada.');
      await loadCommentsAndAnnotations();
    } catch (e: any) {
      console.error('deleteLatestAnnotation error', e);
      toast({
        title: 'Error',
        description: e?.message || 'No se pudo eliminar la anotación.',
        variant: 'destructive',
      });
    }
  };

  const reorderKeyframe = async (angle: 'front'|'back'|'left'|'right', index: number, dir: -1|1) => {
    const arr = localKeyframes[angle] || []; const ni = index + dir; if (ni < 0 || ni >= arr.length) return;
    const order = Array.from({ length: arr.length }, (_, i) => i);
    [order[index], order[ni]] = [order[ni], order[index]];
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ action: 'reorder', angle, order }) });
      if (res.ok) {
        const newArr = order.map(i => arr[i]);
        setLocalKeyframes(prev => ({ ...prev, [angle]: newArr }));
      }
    } catch {}
  };

  const deleteKeyframe = async (angle: 'front'|'back'|'left'|'right', index: number) => {
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ action: 'delete', angle, index }) });
      if (res.ok) {
        setLocalKeyframes(prev => ({ ...prev, [angle]: (prev[angle] || []).filter((_, i) => i !== index) }));
      }
    } catch {}
  };

  const [attemptsDirty, setAttemptsDirty] = useState(false);
  const [savingAttempts, setSavingAttempts] = useState(false);
  const [showAttempts, setShowAttempts] = useState(true);

  const updateAttempt = (idx: number, field: 'start' | 'end', value: number) => {
    setAttemptsState(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    setAttemptsDirty(true);
  };

  const validateAttempts = (arr: Array<{ start: number; end: number }>) => {
    if (!arr.every(a => a.start >= 0 && a.end > a.start)) return false;
    const s = [...arr].sort((x, y) => x.start - y.start);
    for (let i = 1; i < s.length; i++) if (s[i].start < s[i - 1].end) return false;
    return true;
  };

  const saveAttempts = async () => {
    if (!validateAttempts(attemptsState)) return;
    setSavingAttempts(true);
    try {
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempts: attemptsState }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setAttemptsDirty(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAttempts(false);
    }
  };

  // Función para generar ejercicios (temporalmente deshabilitada)
  const handleGenerateDrills = async () => {
    setIsLoadingDrills(true);
    setError(null);
    
    try {
      // TODO: Implementar cuando getDrills esté disponible
      console.log('Generando ejercicios para:', safeAnalysis.shotType);
      
      // Simular carga
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ejercicios de ejemplo
      const mockDrills: Drill[] = [
        {
          name: "Ejercicio de Forma Básica",
          targetIssue: "Mejorar la forma del tiro",
          instructions: ["Practica el movimiento sin pelota", "Enfócate en la posición de los pies"],
          setsReps: "3 series de 10 repeticiones",
          progression: "Añadir pelota cuando domines el movimiento",
          successCriteria: "Movimiento fluido y consistente",
          safety: "Mantén la espalda recta"
        }
      ];
      
      setDrills(mockDrills);
    } catch (err) {
      setError('Error al generar ejercicios');
      console.error(err);
    } finally {
      setIsLoadingDrills(false);
    }
  };

  const handleChecklistChange = (
    categoryName: string,
    itemId: string,
    newRating: DetailedChecklistItem["rating"],
    newComment: string,
    newRating10?: number,
    newNA?: boolean
  ) => {
    setChecklistState((prevState) => {
      const updated = prevState.map((category) =>
        category.category === categoryName
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      rating: newRating,
                      // mantener comment (IA) intacto; guardar en coachComment
                      coachComment: newComment,
                      ...(typeof newRating10 === 'number' ? { rating10: newRating10 } : {}),
                      ...(typeof newNA === 'boolean' ? { na: newNA } : {})
                    }
                  : item
              ),
            }
          : category
      );

      // Guardado automático (coach asignado)
      (async () => {
        try {
          const auth = getAuth();
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          const token = await getIdToken(currentUser, true);
          await fetch(`/api/analyses/${safeAnalysis.id}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ detailedChecklist: updated, fluidezScore10 })
          });
        } catch (e) {
          console.warn('No se pudo guardar rating automáticamente', e);
        }
      })();

      return updated;
    });
  };

  // (ya calculados arriba) checklistStrengths, checklistWeaknesses, checklistRecommendations
  const coachFeedbackItemsByCategory = useMemo(() => {
    return checklistState
      .map((cat) => {
        const items = cat.items.filter((it) => {
          const cf = coachFeedbackByItemId[it.id];
          return Boolean(cf && (typeof cf.rating === 'number' || String(cf.comment || '').trim() !== ''));
        });
        return { category: cat.category, items };
      })
      .filter((cat) => cat.items.length > 0);
  }, [checklistState, coachFeedbackByItemId]);

  // Resumen dinámico de revisión del entrenador
  const coachReviewSummary = useMemo(() => {
    const items = checklistState.flatMap((c) => c.items.map((it) => ({ id: it.id, name: it.name, ia: it.rating })));
    let reviewed = 0;
    let agreed = 0;
    let changed = 0;
    let sumCoach = 0;
    const diffs: Array<{ id: string; name: string; ia: number; coach: number }> = [];
    for (const it of items) {
      const cf = coachFeedbackByItemId[it.id];
      if (cf && typeof cf.rating === 'number') {
        if (typeof it.ia !== 'number') {
          continue;
        }
        reviewed += 1;
        // Convertir rating del coach de escala 1-5 a 1-100 (igual que la IA)
        const coachRating100 = (cf.rating / 5) * 100;
        sumCoach += coachRating100;
        // Comparar en escala 1-100: convertir it.ia si está en 1-5, o usar directamente si ya está en 1-100
        const iaRating100 = it.ia <= 5 ? (it.ia / 5) * 100 : it.ia;
        if (Math.abs(coachRating100 - iaRating100) < 0.01) agreed += 1; else { 
          changed += 1; 
          diffs.push({ id: it.id, name: it.name, ia: iaRating100, coach: coachRating100 }); 
        }
      }
    }
    // Promedio ya está en escala 1-100
    const avgCoach = reviewed > 0 ? Number((sumCoach / reviewed).toFixed(2)) : null;
    return { reviewed, agreed, changed, avgCoach, diffs };
  }, [checklistState, coachFeedbackByItemId]);

  // Calcular score del coach usando los mismos pesos que la IA
  const coachScore = useMemo(() => {
    const scoreMetadata = (analysis as any).scoreMetadata;
    if (!scoreMetadata || Object.keys(coachFeedbackByItemId).length === 0) return null;

    // Obtener los pesos según el tipo de tiro (igual que la IA)
    const shotType = scoreMetadata.shotTypeKey || scoreMetadata.shotType || 'tres';
    const weights = getDefaultWeights(shotType);
    
    // Calcular score usando la misma lógica que computeFinalScoreExactWeights
    let numerator = 0;
    let denominator = 0;
    let evaluableCount = 0;

    for (const category of checklistState) {
      for (const item of category.items) {
        const cf = coachFeedbackByItemId[item.id];
        if (!cf || typeof cf.rating !== 'number') continue;
        
        // Verificar si el item es evaluable (no N/A)
        if ((item as any).na || item.status === 'no_evaluable') continue;
        
        evaluableCount++;
        const rating = Math.max(1, Math.min(5, cf.rating));
        const percent = (rating / 5) * 100;
        
        // Usar el peso real del item (igual que la IA)
        const weight = getItemWeight(item.id, weights);
        if (weight <= 0) continue; // Saltar items sin peso
        
        numerator += weight * percent;
        denominator += weight;
      }
    }

    if (denominator <= 0) return null;
    const finalScore = numerator / denominator;
    return Number(Math.max(0, Math.min(100, finalScore)).toFixed(2));
  }, [checklistState, coachFeedbackByItemId, analysis]);

  const normalizeImageSrc = (src?: string | null) => {
    if (!src) return '';
    if (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
      return src;
    }
    if (src.startsWith('data:')) return src;
    return `data:image/jpeg;base64,${src}`;
  };

  const normalizeKeyframeUrl = (src?: string | null) => {
    if (!src) return '';
    if (!src.startsWith('http')) return src;
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "shotanalisys.firebasestorage.app";
    if (src.includes('storage.googleapis.com/undefined/')) {
      return src.replace('storage.googleapis.com/undefined/', `storage.googleapis.com/${bucket}/`);
    }
    return src;
  };

  const resolveVideoSrc = (src?: string | null) => {
    return normalizeVideoUrl(src);
  };

  // Función para renderizar smart keyframes (data URLs)
  const renderSmartKeyframes = (keyframes: Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }>, angleLabel: string, angleKey: 'front'|'back'|'left'|'right') => {
        if (!keyframes || keyframes.length === 0) {
            return <div className="text-center py-4 text-muted-foreground">No hay fotogramas disponibles</div>;
    }
    
    return (
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6 justify-items-center">
        {keyframes.map((keyframe, index) => {
          const imageSrc = normalizeImageSrc(keyframe.imageBuffer);
          if (!imageSrc) {
            return (
              <div key={`${angleKey}-${index}`} className="space-y-2 text-center">
                <div className="flex items-center justify-center rounded-lg border w-24 h-24 md:w-28 md:h-28 text-xs text-muted-foreground">
                  Sin imagen
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  <div className="font-medium">Frame {index + 1}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={`${angleKey}-${index}`} className="space-y-2 text-center">
              {/* Botón con imagen */}
              <button 
                onClick={() => openKeyframeModal(imageSrc, angleKey, index)} 
                className="relative overflow-hidden rounded-lg border aspect-square focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:scale-105 w-24 h-24 md:w-28 md:h-28"
              >
                {/* Imagen usando data URL */}
                <img
                  src={imageSrc}
                  alt={`Fotograma ${angleLabel} ${index + 1}`}
                  className="aspect-square object-cover w-full h-full"
                  onError={(e) => {
                    console.error(`❌ Error cargando smart keyframe ${keyframe.imageBuffer}:`, e);
                  }}
                  onLoad={() => {
                                      }}
                />
              </button>
              
              {/* Solo el número del frame */}
              <div className="text-center text-xs text-muted-foreground">
                <div className="font-medium">Frame {index + 1}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderKeyframes = (keyframes: string[], angleLabel: string, angleKey: 'front'|'back'|'left'|'right') => {
        if (!keyframes || keyframes.length === 0) {
            return <div className="text-center py-4 text-muted-foreground">No hay fotogramas disponibles</div>;
    }
    
    return (
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6 justify-items-center">
        {keyframes.map((keyframe, index) => {
          const fixedKeyframe = normalizeKeyframeUrl(keyframe);
                    return (
            <div key={`${angleKey}-${index}`} className="space-y-2 text-center">
              {/* Botón con imagen */}
              <button 
                onClick={() => openKeyframeModal(fixedKeyframe, angleKey, index)} 
                className="relative overflow-hidden rounded-lg border aspect-square focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:scale-105 w-24 h-24 md:w-28 md:h-28"
              >
                {/* Imagen de Next.js */}
                <Image
                  src={fixedKeyframe}
                  alt={`Fotograma ${angleLabel} ${index + 1}`}
                  width={112}
                  height={112}
                  className="aspect-square object-cover w-full h-full"
                  data-ai-hint="basketball shot"
                  onError={(e) => {
                    console.error(`❌ Error cargando imagen Next.js ${keyframe}:`, e);
                  }}
                  onLoad={() => {
                                      }}
                />
              </button>
              
              {canEdit && (
                <div className="flex items-center justify-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => reorderKeyframe(angleKey, index, -1)} disabled={index === 0}>◀</Button>
                  <Button variant="ghost" size="sm" onClick={() => reorderKeyframe(angleKey, index, 1)} disabled={index === (keyframes.length - 1)}>▶</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteKeyframe(angleKey, index)}>Eliminar</Button>
                </div>
              )}

              {/* Fallback si la imagen falla */}
              <div className="text-center text-xs text-muted-foreground">
                Keyframe {index + 1}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const defaultTab = 'ai-analysis';
  const getValidTabs = () => ([
    'ai-analysis',
    'videos',
    'checklist',
    'coach-checklist',
    'messages',
    ...(isCoach ? [] : ['improvement-plan']),
  ]);
  // Inicializar el tab desde el hash si existe
  const getInitialTab = () => {
    if (typeof window === 'undefined') return defaultTab;
    const hash = window.location.hash.slice(1);
    const validTabs = getValidTabs();
    if (hash && validTabs.includes(hash)) {
      return hash;
    }
    return defaultTab;
  };
  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Ref para rastrear si el cambio viene de un click manual (para evitar conflictos con useEffect)
  const isManualChangeRef = useRef(false);
  const searchParams = useSearchParams();
  const autoOpenHandledRef = useRef(false);

  useEffect(() => {
    if (autoOpenHandledRef.current) return;
    const angleParam = searchParams.get('kfAngle') as ('front'|'back'|'left'|'right'|null);
    const indexParam = searchParams.get('kfIndex');
    const index = indexParam != null ? Number(indexParam) : NaN;
    if (!angleParam || !Number.isFinite(index) || index < 0) return;

    let targetUrl = '';
    const smartArr = (smartKeyframes as any)[angleParam] as Array<{ imageBuffer: string }> | undefined;
    if (Array.isArray(smartArr) && smartArr[index]) {
      targetUrl = normalizeImageSrc(smartArr[index].imageBuffer);
    }
    const traditionalArr = (localKeyframes as any)[angleParam] as string[] | undefined;
    if (!targetUrl && Array.isArray(traditionalArr) && traditionalArr[index]) {
      targetUrl = normalizeKeyframeUrl(traditionalArr[index]);
    }
    if (!targetUrl) return;

    autoOpenHandledRef.current = true;
    setActiveTab('videos');
    openKeyframeModal(targetUrl, angleParam, index);
  }, [searchParams, smartKeyframes, localKeyframes, normalizeImageSrc, normalizeKeyframeUrl]);

  // Handler personalizado para cambios manuales de tab
  const handleTabChange = useCallback((value: string) => {
    console.log(`[AnalysisView] 🖱️ Cambio manual de tab a: ${value}`);
    isManualChangeRef.current = true;
    setActiveTab(value);
    // Actualizar hash inmediatamente para cambios manuales
    if (typeof window !== 'undefined' && !isInitialLoad) {
      if (value === defaultTab) {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        const newHash = `#${value}`;
        if (window.location.hash !== newHash) {
          window.history.replaceState(null, '', `${window.location.pathname}${newHash}`);
        }
      }
    }
    // Resetear la bandera después de un pequeño delay
    setTimeout(() => {
      isManualChangeRef.current = false;
    }, 100);
  }, [defaultTab, isInitialLoad]);

  // Manejar hash de URL para navegación directa a tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleHashChange = () => {
      // Ignorar si el cambio viene de un click manual
      if (isManualChangeRef.current) {
        console.log('[AnalysisView] ⏭️ Ignorando hashchange porque es cambio manual');
        return;
      }

      const hash = window.location.hash.slice(1); // Remover el #
      const validTabs = getValidTabs();
      
      console.log(`[AnalysisView] 🔍 Verificando hash: "${hash}", showCoachChecklistTab: ${showCoachChecklistTab}`);
      
      if (hash && validTabs.includes(hash)) {
        // Verificar que el tab esté disponible (especialmente para coach-checklist)
        if (hash === 'coach-checklist' && !showCoachChecklistTab) {
          console.log('[AnalysisView] ⚠️ Tab coach-checklist solicitado pero no está disponible aún, esperando...');
          // Si el tab no está disponible pero se está cargando, esperar un poco más
          if (isInitialLoad) {
            setTimeout(() => {
              if (showCoachChecklistTab && !isManualChangeRef.current) {
                console.log('[AnalysisView] ✅ Tab coach-checklist ahora disponible, activando...');
                setActiveTab(hash);
              }
            }, 500);
          }
          return;
        }
        // Solo cambiar si el tab actual es diferente
        if (activeTab !== hash) {
          console.log(`[AnalysisView] 🔗 Cambiando tab desde hash: ${hash}`);
          setActiveTab(hash);
          
          // Hacer scroll suave al inicio del contenido de tabs después de un pequeño delay
          // para asegurar que el tab se haya renderizado
          setTimeout(() => {
            // Buscar el elemento del tab activo o el contenedor de tabs
            const activeTabContent = document.querySelector(`[data-state="active"]`) || 
                                     document.querySelector('[role="tabpanel"]') ||
                                     document.querySelector('.tabs-content');
            if (activeTabContent) {
              activeTabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              // Fallback: scroll al inicio de la página
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }, 300);
        }
      } else if (!hash && isInitialLoad) {
        // Si no hay hash en la carga inicial, usar el tab por defecto
        setActiveTab(defaultTab);
      }
    };

    // Ejecutar al montar con un delay para asegurar que el componente esté renderizado
    const timeoutId = setTimeout(() => {
      handleHashChange();
      setIsInitialLoad(false);
    }, 200);

    // Escuchar cambios en el hash
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [showCoachChecklistTab, isInitialLoad, activeTab, isCoach]);

  // Re-verificar el hash cuando showCoachChecklistTab cambie (por si se estaba esperando)
  useEffect(() => {
    if (typeof window === 'undefined' || !showCoachChecklistTab || isManualChangeRef.current) return;
    const hash = window.location.hash.slice(1);
    if (hash === 'coach-checklist' && activeTab !== 'coach-checklist') {
      console.log('[AnalysisView] ✅ Tab coach-checklist ahora disponible, activando desde hash...');
      setActiveTab('coach-checklist');
      setTimeout(() => {
        const activeTabContent = document.querySelector(`[data-state="active"]`) || 
                                 document.querySelector('[role="tabpanel"]');
        if (activeTabContent) {
          activeTabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [showCoachChecklistTab, activeTab]);

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full flex gap-2 overflow-x-auto flex-nowrap md:grid md:grid-cols-5">
          <TabsTrigger value="ai-analysis" className="min-w-[140px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <Bot className="mr-2" /> {analysisTabLabel}
          </TabsTrigger>
          <TabsTrigger value="videos" className="min-w-[180px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <Camera className="mr-2" /> Videos y fotogramas
          </TabsTrigger>
          <TabsTrigger value="checklist" className="min-w-[120px] md:min-w-0 whitespace-nowrap flex-shrink-0">
              <ListChecks className="mr-2" /> Checklist IA
          </TabsTrigger>
          {showCoachChecklistTab && (
            <TabsTrigger value="coach-checklist" className="min-w-[180px] md:min-w-0 whitespace-nowrap flex-shrink-0">
              <ListChecks className="mr-2" /> Checklist Entrenador
            </TabsTrigger>
          )}
          <TabsTrigger value="messages" className="min-w-[140px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <MessageSquare className="mr-2" /> Mensajes
          </TabsTrigger>
          {!isCoach && (
            <TabsTrigger value="improvement-plan" className="min-w-[150px] md:min-w-0 whitespace-nowrap flex-shrink-0">
              <Dumbbell className="mr-2" /> Plan de Mejora
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="ai-analysis" className="mt-6">
          <div className="flex flex-col gap-8">
            {/* Debug: verificar estado del coachSummary */}
            {(() => {
              console.log('[Render] 🔍 Estado del coachSummary:', {
                hasCoachSummary: !!resolvedCoachSummary,
                coachSummaryLength: resolvedCoachSummary?.length || 0,
                coachSummaryPreview: resolvedCoachSummary?.substring(0, 50) || 'vacío',
                isEditingCoachFeedback,
                isCoach,
                willShow: resolvedCoachSummary && resolvedCoachSummary.trim().length > 0 && !isEditingCoachFeedback
              });
              return null;
            })()}
            {/* Se eliminó el panel de análisis rápido desde JSON para producción */}

            {attemptsState.length > 0 && showAttempts && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-headline text-lg sm:text-xl">Intentos detectados</CardTitle>
                    <Badge variant="secondary">{attemptsState.length}</Badge>
                  </div>
                  <CardDescription>
                    Revisa y corrige los intentos segmentados automáticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm sm:text-base">
                    {attemptsState.map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded border p-2">
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <div>Intento {i + 1}</div>
                          <div className="flex items-center gap-2">
                            <span>Inicio</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={a.start}
                              className="h-8 w-24"
                              onChange={(e) => updateAttempt(i, 'start', Math.max(0, Number(e.target.value)))}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const v = document.querySelector('video') as HTMLVideoElement | null;
                                if (v) updateAttempt(i, 'start', Number(v.currentTime.toFixed(2)));
                              }}
                            >
                              Usar tiempo actual
                            </Button>
                            <span className="ml-2">Fin</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={a.end}
                              className="h-8 w-24"
                              onChange={(e) => updateAttempt(i, 'end', Math.max(0, Number(e.target.value)))}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const v = document.querySelector('video') as HTMLVideoElement | null;
                                if (v) updateAttempt(i, 'end', Number(v.currentTime.toFixed(2)));
                              }}
                            >
                              Usar tiempo actual
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const v = document.querySelector('video');
                              try {
                                if (v) {
                                  (v as HTMLVideoElement).currentTime = Math.max(0, a.start - 0.1);
                                  (v as HTMLVideoElement).play().catch(() => {});
                                }
                              } catch {}
                            }}
                          >
                            Ver
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAttemptsState((prev) => prev.filter((_, idx) => idx !== i));
                              setAttemptsDirty(true);
                            }}
                          >
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setAttemptsState(attempts); setAttemptsDirty(false); }}
                        disabled={!attemptsDirty}
                      >
                        Restaurar auto
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveAttempts}
                        disabled={!attemptsDirty || savingAttempts || !validateAttempts(attemptsState)}
                      >
                        {savingAttempts ? 'Guardando...' : 'Guardar cambios'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Aviso de análisis parcial (modal) */}
            {isPartialAnalysis && (
              <Dialog
                open={partialModalOpen}
                onOpenChange={(open) => {
                  setPartialModalOpen(open);
                  if (!open) setPartialModalDismissed(true);
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-800">
                      <ShieldAlert className="h-5 w-5" />
                      Análisis Parcial
                    </DialogTitle>
                    <DialogDescription className="text-amber-700">
                      Este análisis se realizó con videos limitados. Para un análisis completo, se recomienda subir videos desde múltiples ángulos.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm font-medium text-amber-700">Videos disponibles:</span>
                      {availableAngles.map((angle) => (
                        <Badge key={angle} variant="secondary" className="bg-amber-100 text-amber-800">
                          {angle === 'front' ? 'Frente' :
                           angle === 'back' ? 'Espalda' :
                           angle === 'left' ? 'Izquierda' : 'Derecha'}
                        </Badge>
                      ))}
                    </div>
                    {missingAngles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm font-medium text-amber-700">Ángulos faltantes:</span>
                        {missingAngles.map((angle) => (
                          <Badge key={angle} variant="outline" className="border-amber-300 text-amber-600">
                            {angle === 'front' ? 'Frente' :
                             angle === 'back' ? 'Espalda' :
                             angle === 'left' ? 'Izquierda' : 'Derecha'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => { setPartialModalOpen(false); setPartialModalDismissed(true); }}>
                      Aceptar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* PUNTUACIÓN GLOBAL (si existe scoreMetadata) */}
            {(safeAnalysis as any).scoreMetadata && (
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    🎯 Puntuación Global
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-blue-700 font-medium">Score Final</p>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-blue-900">
                          IA: {(safeAnalysis as any).scoreMetadata.weightedScore}/100
                        </p>
                        {coachScore !== null && (
                          <p className="text-2xl font-bold text-green-700">
                            Coach: {coachScore}/100
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-blue-700 font-medium">Parámetros Evaluables</p>
                      <p className="text-2xl font-bold text-green-700">
                        {(safeAnalysis as any).resumen_evaluacion?.parametros_evaluados || (safeAnalysis as any).scoreMetadata?.evaluableCount || 0}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-blue-700 font-medium">No Evaluables</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {(safeAnalysis as any).resumen_evaluacion?.parametros_no_evaluables || (safeAnalysis as any).scoreMetadata?.nonEvaluableCount || 0}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-xs text-blue-700">
                      <strong>Tipo de tiro:</strong> {(safeAnalysis as any).scoreMetadata.shotTypeKey} • 
                      <strong> Calculado:</strong> {new Date((safeAnalysis as any).scoreMetadata.calculatedAt).toLocaleString('es-ES')}
                    </p>
                  </div>
                  {isPartialAnalysis && availableAngles.length === 1 && (
                    <p className="mt-3 text-sm text-amber-700">
                      Nota: la puntuación global se calculó con un solo video.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Comentarios del Entrenador (mostrar antes del análisis de IA si existen) */}
            {(() => {
              const shouldShow = resolvedCoachSummary && resolvedCoachSummary.trim().length > 0 && !isEditingCoachFeedback;
              console.log('[CoachComments] 🎯 Verificando si mostrar comentarios:', {
                hasCoachSummary: !!resolvedCoachSummary,
                coachSummaryLength: resolvedCoachSummary?.length || 0,
                isEditingCoachFeedback,
                shouldShow
              });
              return shouldShow ? (
                <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                  <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2 text-green-900">
                      <UserCircle className="h-5 w-5" />
                    Comentarios del Entrenador{coachFeedbackCoachName ? ` ${coachFeedbackCoachName}` : ""}
                    </CardTitle>
                    <CardDescription className="text-green-700">
                    {isCoach ? 'Tu revisión de este análisis:' : 'Tu entrenador ha revisado este análisis y dejó los siguientes comentarios.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormattedText text={resolvedCoachSummary} className="text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : null;
            })()}

            <Card>
              <CardHeader>
                <CardTitle className="font-headline">
                  {analysisSummaryTitle}
                </CardTitle>
                <Badge variant="outline" className="w-fit">
                  {safeAnalysis.shotType}
                </Badge>
              </CardHeader>
              <CardContent>
                {isNonBasketballVideo && (
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">La IA no detectó un jugador realizando lanzamientos.</p>
                        <p className="text-xs text-amber-800">{nonBasketballWarning}</p>
                        {canClearScore && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isClearingScore}
                              onClick={async () => {
                                try {
                                  setIsClearingScore(true);
                                  const auth = getAuth();
                                  const cu = auth.currentUser;
                                  if (!cu) throw new Error('Usuario no autenticado');
                                  const token = await getIdToken(cu, true);
                                  const res = await fetch(`/api/analyses/${analysis.id}/clear-score`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                  });
                                  if (!res.ok) throw new Error('No se pudo borrar la calificación');
                                  toast({ title: 'Calificación eliminada', description: 'No afectará tu promedio.' });
                                } catch (e: any) {
                                  toast({
                                    title: 'No se pudo borrar la calificación',
                                    description: e?.message || 'Error desconocido',
                                    variant: 'destructive',
                                  });
                                } finally {
                                  setIsClearingScore(false);
                                }
                              }}
                            >
                              {isClearingScore ? 'Eliminando…' : 'Eliminar calificación'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {!isNonBasketballVideo && (
                  <>
                    <p className="text-muted-foreground">{safeAnalysis.analysisSummary}</p>
                    {/* Puntuación ya se muestra en "Puntuación Global" */}
                  </>
                )}
                {!isNonBasketballVideo && (
                  <div className="mt-6 rounded-md border bg-muted/30 p-4">
                    <p className="text-sm font-medium">¿Te sirvió este análisis? Compartilo en tus redes:</p>
                    <div className="mt-3">
                      <ShareButtons text="Mirá mi análisis de tiro en IaShot" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fortalezas, Debilidades y Recomendaciones (IA) */}
            {!isNonBasketballVideo && (hasStrengths || hasWeaknesses) && (
            <div className="grid gap-4 md:grid-cols-2">
              {hasStrengths && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2 text-green-600">
                    <CheckCircle2 /> Fortalezas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid list-inside list-disc grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                    {derivedStrengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              )}
              {hasWeaknesses && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2 text-destructive">
                    <XCircle /> Debilidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid list-inside list-disc grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                    {derivedWeaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              )}
            </div>
            )}

            {!isNonBasketballVideo && hasRecommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-accent">
                  <Lightbulb /> Recomendaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                  {derivedRecommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            )}

            {/* (Videos y Fotogramas) fue movido a la pestaña "videos" */}
          </div>
        </TabsContent>
        <TabsContent value="videos" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <Camera /> Video y Fotogramas
                  </CardTitle>
                  <CardDescription>
                    Haz clic en un fotograma para ampliarlo, dibujar y comentar.
                  </CardDescription>
                </div>
                {viewerRole === 'coach' && (
                  <Link href="/upload">
                    <Button variant="outline" size="sm" className="shrink-0 border-primary/30 hover:bg-primary/5">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Comprar videos
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Videos disponibles (frente/espalda/izquierda/derecha) */}
              {(() => {
                const hasAnyVideo = (safeAnalysis as any).videoUrl || 
                                   (safeAnalysis as any).videoFrontUrl || 
                                   (safeAnalysis as any).videoBackUrl || 
                                   (safeAnalysis as any).videoLeftUrl || 
                                   (safeAnalysis as any).videoRightUrl;
                
                                if (!hasAnyVideo) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No hay videos disponibles para este análisis.</p>
                      <p className="text-xs mt-2">Los videos pueden no haberse guardado correctamente.</p>
                    </div>
                  );
                }

                const videoBackUrl = resolveVideoSrc((safeAnalysis as any).videoBackUrl);
                const videoFrontUrl = resolveVideoSrc((safeAnalysis as any).videoFrontUrl);
                const videoUrl = resolveVideoSrc((safeAnalysis as any).videoUrl);
                const frontFallbackUrl = !videoBackUrl ? videoUrl : undefined;
                const videoFrontSrc = videoFrontUrl || frontFallbackUrl || undefined;

                return (
                  <div className="grid gap-6 md:grid-cols-2">
                    {videoBackUrl && (
                      <div>
                        <h4 className="font-medium mb-2">Trasera</h4>
                        <video
                          data-analysis-video="back"
                          controls
                          crossOrigin="anonymous"
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={videoBackUrl}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                    {(videoFrontUrl || frontFallbackUrl) && (
                      <div>
                        <h4 className="font-medium mb-2">Frontal</h4>
                        <video
                          data-analysis-video="front"
                          controls
                          crossOrigin="anonymous"
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={videoFrontSrc}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                    {resolveVideoSrc((safeAnalysis as any).videoLeftUrl) && (
                      <div>
                        <h4 className="font-medium mb-2">Lateral Izquierdo</h4>
                        <video
                          data-analysis-video="left"
                          controls
                          crossOrigin="anonymous"
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={resolveVideoSrc((safeAnalysis as any).videoLeftUrl)!}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                    {resolveVideoSrc((safeAnalysis as any).videoRightUrl) && (
                      <div>
                        <h4 className="font-medium mb-2">Lateral Derecho</h4>
                        <video
                          data-analysis-video="right"
                          controls
                          crossOrigin="anonymous"
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={resolveVideoSrc((safeAnalysis as any).videoRightUrl)!}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(shotFramesLoading || shotFrames.length > 0 || shotFramesError) && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Frames por tiro
                    {shotFramesLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Cargando...</span>
                      </div>
                    )}
                  </h3>
                  {shotFramesLoading ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Cargando frames por tiro…</p>
                    </div>
                  ) : shotFrames.length > 0 ? (
                    <div className="space-y-4">
                      {shotFrames.map((shot: any, shotIdx: number) => {
                        const frames = Array.isArray(shot?.frames) ? shot.frames : [];
                        return (
                          <div key={`shot-frames-${shot?.idx ?? shotIdx}`} className="rounded-lg border p-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-3">
                              <span className="font-medium text-foreground">Tiro {shot?.idx ?? shotIdx + 1}</span>
                              <span>Inicio: {formatMs(shot?.start_ms)}</span>
                              <span>Liberación: {formatMs(shot?.release_ms)}</span>
                              <span>Frames: {frames.length}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                              {frames.map((frame: any, frameIdx: number) => {
                                const src = normalizeImageSrc(frame?.dataUrl || frame?.imageBuffer || frame?.src);
                                if (!src) {
                                  return (
                                    <div key={`shot-frame-${shotIdx}-${frameIdx}`} className="flex items-center justify-center rounded-lg border h-24 text-xs text-muted-foreground">
                                      Sin imagen
                                    </div>
                                  );
                                }
                                return (
                                  <button
                                    key={`shot-frame-${shotIdx}-${frameIdx}`}
                                    className="group relative rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                    onClick={() => {
                                      setSelectedKeyframe(src);
                                      setSelectedIndex(frameIdx);
                                      setIsModalOpen(true);
                                    }}
                                  >
                                    <Image
                                      src={src}
                                      alt={`Tiro ${shot?.idx ?? shotIdx + 1} frame ${frameIdx + 1}`}
                                      width={220}
                                      height={220}
                                      className="object-cover w-full h-24 group-hover:opacity-90 transition-opacity"
                                      unoptimized
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">{shotFramesError || 'No hay frames por tiro disponibles.'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Botón dev para generar si no hay nada - SOLO PARA ADMINS */}
              {availableAngles.length === 0 && (userProfile as any)?.role === 'admin' && (
                <div className="flex items-center justify-center mb-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={rebuilding}
                      onClick={async () => {
                        try {
                          setRebuilding(true);
                          const res = await fetch(`/api/analyses/${safeAnalysis.id}/rebuild-keyframes/dev`, { method: 'POST' });
                          const data = await res.json();
                          if (res.ok && data?.keyframes) {
                            setLocalKeyframes(data.keyframes);
                          }
                        } finally {
                          setRebuilding(false);
                        }
                      }}
                    >
                      {rebuilding ? 'Generando (server)…' : 'Generar (server, dev)'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={uploadingFromClient}
                      onClick={generateKeyframesFromClient}
                    >
                      {uploadingFromClient ? 'Generando (cliente)…' : 'Generar (desde este video)'}
                    </Button>
                    </div>
                    {keyframesGenStatus && (
                      <p className="text-xs text-muted-foreground">{keyframesGenStatus}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Keyframes por ángulo con Accordion (smart o tradicionales) */}
              {(() => {
                const angles = ['front','back','left','right'] as const;
                const hasSmartAny = angles.some((k) => Array.isArray((smartKeyframes as any)[k]) && (smartKeyframes as any)[k].length > 0);
                const hasSmartImagesAny = angles.some((k) => {
                  const arr = (smartKeyframes as any)[k] as Array<{ imageBuffer?: string }> | undefined;
                  if (!Array.isArray(arr)) return false;
                  return arr.some((kf) => Boolean(normalizeImageSrc(kf?.imageBuffer)));
                });
                const hasTraditionalAny = angles.some((k) => Array.isArray((localKeyframes as any)[k]) && (localKeyframes as any)[k].length > 0);
                const hasAnyVideo = availableAngles.length > 0;
                const shouldShow = smartKeyframesLoading || keyframesLoading || hasSmartAny || hasTraditionalAny || hasAnyVideo;

                if (!shouldShow) return null;

                return (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Fotogramas
                      {(smartKeyframesLoading || keyframesLoading) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Procesando...</span>
                        </div>
                      )}
                    </h3>

                    {(smartKeyframesLoading || keyframesLoading) && !hasSmartAny && !hasTraditionalAny ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p className="text-lg font-medium">Procesando fotogramas...</p>
                        <p className="text-sm">Esto puede tomar unos minutos dependiendo del tamaño de los videos</p>
                      </div>
                    ) : hasSmartImagesAny ? (
                      <Accordion type="single" collapsible className="w-full">
                        {([
                          { key: 'front' as const, label: 'Vista Frontal', labelAdj: 'frontal', icon: '👁️' },
                          { key: 'back' as const, label: 'Vista Trasera', labelAdj: 'espalda', icon: '🔄' },
                          { key: 'left' as const, label: 'Vista Lateral Izquierda', labelAdj: 'izquierdo', icon: '◀️' },
                          { key: 'right' as const, label: 'Vista Lateral Derecha', labelAdj: 'derecho', icon: '▶️' },
                        ]).map(({ key, label, labelAdj, icon }) => {
                          const smartArr = (smartKeyframes as any)[key] as Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }> | undefined;
                          const smartArrWithImages = Array.isArray(smartArr)
                            ? smartArr.filter((kf) => Boolean(normalizeImageSrc(kf?.imageBuffer)))
                            : [];
                          const hasSmartKeyframes = smartArrWithImages.length > 0;
                          
                          if (!hasSmartKeyframes) return null;
                          
                          return (
                            <AccordionItem key={key} value={key} className="border rounded-lg mb-2">
                              <AccordionTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{icon}</span>
                                  <div className="text-left">
                                    <p className="font-medium">{label}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {smartArrWithImages.length} fotogramas inteligentes • Click para expandir
                                    </p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 py-4 bg-muted/20">
                                {renderSmartKeyframes(smartArrWithImages, labelAdj, key)}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : hasTraditionalAny ? (
                      <Accordion type="single" collapsible className="w-full">
                        {([
                          { key: 'front' as const, label: 'Vista Frontal', labelAdj: 'frontal', icon: '👁️' },
                          { key: 'back' as const, label: 'Vista Trasera', labelAdj: 'espalda', icon: '🔄' },
                          { key: 'left' as const, label: 'Vista Lateral Izquierda', labelAdj: 'izquierdo', icon: '◀️' },
                          { key: 'right' as const, label: 'Vista Lateral Derecha', labelAdj: 'derecho', icon: '▶️' },
                        ]).map(({ key, label, labelAdj, icon }) => {
                          const traditionalArr = (localKeyframes as any)[key] as string[] | undefined;
                          const hasTraditionalKeyframes = Array.isArray(traditionalArr) && traditionalArr.length > 0;

                          if (!hasTraditionalKeyframes) return null;

                          return (
                            <AccordionItem key={key} value={key} className="border rounded-lg mb-2">
                              <AccordionTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{icon}</span>
                                  <div className="text-left">
                                    <p className="font-medium">{label}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {traditionalArr!.length} fotogramas • Click para expandir
                                    </p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 py-4 bg-muted/20">
                                {renderKeyframes(traditionalArr!, labelAdj, key)}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-lg font-medium">No hay fotogramas disponibles</p>
                        <p className="text-sm">
                          {hasSmartAny && !hasSmartImagesAny
                            ? 'Se detectaron metadatos, pero faltan las imágenes.'
                            : 'Si el procesamiento automático no los generó, podés crearlos desde el video.'}
                        </p>
                        {hasAnyVideo && (
                          <div className="mt-4">
                            <Button
                              variant="outline"
                              disabled={uploadingFromClient}
                              onClick={generateKeyframesFromClient}
                            >
                              {uploadingFromClient ? 'Generando…' : 'Generar desde este video'}
                            </Button>
                            {keyframesGenStatus && (
                              <p className="text-xs text-muted-foreground mt-2">{keyframesGenStatus}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="checklist" className="mt-6">
          {/* METADATOS DEL SCORE (si existen) */}
          {(safeAnalysis as any).scoreMetadata && (
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  🎯 Puntuación Global
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-blue-700 font-medium">Score Final</p>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-blue-900">
                        IA: {(safeAnalysis as any).scoreMetadata.weightedScore}/100
                      </p>
                      {coachScore !== null && (
                        <p className="text-2xl font-bold text-green-700">
                          Coach: {coachScore}/100
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-blue-700 font-medium">Parámetros Evaluables</p>
                    <p className="text-2xl font-bold text-green-700">
                      {(safeAnalysis as any).resumen_evaluacion?.parametros_evaluados || (safeAnalysis as any).scoreMetadata?.evaluableCount || 0}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-blue-700 font-medium">No Evaluables</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {(safeAnalysis as any).resumen_evaluacion?.parametros_no_evaluables || (safeAnalysis as any).scoreMetadata?.nonEvaluableCount || 0}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <p className="text-xs text-blue-700">
                    <strong>Tipo de tiro:</strong> {(safeAnalysis as any).scoreMetadata.shotTypeKey} • 
                    <strong> Calculado:</strong> {new Date((safeAnalysis as any).scoreMetadata.calculatedAt).toLocaleString('es-ES')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {(() => {
            try {
              return (
                <DetailedChecklist
                  categories={checklistState}
                  onChecklistChange={handleChecklistChange}
                  analysisId={safeAnalysis.id}
                  currentScore={safeAnalysis.score}
                  editable={roleForPermissions === 'coach' && userProfile?.id === (player?.coachId || '')}
                  showCoachBox={false}
                  coachInline={isCoach}
                  coachIsEditable={isCoach && isEditingCoachFeedback}
                  coachFeedbackByItemId={coachFeedbackByItemId}
                  onCoachFeedbackChange={onCoachFeedbackChange}
                  getScoreColor={getScoreColor}
                  getStatusColor={getStatusColor}
                  renderStars={renderStars}
                />
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error('❌ Error rendering DetailedChecklist:', error);
              return <div>Error rendering checklist: {message}</div>;
            }
          })()}
          {isCoach && (
            <div className="mt-6 space-y-4">
              {hasExistingCoachFeedback && !isEditingCoachFeedback && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-green-900 mb-1">Análisis de coach realizado</h3>
                          <p className="text-sm text-green-700">
                            Ya completaste la revisión de este análisis. Podés editarlo si necesitás hacer correcciones.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingCoachFeedback(true)}
                        className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-100"
                        disabled={!canEdit}
                        title={!canEdit ? 'Solo el coach asignado o admin puede editar' : ''}
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline">Revisión del entrenador</CardTitle>
                  <CardDescription>Resumen de tu revisión sobre las calificaciones de la IA.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Ítems revisados</div>
                      <div className="text-xl font-semibold">{coachReviewSummary.reviewed}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">De acuerdo con IA</div>
                      <div className="text-xl font-semibold">{coachReviewSummary.agreed}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Recalificados</div>
                      <div className="text-xl font-semibold">{coachReviewSummary.changed}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-muted-foreground">Promedio coach</div>
                      <div className="text-xl font-semibold">{coachReviewSummary.avgCoach ?? '-'}</div>
                    </div>
                  </div>
                  {coachReviewSummary.changed > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Ítems recalificados</div>
                      <ul className="text-sm list-disc list-inside text-muted-foreground">
                        {coachReviewSummary.diffs.map((d) => (
                          <li key={d.id}>{d.name}: IA {Number(d.ia.toFixed(2))} → Coach {Number(d.coach.toFixed(2))}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Comentario global</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateCoachSummary}
                        disabled={!canEdit || !isEditingCoachFeedback || generatingSummary || Object.values(coachFeedbackByItemId).filter(cf => cf && typeof cf.rating === 'number').length === 0}
                        className="flex items-center gap-2"
                      >
                        {generatingSummary ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generar resumen con IA
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="relative">
                      <Textarea 
                        value={coachSummary} 
                        onChange={(e) => setCoachSummary(e.target.value)} 
                        placeholder="Comentario global y próximos pasos. Podés usar el botón 'Generar resumen con IA' para que la IA genere un resumen basado en tus calificaciones." 
                        className="text-sm min-h-[120px]" 
                        disabled={!isEditingCoachFeedback}
                        readOnly={!isEditingCoachFeedback}
                      />
                      {isEditingCoachFeedback && (
                        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                          {coachSummary.trim().split(/\s+/).filter(w => w.length > 0).length} / 50 palabras
                        </div>
                      )}
                    </div>
                  </div>
                  {isEditingCoachFeedback && (
                    <div className="flex flex-col gap-2">
                      {!canMarkCompleted && (
                        <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-md p-2">
                          <p className="font-semibold text-yellow-800 mb-1">Para marcar como terminado necesitas:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-yellow-700">
                            {completionStatus.missingItems > 0 && (
                              <li>Calificar todos los ítems del checklist ({completionStatus.missingItems} {completionStatus.missingItems === 1 ? 'pendiente' : 'pendientes'})</li>
                            )}
                            {completionStatus.missingWords > 0 && (
                              <li>Completar el comentario global con al menos 50 palabras (faltan {completionStatus.missingWords})</li>
                            )}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button onClick={saveCoachFeedback} disabled={savingCoachFeedback}>
                          {savingCoachFeedback ? 'Guardando…' : 'Guardar revisión'}
                        </Button>
                        <Button 
                          className="ml-2" 
                          variant="secondary" 
                          onClick={markCompleted} 
                          disabled={completing || !canMarkCompleted}
                          title={!canMarkCompleted ? 'Completá todos los checklist y el comentario global para marcar como terminado' : ''}
                        >
                          {completing ? 'Marcando…' : 'Terminado'}
                        </Button>
                        {hasExistingCoachFeedback && (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              // Recargar los datos originales
                              const load = async () => {
                                try {
                                  const auth = getAuth();
                                  const u = auth.currentUser;
                                  if (!u) return;
                                  const token = await getIdToken(u);
                                  const res = await fetch(`/api/analyses/${analysis.id}/coach-feedback`, { 
                                    headers: { Authorization: `Bearer ${token}` } 
                                  });
                                  if (!res.ok) return;
                                  const data = await res.json();
                                  const fb = data?.feedback;
                                  if (fb) {
                                    setCoachFeedbackByItemId(fb.items || {});
                                    setCoachSummary(fb.coachSummary || "");
                                  }
                                  setIsEditingCoachFeedback(false);
                                } catch {}
                              };
                              void load();
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {!isEditingCoachFeedback && hasExistingCoachFeedback && (
                    <div className="text-sm text-muted-foreground italic">
                      Haz clic en "Editar" arriba para modificar esta revisión.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        
        {showCoachChecklistTab && (
          <TabsContent value="coach-checklist" className="mt-6">
            {hasCoachFeedback || hasExistingCoachFeedback ? (
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <ListChecks /> Checklist del Entrenador{coachFeedbackCoachName ? ` ${coachFeedbackCoachName}` : ""}
                  </CardTitle>
                  <CardDescription>
                    {isCoach ? 'Resultado con tus calificaciones y comentarios por ítem.' : 'Calificaciones y comentarios del entrenador.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Comentario global</div>
                    <FormattedText
                      text={resolvedCoachSummary || 'Sin comentario global'}
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                  <div className="text-sm font-semibold">Calificaciones y comentarios del entrenador</div>
                  {(() => {
                    // Debug: mostrar información sobre los IDs
                    const allChecklistIds = checklistState.flatMap(cat => cat.items.map(it => it.id));
                    const allFeedbackIds = Object.keys(coachFeedbackByItemId);
                    console.log(`[CoachChecklist] 🔍 IDs del checklist:`, allChecklistIds);
                    console.log(`[CoachChecklist] 🔍 IDs del feedback:`, allFeedbackIds);
                    console.log(`[CoachChecklist] 🔍 Feedback completo:`, coachFeedbackByItemId);
                    
                    // Recopilar todos los items con feedback válido
                    const itemsWithFeedback: Array<{ category: string; item: DetailedChecklistItem; feedback: { rating?: number; comment?: string } }> = [];
                    
                    for (const cat of checklistState) {
                      for (const it of cat.items) {
                        // Normalizar el ID al buscar (lowercase y trim para consistencia)
                        const normalizedId = String(it.id).trim().toLowerCase();
                        const cf = coachFeedbackByItemId[normalizedId] || coachFeedbackByItemId[it.id];
                        if (cf && typeof cf.rating === 'number') {
                          itemsWithFeedback.push({ category: cat.category, item: it, feedback: cf });
                        } else {
                          // Debug: mostrar por qué no se muestra este item
                          if (Object.keys(coachFeedbackByItemId).length > 0) {
                            console.log(`[CoachChecklist] ⚠️ Item "${it.name}" (id: "${it.id}", normalized: "${normalizedId}") no tiene feedback válido:`, cf);
                          }
                        }
                      }
                    }
                    
                    // Si no hay items con feedback pero hay feedback guardado, mostrar mensaje
                    if (itemsWithFeedback.length === 0 && Object.keys(coachFeedbackByItemId).length > 0) {
                      return (
                        <div className="rounded-lg border-2 border-dashed border-yellow-200 bg-yellow-50 p-8 text-center">
                          <p className="text-sm text-yellow-800 mb-2">
                            ⚠️ No se encontraron calificaciones válidas en el feedback del entrenador.
                          </p>
                          <p className="text-xs text-yellow-700">
                            El feedback puede tener comentarios pero no calificaciones numéricas, o los IDs pueden no coincidir.
                          </p>
                          <p className="text-xs text-yellow-600 mt-2">
                            IDs en feedback: {Object.keys(coachFeedbackByItemId).join(', ')}
                          </p>
                        </div>
                      );
                    }
                    
                    // Si no hay feedback en absoluto
                    if (itemsWithFeedback.length === 0 && Object.keys(coachFeedbackByItemId).length === 0) {
                      return (
                        <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            Aún no hay feedback del entrenador guardado.
                          </p>
                        </div>
                      );
                    }
                    
                    // Agrupar items por categoría
                    const itemsByCategory: Record<string, typeof itemsWithFeedback> = {};
                    for (const entry of itemsWithFeedback) {
                      if (!itemsByCategory[entry.category]) {
                        itemsByCategory[entry.category] = [];
                      }
                      itemsByCategory[entry.category].push(entry);
                    }
                    
                    return Object.entries(itemsByCategory).map(([category, entries]) => (
                      <div key={`cc-${category}`} className="space-y-2">
                        <div className="text-sm font-semibold">{category}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {entries.map(({ item: it, feedback: cf }) => {
                            // Convertir ambos ratings a escala 1-100 para comparación
                            const coachRating100 = (cf.rating! / 5) * 100;
                            const iaRating100 = typeof it.rating === 'number'
                              ? (it.rating <= 5 ? (it.rating / 5) * 100 : it.rating)
                              : null;
                            return (
                              <div key={`cc-item-${it.id}`} className="rounded border p-3 text-sm">
                                <div className="font-medium mb-1">{it.name}</div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge>Coach {Number(coachRating100.toFixed(2))}</Badge>
                                  <span className="text-muted-foreground">
                                    IA {iaRating100 === null ? 'N/D' : Number(iaRating100.toFixed(2))}
                                  </span>
                                </div>
                                {cf.comment && (
                                  <div className="text-muted-foreground">{cf.comment}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <ListChecks /> Checklist del Entrenador
                  </CardTitle>
                  <CardDescription>
                    Estado pendiente de revisión por un entrenador.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted p-8 text-center">
                    <ShieldAlert className="h-12 w-12 text-muted-foreground" />
                    <h3 className="font-semibold">Aún no hay revisión de entrenador</h3>
                    <p className="text-sm text-muted-foreground max-w-prose">
                      Hasta que no contactes a un entrenador y realice la revisión, este apartado permanecerá vacío.
                    </p>
                    <Button asChild>
                      <a href="/player/coaches">Buscar Entrenador</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <MessageSquare /> Mensajes del lanzamiento
              </CardTitle>
              <CardDescription>
                Conversaciones relacionadas con este análisis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisMessages.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                  No hay mensajes para este lanzamiento.
                </div>
              ) : (
                <ul className="space-y-3">
                  {analysisMessages.map((m) => (
                    <li key={m.id} className="rounded border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Badge variant="outline">{getAnalysisMessageOriginLabel(m)}</Badge>
                        {isKeyframeMessage(m) && <Badge variant="secondary">Fotograma</Badge>}
                        <span>{(m.fromName || "Sistema")} · {formatMessageDate(m.createdAt)}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{renderMessageText(m.text)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Textarea
                placeholder="Escribe un mensaje sobre este lanzamiento..."
                value={analysisMessageText}
                onChange={(e) => setAnalysisMessageText(e.target.value)}
                rows={3}
              />
              <Button
                className="w-full"
                onClick={sendAnalysisMessage}
                disabled={sendingAnalysisMessage || !analysisMessageText.trim() || !user}
              >
                {sendingAnalysisMessage ? 'Enviando...' : 'Enviar mensaje'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        {!isCoach && (
          <TabsContent value="improvement-plan" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Dumbbell /> Plan de Mejora (Sesión con Entrenador)
                </CardTitle>
                <CardDescription>
                  Este plan debe ser guiado por un entrenador certificado. La IA no ejecuta esta actividad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {player?.coachId ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-green-200 bg-green-50 p-8 text-center">
                    <FilePenLine className="h-12 w-12 text-green-600" />
                    <h3 className="font-semibold text-green-800">Tu entrenador asignado te dará el plan de mejora</h3>
                    <p className="text-sm text-green-700 max-w-prose">
                      Ya tienes un entrenador asignado que revisará tu análisis y te proporcionará un plan de mejora personalizado con objetivos específicos y ejercicios correctivos.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        variant="outline" 
                        className="border-green-300 text-green-700 hover:bg-green-100"
                        onClick={() => setCoachSelectionDialogOpen(true)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contactar Entrenador
                      </Button>
                      <Button asChild className="bg-green-600 hover:bg-green-700">
                        <a href="/dashboard">
                          <Users className="mr-2 h-4 w-4" />
                          Ir a Mi Panel
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted p-8 text-center">
                    <FilePenLine className="h-12 w-12 text-muted-foreground" />
                    <h3 className="font-semibold">Coordina una sesión de mejora técnica</h3>
                    <p className="text-sm text-muted-foreground max-w-prose">
                      Un entrenador revisará tu análisis, definirá objetivos específicos y te guiará en ejercicios correctivos. Puedes contactar a un entrenador desde el siguiente enlace.
                    </p>
                    <Button asChild>
                      <a href="/player/coaches">
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Buscar Entrenador
                      </a>
                    </Button>
                  </div>
                )}
                {/* Se removió la generación de ejercicios de ejemplo para evitar contenido dummy */}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className={isExpanded ? "max-w-7xl" : "max-w-4xl"}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                Análisis del Fotograma
                {selectedAngle && (
                  <span className="ml-2 text-sm text-muted-foreground font-normal">
                    ({selectedAngle === 'front' ? 'Vista Frontal' : 
                      selectedAngle === 'back' ? 'Vista Trasera' :
                      selectedAngle === 'left' ? 'Vista Lateral Izquierda' :
                      'Vista Lateral Derecha'})
                  </span>
                )}
              </span>
              {selectedIndex !== null && currentKeyframes.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToKeyframe('prev')}
                    disabled={!canNavigatePrev}
                    className="h-8 w-8 p-0"
                  >
                    ◀
                  </Button>
                  <span>{selectedIndex + 1} de {currentKeyframes.length}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToKeyframe('next')}
                    disabled={!canNavigateNext}
                    className="h-8 w-8 p-0"
                  >
                    ▶
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className={isExpanded ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
            <div className="relative">
              <div
                ref={imageContainerRef}
                className={`relative w-full ${isExpanded ? 'aspect-[3/4]' : 'aspect-[3/4]'} overflow-hidden rounded-lg border bg-muted/20`}
              >
                <Image
                  src={(selectedKeyframe ? normalizeKeyframeUrl(selectedKeyframe) : "") || "https://placehold.co/600x600.png"}
                  alt="Fotograma seleccionado"
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-contain pointer-events-none select-none"
                  draggable={false}
                  onLoadingComplete={(img) => {
                    imageNaturalSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight };
                    const container = imageContainerRef.current;
                    if (container) {
                      const rect = container.getBoundingClientRect();
                      const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
                      const displayW = Math.round(img.naturalWidth * scale);
                      const displayH = Math.round(img.naturalHeight * scale);
                      const offsetX = Math.round((rect.width - displayW) / 2);
                      const offsetY = Math.round((rect.height - displayH) / 2);
                      setImageLayout({ x: offsetX, y: offsetY, width: displayW, height: displayH });
                    }
                  }}
                />
                {/* overlays guardados */}
                {annotations.map((a, i) => (
                  <img
                    key={a.id || i}
                    src={a.overlayUrl}
                    alt="overlay"
                    className="absolute pointer-events-none"
                    style={imageLayout ? { left: imageLayout.x, top: imageLayout.y, width: imageLayout.width, height: imageLayout.height } : { inset: 0, width: '100%', height: '100%' }}
                  />
                ))}
                {/* canvas de dibujo */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0"
                  style={{ cursor: toolRef.current === 'pencil' || toolRef.current === 'line' || toolRef.current === 'circle' ? 'crosshair' : toolRef.current === 'eraser' ? 'cell' : 'default' }}
                  onMouseDown={(e) => {
                    if (commentInputRef.current) commentInputRef.current.blur();
                    isCommentFocusedRef.current = false;
                    setIsCommentFocused(false);
                    beginDraw(e);
                  }}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { toolRef.current = 'move'; }}
                  title="Mover"
                >
                  <Move />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Minimizar" : "Expandir"}
                >
                  {isExpanded ? <Minimize2 /> : <Maximize2 />}
                </Button>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'pencil'; }}><Pencil /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'line'; }}><Minus /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'circle'; }}><CircleIcon /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'eraser'; }}><Eraser /></Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Color</span>
                      <div className="flex items-center gap-1">
                        {['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#111827'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`h-5 w-5 rounded-full border ${drawColor === c ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setDrawColor(c)}
                            title={`Color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" disabled={savingAnnotation} onClick={() => { void saveAnnotation(); }}>
                      {savingAnnotation ? 'Guardando…' : 'Guardar dibujo'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearCanvas}>Limpiar</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={annotations.length === 0}
                      onClick={() => { void deleteLatestAnnotation(); }}
                    >
                      Eliminar último
                    </Button>
                  </>
                )}
                {annotationStatus && (
                  <div className="text-xs text-muted-foreground">
                    {annotationStatus}
                  </div>
                )}
              </div>
              
              {/* Botones de navegación grandes */}
              {currentKeyframes.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                    onClick={() => navigateToKeyframe('prev')}
                    disabled={!canNavigatePrev}
                  >
                    ◀
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                    onClick={() => navigateToKeyframe('next')}
                    disabled={!canNavigateNext}
                  >
                    ▶
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare /> Comentarios del Entrenador
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {keyframeComments.length === 0 ? (
                    canComment ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => commentInputRef.current?.focus()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commentInputRef.current?.focus(); } }}
                        className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label="Haz clic para añadir un comentario"
                      >
                        Aún no hay comentarios para este fotograma. Haz clic aquí para escribir uno.
                      </div>
                    ) : isCoach ? (
                      <div className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg bg-muted/20">
                        Aún no hay comentarios para este fotograma. Solo el entrenador asignado o con acceso puede comentar.
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg">
                        Aún no hay comentarios para este fotograma.
                      </div>
                    )
                  ) : (
                    <ul className="space-y-2">
                      {keyframeComments.map((c, i) => (
                        <li key={c.id || i} className="text-sm border rounded p-2">
                          <div className="text-muted-foreground text-xs">{c.coachName || 'Entrenador'} — {new Date(c.createdAt).toLocaleString()}</div>
                          <div>{c.comment}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canComment && (
                    <>
                      <Textarea
                        ref={commentInputRef}
                        className="pointer-events-auto"
                        placeholder="Añade tu comentario aquí..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onFocus={() => {
                          toolRef.current = 'move';
                          isCommentFocusedRef.current = true;
                          setIsCommentFocused(true);
                        }}
                        onBlur={() => {
                          isCommentFocusedRef.current = false;
                          setIsCommentFocused(false);
                        }}
                        autoFocus
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            const text = newComment.trim();
                            if (!text) {
                              toast({ title: 'Escribí un borrador', description: 'Escribí tu comentario para que la IA mejore la redacción.', variant: 'destructive' });
                              return;
                            }
                            setCommentAiOpen(true);
                            setCommentAiLoading(true);
                            setCommentAiSuggestion("");
                            try {
                              const auth = getAuth();
                              const u = auth.currentUser;
                              if (!u) {
                                toast({ title: 'No autenticado', description: 'Iniciá sesión para usar el asistente.', variant: 'destructive' });
                                return;
                              }
                              const token = await getIdToken(u, true);
                              const res = await fetch("/api/coach/compare/rewrite", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ text }),
                              });
                              if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                throw new Error((err as any)?.error || "Error al mejorar el comentario");
                              }
                              const data = await res.json();
                              setCommentAiSuggestion(String(data?.improved || ""));
                            } catch (e) {
                              console.error("Asistente comentario:", e);
                              toast({ title: "Error", description: "No se pudo mejorar la redacción. Intentá de nuevo.", variant: "destructive" });
                            } finally {
                              setCommentAiLoading(false);
                            }
                          }}
                          disabled={commentAiLoading}
                        >
                          {commentAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          <span className="ml-2">Asistente de redacción (IA)</span>
                        </Button>
                        <Button className="w-full sm:w-auto flex-1 sm:flex-initial" onClick={() => { toolRef.current = 'move'; void saveComment(); }}>
                          Guardar y enviar comentario
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo asistente de redacción IA para comentario de fotograma */}
      <Dialog open={commentAiOpen} onOpenChange={setCommentAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Asistente de redacción (IA)
            </DialogTitle>
            <DialogDescription>
              Revisá la propuesta y ajustala si querés antes de usarla en tu comentario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Propuesta</div>
            <Textarea
              value={commentAiSuggestion}
              onChange={(e) => setCommentAiSuggestion(e.target.value)}
              placeholder={commentAiLoading ? "Generando propuesta..." : "La propuesta aparecerá aquí"}
              rows={5}
              disabled={commentAiLoading}
            />
          </div>
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={async () => {
                const text = newComment.trim();
                if (!text) return;
                setCommentAiLoading(true);
                setCommentAiSuggestion("");
                try {
                  const auth = getAuth();
                  const u = auth.currentUser;
                  if (!u) return;
                  const token = await getIdToken(u, true);
                  const res = await fetch("/api/coach/compare/rewrite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ text }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setCommentAiSuggestion(String(data?.improved || ""));
                  }
                } finally {
                  setCommentAiLoading(false);
                }
              }}
              disabled={commentAiLoading}
            >
              {commentAiLoading ? "Generando..." : "Reintentar"}
            </Button>
            <Button
              onClick={() => {
                if (commentAiSuggestion.trim()) {
                  setNewComment(commentAiSuggestion.trim());
                  setCommentAiOpen(false);
                  toast({ title: "Redacción aplicada", description: "Podés editarla y guardar cuando quieras." });
                } else {
                  toast({ title: "No hay propuesta", description: "Generá una propuesta antes de aplicar.", variant: "destructive" });
                }
              }}
              disabled={commentAiLoading}
            >
              Usar esta versión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de selección de entrenadores */}
      <Dialog open={coachSelectionDialogOpen} onOpenChange={setCoachSelectionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Elegir Entrenador</DialogTitle>
            <CardDescription>
              Selecciona un entrenador para contactar y coordinar tu plan de mejora
            </CardDescription>
          </DialogHeader>
          
          {/* Barra de búsqueda */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar entrenadores por nombre, especialidad o experiencia..."
              value={coachSearchTerm}
              onChange={(e) => setCoachSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {coachesLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Cargando entrenadores...
            </div>
          )}

          {/* Lista de entrenadores */}
          {!coachesLoading && (
            <>
              {filteredCoaches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {coachSearchTerm ? 'No se encontraron entrenadores con ese criterio de búsqueda' : 'No hay entrenadores disponibles'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filteredCoaches.map((coach) => {
                    const displayRate = getDisplayRate(coach);
                    const showRate = coach.showRate !== false;
                    return (
                    <Card key={coach.id} className="flex flex-col hover:shadow-lg transition-shadow">
                      <CardHeader className="items-center text-center pb-4">
                        <Avatar className="h-20 w-20 border-4 border-primary/20">
                          <AvatarImage src={coach.avatarUrl} alt={coach.name} />
                          <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="font-headline pt-2 text-xl">{coach.name}</CardTitle>
                        
                        {/* Rating and Reviews */}
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            {renderCoachStars(coach.rating || 0)}
                          </div>
                          <span className="text-sm font-semibold text-primary">
                            {coach.rating?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        {coach.reviews && (
                          <div className="text-sm text-muted-foreground mb-3">
                            ({coach.reviews} reseñas)
                          </div>
                        )}

                        {/* Specialties */}
                        {coach.specialties && coach.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {coach.specialties.slice(0, 3).map((specialty) => (
                              <Badge key={specialty} variant="secondary" className="text-xs">
                                {specialty}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="flex-grow space-y-3">
                        {/* Experience */}
                        {coach.experience && (
                          <div>
                            <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                              <Briefcase className="h-4 w-4 text-primary" /> 
                              Experiencia
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">{coach.experience}</p>
                            {coach.yearsOfExperience && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {coach.yearsOfExperience} años
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bio */}
                        {coach.bio && (
                          <div>
                            <h4 className="font-semibold mb-1 text-sm">Curriculum</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {coach.bio}
                            </p>
                            {coach.bio.length > 100 && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="link" className="text-xs p-0 h-auto mt-1 text-primary">
                                    Ver curriculum completo
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Curriculum - {coach.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {coach.bio}
                                      </p>
                                    </div>
                                    {coach.experience && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Experiencia</h4>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                          {coach.experience}
                                        </p>
                                      </div>
                                    )}
                                    {coach.certifications && coach.certifications.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                                          <Trophy className="h-5 w-5 text-primary" />
                                          Certificaciones
                                        </h4>
                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                          {coach.certifications.map((cert, idx) => (
                                            <li key={idx}>{cert}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {coach.specialties && coach.specialties.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Especialidades</h4>
                                        <div className="flex flex-wrap gap-1">
                                          {coach.specialties.map((spec, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-xs">
                                              {spec}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {coach.education && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Educación</h4>
                                        <p className="text-sm text-muted-foreground">{coach.education}</p>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="flex flex-col gap-3 pt-4">
                        {/* Tarifa */}
                        {showRate && typeof displayRate === 'number' && (
                          <div className="flex justify-center items-baseline">
                            <span className="font-headline text-2xl font-bold text-primary">
                              ${displayRate.toLocaleString('es-AR')}
                            </span>
                            <span className="text-sm text-muted-foreground">/análisis</span>
                          </div>
                        )}
                        {/* Botones de acción */}
                        <div className="flex flex-col gap-2 w-full">
                          <Button 
                            variant="outline"
                            className="w-full" 
                            onClick={() => {
                              setSelectedCoachForMessage(coach);
                              setMessageDialogOpen(true);
                            }}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Enviar Mensaje
                          </Button>
                          <div
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🔘 DIV onClick ejecutado - wrapper del botón');
                              alert('✅ DIV clickeado - el evento funciona!');
                              setCoachSelectionDialogOpen(false);
                              handleRequestReview(coach);
                            }}
                            onMouseDown={(e) => {
                              console.log('🖱️ DIV onMouseDown');
                            }}
                            style={{ width: '100%' }}
                          >
                            <Button 
                              className="w-full" 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔘 BUTTON onClick ejecutado');
                                alert('✅ BUTTON clickeado!');
                                console.log('Coach:', coach);
                                console.log('showRate:', coach.showRate);
                                console.log('ratePerAnalysis:', coach.ratePerAnalysis);
                                setCoachSelectionDialogOpen(false);
                                handleRequestReview(coach);
                              }}
                              onMouseDown={(e) => {
                                console.log('🖱️ BUTTON onMouseDown');
                                e.stopPropagation();
                              }}
                              disabled={false}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Pagar y Solicitar Revisión
                              {!showRate || typeof displayRate !== 'number' ? ' (Sin tarifa)' : ''}
                            </Button>
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de mensaje */}
      <Dialog 
        open={messageDialogOpen} 
        onOpenChange={(open) => {
          setMessageDialogOpen(open);
          if (!open) {
            setSelectedCoachForMessage(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensaje a {selectedCoachForMessage?.name}</DialogTitle>
            <CardDescription>Envía un mensaje breve al entrenador.</CardDescription>
          </DialogHeader>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={4}
            placeholder="Escribe tu mensaje aquí..."
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMessageDialogOpen(false)}
              disabled={sendingMessage}
            >
              Cancelar
            </Button>
            <Button
              disabled={sendingMessage || !user || !messageText.trim()}
              onClick={handleSendMessage}
            >
              {sendingMessage ? 'Enviando…' : 'Enviar mensaje'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de pago */}
      <Dialog
        open={unlockDialogOpen}
        onOpenChange={(open) => {
          console.log('🔔 Dialog onOpenChange:', open, 'unlockDialogOpen actual:', unlockDialogOpen);
          setUnlockDialogOpen(open);
          if (!open) {
            setUnlockCoach(null);
            setUnlockError(null);
            setPaymentProvider('mercadopago'); // Reset al cerrar
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {unlockCoach ? `Solicitar revisión con ${unlockCoach.name}` : 'Solicitar revisión'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              El pago desbloqueará el análisis para que el entrenador pueda ver tus videos y dejar la devolución.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Análisis</span>
              </div>
              <div className="mt-2 text-muted-foreground">
                <p>{analysis.shotType || 'Análisis de tiro'}</p>
                {analysis.createdAt && (
                  <p>Subido el {new Date(analysis.createdAt).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}</p>
                )}
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-2">
                  El precio mostrado incluye la tarifa del entrenador más un 30% adicional por costo de servicio de la plataforma.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span>Tarifa del entrenador</span>
                <span className="font-semibold">
                  {coachRate != null ? `$${coachRate.toLocaleString('es-AR')}` : 'No disponible'}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Costo de servicio de la plataforma (30%)</span>
                <span>{platformFee != null ? `$${platformFee.toLocaleString('es-AR')}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t font-semibold text-lg">
                <span>Total a pagar</span>
                <span className="text-primary">
                  {totalAmount != null ? `$${totalAmount.toLocaleString('es-AR')}` : '-'}
                </span>
              </div>
            </div>

            {/* Selector de método de pago - SIEMPRE visible */}
            <div className="rounded-md border p-3 text-sm space-y-2 bg-blue-50 border-blue-200">
              <label className="font-medium">Método de pago</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentProvider === 'mercadopago' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    console.log('🔘 Seleccionando MercadoPago');
                    setPaymentProvider('mercadopago');
                  }}
                >
                  {paymentProvider === 'mercadopago' && '✓ '}MercadoPago
                </Button>
                <Button
                  type="button"
                  variant={paymentProvider === 'dlocal' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    console.log('🔘 Seleccionando Tarjeta de crédito/débito (dLocal)');
                    setPaymentProvider('dlocal');
                  }}
                >
                  {paymentProvider === 'dlocal' && '✓ '}Tarjeta de crédito o débito
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Seleccionado: <strong>{paymentProvider === 'mercadopago' ? 'MercadoPago' : 'Tarjeta de crédito o débito'}</strong>
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Después del pago, el entrenador recibirá una notificación y podrás escribirle para coordinar la devolución personalizada.
            </p>

            {unlockError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {unlockError}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setUnlockDialogOpen(false)} 
              disabled={creatingUnlock || simulatingPayment}
            >
              Cancelar
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 Botón "Pagar y solicitar revisión" clickeado en el diálogo');
                console.log('📋 Estado actual:', {
                  creatingUnlock,
                  simulatingPayment,
                  unlockCoach: !!unlockCoach,
                  coachRate,
                  platformFee,
                  paymentProvider,
                });
                if (!creatingUnlock && !simulatingPayment && unlockCoach && coachRate != null && platformFee != null) {
                  console.log('✅ Todas las condiciones cumplidas, llamando handleCreateUnlock con paymentProvider:', paymentProvider);
                  handleCreateUnlock();
                } else {
                  console.warn('⚠️ Botón deshabilitado o condiciones no cumplidas');
                }
              }}
              disabled={
                creatingUnlock ||
                simulatingPayment ||
                !unlockCoach ||
                coachRate == null ||
                platformFee == null
              }
            >
              {creatingUnlock ? 'Abriendo pago...' : 'Pagar y solicitar revisión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
