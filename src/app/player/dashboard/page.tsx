"use client";

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { PlusCircle, User, BarChart, FileText, Eye, Calendar, Video, CheckCircle2, Clock, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { PlayerProgressChart } from "@/components/player-progress-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        setFormattedDate(new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'}));
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}

export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userAnalyses, setUserAnalyses] = useState<any[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [profileIncompleteOpen, setProfileIncompleteOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceConfig, setMaintenanceConfig] = useState<any>(null);
  const [coachFeedbackByAnalysis, setCoachFeedbackByAnalysis] = useState<Record<string, boolean>>({});
  const [unlockStatusByAnalysis, setUnlockStatusByAnalysis] = useState<Record<string, {
    status: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed';
    paidCoachIds: Array<{ coachId: string; coachName: string }>;
    pendingCoachIds: Array<{ coachId: string; coachName: string }>;
    unlocks?: Array<{
      id: string;
      coachId: string;
      coachName: string;
      status: string;
      paymentProvider?: string | null;
      preferenceId?: string | null;
      paymentId?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
    reviewedCoachIds?: string[];
  }>>({});
  const [retryingByAnalysis, setRetryingByAnalysis] = useState<Record<string, boolean>>({});
  const mpRetryRef = useRef<Set<string>>(new Set());

  // Controles de filtro/rango
  const [range, setRange] = useState<string>("12m"); // 3m,6m,12m,5y,all
  const [shotFilter, setShotFilter] = useState<string>("all"); // all, three, jump, free

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    analysisId: string;
    coachId: string;
    coachName: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Función para obtener análisis del usuario
  // Cargar configuración de mantenimiento - DESHABILITADO PARA DESARROLLO
  useEffect(() => {
    // Mantenimiento deshabilitado para desarrollo local
    setMaintenanceConfig({ enabled: false, title: '', message: '' });
  }, []);

  useEffect(() => {
    const fetchAnalyses = async () => {
      console.log('🔍 [DASHBOARD] fetchAnalyses llamado, user.uid:', user?.uid);
      if (!user?.uid) {
        console.log('❌ [DASHBOARD] No hay user.uid, saliendo');
        return;
      }
      
      try {
        console.log('🔍 [DASHBOARD] Llamando a /api/analyses con userId:', user.uid);
        setAnalysesLoading(true);
        const response = await fetch(`/api/analyses?userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          const arr = Array.isArray(data.analyses) ? data.analyses : [];
          // Ordenar por fecha descendente para que [0] sea el más reciente
          arr.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setUserAnalyses(arr);
        }
      } catch (error) {
        console.error('Error fetching analyses:', error);
      } finally {
        setAnalysesLoading(false);
      }
    };

    if (user?.uid) {
      fetchAnalyses();
    }
  }, [user?.uid]);

  // Cargar disponibilidad de feedback de entrenador y unlock status en batch (optimizado)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!user || !userAnalyses.length) return;
        const token = await user.getIdToken();
        const toCheck = userAnalyses.slice(0, 50); // limitar por rendimiento
        const analysisIds = toCheck.map(a => a.id);
        
        try {
          const res = await fetch('/api/analyses/batch-coach-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ analysisIds }),
          });
          
          if (!res.ok) {
            console.error(`[Dashboard] ⚠️ No se pudo cargar estado batch:`, res.status);
            return;
          }
          
          const data = await res.json();
          const statusByAnalysis = data.statusByAnalysis || {};
          
          if (cancelled) return;
          
          // Separar feedback y unlock status
          const feedbackMap: Record<string, boolean> = {};
          const unlockMap: Record<string, {
            status: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed';
            paidCoachIds: Array<{ coachId: string; coachName: string }>;
            pendingCoachIds: Array<{ coachId: string; coachName: string }>;
            unlocks?: Array<{
              id: string;
              coachId: string;
              coachName: string;
              status: string;
              paymentProvider?: string | null;
              preferenceId?: string | null;
              paymentId?: string | null;
              createdAt?: string | null;
              updatedAt?: string | null;
            }>;
            reviewedCoachIds?: string[];
          }> = {};
          
          for (const [analysisId, status] of Object.entries(statusByAnalysis)) {
            const s = status as {
              hasCoachFeedback: boolean;
              unlockStatus: {
                status: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed';
                paidCoachIds: Array<{ coachId: string; coachName: string }>;
                pendingCoachIds: Array<{ coachId: string; coachName: string }>;
              };
            };
            feedbackMap[analysisId] = s.hasCoachFeedback;
            unlockMap[analysisId] = {
              ...s.unlockStatus,
              unlocks: (s as any).unlocks || [],
              reviewedCoachIds: (s as any).reviewedCoachIds || [],
            };
          }
          
          console.log(`[Dashboard] ✅ Estado batch cargado para ${Object.keys(feedbackMap).length} análisis`);
          setCoachFeedbackByAnalysis(feedbackMap);
          setUnlockStatusByAnalysis(unlockMap);
        } catch (e) {
          console.error('[Dashboard] ❌ Error cargando estado batch:', e);
        }
      } catch (e) {
        console.error('[Dashboard] ❌ Error general cargando estado:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, userAnalyses]);

  // Redirecciones fuera del render para evitar actualizar durante render
  useEffect(() => {
    if (loading) return;
    if (!user || !userProfile) {
      router.replace('/login');
      return;
    }
    if ((userProfile as any).role === 'admin') {
      router.replace('/admin');
    }
  }, [loading, user, userProfile, router]);

    useEffect(() => {
    if (userAnalyses.length > 0) {
            console.log('🔍 Tipos de tiro encontrados:', userAnalyses.map(a => ({ 
        shotType: a.shotType, 
        status: a.status, 
        id: a.id,
        score: a.score
      })));
      
      // Verificar análisis por tipo y status
      const statusCounts = userAnalyses.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
            const threeAnalyses = userAnalyses.filter(a => a.shotType === 'Lanzamiento de Tres');
      const jumpAnalyses = userAnalyses.filter(a => a.shotType === 'Lanzamiento de Media Distancia (Jump Shot)');
      const freeAnalyses = userAnalyses.filter(a => a.shotType === 'Tiro Libre');
      
      console.log('🔍 Análisis de Tres (total):', threeAnalyses.length);
      console.log('🔍 Análisis de Jump (total):', jumpAnalyses.length);
      console.log('🔍 Análisis de Libres (total):', freeAnalyses.length);
      
      const threeAnalyzed = threeAnalyses.filter(a => a.status === 'analyzed');
      const jumpAnalyzed = jumpAnalyses.filter(a => a.status === 'analyzed');
      const freeAnalyzed = freeAnalyses.filter(a => a.status === 'analyzed');
      
      console.log('🔍 Análisis de Tres (analyzed):', threeAnalyzed.length);
      console.log('🔍 Análisis de Jump (analyzed):', jumpAnalyzed.length);
      console.log('🔍 Análisis de Libres (analyzed):', freeAnalyzed.length);
    }
  }, [userAnalyses]);

  // Intentar reprocesar pagos MP pendientes (una vez por análisis)
  useEffect(() => {
    if (!user) return;
    const entries = Object.entries(unlockStatusByAnalysis);
    if (!entries.length) return;
    for (const [analysisId, status] of entries) {
      if (status.status !== 'pending_payment') continue;
      if (mpRetryRef.current.has(analysisId)) continue;
      const mpUnlock = status.unlocks?.find(
        (u) => u.paymentProvider === 'mercadopago' && u.preferenceId
      );
      if (!mpUnlock?.preferenceId) continue;
      mpRetryRef.current.add(analysisId);
      retryMpPayment(analysisId, { silent: true });
    }
  }, [unlockStatusByAnalysis, user]);

  // Evitar render mientras se decide o se redirige
  if (!user || !userProfile || (userProfile as any).role === 'admin') {
    return null;
  }

  // Mostrar loader cuando aún está cargando
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // Helpers: derivar score desde checklist si falta
  const mapStatusToRating = (s?: string): number | null => {
    if (!s) return null;
    if (s === 'Incorrecto') return 1;
    if (s === 'Incorrecto leve') return 2;
    if (s === 'Mejorable') return 3;
    if (s === 'Correcto') return 4;
    if (s === 'Excelente') return 5;
    return null;
  };
  // Convertir scores legacy a 0..100 con 1 decimal (primero escala 1..5, luego 1..10)
  const toPct = (score: number): number => {
    if (score <= 5) return Number(((score / 5) * 100).toFixed(1));
    if (score <= 10) return Number((score * 10).toFixed(1));
    return Number(Number(score).toFixed(1));
  };

  const getDerivedScore = (a: any): number | null => {
    if (!a) return null;
    
            // Primero intentar score directo
    if (typeof a.score === 'number') {
            return toPct(Number(a.score));
    }
    
    // Intentar score del analysisResult
    if (a.analysisResult && typeof a.analysisResult.score === 'number') {
            return toPct(Number(a.analysisResult.score));
    }
    
    // Intentar derivar desde checklist
    const cats = Array.isArray(a.detailedChecklist) ? a.detailedChecklist : (a.analysisResult && Array.isArray(a.analysisResult.detailedChecklist) ? a.analysisResult.detailedChecklist : []);
    if (!cats.length) {
            return null;
    }
    
    const vals = cats.flatMap((c: any) => c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
      .filter((v: any) => typeof v === 'number');
    
    if (!vals.length) {
            return null;
    }
    
    const avg1to5 = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    const result = Number(((avg1to5 / 5) * 100).toFixed(1));
        return result;
  };

  // Obtener el último análisis (ya viene ordenado por fecha desc)
  const lastAnalysis = userAnalyses.length > 0 ? userAnalyses[0] : null;
  const lastScore = getDerivedScore(lastAnalysis);

  // Último score por tipo en 0..100
  const lastScoreByType = (type: string) => {
    // Buscar primero análisis con status 'analyzed'
    let found = userAnalyses.find((a) => a.status === 'analyzed' && a.shotType === type);
    
    // Si no encuentra análisis 'analyzed', buscar cualquier análisis de ese tipo
    if (!found) {
      found = userAnalyses.find((a) => a.shotType === type);
    }
    
    return found ? getDerivedScore(found) : null;
  };

  // Función para calcular score promedio de todos los análisis de un tipo
  const getAverageScoreByType = (type: string) => {
    const analyses = userAnalyses.filter(a => a.shotType === type);
    if (analyses.length === 0) return null;
    
    const scores = analyses.map(a => getDerivedScore(a)).filter(s => s !== null) as number[];
    if (scores.length === 0) return null;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Number(average.toFixed(1));
  };

  const pct = (score: number | null) => (score == null ? 'N/A' : `${Number(score).toFixed(1)} / 100`);

  const goToCoachRequest = (analysisId: string) => {
    const unlockStatus = unlockStatusByAnalysis[analysisId];
    
    // Si ya está pagado y pendiente de revisión, mostrar mensaje
    if (unlockStatus?.status === 'paid_pending_review') {
      const coachName = unlockStatus.paidCoachIds[0]?.coachName || 'entrenador designado';
      toast({
        title: 'Revisión pendiente',
        description: `Ya pagaste y tu análisis está pendiente de revisión por ${coachName}. Te avisaremos cuando esté listo.`,
        variant: 'default',
      });
      return;
    }
    
    // Si ya hay feedback, mostrar mensaje
    if (coachFeedbackByAnalysis[analysisId]) {
      toast({
        title: 'Revisión completada',
        description: 'Tu análisis ya fue revisado por el entrenador. Revisa los resultados.',
        variant: 'default',
      });
      router.push(`/analysis/${analysisId}`);
      return;
    }
    
    // Caso normal: redirigir a selección de entrenador
    router.push(`/player/coaches?analysisId=${analysisId}`);
  };

  const refreshUnlockStatus = async (analysisId: string, token: string) => {
    try {
      const unlockResponse = await fetch(`/api/analyses/${analysisId}/unlock-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (unlockResponse.ok) {
        const unlockData = await unlockResponse.json();
        setUnlockStatusByAnalysis((prev) => ({
          ...prev,
          [analysisId]: {
            status: unlockData.status || 'none',
            paidCoachIds: unlockData.paidCoachIds || [],
            pendingCoachIds: unlockData.pendingCoachIds || [],
            unlocks: unlockData.unlocks || [],
            reviewedCoachIds: unlockData.reviewedCoachIds || [],
          },
        }));
        setCoachFeedbackByAnalysis((prev) => ({
          ...prev,
          [analysisId]: unlockData.hasCoachFeedback || false,
        }));
      }
    } catch (error) {
      console.error('[Dashboard] Error refrescando unlock status:', error);
    }
  };

  const retryMpPayment = async (analysisId: string, opts: { silent?: boolean } = {}) => {
    const unlockStatus = unlockStatusByAnalysis[analysisId];
    const mpUnlock = unlockStatus?.unlocks?.find(
      (u) => u.paymentProvider === 'mercadopago' && u.preferenceId
    );
    if (!mpUnlock?.preferenceId) {
      if (!opts.silent) {
        toast({
          title: 'No se encontró preferenceId',
          description: 'No hay datos suficientes para reprocesar el pago.',
          variant: 'destructive',
        });
      }
      return;
    }
    if (!user) return;

    setRetryingByAnalysis((prev) => ({ ...prev, [analysisId]: true }));
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/payments/check-mp-payment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferenceId: mpUnlock.preferenceId,
          analysisId,
        }),
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        await refreshUnlockStatus(analysisId, token);
        if (!opts.silent) {
          toast({
            title: 'Pago procesado',
            description: 'El estado se actualizó correctamente.',
          });
        }
      } else if (!opts.silent) {
        const detailText = data?.details ? ` ${String(data.details).slice(0, 500)}` : '';
        const statusText = data?.status ? ` (HTTP ${data.status})` : '';
        toast({
          title: 'No se pudo reprocesar',
          description: `${data?.error || data?.message || 'El pago sigue pendiente.'}${statusText}${detailText}`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      if (!opts.silent) {
        toast({
          title: 'Error',
          description: error?.message || 'No se pudo reprocesar el pago.',
          variant: 'destructive',
        });
      }
    } finally {
      setRetryingByAnalysis((prev) => ({ ...prev, [analysisId]: false }));
    }
  };

  const isReviewWindowOpen = (createdAt?: string | null) => {
    if (!createdAt) return false;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const diffMs = Date.now() - created.getTime();
    return diffMs >= 7 * 24 * 60 * 60 * 1000;
  };

  const getReviewCandidate = (analysisId: string) => {
    const unlockStatus = unlockStatusByAnalysis[analysisId];
    if (!unlockStatus) return null;
    const reviewedCoachIds = unlockStatus.reviewedCoachIds || [];
    const unlock = (unlockStatus.unlocks || []).find(
      (u) => u.status === 'paid' && !!u.coachId && !reviewedCoachIds.includes(u.coachId) && isReviewWindowOpen(u.createdAt)
    );
    if (unlock) {
      return {
        analysisId,
        coachId: unlock.coachId,
        coachName: unlock.coachName || 'Entrenador',
      };
    }

    if (coachFeedbackByAnalysis[analysisId]) {
      const paidCoach = unlockStatus.paidCoachIds?.[0];
      if (paidCoach && !reviewedCoachIds.includes(paidCoach.coachId)) {
        return {
          analysisId,
          coachId: paidCoach.coachId,
          coachName: paidCoach.coachName || 'Entrenador',
        };
      }
    }
    return null;
  };

  const openReviewDialog = (analysisId: string, coachId: string, coachName: string) => {
    setReviewTarget({ analysisId, coachId, coachName });
    setReviewRating(null);
    setReviewComment("");
    setReviewDialogOpen(true);
  };

  const submitCoachReview = async () => {
    if (!reviewTarget || !user || !reviewRating) return;
    try {
      setSubmittingReview(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-reviews', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisId: reviewTarget.analysisId,
          coachId: reviewTarget.coachId,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo enviar la reseña.');
      }
      setUnlockStatusByAnalysis((prev) => {
        const current = prev[reviewTarget.analysisId];
        if (!current) return prev;
        const reviewedCoachIds = Array.from(new Set([...(current.reviewedCoachIds || []), reviewTarget.coachId]));
        return {
          ...prev,
          [reviewTarget.analysisId]: { ...current, reviewedCoachIds },
        };
      });
      toast({
        title: 'Gracias por tu reseña',
        description: `Tu valoración de ${reviewTarget.coachName} fue enviada.`,
      });
      setReviewDialogOpen(false);
      setReviewTarget(null);
    } catch (error: any) {
      toast({
        title: 'No se pudo enviar la reseña',
        description: error?.message || 'Intenta nuevamente en unos minutos.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const reviewIsCoachCompleted = reviewTarget
    ? !!coachFeedbackByAnalysis[reviewTarget.analysisId]
    : false;
  
  // Obtener el ÚLTIMO análisis de cada tipo (no promedio)
  const lastThree = lastScoreByType('Lanzamiento de Tres');
  const lastJump = lastScoreByType('Lanzamiento de Media Distancia (Jump Shot)');
  const lastFree = lastScoreByType('Tiro Libre');
  
  // Calcular el Nivel Actual como promedio de las tres categorías
  const calculateOverallLevel = () => {
    const scores = [lastThree, lastJump, lastFree].filter(score => score !== null) as number[];
        if (scores.length === 0) return null;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const result = Number(average.toFixed(1));
        return result;
  };
  
  const overallLevel = calculateOverallLevel();

  // Función para obtener el color del badge según el status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzed':
        return <Badge className="bg-green-100 text-green-800">Analizado</Badge>;
      case 'uploaded':
        return <Badge className="bg-blue-100 text-blue-800">Subido</Badge>;
      case 'ai_failed':
        return <Badge className="bg-red-100 text-red-800">Error IA</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Mapeos auxiliares
  const shotTypeMap: Record<string, string> = {
    three: 'Lanzamiento de Tres',
    jump: 'Lanzamiento de Media Distancia (Jump Shot)',
    free: 'Tiro Libre',
  };

  // Filtrado por rango temporal
  const getStartDateForRange = (r: string) => {
    const now = new Date();
    const d = new Date(now);
    if (r === '3m') { d.setMonth(now.getMonth() - 3); return d; }
    if (r === '6m') { d.setMonth(now.getMonth() - 6); return d; }
    if (r === '12m') { d.setMonth(now.getMonth() - 12); return d; }
    if (r === '5y') { d.setFullYear(now.getFullYear() - 5); return d; }
    return new Date(0); // all
  };

  // Agregación mensual para el gráfico
  const progressData = (() => {
    const from = getStartDateForRange(range);

    const filtered = userAnalyses.filter((a) => {
      const created = new Date(a.createdAt);
      if (created < from) return false;
      if (a.status !== 'analyzed') return false;
      if (shotFilter === 'all') return true;
      const type = shotTypeMap[shotFilter];
      return a.shotType === type;
    });

    const buckets: Record<string, number[]> = {};
    for (const a of filtered) {
      const created = new Date(a.createdAt);
      const label = created.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
      const score = getDerivedScore(a);
      if (typeof score !== 'number') continue;
      if (!buckets[label]) buckets[label] = [];
      buckets[label].push(score);
    }

    const entries = Object.entries(buckets)
      .map(([month, arr]) => ({ month, score: Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    return entries;
  })();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name || user.email || 'Usuario'} />
              <AvatarFallback>{(userProfile.name && userProfile.name.charAt(0)) || (user?.email?.[0]?.toUpperCase() ?? 'U')}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-headline text-3xl font-bold tracking-tight">
                Bienvenido, {userProfile.name || user.email || 'Usuario'}
              </h1>
              <p className="text-muted-foreground">Aquí está tu resumen de actividad.</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button onClick={() => {
              if (maintenanceConfig?.enabled) {
                setMaintenanceOpen(true);
              } else {
                router.push('/upload');
              }
            }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Análisis Completo
            </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Análisis</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalyses.length}</div>
            <p className="text-xs text-muted-foreground">
              análisis completados en total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nivel Actual</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallLevel != null ? `${overallLevel} / 100` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {overallLevel != null
                ? 'promedio de las tres categorías'
                : 'no hay análisis suficientes'}
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">Tres</div>
                <div className="font-semibold">{pct(lastThree)}</div>
                {lastThree !== null && (
                  <div className="text-xs text-muted-foreground">
                    último análisis
                  </div>
                )}
                {userAnalyses.filter(a => a.shotType === 'Lanzamiento de Tres').length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {userAnalyses.filter(a => a.shotType === 'Lanzamiento de Tres').length} total
                  </div>
                )}
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">Jump</div>
                <div className="font-semibold">{pct(lastJump)}</div>
                {lastJump !== null && (
                  <div className="text-xs text-muted-foreground">
                    último análisis
                  </div>
                )}
                {userAnalyses.filter(a => a.shotType === 'Lanzamiento de Media Distancia (Jump Shot)').length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {userAnalyses.filter(a => a.shotType === 'Lanzamiento de Media Distancia (Jump Shot)').length} total
                  </div>
                )}
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">Libres</div>
                <div className="font-semibold">{pct(lastFree)}</div>
                {lastFree !== null && (
                  <div className="text-xs text-muted-foreground">
                    último análisis
                  </div>
                )}
                {userAnalyses.filter(a => a.shotType === 'Tiro Libre').length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {userAnalyses.filter(a => a.shotType === 'Tiro Libre').length} total
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3">
              <Button asChild variant="link" className="px-0">
                <Link href="/player/dashboard/history">Ver historial</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Lanzamiento Analizado</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastAnalysis ? lastAnalysis.shotType : 'N/A'}</div>
             <p className="text-xs text-muted-foreground">
              {lastAnalysis ? <FormattedDate dateString={lastAnalysis.createdAt} /> : 'Aún no hay análisis'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análisis Recientes</CardTitle>
          <CardDescription>
            Revisa tus análisis de lanzamiento más recientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysesLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando análisis...</p>
            </div>
          ) : userAnalyses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="mb-4">Aún no tienes análisis de lanzamiento.</p>
              <Button asChild>
                <Link href="/player/upload" onClick={(e) => {
                  const p: any = userProfile as any;
                  const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
                  const isComplete = !!p && isNonEmptyString(p.name) && !!p.dob && isNonEmptyString(p.country) && isNonEmptyString(p.ageGroup) && isNonEmptyString(p.playerLevel) && isNonEmptyString(p.position) && p.height && p.wingspan;
                  if (!isComplete) {
                    toast({ title: 'Perfil incompleto', description: 'Podés continuar. Completar tu perfil mejora la precisión del análisis.', variant: 'default' });
                  }
                }}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Analiza tu primer lanzamiento
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {userAnalyses.map((analysis) => {
                const hasCoachReview = !!coachFeedbackByAnalysis[analysis.id];
                const unlockStatus = unlockStatusByAnalysis[analysis.id];
                const hasPendingMp = unlockStatus?.status === 'pending_payment' && unlockStatus?.unlocks?.some(
                  (u) => u.paymentProvider === 'mercadopago' && u.preferenceId
                );
                const reviewCandidate = getReviewCandidate(analysis.id);
                return (
                <div
                  key={analysis.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    hasCoachReview
                      ? 'bg-amber-50 border-amber-200'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Video className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{analysis.shotType}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <FormattedDate dateString={analysis.createdAt} />
                        {getStatusBadge(analysis.status)}
                      </div>
                      {analysis.status === 'analyzed' && (
                        <>
                          {coachFeedbackByAnalysis[analysis.id] ? (
                            <div className="mt-1 text-xs text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Finalizado análisis de entrenador
                            </div>
                          ) : unlockStatus?.status === 'paid_pending_review' ? (
                            <div className="mt-1 text-xs text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              ✅ Ya abonado - Pendiente evaluación por {unlockStatus?.paidCoachIds[0]?.coachName || 'entrenador designado'}
                            </div>
                          ) : unlockStatus?.status === 'pending_payment' ? (
                            <div className="mt-1 text-xs text-amber-700 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Pago pendiente. Estamos verificando automáticamente.
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis.status === 'analyzed' && (
                      <Button asChild size="sm">
                        <Link href={`/analysis/${analysis.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Resultados
                        </Link>
                      </Button>
                    )}
                    {reviewCandidate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(reviewCandidate.analysisId, reviewCandidate.coachId, reviewCandidate.coachName)}
                        className="whitespace-nowrap"
                      >
                        <Star className="mr-2 h-4 w-4 text-yellow-500" />
                        Valorar entrenador
                      </Button>
                    )}
                    {coachFeedbackByAnalysis[analysis.id] ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="whitespace-nowrap bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      >
                        <Link href={`/analysis/${analysis.id}#coach-checklist`}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Ver revisión del entrenador
                        </Link>
                      </Button>
                    ) : unlockStatus?.status === 'paid_pending_review' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToCoachRequest(analysis.id)}
                        className="whitespace-nowrap bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Ya abonado - Pendiente evaluación
                      </Button>
                    ) : unlockStatus?.status === 'pending_payment' && hasPendingMp ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryMpPayment(analysis.id)}
                        className="whitespace-nowrap"
                        disabled={!!retryingByAnalysis[analysis.id]}
                      >
                        {retryingByAnalysis[analysis.id] ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reintentar verificación de pago
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToCoachRequest(analysis.id)}
                        className="whitespace-nowrap"
                      >
                        Solicitar revisión por entrenador humano
                      </Button>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evolución del jugador (vista rápida) */}
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle>Evolución del Jugador</CardTitle>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rango</span>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="12m">Último año</SelectItem>
                  <SelectItem value="5y">Últimos 5 años</SelectItem>
                  <SelectItem value="all">Todo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tipo de tiro</span>
              <Select value={shotFilter} onValueChange={setShotFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="three">Lanzamiento de Tres</SelectItem>
                  <SelectItem value="jump">Lanzamiento de Media Distancia (Jump)</SelectItem>
                  <SelectItem value="free">Tiro Libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {analysesLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando evolución...</p>
            </div>
          ) : progressData.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No hay datos en el rango seleccionado.</div>
          ) : (
            <PlayerProgressChart data={progressData} />
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewIsCoachCompleted ? 'Valorar evaluación de' : 'Valorar a'}{' '}
              {reviewTarget?.coachName || 'entrenador'}
            </DialogTitle>
            <DialogDescription>
              {reviewIsCoachCompleted
                ? 'El entrenador ya finalizó tu evaluación. Tu reseña ayuda a otros jugadores.'
                : 'Han pasado 7 días desde tu solicitud. Tu reseña ayuda a otros jugadores.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                const isActive = (reviewRating || 0) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className="rounded p-1 transition hover:bg-yellow-50"
                    aria-label={`Calificar ${value} estrellas`}
                  >
                    <Star className={`h-5 w-5 ${isActive ? 'fill-yellow-400 text-yellow-500' : 'text-gray-300'}`} />
                  </button>
                );
              })}
              <span className="text-sm text-muted-foreground">
                {reviewRating ? `${reviewRating}/5` : 'Selecciona una calificación'}
              </span>
            </div>
            <Textarea
              placeholder="Comentario opcional sobre la evaluación del entrenador..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={submittingReview}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitCoachReview}
              disabled={!reviewRating || submittingReview}
            >
              {submittingReview
                ? 'Enviando...'
                : reviewIsCoachCompleted
                ? 'Enviar reseña de la evaluación'
                : 'Enviar reseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de mantenimiento */}
      <AlertDialog open={maintenanceOpen} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{maintenanceConfig?.title || '🔧 SITIO EN MANTENIMIENTO'}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {maintenanceConfig?.message || 'El análisis de lanzamientos está temporalmente deshabilitado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMaintenanceOpen(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
