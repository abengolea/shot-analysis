"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";
import { PlusCircle, User, BarChart, FileText, Eye, Calendar, Video } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";


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


export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userAnalyses, setUserAnalyses] = useState<any[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [profileIncompleteOpen, setProfileIncompleteOpen] = useState(false);
  const [coachFeedbackByAnalysis, setCoachFeedbackByAnalysis] = useState<Record<string, boolean>>({});
  const [coachReviewStatusByAnalysis, setCoachReviewStatusByAnalysis] = useState<Record<string, { reviewedCoachIds?: string[] }>>({});
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState<string>("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);

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

  // Cargar disponibilidad de feedback de entrenador para cada análisis listado
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!user || !userAnalyses.length) return;
        const token = await user.getIdToken();
        const toCheck = userAnalyses.slice(0, 30); // limitar por rendimiento
        const results = await Promise.all(toCheck.map(async (a) => {
          try {
            const res = await fetch(`/api/analyses/${a.id}/coach-feedback`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return [a.id, false] as const;
            const data = await res.json();
            return [a.id, Boolean(data?.feedback)] as const;
          } catch {
            return [a.id, false] as const;
          }
        }));
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        for (const [id, has] of results) map[id] = has;
        setCoachFeedbackByAnalysis(map);
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, [user, userAnalyses]);

  // Cargar estado de reseñas de coach para los análisis listados
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!user || !userAnalyses.length) return;
        const token = await user.getIdToken();
        const analysisIds = userAnalyses.slice(0, 50).map((a) => a.id);
        const res = await fetch('/api/analyses/batch-coach-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ analysisIds }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCoachReviewStatusByAnalysis(data?.statusByAnalysis || {});
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

  const openReviewDialog = (analysis: any) => {
    setReviewTarget(analysis);
    setReviewRating("5");
    setReviewComment("");
    setReviewDialogOpen(true);
  };

  const submitCoachReview = async () => {
    if (!reviewTarget || !user) return;
    const rating = Number(reviewRating);
    if (!rating || rating < 1 || rating > 5) {
      toast({ title: 'Calificación inválida', description: 'Seleccioná una calificación de 1 a 5.', variant: 'destructive' });
      return;
    }
    try {
      setReviewSubmitting(true);
      const token = await user.getIdToken();
      const res = await fetch(`/api/analyses/${reviewTarget.id}/coach-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment: reviewComment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo enviar la reseña.');
      }
      toast({ title: 'Reseña enviada', description: 'Gracias por tu devolución.' });
      setReviewDialogOpen(false);
      if (reviewTarget?.coachId) {
        setCoachReviewStatusByAnalysis((prev) => {
          const current = prev[reviewTarget.id]?.reviewedCoachIds || [];
          const next = Array.from(new Set([...current, String(reviewTarget.coachId)]));
          return { ...prev, [reviewTarget.id]: { ...prev[reviewTarget.id], reviewedCoachIds: next } };
        });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo enviar la reseña.', variant: 'destructive' });
    } finally {
      setReviewSubmitting(false);
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
                const reviewedCoachIds = coachReviewStatusByAnalysis[analysis.id]?.reviewedCoachIds || [];
                const hasCoachReview = analysis?.coachId ? reviewedCoachIds.includes(String(analysis.coachId)) : false;
                return (
                <div
                  key={analysis.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${analysis.status === 'analyzed' && analysis.coachCompleted ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Video className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{analysis.shotType}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <Calendar className="h-4 w-4" />
                        <FormattedDate dateString={analysis.createdAt} />
                        {getStatusBadge(analysis.status)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis.status === 'analyzed' && analysis.coachCompleted && (
                      <div className="hidden sm:flex items-center justify-center px-3 py-2 rounded-md border border-blue-200 bg-blue-100 text-blue-800 text-xs font-semibold">
                        Revisado por entrenador
                      </div>
                    )}
                    {analysis.status === 'analyzed' && analysis.coachCompleted && analysis.coachId && (
                      hasCoachReview ? (
                        <div className="hidden sm:flex items-center justify-center px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                          Reseña enviada
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openReviewDialog(analysis)}>
                          Dejar reseña
                        </Button>
                      )
                    )}
                    {analysis.status === 'analyzed' && (
                      <Button asChild size="sm">
                        <Link href={`/analysis/${analysis.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Resultados
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )})}
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

      <AlertDialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reseña del entrenador</AlertDialogTitle>
            <AlertDialogDescription>
              Compartí tu experiencia para ayudar a otros jugadores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Calificación</div>
              <Select value={reviewRating} onValueChange={setReviewRating}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una calificación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - Excelente</SelectItem>
                  <SelectItem value="4">4 - Muy bueno</SelectItem>
                  <SelectItem value="3">3 - Bueno</SelectItem>
                  <SelectItem value="2">2 - Regular</SelectItem>
                  <SelectItem value="1">1 - Malo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Comentario (opcional)</div>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Contá qué te gustó y qué se puede mejorar..."
                rows={4}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={submitCoachReview} disabled={reviewSubmitting}>
              {reviewSubmitting ? 'Enviando...' : 'Enviar reseña'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de perfil incompleto eliminado: ya no bloquea desde el dashboard */}
    </div>
  );
}
