"use client";

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { PlusCircle, User, BarChart, FileText, Eye, Calendar, Video, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { PlayerProgressChart } from "@/components/player-progress-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeVideoUrl } from "@/lib/video-url";


function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        setFormattedDate(
          new Date(dateString).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}

type ComparisonNote = {
  id: string;
  playerId: string;
  coachId: string;
  beforeAnalysisId: string;
  afterAnalysisId: string;
  comment: string;
  createdAt?: any;
  beforeLabel?: string;
  afterLabel?: string;
};


export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userAnalyses, setUserAnalyses] = useState<any[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [coachStatusByAnalysis, setCoachStatusByAnalysis] = useState<Record<string, {
    hasCoachFeedback?: boolean;
    reviewedCoachIds?: string[];
    unlockStatus?: {
      status?: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed';
      paidCoachIds?: Array<{ coachId: string; coachName: string }>;
      pendingCoachIds?: Array<{ coachId: string; coachName: string }>;
    };
  }>>({});
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ analysisId: string; coachId: string; coachName?: string } | null>(null);
  const [coachRating, setCoachRating] = useState<number>(5);
  const [coachRatingComment, setCoachRatingComment] = useState<string>("");
  const [savingCoachRating, setSavingCoachRating] = useState(false);
  const [comparisonNotes, setComparisonNotes] = useState<ComparisonNote[]>([]);
  const [comparisonAnalyses, setComparisonAnalyses] = useState<Record<string, any>>({});
  const [comparisonsLoading, setComparisonsLoading] = useState(false);
  const comparisonsRef = useRef<HTMLDivElement | null>(null);
  const [coachById, setCoachById] = useState<Record<string, { name?: string }>>({});

  // Controles de filtro/rango
  const [range, setRange] = useState<string>("12m"); // 3m,6m,12m,5y,all
  const [shotFilter, setShotFilter] = useState<string>("all"); // all, three, jump, free
  const [recentRange, setRecentRange] = useState<string>("6m");
  const [recentShotFilter, setRecentShotFilter] = useState<string>("all");
  const [showAllRecent, setShowAllRecent] = useState(false);

  const toDate = (value: any) => {
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

  const isBiomechProAnalysis = (analysis: any) =>
    String(analysis?.analysisMode) === "biomech-pro";

  const formatDate = (value: any) => {
    const d = toDate(value);
    return d ? d.toLocaleString() : "Fecha desconocida";
  };

  const getAnalysisLabel = (analysis: any) => {
    const createdAt = toDate(analysis?.createdAt);
    const shotType = analysis?.shotType ? ` · ${analysis.shotType}` : "";
    const label = createdAt ? createdAt.toLocaleString() : "Fecha desconocida";
    return `${label}${shotType}`;
  };

  const getAnalysisVideoUrl = (analysis: any) => {
    const rawUrl =
      analysis?.videoFrontUrl ||
      analysis?.videoUrl ||
      analysis?.videoLeftUrl ||
      analysis?.videoRightUrl ||
      analysis?.videoBackUrl;
    return rawUrl ? (normalizeVideoUrl(String(rawUrl)) ?? undefined) : undefined;
  };

  const comparisonIds = (() => {
    const ids = new Set<string>();
    comparisonNotes.forEach((note) => {
      if (note.beforeAnalysisId) ids.add(note.beforeAnalysisId);
      if (note.afterAnalysisId) ids.add(note.afterAnalysisId);
    });
    return ids;
  })();

  const filteredRecentAnalyses = (() => {
    const now = new Date();
    const inRange = (createdAt: string) => {
      if (recentRange === "all") return true;
      const months = recentRange === "3m" ? 3 : recentRange === "6m" ? 6 : 12;
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - months);
      const date = new Date(createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return date >= cutoff;
    };
    return userAnalyses.filter((analysis) => {
      const matchesRange = inRange(analysis.createdAt);
      const matchesShot =
        recentShotFilter === "all" ? true : analysis.shotType === recentShotFilter;
      return matchesRange && matchesShot;
    });
  })();

  const recentAnalysesToShow = showAllRecent
    ? filteredRecentAnalyses
    : filteredRecentAnalyses.slice(0, 5);

  // Función para obtener análisis del usuario
  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user?.uid) return;
      
      try {
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

  useEffect(() => {
    if (!user?.uid) return;
    setComparisonsLoading(true);
    const q = query(collection(db as any, "comparisonNotes"), where("playerId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ComparisonNote[];
        list.sort((a, b) => {
          const timeA = toDate(a.createdAt)?.getTime() ?? 0;
          const timeB = toDate(b.createdAt)?.getTime() ?? 0;
          return timeB - timeA;
        });
        setComparisonNotes(list);
        setComparisonsLoading(false);
      },
      (err) => {
        console.error("Error cargando comparaciones:", err);
        setComparisonsLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const ids = new Set<string>();
    comparisonNotes.forEach((note) => {
      if (note.beforeAnalysisId) ids.add(note.beforeAnalysisId);
      if (note.afterAnalysisId) ids.add(note.afterAnalysisId);
    });
    const missing = Array.from(ids).filter((id) => !comparisonAnalyses[id]);
    if (!missing.length) return;
    const load = async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (id) => {
            const snap = await getDoc(doc(db as any, "analyses", id));
            return [id, snap.exists() ? { id, ...(snap.data() as any) } : null] as const;
          })
        );
        setComparisonAnalyses((prev) => {
          const next = { ...prev };
          entries.forEach(([id, data]) => {
            if (data) next[id] = data;
          });
          return next;
        });
      } catch (e) {
        console.error("Error cargando análisis para comparaciones:", e);
      }
    };
    load();
  }, [comparisonNotes, comparisonAnalyses]);

  useEffect(() => {
    const coachIds = Array.from(new Set(comparisonNotes.map((note) => note.coachId).filter(Boolean)));
    const missing = coachIds.filter((id) => !coachById[id]);
    if (!missing.length) return;
    const load = async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (id) => {
            const snap = await getDoc(doc(db as any, "coaches", id));
            return [id, snap.exists() ? (snap.data() as any) : null] as const;
          })
        );
        setCoachById((prev) => {
          const next = { ...prev };
          entries.forEach(([id, data]) => {
            if (data) next[id] = { name: data.displayName || data.name || data.email };
          });
          return next;
        });
      } catch (e) {
        console.error("Error cargando entrenadores de comparaciones:", e);
      }
    };
    load();
  }, [comparisonNotes, coachById]);

  // Cargar estado de feedback y reseñas del entrenador en batch
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!user || !userAnalyses.length) {
          setCoachStatusByAnalysis({});
          return;
        }
        const token = await user.getIdToken();
        const analysisIds = userAnalyses.map((a) => a.id).filter(Boolean);
        if (!analysisIds.length) {
          setCoachStatusByAnalysis({});
          return;
        }
        const res = await fetch('/api/analyses/batch-coach-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ analysisIds }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCoachStatusByAnalysis(data?.statusByAnalysis || {});
      } catch {}
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
    if (typeof a.score === 'number') return toPct(Number(a.score));
    const cats = Array.isArray(a.detailedChecklist) ? a.detailedChecklist : (a.analysisResult && Array.isArray(a.analysisResult.detailedChecklist) ? a.analysisResult.detailedChecklist : []);
    if (!cats.length) return null;
    const vals = cats.flatMap((c: any) => c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
      .filter((v: any) => typeof v === 'number');
    if (!vals.length) return null;
    const avg1to5 = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    return Number(((avg1to5 / 5) * 100).toFixed(1));
  };

  // Obtener el último análisis (ya viene ordenado por fecha desc)
  const lastAnalysis = userAnalyses.length > 0 ? userAnalyses[0] : null;
  const lastScore = getDerivedScore(lastAnalysis);

  // Último score por tipo en 0..100
  const lastScoreByType = (type: string) => {
    const found = userAnalyses.find((a) => a.status === 'analyzed' && a.shotType === type);
    return found ? getDerivedScore(found) : null;
  };
  const pct = (score: number | null) => (score == null ? 'N/A' : `${Number(score).toFixed(1)} / 100`);
  const lastThree = lastScoreByType('Lanzamiento de Tres');
  const lastJump = lastScoreByType('Lanzamiento de Media Distancia (Jump Shot)');
  const lastFree = lastScoreByType('Tiro Libre');

  // Función para obtener el/los badge(s) según el status
  const getStatusBadge = (status: string, unlockStatus?: { status?: string }) => {
    let baseBadge: JSX.Element;
    switch (status) {
      case 'analyzed':
        baseBadge = <Badge className="bg-green-100 text-green-800">Analizado</Badge>;
        break;
      case 'uploaded':
        baseBadge = <Badge className="bg-blue-100 text-blue-800">Subido</Badge>;
        break;
      case 'ai_failed':
        baseBadge = <Badge className="bg-red-100 text-red-800">Error IA</Badge>;
        break;
      default:
        baseBadge = <Badge variant="secondary">{status}</Badge>;
        break;
    }

    const extraBadge = unlockStatus?.status === 'paid_pending_review'
      ? <Badge className="bg-amber-100 text-amber-800">En espera de devolución del entrenador</Badge>
      : unlockStatus?.status === 'pending_payment'
        ? <Badge className="bg-yellow-100 text-yellow-800">Pago pendiente</Badge>
        : null;

    return (
      <span className="inline-flex flex-wrap gap-2">
        {baseBadge}
        {extraBadge}
      </span>
    );
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

  const openRatingDialog = (analysisId: string, coachId: string, coachName?: string) => {
    setRatingTarget({ analysisId, coachId, coachName });
    setCoachRating(5);
    setCoachRatingComment("");
    setRatingDialogOpen(true);
  };

  const submitCoachRating = async () => {
    if (!user || !ratingTarget) return;
    try {
      setSavingCoachRating(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: ratingTarget.analysisId,
          coachId: ratingTarget.coachId,
          rating: coachRating,
          comment: coachRatingComment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo guardar la calificación.');
      }
      toast({
        title: 'Gracias por tu calificación',
        description: 'Tu reseña ayuda a mejorar la comunidad.',
      });
      setCoachStatusByAnalysis((prev) => {
        const current = prev[ratingTarget.analysisId] || {};
        const reviewed = new Set(current.reviewedCoachIds || []);
        reviewed.add(ratingTarget.coachId);
        return {
          ...prev,
          [ratingTarget.analysisId]: {
            ...current,
            reviewedCoachIds: Array.from(reviewed),
          },
        };
      });
      setRatingDialogOpen(false);
    } catch (e: any) {
      toast({
        title: 'Error al calificar',
        description: e?.message || 'No se pudo guardar la reseña.',
        variant: 'destructive',
      });
    } finally {
      setSavingCoachRating(false);
    }
  };

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
            <Button asChild variant="outline">
              <Link href="/dashboard/videos">
                <Video className="mr-2 h-4 w-4" />
                Ver mis videos
              </Link>
            </Button>
            <Button asChild>
              <Link href="/upload" onClick={(e) => {
                const p: any = userProfile as any;
                const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
                const isComplete = !!p && isNonEmptyString(p.name) && !!p.dob && isNonEmptyString(p.country) && isNonEmptyString(p.ageGroup) && isNonEmptyString(p.playerLevel) && isNonEmptyString(p.position) && p.height && p.wingspan;
                if (!isComplete) {
                  // Ya no bloqueamos; solo informamos
                  toast({ title: 'Perfil incompleto', description: 'Podés continuar. Completar tu perfil mejora la precisión del análisis.', variant: 'default' });
                }
              }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Analizar Nuevo Lanzamiento
              </Link>
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
              {lastScore != null ? `${Number(lastScore).toFixed(1)} / 100` : (userProfile.role === 'player' && userProfile.playerLevel ? userProfile.playerLevel : 'N/A')}
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {lastScore != null
                ? 'según tu último análisis'
                : (userProfile.role === 'player' ? 'según tu último análisis' : 'no aplica para entrenadores')}
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">Tres</div>
                <div className="font-semibold">{pct(lastThree)}</div>
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">Jump</div>
                <div className="font-semibold">{pct(lastJump)}</div>
              </div>
              <div className="p-2 rounded border">
                <div className="text-muted-foreground">Libres</div>
                <div className="font-semibold">{pct(lastFree)}</div>
              </div>
            </div>
            <div className="mt-3">
              <Button asChild variant="link" className="px-0">
                <Link href="/dashboard/history">Ver historial</Link>
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
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rango</span>
              <Select value={recentRange} onValueChange={setRecentRange}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="12m">Último año</SelectItem>
                  <SelectItem value="all">Todo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tipo</span>
              <Select value={recentShotFilter} onValueChange={setRecentShotFilter}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Tipo de tiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="Tiro Libre">Tiro Libre</SelectItem>
                  <SelectItem value="Lanzamiento de Media Distancia (Jump Shot)">Media Distancia</SelectItem>
                  <SelectItem value="Lanzamiento de Tres">Tres Puntos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {analysesLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando análisis...</p>
            </div>
          ) : filteredRecentAnalyses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="mb-4">No hay análisis para los filtros seleccionados.</p>
              <Button asChild>
                <Link href="/upload" onClick={(e) => {
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
              {recentAnalysesToShow.map((analysis) => {
                const statusMeta = coachStatusByAnalysis[analysis.id] || {};
                const hasCoachFeedback = Boolean(statusMeta.hasCoachFeedback) || analysis.coachCompleted === true;
                const reviewedCoachIds = statusMeta.reviewedCoachIds || [];
                const paidCoachInfo = statusMeta.unlockStatus?.paidCoachIds?.[0];
                const coachIdForRating = analysis.coachId || paidCoachInfo?.coachId;
                const coachNameForRating = paidCoachInfo?.coachName;
                const isCoachReviewedByPlayer = coachIdForRating ? reviewedCoachIds.includes(coachIdForRating) : false;
                const canRateCoach = Boolean(hasCoachFeedback && coachIdForRating && !isCoachReviewedByPlayer);
                return (
                  <div
                    key={analysis.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${hasCoachFeedback ? 'border-emerald-200 bg-emerald-50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${hasCoachFeedback ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                        <Video className={`h-5 w-5 ${hasCoachFeedback ? 'text-emerald-700' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium">
                          <span>{analysis.shotType}</span>
                          {isBiomechProAnalysis(analysis) && (
                            <Badge variant="secondary" className="ml-2">BIOMECH PRO</Badge>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Calendar className="h-4 w-4" />
                          <FormattedDate dateString={analysis.createdAt} />
                          {getStatusBadge(analysis.status, statusMeta.unlockStatus)}
          {comparisonIds.has(analysis.id) && (
                            <button
              type="button"
              className="inline-flex"
              onClick={() => {
                                const target = comparisonsRef.current || document.getElementById("comparisons");
                                if (!target) return;
                                const top = target.getBoundingClientRect().top + window.scrollY - 80;
                                window.scrollTo({ top, behavior: "smooth" });
                                window.location.hash = "comparisons";
              }}
            >
              <Badge variant="outline" className="text-xs">Comparado</Badge>
            </button>
          )}
                        </div>
                        {isBiomechProAnalysis(analysis) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Métrica: timing de transferencia (piernas→cadera→tronco→brazo→muñeca).
                          </div>
                        )}
                        {analysis.status === 'analyzed' && hasCoachFeedback && (
                          <div className="mt-1 text-xs text-emerald-700">
                            Feedback del entrenador disponible.
                          </div>
                        )}
                        {analysis.status === 'analyzed' && isCoachReviewedByPlayer && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Entrenador calificado.
                          </div>
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
                      {analysis.status === 'analyzed' && canRateCoach && coachIdForRating && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openRatingDialog(analysis.id, coachIdForRating, coachNameForRating)}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Calificar entrenador
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredRecentAnalyses.length > 5 && (
                <div className="flex items-center justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllRecent((prev) => !prev)}
                  >
                    {showAllRecent ? "Ver menos" : "Ver más"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div id="comparisons" ref={comparisonsRef}>
      <Card>
        <CardHeader>
          <CardTitle>Comparaciones efectuadas por tu entrenador</CardTitle>
          <CardDescription>
            Revisá el antes y después con comentarios y videos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comparisonsLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando comparaciones...</p>
            </div>
          ) : comparisonNotes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Todavía no hay comparaciones guardadas.
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {comparisonNotes.map((note) => {
                const before = comparisonAnalyses[note.beforeAnalysisId];
                const after = comparisonAnalyses[note.afterAnalysisId];
                const shotType = (after || before)?.shotType || "Tiro";
                const beforeDate = formatDate(before?.createdAt);
                const afterDate = formatDate(after?.createdAt);
                const coachName = coachById[note.coachId]?.name || "tu entrenador";
                return (
                  <AccordionItem key={note.id} value={note.id} className="rounded-lg border px-4">
                    <AccordionTrigger className="text-left">
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Comparación realizada por {coachName}</span>
                        <span>· {shotType}</span>
                        <span>· {beforeDate} → {afterDate}</span>
                        <span>· Tiros evaluados: 2</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Video Antes</div>
                          {getAnalysisVideoUrl(before) ? (
                            <video
                              controls
                              className="w-full rounded-md border bg-black aspect-video"
                              src={getAnalysisVideoUrl(before)}
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground">Video no disponible.</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Video Después</div>
                          {getAnalysisVideoUrl(after) ? (
                            <video
                              controls
                              className="w-full rounded-md border bg-black aspect-video"
                              src={getAnalysisVideoUrl(after)}
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground">Video no disponible.</div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm">{note.comment}</div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
      </div>

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

      <Dialog
        open={ratingDialogOpen}
        onOpenChange={(open) => {
          setRatingDialogOpen(open);
          if (!open) setRatingTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calificar entrenador</DialogTitle>
            <DialogDescription>
              {ratingTarget?.coachName
                ? `¿Cómo fue tu experiencia con ${ratingTarget.coachName}?`
                : 'Tu calificación ayuda a otros jugadores a elegir entrenador.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={`rate-${r}`}
                  type="button"
                  onClick={() => setCoachRating(r)}
                  className="rounded-full p-1 hover:bg-muted"
                  aria-label={`Calificar ${r}`}
                >
                  <Star className={`h-6 w-6 ${r <= coachRating ? 'fill-yellow-400 text-yellow-500' : 'text-muted-foreground'}`} />
                </button>
              ))}
              <span className="text-sm text-muted-foreground">{coachRating} / 5</span>
            </div>
            <div>
              <label className="text-sm font-medium">Comentario (opcional)</label>
              <Textarea
                value={coachRatingComment}
                onChange={(e) => setCoachRatingComment(e.target.value)}
                rows={4}
                placeholder="Contanos qué te gustó o qué mejorarías."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRatingDialogOpen(false)} disabled={savingCoachRating}>
              Cancelar
            </Button>
            <Button onClick={submitCoachRating} disabled={savingCoachRating || !ratingTarget}>
              {savingCoachRating ? 'Guardando...' : 'Enviar calificación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de perfil incompleto eliminado: ya no bloquea desde el dashboard */}
    </div>
  );
}
