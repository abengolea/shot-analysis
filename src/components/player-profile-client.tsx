"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from "next/link";
import {
  FileText,
  BarChart,
  Target,
  User,
  MapPin,
  Phone,
  Award,
  Video,
} from "lucide-react";
import { Player, ShotAnalysis, PlayerEvaluation, PlayerComment } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PlayerProgressChart } from "@/components/player-progress-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlayerVideosSection } from "@/components/player-videos-section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { normalizeVideoUrl } from "@/lib/video-url";

// Normaliza cualquier escala a 0..100 con 1 decimal (prioriza 1..5, luego 1..10)
const toPct = (score: number): number => {
    if (score <= 5) return Number(((score / 5) * 100).toFixed(1));
    if (score <= 10) return Number(((score) * 10).toFixed(1));
    return Number((Number(score)).toFixed(1));
};

// Helper to format chart data from analyses
const getChartData = (analyses: ShotAnalysis[]) => {
    const playerAnalyses = analyses
        .filter(a => a.score !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (playerAnalyses.length === 0) return [];
    
    const monthlyScores: { [key: string]: number[] } = {};

    playerAnalyses.forEach(analysis => {
        const month = new Date(analysis.createdAt).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        if (!monthlyScores[month]) {
            monthlyScores[month] = [];
        }
        monthlyScores[month].push(toPct(analysis.score!));
    });

    return Object.entries(monthlyScores).map(([month, scores]) => ({
        month: month.split(' ')[0].charAt(0).toUpperCase() + month.split(' ')[0].slice(1), // just month name, capitalized
        score: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
    }));
};

const isNonBasketballAnalysis = (analysis: ShotAnalysis) => {
    const warning = (analysis as any)?.advertencia || (analysis as any)?.analysisResult?.advertencia || '';
    const summary = analysis?.analysisSummary || '';
    const text = `${warning} ${summary}`.toLowerCase();
    return /no corresponde a basquet|no detectamos/.test(text);
};

const buildAISummary = (analyses: ShotAnalysis[]) => {
    if (!analyses.length) return "";
    const filteredAnalyses = analyses.filter((analysis) => !isNonBasketballAnalysis(analysis));
    if (!filteredAnalyses.length) return "";
    const normalize = (value: string) => value.trim().toLowerCase();
    const cleanList = (items: string[]) =>
        items.map((item) => item.trim()).filter((item) => item.length > 0);
    const collectCounts = (items: string[]) => {
        const counts = new Map<string, { label: string; count: number }>();
        for (const label of cleanList(items)) {
            const key = normalize(label);
            const current = counts.get(key);
            if (current) {
                current.count += 1;
            } else {
                counts.set(key, { label, count: 1 });
            }
        }
        return Array.from(counts.values()).sort((a, b) => b.count - a.count);
    };
    const summaryTexts = cleanList(filteredAnalyses.map((a) => a.analysisSummary || ""));
    const strengths = collectCounts(filteredAnalyses.flatMap((a) => a.strengths || []));
    const weaknesses = collectCounts(filteredAnalyses.flatMap((a) => a.weaknesses || []));
    const recommendations = collectCounts(filteredAnalyses.flatMap((a) => a.recommendations || []));
    const topStrengths = strengths.slice(0, 5).map((item) => `${item.label} (${item.count})`);
    const topWeaknesses = weaknesses.slice(0, 5).map((item) => `${item.label} (${item.count})`);
    const topRecommendations = recommendations.slice(0, 5).map((item) => `${item.label} (${item.count})`);
    const shotTypes = Array.from(new Set(filteredAnalyses.map((a) => a.shotType).filter(Boolean)));
    const total = filteredAnalyses.length;
    const createdDates = filteredAnalyses
        .map((a) => new Date(a.createdAt).getTime())
        .filter((value) => Number.isFinite(value));
    const dateRange = createdDates.length
        ? (() => {
            const sorted = [...createdDates].sort((a, b) => a - b);
            const start = new Date(sorted[0]).toLocaleDateString('es-AR');
            const end = new Date(sorted[sorted.length - 1]).toLocaleDateString('es-AR');
            return start === end ? `Fecha: ${start}.` : `Periodo: ${start} a ${end}.`;
        })()
        : "";
    const scoreValues = filteredAnalyses
        .map((a) => (typeof a.score === "number" ? a.score : null))
        .filter((v): v is number => typeof v === "number");
    const averageScore = scoreValues.length > 0
        ? Number((scoreValues.reduce((sum, v) => sum + v, 0) / scoreValues.length).toFixed(1))
        : null;
    const lastScore = scoreValues.length > 0 ? scoreValues[scoreValues.length - 1] : null;
    const trend = scoreValues.length >= 2
        ? (() => {
            const last = scoreValues[scoreValues.length - 1];
            const prev = scoreValues[scoreValues.length - 2];
            const delta = last - prev;
            if (delta > 0.2) return "Tendencia reciente: mejora sostenida.";
            if (delta < -0.2) return "Tendencia reciente: leve descenso.";
            return "Tendencia reciente: estable.";
        })()
        : "";
    const shotTypesText = shotTypes.length ? `Tipos de tiro analizados: ${shotTypes.join(', ')}.` : '';
    const strengthsText = topStrengths.length ? `Fortalezas recurrentes: ${topStrengths.join(', ')}.` : 'Fortalezas recurrentes: sin datos suficientes.';
    const weaknessesText = topWeaknesses.length ? `Aspectos a mejorar: ${topWeaknesses.join(', ')}.` : 'Aspectos a mejorar: sin datos suficientes.';
    const recommendationsText = topRecommendations.length ? `Recomendaciones frecuentes: ${topRecommendations.join(', ')}.` : 'Recomendaciones frecuentes: sin datos suficientes.';
    const averageText = averageScore != null ? `Promedio general: ${averageScore}.` : 'Promedio general: sin score disponible.';
    const lastScoreText = lastScore != null ? `Ultimo score: ${lastScore}.` : '';
    const summarySnippet = summaryTexts.length ? `Resumenes previos: ${summaryTexts.slice(0, 2).join(' / ')}.` : '';
    return `Resumen IA basado en ${total} analisis. ${dateRange} ${shotTypesText} ${averageText} ${lastScoreText} ${trend} ${strengthsText} ${weaknessesText} ${recommendationsText} ${summarySnippet}`
        .replace(/\s+/g, ' ')
        .trim();
};

function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        // This check ensures the code runs only on the client
        if (typeof window !== 'undefined') {
            setFormattedDate(
              new Date(dateString).toLocaleString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            );
        }
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}

interface PlayerProfileClientProps {
  player: Player;
  analyses: ShotAnalysis[];
  evaluations: PlayerEvaluation[];
  comments: PlayerComment[];
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

export function PlayerProfileClient({ player, analyses, evaluations, comments }: PlayerProfileClientProps) {
  const { userProfile } = useAuth();
  const isBiomechProAnalysis = (analysis: any) =>
    String(analysis?.analysisMode) === "biomech-pro";
  const visibleAnalyses = useMemo(() => {
    if (userProfile?.role !== 'coach' || !userProfile?.id) return analyses;
    if (String(player.coachId || '') === String(userProfile.id)) return analyses;
    return analyses.filter((analysis: any) => analysis?.coachAccess?.[userProfile.id]?.status === 'paid');
  }, [analyses, userProfile, player]);
  const basketballAnalyses = useMemo(
    () => visibleAnalyses.filter((analysis) => !isNonBasketballAnalysis(analysis)),
    [visibleAnalyses]
  );
  const aiProgressSummary = useMemo(() => buildAISummary(basketballAnalyses), [basketballAnalyses]);
  const chartData = getChartData(visibleAnalyses);
  const [filter, setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const latestAnalysisId = [...visibleAnalyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id;
  const [progressSummaryDraft, setProgressSummaryDraft] = useState<string>("");
  const [editingProgressSummary, setEditingProgressSummary] = useState(false);
  const [savingProgressSummary, setSavingProgressSummary] = useState(false);
  const [comparisonNotes, setComparisonNotes] = useState<ComparisonNote[]>([]);
  const [comparisonAnalyses, setComparisonAnalyses] = useState<Record<string, any>>({});
  const [coachById, setCoachById] = useState<Record<string, { name?: string }>>({});
  const role = (userProfile as any)?.role;
  const canEditProgressSummary = Boolean(
    userProfile?.id &&
    (role === 'coach' || role === 'admin') &&
    String(player.coachId || '') === String(userProfile?.id)
  );

  useEffect(() => {
    if (editingProgressSummary) return;
    const existing = (player as any)?.progressSummary?.text;
    if (typeof existing === 'string' && existing.trim().length > 0) {
      setProgressSummaryDraft(existing);
      return;
    }
    setProgressSummaryDraft(aiProgressSummary);
  }, [player, aiProgressSummary, editingProgressSummary]);

  const strengthsList = useMemo(() => {
    const strengths = basketballAnalyses.flatMap((a) => a.strengths || []).map((s) => s.trim()).filter((s) => s.length > 0);
    if (strengths.length > 0) return strengths;
    const checklistItems = basketballAnalyses.flatMap((analysis) =>
      (analysis.detailedChecklist || []).flatMap((category) => category.items || [])
    );
    return checklistItems
      .filter((item) => item.status === 'Correcto' && !item.na)
      .map((item) => item.name || '')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [basketballAnalyses]);
  const weaknessesList = useMemo(() => {
    const weaknesses = basketballAnalyses.flatMap((a) => a.weaknesses || []).map((s) => s.trim()).filter((s) => s.length > 0);
    if (weaknesses.length > 0) return weaknesses;
    const checklistItems = basketballAnalyses.flatMap((analysis) =>
      (analysis.detailedChecklist || []).flatMap((category) => category.items || [])
    );
    return checklistItems
      .filter((item) =>
        !item.na &&
        (item.status === 'Incorrecto' || item.status === 'Mejorable')
      )
      .map((item) => item.name || '')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [basketballAnalyses]);

  const filteredAnalyses = filter === 'all' 
    ? visibleAnalyses 
    : visibleAnalyses.filter(a => a.shotType === filter);

  const analysisById = useMemo(() => {
    const map: Record<string, any> = {};
    visibleAnalyses.forEach((analysis: any) => {
      if (analysis?.id) map[analysis.id] = analysis;
    });
    return map;
  }, [visibleAnalyses]);

  const getAnalysisLabel = (analysis: any) => {
    const dateRaw = analysis?.createdAt;
    const date = dateRaw ? new Date(dateRaw) : null;
    const label = date && !Number.isNaN(date.getTime()) ? date.toLocaleString('es-ES') : 'Fecha desconocida';
    const shotType = analysis?.shotType ? ` · ${analysis.shotType}` : '';
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

  useEffect(() => {
    if (!player?.id) return;
    const q = query(collection(db as any, 'comparisonNotes'), where('playerId', '==', player.id));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ComparisonNote[];
        list.sort((a, b) => {
          const timeA = (a.createdAt && typeof a.createdAt?.toDate === 'function')
            ? a.createdAt.toDate().getTime()
            : new Date(a.createdAt || 0).getTime();
          const timeB = (b.createdAt && typeof b.createdAt?.toDate === 'function')
            ? b.createdAt.toDate().getTime()
            : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setComparisonNotes(list);
      },
      (err) => {
        console.error('Error cargando comparaciones:', err);
      }
    );
    return () => unsub();
  }, [player?.id]);

  useEffect(() => {
    const ids = new Set<string>();
    comparisonNotes.forEach((note) => {
      if (note.beforeAnalysisId) ids.add(note.beforeAnalysisId);
      if (note.afterAnalysisId) ids.add(note.afterAnalysisId);
    });
    const missing = Array.from(ids).filter((id) => !analysisById[id] && !comparisonAnalyses[id]);
    if (!missing.length) return;
    const load = async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (id) => {
            const snap = await getDoc(doc(db as any, 'analyses', id));
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
      } catch (error) {
        console.error('Error cargando análisis de comparaciones:', error);
      }
    };
    load();
  }, [comparisonNotes, analysisById, comparisonAnalyses]);

  useEffect(() => {
    const coachIds = Array.from(new Set(comparisonNotes.map((note) => note.coachId).filter(Boolean)));
    const missing = coachIds.filter((id) => !coachById[id]);
    if (!missing.length) return;
    const load = async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (id) => {
            const snap = await getDoc(doc(db as any, 'coaches', id));
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
      } catch (error) {
        console.error('Error cargando entrenadores de comparaciones:', error);
      }
    };
    load();
  }, [comparisonNotes, coachById]);

  const comparisonIds = useMemo(() => {
    const ids = new Set<string>();
    comparisonNotes.forEach((note) => {
      if (note.beforeAnalysisId) ids.add(note.beforeAnalysisId);
      if (note.afterAnalysisId) ids.add(note.afterAnalysisId);
    });
    return ids;
  }, [comparisonNotes]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header del Jugador */}
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-4 border-primary/20">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback className="text-2xl sm:text-3xl">
            {player.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="font-headline text-2xl sm:text-4xl font-bold tracking-tight">
            {player.name}
          </h1>
          <div className="mt-1 sm:mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{player.ageGroup}</Badge>
            <Badge variant="secondary">{player.playerLevel}</Badge>
            {player.position && <Badge variant="outline">{player.position}</Badge>}
          </div>
        </div>
        <div className="text-right self-start sm:self-auto">
          <div className="text-xl sm:text-2xl font-bold text-primary">
            {visibleAnalyses.length > 0 
              ? (
                (() => {
                  const vals = visibleAnalyses
                    .map(a => (typeof a.score === 'number' ? toPct(a.score as number) : null))
                    .filter((v): v is number => typeof v === 'number');
                  if (!vals.length) return 'N/A';
                  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
                  return `${avg.toFixed(1)}`;
                })()
              )
              : 'N/A'
            }
          </div>
          <p className="text-sm text-muted-foreground">Puntuación Promedio</p>
        </div>
      </header>

      {/* Sistema de Pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex gap-2 overflow-x-auto flex-nowrap sm:grid sm:grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <Video className="h-4 w-4" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <FileText className="h-4 w-4" />
            Análisis de tiro
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <BarChart className="h-4 w-4" />
            Progreso
          </TabsTrigger>
        </TabsList>

        {/* Pestaña: Perfil General */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Información del Jugador */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información del Jugador
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">País</p>
                        <p className="text-sm text-muted-foreground">{player.country || 'No especificado'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Teléfono</p>
                        <p className="text-sm text-muted-foreground">{player.phone || 'No especificado'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Nivel</p>
                        <p className="text-sm text-muted-foreground">{player.playerLevel || 'No especificado'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Posición</p>
                        <p className="text-sm text-muted-foreground">{player.position || 'No especificado'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {player.height && player.weight && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Altura</p>
                        <p className="text-sm text-muted-foreground">{player.height} cm</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Peso</p>
                        <p className="text-sm text-muted-foreground">{player.weight} kg</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Estadísticas Rápidas */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Estadísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Análisis</span>
                    <span className="font-semibold">{visibleAnalyses.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Evaluaciones</span>
                    <span className="font-semibold">{evaluations.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Comentarios</span>
                    <span className="font-semibold">{comments.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Progreso</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <PlayerProgressChart data={chartData} />
                  ) : (
                    <div className="flex h-[200px] items-center justify-center">
                      <p className="text-center text-muted-foreground text-sm">
                        No hay suficientes datos para mostrar el progreso.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Pestaña: Videos */}
        <TabsContent value="videos" className="space-y-6">
          <PlayerVideosSection analyses={visibleAnalyses} />
        </TabsContent>

        {/* Pestaña: Análisis de tiro (listado) */}
        <TabsContent value="checklist" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Total: {visibleAnalyses.length}</Badge>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">Todos los tipos</option>
                <option value="Tiro Libre">Tiro Libre</option>
                <option value="Lanzamiento de Media Distancia (Jump Shot)">Media Distancia</option>
                <option value="Lanzamiento de Tres">Tres Puntos</option>
              </select>
              {latestAnalysisId && (
                <Link
                  href={`/analysis/${latestAnalysisId}`}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  Ir al último análisis
                </Link>
              )}
            </div>
          </div>

          {filteredAnalyses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
              <p>No hay análisis para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Fecha</th>
                    <th className="text-left font-medium px-3 py-2">Tipo</th>
                    <th className="text-left font-medium px-3 py-2">Score</th>
                    <th className="text-left font-medium px-3 py-2">Estado</th>
                    <th className="text-left font-medium px-3 py-2">Métrica</th>
                    <th className="text-left font-medium px-3 py-2">Comparación</th>
                    <th className="text-left font-medium px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyses
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((a) => {
                      const score = typeof a.score === 'number' ? toPct(a.score as number).toFixed(1) : '-';
                      const isLatest = a.id === latestAnalysisId;
                      const coachStatus = (a as any).coachCompleted === true
                        ? { label: 'Evaluado', variant: 'default' as const }
                        : { label: 'En revisión', variant: 'secondary' as const };
                      return (
                        <tr key={a.id} className={isLatest ? 'bg-primary/5' : ''}>
                          <td className="px-3 py-2 whitespace-nowrap"><FormattedDate dateString={a.createdAt} /></td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{a.shotType}</span>
                              {isBiomechProAnalysis(a) && (
                                <Badge variant="secondary">BIOMECH PRO</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">{score}</td>
                          <td className="px-3 py-2">
                            <Badge variant={coachStatus.variant}>{coachStatus.label}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-muted-foreground">
                              {isBiomechProAnalysis(a)
                                ? "Timing de transferencia (piernas→cadera→tronco→brazo→muñeca)"
                                : "Checklist técnico del tiro"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {comparisonIds.has(a.id) ? (
                              <Link
                                href={`/coach/compare?playerId=${encodeURIComponent(player.id)}&focusAnalysisId=${encodeURIComponent(a.id)}`}
                                className="inline-flex"
                              >
                                <Badge variant="outline">Comparado</Badge>
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/analysis/${a.id}`} className="underline">Ver checklist</Link>
                              {a.videoUrl && (
                                <Link href={`/analysis/${a.id}`} className="text-muted-foreground underline">Ver video</Link>
                              )}
                              <a href={`/analysis/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline">Abrir nueva pestaña</a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Pestaña: Progreso */}
        <TabsContent value="progress" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Progreso del Jugador</h2>
            <p className="text-muted-foreground mb-6">
              Visualiza el progreso a lo largo del tiempo y las tendencias de mejora.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Progreso de Puntuación</CardTitle>
                <CardDescription>
                  Evolución de las puntuaciones en el tiempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <PlayerProgressChart data={chartData} />
                ) : (
                  <div className="flex h-[300px] items-center justify-center">
                    <p className="text-center text-muted-foreground">
                      No hay suficientes datos para mostrar el progreso.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de Mejoras</CardTitle>
                <CardDescription>
                  Generado por IA con todas las devoluciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Resumen IA</h4>
                    {canEditProgressSummary && !editingProgressSummary && (
                      <Button variant="outline" size="sm" onClick={() => setEditingProgressSummary(true)}>
                        Editar
                      </Button>
                    )}
                  </div>
                  {editingProgressSummary ? (
                    <div className="space-y-3">
                      <textarea
                        className="w-full min-h-[140px] rounded-md border bg-background px-3 py-2 text-sm"
                        value={progressSummaryDraft}
                        onChange={(e) => setProgressSummaryDraft(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setProgressSummaryDraft(aiProgressSummary)}
                          disabled={savingProgressSummary}
                        >
                          Usar resumen IA
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!canEditProgressSummary) return;
                            try {
                              setSavingProgressSummary(true);
                              const trimmed = progressSummaryDraft.trim();
                              await updateDoc(doc(db as any, 'players', player.id), {
                                progressSummary: {
                                  text: trimmed,
                                  updatedAt: new Date().toISOString(),
                                  updatedBy: userProfile?.id || null,
                                },
                              });
                              setEditingProgressSummary(false);
                            } catch (error) {
                              console.error('Error guardando resumen de progreso:', error);
                            } finally {
                              setSavingProgressSummary(false);
                            }
                          }}
                          disabled={savingProgressSummary}
                        >
                          {savingProgressSummary ? 'Guardando...' : 'Guardar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProgressSummary(false);
                            const existing = (player as any)?.progressSummary?.text;
                            setProgressSummaryDraft(existing || aiProgressSummary);
                          }}
                          disabled={savingProgressSummary}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {progressSummaryDraft || 'No hay suficiente informacion para generar el resumen.'}
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-green-600">Fortalezas Identificadas</h4>
                  {strengthsList.length > 0 ? (
                    <ul className="space-y-1">
                      {strengthsList.slice(0, 5).map((strength, index) => (
                        <li key={`${strength}-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin fortalezas registradas.</p>
                  )}
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-orange-600">Áreas de Mejora</h4>
                  {weaknessesList.length > 0 ? (
                    <ul className="space-y-1">
                      {weaknessesList.slice(0, 5).map((weakness, index) => (
                        <li key={`${weakness}-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin areas de mejora registradas.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparaciones antes y después</CardTitle>
              <CardDescription>
                Comparaciones realizadas por el entrenador con videos y comentarios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comparisonNotes.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Todavía no hay comparaciones guardadas.
                </div>
              ) : (
                <Accordion type="single" collapsible className="space-y-2">
                  {comparisonNotes.map((note) => {
                    const before = analysisById[note.beforeAnalysisId] || comparisonAnalyses[note.beforeAnalysisId];
                    const after = analysisById[note.afterAnalysisId] || comparisonAnalyses[note.afterAnalysisId];
                    const shotType = (after || before)?.shotType || "Tiro";
                    const beforeDate = before ? new Date(before.createdAt).toLocaleString('es-ES') : 'Fecha desconocida';
                    const afterDate = after ? new Date(after.createdAt).toLocaleString('es-ES') : 'Fecha desconocida';
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
