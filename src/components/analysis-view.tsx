"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Accordion } from "@/components/ui/accordion";
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
} from "lucide-react";
import { DrillCard } from "./drill-card";
import { DetailedChecklist } from "./detailed-checklist";
import { computeCategorySubtotal, getCategoryNominalWeight, getItemWeight } from "@/lib/scoring";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getAuth, getIdToken } from "firebase/auth";
import ShareButtons from "@/components/share-buttons";

interface AnalysisViewProps {
  analysis: ShotAnalysis;
  player: Player;
}

export function AnalysisView({ analysis, player }: AnalysisViewProps) {
  const { userProfile } = useAuth();
  console.log('🎯 AnalysisView recibió:', analysis);
  console.log('👤 Player recibido:', player);
  
  // Asegurar que keyframes tenga la estructura correcta
  const safeKeyframes = analysis.keyframes || {
    front: [],
    back: [],
    left: [],
    right: []
  };

  const [localKeyframes, setLocalKeyframes] = useState<typeof safeKeyframes>(safeKeyframes);

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
  }, [analysis.keyframes]);

  // Solo mostrar ángulos que tengan keyframes disponibles (preferir estado local)
  const knownAngles: Array<'front'|'back'|'left'|'right'> = ['front','back','left','right'];
  const hasAngleAvailable = (angle: 'front'|'back'|'left'|'right'): boolean => {
    const kfs = (localKeyframes as any)[angle];
    const hasKfs = Array.isArray(kfs) && kfs.length > 0;
    const anyObj = analysis as any;
    const hasVideo = angle === 'front'
      ? Boolean(anyObj?.videoUrl)
      : angle === 'back'
        ? Boolean(anyObj?.videoBackUrl)
        : angle === 'left'
          ? Boolean(anyObj?.videoLeftUrl)
          : Boolean(anyObj?.videoRightUrl);
    console.log(`🔍 Ángulo ${angle}: kfs=${hasKfs} video=${hasVideo}`);
    return hasKfs || hasVideo;
  };
  const availableAngles = knownAngles.filter((a) => hasAngleAvailable(a));

  console.log('📹 Ángulos disponibles:', availableAngles);
  console.log('🔍 localKeyframes completo:', localKeyframes);
  console.log('🔍 localKeyframes.front:', localKeyframes.front);
  console.log('🔍 localKeyframes.back:', localKeyframes.back);
  console.log('🔍 localKeyframes.left:', localKeyframes.left);
  console.log('🔍 localKeyframes.right:', localKeyframes.right);

  // Verificar si el análisis es parcial (menos de 4 ángulos)
  const isPartialAnalysis = availableAngles.length < 4;
  const missingAngles = knownAngles.filter((angle) => !availableAngles.includes(angle));

  console.log('⚠️ ¿Es análisis parcial?', isPartialAnalysis);
  console.log('❌ Ángulos faltantes:', missingAngles);

  // Estado del checklist (usar directamente lo que venga en analysis)
  const normalizeChecklist = (cats: ChecklistCategory[]): ChecklistCategory[] => {
    if (!Array.isArray(cats)) return [];
    // Target buckets
    const buckets: Record<string, ChecklistCategory> = {};
    const getBucket = (name: string) => {
      const key = name.trim();
      if (!buckets[key]) buckets[key] = { category: key, items: [] } as ChecklistCategory;
      return buckets[key];
    };
    // Helper to decide destination
    const toPrep = (name: string) => /pies|base|posición de los pies|ancho/i.test(name);
    const toAscenso = (name: string) => /ascenso|elevaci[oó]n|tiempo\s*de\s*lanzamiento|captura\s*[→\->]\s*liberaci[oó]n|codo|alineaci[oó]n\s*del\s*codo|set\s*point|subida\s*recta|trayectoria\s*hasta\s*el\s*set\s*point/i.test(name);
    const toLiberacion = (name: string) => /liberaci[oó]n|extensi[oó]n\s*del\s*brazo|follow\s*-?through|giro\s*de\s*la\s*pelota|giro\s*de\s*bal[oó]n|back\s*spin|backspin/i.test(name);
    const isTimingCat = (catName: string) => /timing\s*y?\s*giro/i.test(catName);
    const isBackspinItem = (name: string) => /giro\s*de\s*la\s*pelota|giro\s*de\s*bal[oó]n|back\s*spin|backspin/i.test(name);
    const isTiempoLanzamiento = (it: DetailedChecklistItem) =>
      (it.id && /tiempo_?lanzamiento/i.test(it.id)) ||
      /tiempo\s*de\s*lanzamiento|velocidad\s*de\s*tir|captura\s*[→\->]\s*liberaci[oó]n/i.test(it.name || '');
    const isMunecaCargada = (it: DetailedChecklistItem) =>
      (it.id && /muneca_cargada/i.test(it.id)) ||
      /muñeca\s*cargada/i.test(it.name || '');
    cats.forEach((cat) => {
      const isFeetCat = /pies\s*y?\s*bases?/i.test(cat.category);
      const isTiming = isTimingCat(cat.category);
      cat.items.forEach((item) => {
        const itemName = item.name || '';
        // Normalizar: si no hay rating numérico, derivarlo desde status (legacy)
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
                      : 3; // fallback prudente
        const normalizedItem = { ...item, rating: normalizedRating } as DetailedChecklistItem;
        if (isMunecaCargada(item)) {
          getBucket('Preparación (17%)').items.push(normalizedItem);
        } else if (isTiming) {
          // Conservar Backspin y Tiempo/Velocidad dentro de "Ascenso y Liberación"
          if (isBackspinItem(itemName) || isTiempoLanzamiento(item)) {
            getBucket('Ascenso y Liberación').items.push(normalizedItem);
          }
        } else if (toPrep(itemName) || isFeetCat) {
          getBucket('Preparación (17%)').items.push(normalizedItem);
        } else if (toAscenso(itemName)) {
          getBucket('Ascenso (17%)').items.push(normalizedItem);
        } else if (toLiberacion(itemName)) {
          getBucket('Liberación (10%)').items.push(normalizedItem);
        } else {
          getBucket(cat.category).items.push(normalizedItem);
        }
      });
    });
    // Asegurar existencia de la categoría de Fluidez/Armonía (aunque venga vacía desde IA)
    const fluidezCategoryName = 'Fluidez (50%)';
    if (!buckets[fluidezCategoryName]) buckets[fluidezCategoryName] = { category: fluidezCategoryName, items: [] } as ChecklistCategory;
    // Inyectar ítem por defecto si falta
    const hasFluidezItem = (buckets[fluidezCategoryName].items || []).some(
      (it) => (it.name || '').trim() === fluidezCategoryName
    );
    if (!hasFluidezItem) {
      const defaultFluidez: DetailedChecklistItem = {
        id: 'fluidez_armonia',
        name: fluidezCategoryName,
        description: 'Evaluación de la transferencia energética coordinada a lo largo de todo el movimiento. Puntúa de 1 (muy pobre) a 10 (excelente).',
        rating: 4,
        comment: '',
        // incluir rating10 (campo opcional para este ítem especial)
        rating10: (typeof (analysis as any).fluidezScore10 === 'number' ? (analysis as any).fluidezScore10 : 5) as any,
      } as unknown as DetailedChecklistItem;
      buckets[fluidezCategoryName].items.push(defaultFluidez);
    }

    // Asegurar existencia de las categorías "Ascenso" y "Liberación"
    const ascensoCatName = 'Ascenso (17%)';
    const liberacionCatName = 'Liberación (10%)';
    if (!buckets[ascensoCatName]) buckets[ascensoCatName] = { category: ascensoCatName, items: [] } as ChecklistCategory;
    if (!buckets[liberacionCatName]) buckets[liberacionCatName] = { category: liberacionCatName, items: [] } as ChecklistCategory;
    // Inyectar ítem por defecto de Set Point si falta
    const setPointName = 'Set point (inicio del empuje de la pelota)';
    const hasSetPointItem = (buckets[ascensoCatName].items || []).some(
      (it) => /set\s*point/i.test(it.id || '') || (it.name || '').trim().toLowerCase() === setPointName.toLowerCase()
    );
    if (!hasSetPointItem) {
      const defaultSetPoint: DetailedChecklistItem = {
        id: 'set_point',
        name: setPointName,
        description: 'Altura de inicio del empuje y continuidad (un solo tiempo). Para Sub-12/13: pecho a debajo de la pera. En mayores: subir gradualmente sin superar la frente.',
        rating: 3,
        comment: '',
      } as DetailedChecklistItem;
      buckets[ascensoCatName].items.push(defaultSetPoint);
    }

    // Inyectar ítem por defecto: Subida recta del balón (3%)
    const subidaRectaId = 'subida_recta_balon';
    const hasSubidaRecta = (buckets[ascensoCatName].items || []).some(
      (it) => (it.id || '').trim() === subidaRectaId || /subida\s*recta\s*del\s*bal[oó]n/i.test(it.name || '')
    );
    if (!hasSubidaRecta) {
      const defaultSubidaRecta: DetailedChecklistItem = {
        id: subidaRectaId,
        name: 'Subida recta del balón',
        description: 'El balón debe ascender de forma vertical y cercana al eje corporal; evitar trayectorias inclinadas o desde el costado que rompan la alineación y la eficiencia del tiro.',
        rating: 3,
        comment: '',
      } as DetailedChecklistItem;
      buckets[ascensoCatName].items.push(defaultSubidaRecta);
    }

    // Inyectar ítem por defecto: Trayectoria del balón hasta el set point (3%)
    const trayectoriaId = 'trayectoria_hasta_set_point';
    const hasTrayectoria = (buckets[ascensoCatName].items || []).some(
      (it) => (it.id || '').trim() === trayectoriaId || /trayectoria\s*del\s*bal[oó]n\s*hasta\s*el\s*set\s*point/i.test(it.name || '')
    );
    if (!hasTrayectoria) {
      const defaultTrayectoria: DetailedChecklistItem = {
        id: trayectoriaId,
        name: 'Trayectoria del balón hasta el set point',
        description: 'El balón debe subir recto y cercano al eje corporal hacia el set point, evitando trayectorias circulares o abiertas que resten eficiencia.',
        rating: 3,
        comment: '',
      } as DetailedChecklistItem;
      buckets[ascensoCatName].items.push(defaultTrayectoria);
    }

    // Inyectar ítem por defecto: Mano no dominante durante el ascenso (binario, 2%)
    const ascensoHandId = 'mano_no_dominante_ascenso';
    const hasAscensoHand = (buckets[ascensoCatName].items || []).some(
      (it) => (it.id || '').trim() === ascensoHandId || /mano\s*no\s*dominante.*ascenso/i.test(it.name || '')
    );
    if (!hasAscensoHand) {
      const defaultAscensoHand: DetailedChecklistItem = {
        id: ascensoHandId,
        name: 'Posición de la mano no dominante (ascenso)',
        description: 'Debe acompañar sin interferir la dirección ni la fuerza de la mano dominante. No empuja ni desvía la pelota durante el ascenso.',
        rating: 3,
        comment: '',
      } as DetailedChecklistItem;
      buckets[ascensoCatName].items.push(defaultAscensoHand);
    }

    // Si quedó una categoría legacy "Ascenso y Liberación", migrar sus ítems y eliminarla
    const legacyAL = buckets['Ascenso y Liberación'];
    if (legacyAL && Array.isArray(legacyAL.items) && legacyAL.items.length) {
      for (const it of legacyAL.items) {
        const nm = (it.name || '');
        if (toLiberacion(nm)) buckets[liberacionCatName].items.push(it as DetailedChecklistItem);
        else buckets[ascensoCatName].items.push(it as DetailedChecklistItem);
      }
      delete buckets['Ascenso y Liberación'];
    }

    // Diagnóstico: registrar ids duplicados por categoría antes de deduplicar
    try {
      Object.keys(buckets).forEach((catName) => {
        const counts: Record<string, number> = {};
        (buckets[catName].items || []).forEach((it) => {
          const id = (it.id || '').trim();
          if (!id) return;
          counts[id] = (counts[id] || 0) + 1;
        });
        const dupIds = Object.keys(counts).filter((k) => counts[k] > 1);
        if (dupIds.length) {
          console.warn('Checklist: ids duplicados detectados en categoría', catName, dupIds);
        }
      });
    } catch {}

    // Deduplicar por id dentro de cada categoría para evitar keys duplicadas (p.ej. giro_pelota)
    Object.keys(buckets).forEach((catName) => {
      const seen = new Set<string>();
      const deduped: DetailedChecklistItem[] = [];
      for (const it of buckets[catName].items) {
        const key = (it.id || '').trim();
        if (!key) { deduped.push(it as DetailedChecklistItem); continue; }
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(it as DetailedChecklistItem);
      }
      buckets[catName].items = deduped;
    });

    // Asegurar ítem Backspin en Liberación si falta (después de migrar y deduplicar)
    const backspinName = 'Giro de la pelota (backspin)';
    const hasBackspinItem = (buckets[liberacionCatName].items || []).some(
      (it) => /(^|\s)giro_pelota(\s|$)/i.test(it.id || '') || /giro\s*de\s*la\s*pelota|back\s*spin|backspin/i.test((it.name || ''))
    );
    if (!hasBackspinItem) {
      const defaultBackspin: DetailedChecklistItem = {
        id: 'giro_pelota',
        name: backspinName,
        description: 'El balón debe tener un giro limpio hacia atrás en el aire. Comenta la calidad del backspin (limpio/bajo/irregular).',
        rating: 3,
        comment: '',
      } as DetailedChecklistItem;
      buckets[liberacionCatName].items.push(defaultBackspin);
    }

    // Inyectar ítem por defecto: Mano no dominante en la liberación (3% + posibles penalizaciones)
    const liberacionHandId = 'mano_no_dominante_liberacion';
    const hasLiberacionHand = (buckets[liberacionCatName].items || []).some(
      (it) => (it.id || '').trim() === liberacionHandId || /mano\s*no\s*dominante.*liberaci[oó]n/i.test(it.name || '')
    );
    if (!hasLiberacionHand) {
      const defaultLiberacionHand: DetailedChecklistItem = {
        id: liberacionHandId,
        name: 'Mano no dominante en la liberación',
        description: 'Debe acompañar y “apagarse” en la suelta; no empuja ni añade fuerza lateral/frontal. Dedos hacia arriba al finalizar. Si empuja (leve/fuerte), se penaliza el puntaje total.',
        rating: 3,
        comment: '',
      } as DetailedChecklistItem;
      buckets[liberacionCatName].items.push(defaultLiberacionHand);
    }

    // Segunda pasada de deduplicación por seguridad
    Object.keys(buckets).forEach((catName) => {
      const seen = new Set<string>();
      buckets[catName].items = buckets[catName].items.filter((it) => {
        const key = (it.id || '').trim();
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

    // Orden estable esperado en UI
    const order = ['Preparación (17%)', 'Ascenso (17%)', 'Liberación (10%)', fluidezCategoryName, 'Seguimiento / Post-liberación (9%)'];
    const ordered: ChecklistCategory[] = [];
    order.forEach((n) => {
      if (!buckets[n]) return;
      if (n === fluidezCategoryName) { ordered.push(buckets[n]); return; }
      if (buckets[n].items.length) ordered.push(buckets[n]);
    });
    Object.keys(buckets)
      .filter((k) => !order.includes(k) && buckets[k].items.length)
      .forEach((k) => ordered.push(buckets[k]));
    return ordered;
  };

  const [checklistState, setChecklistState] = useState<ChecklistCategory[]>(() => {
    if (analysis.detailedChecklist && Array.isArray(analysis.detailedChecklist)) {
      return normalizeChecklist(analysis.detailedChecklist);
    }
    return [];
  });

  // Derivados del checklist basados en rating 1..5
  const checklistStrengths = checklistState
    .flatMap((c) => c.items)
    .filter((item) => (item.rating || 3) >= 4)
    .map((item) => item.name);

  const checklistWeaknesses = checklistState
    .flatMap((c) => c.items)
    .filter((item) => (item.rating || 3) <= 2)
    .map((item) => item.name);

  const checklistRecommendations = checklistState
    .flatMap((c) => c.items)
    .filter((item) => (item.rating || 3) <= 3 && item.comment.trim() !== "")
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
  const derivedSummary: string = analysis.analysisSummary || analysisResult.analysisSummary || 'Análisis en progreso...';
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

  const safeAnalysis = {
    ...analysis,
    keyframes: safeKeyframes,
    detailedChecklist: analysis.detailedChecklist || [],
    score: analysis.score || 0,
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

  const canEdit = userProfile?.role === 'coach' && userProfile.id === (player.coachId || '');
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
    setSelectedKeyframe(keyframeUrl);
    setSelectedAngle(angleKey);
    setSelectedIndex(index);
    setIsModalOpen(true);
  };

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


  
  const renderKeyframes = (keyframes: string[], angleLabel: string, angleKey: 'front'|'back'|'left'|'right') => {
    console.log(`🎨 Renderizando keyframes para ${angleLabel}:`, keyframes);
    
    if (!keyframes || keyframes.length === 0) {
      console.log(`❌ No hay keyframes para ${angleLabel}`);
      return <div className="text-center py-4 text-muted-foreground">No hay fotogramas disponibles</div>;
    }
    
    return (
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6 justify-items-center">
        {keyframes.map((keyframe, index) => {
          console.log(`🖼️ Renderizando keyframe ${index} para ${angleLabel}:`, keyframe);
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
                    console.log(`✅ Imagen Next.js cargada exitosamente: ${keyframe}`);
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

  return (
    <>
      <Tabs defaultValue="ai-analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-analysis">
            <Bot className="mr-2" /> Análisis IA
          </TabsTrigger>
          <TabsTrigger value="checklist">
              <ListChecks className="mr-2" /> Checklist
          </TabsTrigger>
        
          <TabsTrigger value="coach-feedback">
            <FilePenLine className="mr-2" /> Feedback de la IA
          </TabsTrigger>
          <TabsTrigger value="improvement-plan">
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
                    <CardTitle className="font-headline">Intentos detectados</CardTitle>
                    <Badge variant="secondary">{attemptsState.length}</Badge>
                  </div>
                  <CardDescription>
                    Revisa y corrige los intentos segmentados automáticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
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
                    <Badge>{avgRating} / 5</Badge>
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
                {/* Oculto temporalmente el aviso de selección de keyframes por IA */}

                {/* Video arriba */}
                {safeAnalysis.videoUrl && (
                  <div className="max-w-xl mx-auto mb-6">
                    <video 
                      controls 
                      className="w-full rounded-lg shadow-lg max-h-[420px]"
                      src={safeAnalysis.videoUrl}
                    >
                      Tu navegador no soporta el elemento video.
                    </video>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Video: {safeAnalysis.shotType}
                    </p>
                  </div>
                )}

                {/* Botón dev para generar si no hay nada */}
                {availableAngles.length === 0 && (
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

                {/* Cuatro secciones por ángulo debajo del video */}
                <div className="space-y-8">
                  {([
                    { key: 'front' as const, label: 'Frente', labelAdj: 'frontal' },
                    { key: 'back' as const, label: 'Espalda', labelAdj: 'espalda' },
                    { key: 'left' as const, label: 'Izquierda', labelAdj: 'izquierdo' },
                    { key: 'right' as const, label: 'Derecha', labelAdj: 'derecho' },
                  ]).map(({ key, label, labelAdj }) => (
                    <div key={key}>
                      <h4 className="font-medium mb-2">{label}</h4>
                      {(localKeyframes[key] && localKeyframes[key].length > 0)
                        ? renderKeyframes(localKeyframes[key], labelAdj, key)
                        : <div className="text-sm text-muted-foreground">No hay fotogramas disponibles</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="coach-feedback" className="mt-6">
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
          </div>
        </TabsContent>
        <TabsContent value="checklist" className="mt-6">
          {analysis.detailedChecklist && (
            <DetailedChecklist
              categories={checklistState}
              onChecklistChange={handleChecklistChange}
              analysisId={safeAnalysis.id}
              currentScore={safeAnalysis.score}
              editable={userProfile?.role === 'coach' && userProfile.id === (player.coachId || '')}
              showCoachBox={Boolean(player.coachId)}
            />
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
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted p-8 text-center">
                <FilePenLine className="h-12 w-12 text-muted-foreground" />
                <h3 className="font-semibold">Coordina una sesión de mejora técnica</h3>
                <p className="text-sm text-muted-foreground max-w-prose">
                  Un entrenador revisará tu análisis, definirá objetivos específicos y te guiará en ejercicios correctivos. Puedes contactar a un entrenador desde el siguiente enlace.
                </p>
                <Button asChild>
                  <a href="/coaches">
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Buscar Entrenador
                  </a>
                </Button>
              </div>
              {/* Se removió la generación de ejercicios de ejemplo para evitar contenido dummy */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Análisis del Fotograma</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Image
                src={selectedKeyframe || "https://placehold.co/600x600.png"}
                alt="Fotograma seleccionado"
                width={600}
                height={600}
                className="rounded-lg border"
              />
              {/* overlays guardados */}
              {annotations.map((a, i) => (
                <img key={a.id || i} src={a.overlayUrl} alt="overlay" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              ))}
              {/* canvas de dibujo */}
              <canvas
                ref={canvasRef}
                width={600}
                height={600}
                className="absolute inset-0 rounded-lg"
                style={{ cursor: toolRef.current === 'pencil' ? 'crosshair' : toolRef.current === 'eraser' ? 'cell' : 'default' }}
                onMouseDown={beginDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
              <div className="absolute top-2 left-2 flex flex-col gap-2 rounded-lg border bg-background/80 p-2 shadow-lg backdrop-blur-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toolRef.current = 'move'; }}><Move /></Button>
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
