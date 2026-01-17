"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from "next/link";
import {
  FileText,
  Calendar,
  BarChart,
  Target,
  User,
  MapPin,
  Phone,
  Award,
  MessageSquare,
  Star,
  Video,
  ArrowLeft,
  Users,
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
import { PlayerEvaluationCard } from "@/components/player-evaluation-card";
import { PlayerCommentsSection } from "@/components/player-comments-section";
import { Button } from "@/components/ui/button";
import { PlayerVideosSection } from "@/components/player-videos-section";
import { useAuth } from "@/hooks/use-auth";

// Normaliza cualquier escala a 0..100 con 1 decimal (prioriza 1..5, luego 1..10)
const toPct = (score: number): number => {
    if (score <= 5) return Number(((score / 5) * 100).toFixed(1));
    if (score <= 10) return Number(((score) * 10).toFixed(1));
    return Number((Number(score)).toFixed(1));
};

// Helper to format chart data from analyses with time filters
const getChartData = (analyses: ShotAnalysis[], timeFilter: 'semanal' | 'mensual' | 'anual' = 'mensual') => {
    const playerAnalyses = analyses
        .filter(a => a.score !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (playerAnalyses.length === 0) return [];
    
    const now = new Date();
    let filteredAnalyses = playerAnalyses;

    // Aplicar filtro de tiempo
    if (timeFilter === 'semanal') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredAnalyses = playerAnalyses.filter(a => new Date(a.createdAt) >= oneWeekAgo);
    } else if (timeFilter === 'mensual') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredAnalyses = playerAnalyses.filter(a => new Date(a.createdAt) >= oneMonthAgo);
    } else if (timeFilter === 'anual') {
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        filteredAnalyses = playerAnalyses.filter(a => new Date(a.createdAt) >= oneYearAgo);
    }

    if (filteredAnalyses.length === 0) return [];

    // Agrupar por período según el filtro
    if (timeFilter === 'semanal') {
        // Mostrar cada análisis individual para vista semanal
        return filteredAnalyses.map((analysis) => {
            const date = new Date(analysis.createdAt);
            const day = date.getDate();
            const month = date.toLocaleString('es-ES', { month: 'short' });
            return {
                month: `${day} ${month}`,
                score: toPct(analysis.score!),
                fullDate: analysis.createdAt,
                analysisId: analysis.id
            };
        });
    } else if (timeFilter === 'mensual') {
        // Agrupar por semana para vista mensual
        const weeklyScores: { [key: string]: number[] } = {};
        filteredAnalyses.forEach(analysis => {
            const date = new Date(analysis.createdAt);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Lunes de la semana
            const weekKey = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
            
            if (!weeklyScores[weekKey]) {
                weeklyScores[weekKey] = [];
            }
            weeklyScores[weekKey].push(toPct(analysis.score!));
        });

        return Object.entries(weeklyScores).map(([week, scores]) => ({
            month: `Sem ${week}`,
            score: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
            fullDate: '',
            analysisId: ''
        }));
    } else {
        // Agrupar por mes para vista anual
        const monthlyScores: { [key: string]: number[] } = {};
        filteredAnalyses.forEach(analysis => {
            const date = new Date(analysis.createdAt);
            const month = date.toLocaleString('es-ES', { month: 'short', year: 'numeric' });
            
            if (!monthlyScores[month]) {
                monthlyScores[month] = [];
            }
            monthlyScores[month].push(toPct(analysis.score!));
        });

        return Object.entries(monthlyScores).map(([month, scores]) => ({
            month: month.split(' ')[0],
            score: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
            fullDate: '',
            analysisId: ''
        }));
    }
};

function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        // This check ensures the code runs only on the client
        if (typeof window !== 'undefined') {
            setFormattedDate(new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'}));
        }
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}

interface CoachPlayerProfileClientProps {
  player: Player;
  analyses: ShotAnalysis[];
  evaluations: PlayerEvaluation[];
  comments: PlayerComment[];
}

export function CoachPlayerProfileClient({ player, analyses, evaluations, comments }: CoachPlayerProfileClientProps) {
  const { userProfile } = useAuth();
  const [timeFilter, setTimeFilter] = useState<'semanal' | 'mensual' | 'anual'>('mensual');
  const userRole = (userProfile as any)?.role;
  const coachId = userRole === 'coach' ? userProfile?.id : null;
  const visibleAnalyses = useMemo(() => {
    if (userRole === 'coach') {
      if (!coachId) return [];
      return analyses.filter((analysis) => {
        const access = (analysis as any)?.coachAccess;
        return Boolean(access && access[coachId]?.status === 'paid');
      });
    }
    return analyses;
  }, [analyses, coachId, userRole]);
  const chartData = getChartData(visibleAnalyses, timeFilter);
  const [filter, setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const latestAnalysisId = [...visibleAnalyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id;

  const filteredAnalyses = filter === 'all' 
    ? visibleAnalyses 
    : visibleAnalyses.filter(a => a.shotType === filter);

  // Verificar si el entrenador actual es el entrenador asignado al jugador
  const isAssignedCoach = userProfile?.role === 'coach' && userProfile.id === player.coachId;

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb y navegación */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/coach/dashboard#players">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Mis Jugadores
          </Link>
        </Button>
      </div>

      {/* Header del Jugador */}
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-4 border-primary/20">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback className="text-2xl sm:text-3xl">
            {player.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-headline text-2xl sm:text-4xl font-bold tracking-tight">
              {player.name}
            </h1>
            {isAssignedCoach && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Users className="h-3 w-3 mr-1" />
                Tu Jugador
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
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
        <TabsList className="w-full flex gap-2 overflow-x-auto flex-nowrap sm:grid sm:grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <Video className="h-4 w-4" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <Star className="h-4 w-4" />
            Evaluaciones
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

        {/* Pestaña: Evaluaciones */}
        <TabsContent value="evaluations" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Evaluaciones del Jugador</h2>
            <p className="text-muted-foreground mb-6">
              Revisa las evaluaciones realizadas por entrenadores y crea nuevas evaluaciones.
            </p>
          </div>

          {evaluations.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {evaluations.map((evaluation) => (
                <PlayerEvaluationCard
                  key={evaluation.id}
                  evaluation={evaluation}
                  isEditable={isAssignedCoach}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="mx-auto h-16 w-16 mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No hay evaluaciones</h3>
              <p>Este jugador aún no tiene evaluaciones de entrenadores.</p>
            </div>
          )}

          {/* Botón para Agregar Nueva Evaluación - Solo si es el entrenador asignado */}
          {isAssignedCoach && (
            <div className="text-center">
              <Button size="lg">
                <Star className="mr-2 h-4 w-4" />
                Crear Nueva Evaluación
              </Button>
            </div>
          )}
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
                      return (
                        <tr key={a.id} className={isLatest ? 'bg-primary/5' : ''}>
                          <td className="px-3 py-2 whitespace-nowrap"><FormattedDate dateString={a.createdAt} /></td>
                          <td className="px-3 py-2 whitespace-nowrap">{a.shotType}</td>
                          <td className="px-3 py-2">{score}</td>
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
            
            {/* Filtros de tiempo */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={timeFilter === 'semanal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeFilter('semanal')}
              >
                Semanal
              </Button>
              <Button
                variant={timeFilter === 'mensual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeFilter('mensual')}
              >
                Mensual
              </Button>
              <Button
                variant={timeFilter === 'anual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeFilter('anual')}
              >
                Anual
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Progreso de Puntuación - {timeFilter === 'semanal' ? 'Última Semana' : timeFilter === 'mensual' ? 'Último Mes' : 'Último Año'}</CardTitle>
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
                <CardTitle>Resumen de Mejoras - Último Análisis</CardTitle>
                <CardDescription>
                  Áreas de mejora y fortalezas identificadas en el análisis más reciente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestAnalysisId ? (
                  <>
                    <div>
                      <h4 className="font-semibold mb-2 text-green-600">Fortalezas Identificadas</h4>
                      {(() => {
                        const latestAnalysis = visibleAnalyses.find(a => a.id === latestAnalysisId);
                        const strengths = latestAnalysis?.strengths;
                                                return strengths && Array.isArray(strengths) && strengths.length > 0;
                      })() ? (
                        <ul className="space-y-1">
                          {visibleAnalyses.find(a => a.id === latestAnalysisId)!.strengths.map((strength, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No se identificaron fortalezas específicas en el último análisis.</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2 text-orange-600">Áreas de Mejora</h4>
                      {(() => {
                        const latestAnalysis = visibleAnalyses.find(a => a.id === latestAnalysisId);
                        const weaknesses = latestAnalysis?.weaknesses;
                                                return weaknesses && Array.isArray(weaknesses) && weaknesses.length > 0;
                      })() ? (
                        <ul className="space-y-1">
                          {visibleAnalyses.find(a => a.id === latestAnalysisId)!.weaknesses.map((weakness, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No se identificaron áreas de mejora específicas en el último análisis.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No hay análisis disponibles para mostrar fortalezas y debilidades.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
