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
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

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

const buildAISummary = (analyses: ShotAnalysis[]) => {
    if (!analyses.length) return "";
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
    const strengths = collectCounts(analyses.flatMap((a) => a.strengths || []));
    const weaknesses = collectCounts(analyses.flatMap((a) => a.weaknesses || []));
    const recommendations = collectCounts(analyses.flatMap((a) => a.recommendations || []));
    const topStrengths = strengths.slice(0, 3).map((item) => item.label);
    const topWeaknesses = weaknesses.slice(0, 3).map((item) => item.label);
    const topRecommendations = recommendations.slice(0, 3).map((item) => item.label);
    const shotTypes = Array.from(new Set(analyses.map((a) => a.shotType).filter(Boolean)));
    const total = analyses.length;
    const scoreValues = analyses
        .map((a) => (typeof a.score === "number" ? a.score : null))
        .filter((v): v is number => typeof v === "number");
    const averageScore = scoreValues.length > 0
        ? Number((scoreValues.reduce((sum, v) => sum + v, 0) / scoreValues.length).toFixed(1))
        : null;
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
    const strengthsText = topStrengths.length ? `Fortalezas recurrentes: ${topStrengths.join(', ')}.` : '';
    const weaknessesText = topWeaknesses.length ? `Aspectos a mejorar: ${topWeaknesses.join(', ')}.` : '';
    const recommendationsText = topRecommendations.length ? `Recomendaciones frecuentes: ${topRecommendations.join(', ')}.` : '';
    const averageText = averageScore != null ? `Promedio general: ${averageScore}.` : '';
    return `Resumen IA basado en ${total} analisis. ${shotTypesText} ${averageText} ${strengthsText} ${weaknessesText} ${recommendationsText} ${trend}`
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

export function PlayerProfileClient({ player, analyses, evaluations, comments }: PlayerProfileClientProps) {
  const { userProfile } = useAuth();
  const visibleAnalyses = useMemo(() => {
    if (userProfile?.role !== 'coach' || !userProfile?.id) return analyses;
    return analyses.filter((analysis: any) => analysis?.coachAccess?.[userProfile.id]?.status === 'paid');
  }, [analyses, userProfile]);
  const aiProgressSummary = useMemo(() => buildAISummary(visibleAnalyses), [visibleAnalyses]);
  const chartData = getChartData(visibleAnalyses);
  const [filter, setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const latestAnalysisId = [...visibleAnalyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id;
  const [progressSummaryDraft, setProgressSummaryDraft] = useState<string>("");
  const [editingProgressSummary, setEditingProgressSummary] = useState(false);
  const [savingProgressSummary, setSavingProgressSummary] = useState(false);
  const canEditProgressSummary = Boolean(
    userProfile?.id &&
    (userProfile?.role === 'coach' || userProfile?.role === 'admin') &&
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

  const strengthsList = useMemo(
    () => visibleAnalyses.flatMap((a) => a.strengths || []).map((s) => s.trim()).filter((s) => s.length > 0),
    [visibleAnalyses]
  );
  const weaknessesList = useMemo(
    () => visibleAnalyses.flatMap((a) => a.weaknesses || []).map((s) => s.trim()).filter((s) => s.length > 0),
    [visibleAnalyses]
  );

  const filteredAnalyses = filter === 'all' 
    ? visibleAnalyses 
    : visibleAnalyses.filter(a => a.shotType === filter);

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
                      const coachStatus = a.coachCompleted === true
                        ? { label: 'Evaluado', variant: 'default' as const }
                        : { label: 'En revisión', variant: 'secondary' as const };
                      return (
                        <tr key={a.id} className={isLatest ? 'bg-primary/5' : ''}>
                          <td className="px-3 py-2 whitespace-nowrap"><FormattedDate dateString={a.createdAt} /></td>
                          <td className="px-3 py-2 whitespace-nowrap">{a.shotType}</td>
                          <td className="px-3 py-2">{score}</td>
                          <td className="px-3 py-2">
                            <Badge variant={coachStatus.variant}>{coachStatus.label}</Badge>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
