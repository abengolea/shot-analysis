"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";
import { PlusCircle, User, BarChart, FileText, Eye, Calendar, Video, Star } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { PlayerProgressChart } from "@/components/player-progress-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [coachStatusByAnalysis, setCoachStatusByAnalysis] = useState<Record<string, {
    hasCoachFeedback?: boolean;
    reviewedCoachIds?: string[];
    unlockStatus?: {
      paidCoachIds?: Array<{ coachId: string; coachName: string }>;
    };
  }>>({});
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ analysisId: string; coachId: string; coachName?: string } | null>(null);
  const [coachRating, setCoachRating] = useState<number>(5);
  const [coachRatingComment, setCoachRatingComment] = useState<string>("");
  const [savingCoachRating, setSavingCoachRating] = useState(false);

  // Controles de filtro/rango
  const [range, setRange] = useState<string>("12m"); // 3m,6m,12m,5y,all
  const [shotFilter, setShotFilter] = useState<string>("all"); // all, three, jump, free

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
          {analysesLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando análisis...</p>
            </div>
          ) : userAnalyses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="mb-4">Aún no tienes análisis de lanzamiento.</p>
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
              {userAnalyses.map((analysis) => {
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
                        <h3 className="font-medium">{analysis.shotType}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <FormattedDate dateString={analysis.createdAt} />
                          {getStatusBadge(analysis.status)}
                        </div>
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
