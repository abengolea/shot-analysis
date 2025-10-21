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
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
} from "@/components/ui/dialog";
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
  Pencil,
  Circle as CircleIcon,
  Eraser,
  ListChecks,
  Users,
  Star,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { DrillCard } from "./drill-card";
import { DetailedChecklist } from "./detailed-checklist";
import { CANONICAL_CATEGORIES } from "@/lib/canonical-checklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getAuth, getIdToken } from "firebase/auth";
import ShareButtons from "@/components/share-buttons";
import { useToast } from "@/hooks/use-toast";

interface AnalysisViewProps {
  analysis: ShotAnalysis;
  player: Player;
}

export function AnalysisView({ analysis, player }: AnalysisViewProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
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
    if (!analysis.id) return;
    
    try {
      setSmartKeyframesLoading(true);
            const response = await fetch(`/api/analyses/${analysis.id}/smart-keyframes`);
      if (!response.ok) {
        if (response.status === 404) {
                    setSmartKeyframesLoading(false);
          return;
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
            setSmartKeyframes(data);
      setSmartKeyframesLoading(false);
    } catch (error) {
      console.error('❌ Error cargando smart keyframes:', error);
      setSmartKeyframesLoading(false);
    }
  }, [analysis.id]);

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
      setKeyframesLoading(false); // Keyframes cargados
    } else if (!anyIncoming && !anyLocal) {
      // Si no hay keyframes en el análisis ni localmente, pero hay videos disponibles, mostrar loading
      const hasVideos = expectedKeys.some((k) => {
        const videoKey = k === 'front' ? 'videoFrontUrl' : 
                        k === 'back' ? 'videoBackUrl' : 
                        k === 'left' ? 'videoLeftUrl' : 'videoRightUrl';
        return !!(analysis as any)[videoKey];
      });
      if (hasVideos) {
        setKeyframesLoading(true);
      }
    }
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
          const mappedItem = {
            id: item.id || normalizeIdFromName(item.name),
            name: item.name,
            score: item.score || 0,
            status: item.status || 'no_evaluable',
            comment: item.comment || '',
            evidencia: item.evidencia || '',
            rating: item.rating, // Usar el rating de la IA, undefined si no existe
            description: item.comment || '' // Usar comment como description
          };
                    return mappedItem;
        }) as DetailedChecklistItem[];
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

    // Función para mapear IDs de Gemini a IDs canónicos
    const mapGeminiToCanonical = (geminiId: string): string => {
      const normalized = normalizeId(geminiId);
      
      // Mapeo específico de IDs problemáticos
      const mapping: Record<string, string> = {
        'alineacion_de_pies': 'alineacion_pies',
        'alineacion_corporal': 'alineacion_cuerpo',
        'flexion_de_rodillas': 'flexion_rodillas',
        'mano_no_dominante_en_ascenso': 'mano_no_dominante_ascenso',
        'codos_cerca_del_cuerpo': 'codos_cerca_cuerpo',
        'subida_recta_del_balon': 'subida_recta_balon',
        'tiempo_de_lanzamiento': 'tiempo_lanzamiento',
        'tiro_en_un_solo_tiempo': 'tiro_un_solo_tiempo',
        'transferencia_energetica_sincronia_con_piernas': 'sincronia_piernas',
        'mano_no_dominante_en_liberacion': 'mano_no_dominante_liberacion',
        'extension_completa_del_brazo': 'extension_completa_brazo',
        'giro_de_la_pelota': 'giro_pelota',
        'angulo_de_salida': 'angulo_salida',
        'mantenimiento_del_equilibrio': 'mantenimiento_equilibrio',
        'equilibrio_en_aterrizaje': 'equilibrio_aterrizaje',
        'duracion_del_follow_through': 'duracion_follow_through',
        'duracion_del_followthrough': 'duracion_follow_through',
        'consistencia_del_movimiento': 'consistencia_repetitiva',
        'consistencia_tecnica': 'consistencia_repetitiva',
        'consistencia_de_resultados': 'consistencia_repetitiva'
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

    // Construir checklist canónico y superponer datos de IA por id (sin agregar otros ítems)
    const canonical = CANONICAL_CATEGORIES.map((cat) => {
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

  const [checklistState, setChecklistState] = useState<ChecklistCategory[]>(() => {
        if (analysis.detailedChecklist && Array.isArray(analysis.detailedChecklist)) {
      const normalized = normalizeChecklist(analysis.detailedChecklist);
      return normalized;
    }
    return [];
  });

  // ===== Feedback del entrenador (privado para jugador y coach) =====
  const [coachFeedbackByItemId, setCoachFeedbackByItemId] = useState<Record<string, { rating?: number; comment?: string }>>({});
  const [coachSummary, setCoachSummary] = useState<string>("");
  const isCoach = (userProfile as any)?.role === 'coach' || (userProfile as any)?.role === 'admin';

  useEffect(() => {
    // Cargar feedback del coach si es coach o admin
    const load = async () => {
      try {
        const auth = getAuth();
        const u = auth.currentUser;
        if (!u) return;
        const token = await getIdToken(u);
        const res = await fetch(`/api/analyses/${analysis.id}/coach-feedback`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const fb = data?.feedback;
        if (fb) {
          setCoachFeedbackByItemId(fb.items || {});
          setCoachSummary(fb.coachSummary || "");
        }
      } catch {}
    };
    void load();
  }, [analysis.id]);

  const onCoachFeedbackChange = (itemId: string, next: { rating?: number; comment?: string }) => {
    setCoachFeedbackByItemId((prev) => ({ ...prev, [itemId]: { rating: next.rating, comment: next.comment } }));
  };

  // Guardar feedback del entrenador
  const saveCoachFeedback = async () => {
    try {
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
      if (!res.ok) throw new Error('save failed');
      toast({ title: 'Feedback guardado', description: 'Se enviaron discrepancias a revisión de IA si correspondía.' });
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo guardar el feedback.', variant: 'destructive' });
    }
  };

  // Derivados del checklist basados en rating 1..5 (ordenados por importancia)
  const flatChecklistItems = checklistState.flatMap((c) => c.items);

  const checklistStrengths = flatChecklistItems
    .filter((item) => (item.rating || 3) >= 4)
    .sort((a, b) => (b.rating || 3) - (a.rating || 3)) // 5 primero, luego 4
    .map((item) => item.name);

  const checklistWeaknesses = flatChecklistItems
    .filter((item) => (item.rating || 3) <= 2)
    .sort((a, b) => (a.rating || 3) - (b.rating || 3)) // 1 primero, luego 2
    .map((item) => item.name);

  const checklistRecommendations = flatChecklistItems
    .filter((item) => (item.rating || 3) <= 3 && String(item.comment || '').trim() !== "")
    .sort((a, b) => {
      const ra = a.rating || 3;
      const rb = b.rating || 3;
      if (ra !== rb) return ra - rb; // peor primero
      const la = String(a.comment || '').length;
      const lb = String(b.comment || '').length;
      return lb - la; // comentario más sustancioso primero
    })
    .map((item) => `${item.name}: ${item.comment}`);

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
  const analysisResult: any = (analysis as any).analysisResult || {};
  if (allRatings.length === 0 && Array.isArray(analysisResult.detailedChecklist)) {
    allRatings = (analysisResult.detailedChecklist as any[])
      .flatMap((c: any) => c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
      .filter((v: any) => typeof v === 'number');
  }
  const derivedSummary: string = analysis.analysisSummary || analysisResult.analysisSummary || 'Análisis completado';
  // Preferir valores del análisis; si no, usar los derivados del checklist; si tampoco, usar analysisResult
  const strengthsFromChecklist = checklistStrengths || [];
  const weaknessesFromChecklist = checklistWeaknesses || [];
  const recommendationsFromChecklist = checklistRecommendations || [];
  const derivedStrengths: string[] = (analysis.strengths && analysis.strengths.length > 0)
    ? analysis.strengths
    : (strengthsFromChecklist.length > 0 ? strengthsFromChecklist : (analysisResult.strengths || []));
  const derivedWeaknesses: string[] = (analysis.weaknesses && analysis.weaknesses.length > 0)
    ? analysis.weaknesses
    : (weaknessesFromChecklist.length > 0 ? weaknessesFromChecklist : (analysisResult.weaknesses || []));
  const derivedRecommendations: string[] = (analysis.recommendations && analysis.recommendations.length > 0)
    ? analysis.recommendations
    : (recommendationsFromChecklist.length > 0 ? recommendationsFromChecklist : (analysisResult.recommendations || []));
  const derivedKeyframeAnalysis: string | null = (analysis as any).keyframeAnalysis || analysisResult.keyframeAnalysis || null;

  const toPct = (score: number): number => {
    if (score <= 10) return Math.round(score * 10);
    if (score <= 5) return Math.round((score / 5) * 100);
    return Math.round(score);
  };

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

  const canEdit = userProfile?.role === 'coach' && userProfile.id === (player?.coachId || '');
  const [completing, setCompleting] = useState(false);
  const markCompleted = async () => {
    if (!canEdit) return;
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

  type KeyframeComment = { id?: string; comment: string; coachName?: string; createdAt: string };
  const [keyframeComments, setKeyframeComments] = useState<KeyframeComment[]>([]);
  const [newComment, setNewComment] = useState("");

  type KeyframeAnnotation = { id?: string; overlayUrl: string; createdAt: string };
  const [annotations, setAnnotations] = useState<KeyframeAnnotation[]>([]);

  // Canvas overlay refs y estado de herramienta
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const toolRef = useRef<'move' | 'pencil' | 'circle' | 'eraser'>("move");
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const beginDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current === 'move') return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    drawingRef.current = true; startPointRef.current = { x, y };
    if (toolRef.current === 'pencil' || toolRef.current === 'eraser') {
      const ctx = canvasRef.current?.getContext('2d'); if (!ctx || !canvasRef.current) return;
      ctx.lineWidth = toolRef.current === 'eraser' ? 16 : 3;
      ctx.strokeStyle = toolRef.current === 'eraser' ? 'rgba(0,0,0,1)' : '#ef4444';
      ctx.globalCompositeOperation = toolRef.current === 'eraser' ? 'destination-out' : 'source-over';
      ctx.beginPath(); ctx.moveTo(x, y);
    }
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    if (toolRef.current === 'pencil' || toolRef.current === 'eraser') {
      ctx.lineTo(x, y); ctx.stroke();
    } else if (toolRef.current === 'circle') {
      const sp = startPointRef.current; if (!sp || !canvasRef.current) return;
      // Redibujar círculo provisional: limpiar y no borrar el trazo previo
      // Para simplicidad, limpiar solo el último círculo provisional pintando sobre una capa temporal no implementada; aquí trazamos guía mínima
    }
  };
  const endDraw = () => { drawingRef.current = false; startPointRef.current = null; };

  const loadCommentsAndAnnotations = useCallback(async () => {
    if (!selectedKeyframe) return;
    try {
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-comments?keyframeUrl=${encodeURIComponent(selectedKeyframe)}`);
      if (res.ok) {
        const data = await res.json();
        setKeyframeComments(Array.isArray(data.comments) ? data.comments : []);
      } else { setKeyframeComments([]); }
    } catch { setKeyframeComments([]); }
    try {
      const res2 = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-annotations?keyframeUrl=${encodeURIComponent(selectedKeyframe)}`);
      if (res2.ok) {
        const data2 = await res2.json();
        setAnnotations(Array.isArray(data2.annotations) ? data2.annotations : []);
      } else { setAnnotations([]); }
    } catch { setAnnotations([]); }
  }, [selectedKeyframe, safeAnalysis.id]);

  useEffect(() => {
    if (isModalOpen) { void loadCommentsAndAnnotations(); }
  }, [isModalOpen, loadCommentsAndAnnotations]);

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
      angleKeyframes = smartAngleKeyframes.map(kf => kf.imageBuffer);
          } else if (Array.isArray(traditionalAngleKeyframes) && traditionalAngleKeyframes.length > 0) {
      // Usar keyframes tradicionales (URLs)
      angleKeyframes = traditionalAngleKeyframes;
          }
    
        if (angleKeyframes.length > 0) {
      setCurrentKeyframes(angleKeyframes);
          } else {
            setCurrentKeyframes([]);
    }
    
    setIsModalOpen(true);
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
  }, [isModalOpen, canNavigatePrev, canNavigateNext, navigateToKeyframe]);

  const saveComment = async () => {
    if (!canEdit || !selectedKeyframe) return;
    const text = newComment.trim(); if (!text) return;
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      const body: any = { keyframeUrl: selectedKeyframe, comment: text };
      if (selectedAngle) body.angle = selectedAngle; if (typeof selectedIndex === 'number') body.index = selectedIndex;
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body)
      });
      if (res.ok) { setNewComment(""); await loadCommentsAndAnnotations(); }
    } catch {}
  };

  const saveAnnotation = async () => {
    if (!canEdit || !selectedKeyframe || !canvasRef.current) return;
    try {
      const overlayDataUrl = canvasRef.current.toDataURL('image/png');
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) return;
      const token = await getIdToken(cu, true);
      const body: any = { keyframeUrl: selectedKeyframe, overlayDataUrl };
      if (selectedAngle) body.angle = selectedAngle; if (typeof selectedIndex === 'number') body.index = selectedIndex;
      const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframe-annotations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body)
      });
      if (res.ok) { clearCanvas(); await loadCommentsAndAnnotations(); }
    } catch (e) { console.error(e); }
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
        reviewed += 1;
        sumCoach += cf.rating;
        if (cf.rating === it.ia) agreed += 1; else { changed += 1; diffs.push({ id: it.id, name: it.name, ia: it.ia, coach: cf.rating }); }
      }
    }
    const avgCoach = reviewed > 0 ? Number((sumCoach / reviewed).toFixed(2)) : null;
    return { reviewed, agreed, changed, avgCoach, diffs };
  }, [checklistState, coachFeedbackByItemId]);

  // Función para renderizar smart keyframes (data URLs)
  const renderSmartKeyframes = (keyframes: Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }>, angleLabel: string, angleKey: 'front'|'back'|'left'|'right') => {
        if (!keyframes || keyframes.length === 0) {
            return <div className="text-center py-4 text-muted-foreground">No hay fotogramas disponibles</div>;
    }
    
    return (
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6 justify-items-center">
        {keyframes.map((keyframe, index) => {
                    return (
            <div key={`${angleKey}-${index}`} className="space-y-2 text-center">
              {/* Botón con imagen */}
              <button 
                onClick={() => openKeyframeModal(keyframe.imageBuffer, angleKey, index)} 
                className="relative overflow-hidden rounded-lg border aspect-square focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:scale-105 w-24 h-24 md:w-28 md:h-28"
              >
                {/* Imagen usando data URL */}
                <img
                  src={keyframe.imageBuffer}
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
                    return (
            <div key={`${angleKey}-${index}`} className="space-y-2 text-center">
              {/* DEBUG: Mostrar URL */}
              <div className="text-xs text-gray-500 truncate max-w-32" title={keyframe}>
                URL: {keyframe}
              </div>
              
              {/* Botón con imagen */}
              <button 
                onClick={() => openKeyframeModal(keyframe, angleKey, index)} 
                className="relative overflow-hidden rounded-lg border aspect-square focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:scale-105 w-24 h-24 md:w-28 md:h-28"
              >
                {/* Imagen de Next.js */}
                <Image
                  src={keyframe}
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
  return (
    <>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full flex gap-2 overflow-x-auto flex-nowrap md:grid md:grid-cols-5">
          <TabsTrigger value="ai-analysis" className="min-w-[140px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <Bot className="mr-2" /> Análisis IA
          </TabsTrigger>
          <TabsTrigger value="videos" className="min-w-[180px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <Camera className="mr-2" /> Videos y fotogramas
          </TabsTrigger>
          <TabsTrigger value="checklist" className="min-w-[120px] md:min-w-0 whitespace-nowrap flex-shrink-0">
              <ListChecks className="mr-2" /> Checklist IA
          </TabsTrigger>
          <TabsTrigger value="coach-checklist" className="min-w-[180px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <ListChecks className="mr-2" /> Checklist Entrenador
          </TabsTrigger>
          <TabsTrigger value="improvement-plan" className="min-w-[150px] md:min-w-0 whitespace-nowrap flex-shrink-0">
            <Dumbbell className="mr-2" /> Plan de Mejora
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai-analysis" className="mt-6">
          <div className="flex flex-col gap-8">
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
            {/* Aviso de análisis parcial */}
            {isPartialAnalysis && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <ShieldAlert className="h-5 w-5" />
                    Análisis Parcial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-amber-700">
                      Este análisis se realizó con videos limitados. Para un análisis completo, se recomienda subir videos desde múltiples ángulos.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm font-medium text-amber-700">Videos disponibles:</span>
                      {availableAngles.map(angle => (
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
                        {missingAngles.map(angle => (
                          <Badge key={angle} variant="outline" className="border-amber-300 text-amber-600">
                            {angle === 'front' ? 'Frente' : 
                             angle === 'back' ? 'Espalda' : 
                             angle === 'left' ? 'Izquierda' : 'Derecha'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                    <div className="space-y-1">
                      <p className="text-sm text-blue-700 font-medium">Score Final</p>
                      <p className="text-3xl font-bold text-blue-900">
                        {(safeAnalysis as any).scoreMetadata.weightedScore}/100
                      </p>
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

            <Card>
              <CardHeader>
                <CardTitle className="font-headline">
                  Resumen del Análisis de IA
                </CardTitle>
                <Badge variant="outline" className="w-fit">
                  {safeAnalysis.shotType}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{safeAnalysis.analysisSummary}</p>
                {avgRating != null && (
                  <div className="mt-3 flex items-center gap-3">
                    <Badge>{Math.round((avgRating/5)*100)} / 100</Badge>
                    <span className="text-sm text-muted-foreground">Evaluación final: {scoreLabel(avgRating)}</span>
                  </div>
                )}
                <div className="mt-6 rounded-md border bg-muted/30 p-4">
                  <p className="text-sm font-medium">¿Te sirvió este análisis? Compartilo en tus redes:</p>
                  <div className="mt-3">
                    <ShareButtons text="Mirá mi análisis de tiro en IaShot" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fortalezas, Debilidades y Recomendaciones (IA) */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2 text-green-600">
                    <CheckCircle2 /> Fortalezas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checklistStrengths.length > 0 ? (
                    <ul className="grid list-inside list-disc grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                      {checklistStrengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      La IA no encontró fortalezas destacadas en este intento.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2 text-destructive">
                    <XCircle /> Debilidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checklistWeaknesses.length > 0 ? (
                    <ul className="grid list-inside list-disc grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                      {checklistWeaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      La IA no encontró debilidades claras en este intento.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-accent">
                  <Lightbulb /> Recomendaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {checklistRecommendations.length > 0 ? (
                  <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                    {checklistRecommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    El entrenador no ha dejado recomendaciones específicas en el
                    checklist.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* (Videos y Fotogramas) fue movido a la pestaña "videos" */}
          </div>
        </TabsContent>
        <TabsContent value="videos" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Camera /> Video y Fotogramas
              </CardTitle>
              <CardDescription>
                Haz clic en un fotograma para ampliarlo, dibujar y comentar.
              </CardDescription>
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

                return (
                  <div className="grid gap-6 md:grid-cols-2">
                    {((safeAnalysis as any).videoBackUrl) && (
                      <div>
                        <h4 className="font-medium mb-2">Trasera</h4>
                        <video
                          controls
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={(safeAnalysis as any).videoBackUrl}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                    {((safeAnalysis as any).videoFrontUrl || (safeAnalysis as any).videoUrl) && (
                      <div>
                        <h4 className="font-medium mb-2">Frontal</h4>
                        <video
                          controls
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={(safeAnalysis as any).videoFrontUrl || (safeAnalysis as any).videoUrl}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                    {(safeAnalysis as any).videoLeftUrl && (
                      <div>
                        <h4 className="font-medium mb-2">Lateral Izquierdo</h4>
                        <video
                          controls
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={(safeAnalysis as any).videoLeftUrl}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                    {(safeAnalysis as any).videoRightUrl && (
                      <div>
                        <h4 className="font-medium mb-2">Lateral Derecho</h4>
                        <video
                          controls
                          className="w-full rounded-lg shadow-lg max-h-[360px]"
                          src={(safeAnalysis as any).videoRightUrl}
                        >
                          Tu navegador no soporta el elemento video.
                        </video>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botón dev para generar si no hay nada - SOLO PARA ADMINS */}
              {availableAngles.length === 0 && userProfile?.role === 'admin' && (
                <div className="flex items-center justify-center mb-6">
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
                      onClick={async () => {
                        try {
                          setUploadingFromClient(true);
                          // Intentar extraer 12 frames desde el video visible del DOM
                          const v = document.querySelector('video');
                          if (!v) return;
                          const videoEl = v as HTMLVideoElement;
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          await new Promise<void>((r)=>{ if (videoEl.readyState>=2) r(); else videoEl.addEventListener('loadedmetadata', ()=>r(), { once: true }); });
                          const count = 12; const urls: Array<{ dataUrl: string; timestamp: number }> = [];
                          canvas.width = Math.max(160, videoEl.videoWidth/4|0); canvas.height = Math.max(160, (videoEl.videoHeight/videoEl.videoWidth*canvas.width)|0);
                          const interval = Math.max(0.1, Math.min( (videoEl.duration||6)/(count+1), 2 ));
                          for (let i=1;i<=count;i++){
                            const t = Math.min(videoEl.duration-0.001, i*interval);
                            videoEl.pause(); videoEl.currentTime = t;
                            await new Promise<void>((r)=>{ const onS=()=>{videoEl.removeEventListener('seeked', onS); r();}; videoEl.addEventListener('seeked', onS); });
                            ctx.drawImage(videoEl, 0,0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            urls.push({ dataUrl, timestamp: t });
                          }
                          const res = await fetch(`/api/analyses/${safeAnalysis.id}/keyframes/upload`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ angle:'front', frames: urls }) });
                          const data = await res.json();
                          if (res.ok && data?.keyframes) setLocalKeyframes(data.keyframes);
                        } finally { setUploadingFromClient(false); }
                      }}
                    >
                      {uploadingFromClient ? 'Generando (cliente)…' : 'Generar (desde este video)'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Keyframes inteligentes por ángulo con Accordion */}
              {(smartKeyframesLoading || (['front','back','left','right'] as const).some((k) => Array.isArray((smartKeyframes as any)[k]) && (smartKeyframes as any)[k].length > 0)) && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Fotogramas
                    {smartKeyframesLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Procesando con IA...</span>
                      </div>
                    )}
                  </h3>
                  {smartKeyframesLoading && !(['front','back','left','right'] as const).some((k) => Array.isArray((smartKeyframes as any)[k]) && (smartKeyframes as any)[k].length > 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                      <p className="text-lg font-medium">Procesando fotogramas clave con IA...</p>
                      <p className="text-sm">Esto puede tomar unos minutos dependiendo del tamaño de los videos</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {([
                        { key: 'front' as const, label: 'Vista Frontal', labelAdj: 'frontal', icon: '👁️' },
                        { key: 'back' as const, label: 'Vista Trasera', labelAdj: 'espalda', icon: '🔄' },
                        { key: 'left' as const, label: 'Vista Lateral Izquierda', labelAdj: 'izquierdo', icon: '◀️' },
                        { key: 'right' as const, label: 'Vista Lateral Derecha', labelAdj: 'derecho', icon: '▶️' },
                      ]).map(({ key, label, labelAdj, icon }) => {
                        // Usar solo keyframes inteligentes
                        const smartArr = (smartKeyframes as any)[key] as Array<{ index: number; timestamp: number; description: string; importance: number; phase: string; imageBuffer: string }> | undefined;
                        const hasSmartKeyframes = Array.isArray(smartArr) && smartArr.length > 0;
                        
                        if (!hasSmartKeyframes) return null;
                        
                        return (
                          <AccordionItem key={key} value={key} className="border rounded-lg mb-2">
                            <AccordionTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{icon}</span>
                                <div className="text-left">
                                  <p className="font-medium">{label}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {smartArr!.length} fotogramas inteligentes • Click para expandir
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 py-4 bg-muted/20">
                              {renderSmartKeyframes(smartArr!, labelAdj, key)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="coach-checklist" className="mt-6">
          {isCoach ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <ListChecks /> Checklist del Entrenador
                </CardTitle>
                <CardDescription>Resultado con tus calificaciones y comentarios por ítem.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {checklistState.map((cat) => (
                  <div key={`cc-${cat.category}`} className="space-y-2">
                    <div className="text-sm font-semibold">{cat.category}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cat.items.map((it) => {
                        const cf = coachFeedbackByItemId[it.id];
                        if (!cf || typeof cf.rating !== 'number') return null;
                        return (
                          <div key={`cc-item-${it.id}`} className="rounded border p-3 text-sm">
                            <div className="font-medium mb-1">{it.name}</div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge>Coach {cf.rating}</Badge>
                              <span className="text-muted-foreground">IA {it.rating}</span>
                            </div>
                            {cf.comment && (
                              <div className="text-muted-foreground">{cf.comment}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Comentario global</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-line">{coachSummary || 'Sin comentario global'}</div>
                </div>
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
                    <a href="/coach/coaches">Buscar Entrenador</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
                  <div className="space-y-1">
                    <p className="text-sm text-blue-700 font-medium">Score Final</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {(safeAnalysis as any).scoreMetadata.weightedScore}/100
                    </p>
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
                  editable={userProfile?.role === 'coach' && userProfile.id === (player?.coachId || '')}
                  showCoachBox={false}
                  coachInline={isCoach}
                  coachIsEditable={isCoach}
                  coachFeedbackByItemId={coachFeedbackByItemId}
                  onCoachFeedbackChange={onCoachFeedbackChange}
                  getScoreColor={getScoreColor}
                  getStatusColor={getStatusColor}
                  renderStars={renderStars}
                />
              );
            } catch (error) {
              console.error('❌ Error rendering DetailedChecklist:', error);
              return <div>Error rendering checklist: {error.message}</div>;
            }
          })()}
          {isCoach && (
            <div className="mt-6 space-y-4">
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
                          <li key={d.id}>{d.name}: IA {d.ia} → Coach {d.coach}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Comentario global</div>
                    <Textarea value={coachSummary} onChange={(e) => setCoachSummary(e.target.value)} placeholder="Comentario global y próximos pasos" className="text-sm" />
                  </div>
                  <div>
                    <Button onClick={saveCoachFeedback}>Guardar revisión</Button>
                    <Button className="ml-2" variant="secondary" onClick={markCompleted} disabled={completing}>
                      {completing ? 'Marcando…' : 'Terminado'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
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
                    <Button variant="outline" asChild className="border-green-300 text-green-700 hover:bg-green-100">
                      <a href="/player/messages">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contactar Entrenador
                      </a>
                    </Button>
                    <Button asChild className="bg-green-600 hover:bg-green-700">
                      <a href="/player/dashboard">
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
                    <a href="/coach/coaches">
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
              <Image
                src={selectedKeyframe || "https://placehold.co/600x600.png"}
                alt="Fotograma seleccionado"
                width={isExpanded ? 800 : 600}
                height={isExpanded ? 800 : 600}
                className="rounded-lg border"
              />
              {/* overlays guardados */}
              {annotations.map((a, i) => (
                <img key={a.id || i} src={a.overlayUrl} alt="overlay" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              ))}
              {/* canvas de dibujo */}
              <canvas
                ref={canvasRef}
                width={isExpanded ? 800 : 600}
                height={isExpanded ? 800 : 600}
                className="absolute inset-0 rounded-lg"
                style={{ cursor: toolRef.current === 'pencil' ? 'crosshair' : toolRef.current === 'eraser' ? 'cell' : 'default' }}
                onMouseDown={beginDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
              <div className="absolute top-2 left-2 flex flex-col gap-2 rounded-lg border bg-background/80 p-2 shadow-lg backdrop-blur-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => { toolRef.current = 'move'; }}
                  title="Herramienta de movimiento"
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'circle'; }}><CircleIcon /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'eraser'; }}><Eraser /></Button>
                    <Button variant="secondary" size="sm" onClick={saveAnnotation}>Guardar dibujo</Button>
                    <Button variant="outline" size="sm" onClick={clearCanvas}>Limpiar</Button>
                  </>
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
                    <div className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg">
                      Aún no hay comentarios para este fotograma.
                    </div>
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
                  {canEdit && (
                    <>
                      <Textarea placeholder="Añade tu comentario aquí..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                      <Button className="w-full" onClick={saveComment}>Guardar Comentario</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
