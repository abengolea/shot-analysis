"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Target, Play, Star, TrendingUp, TrendingDown, GitCompare, X } from "lucide-react";
import { ShotAnalysis } from "@/lib/types";
import { VideoPlayer } from "@/components/video-player";
import { normalizeVideoUrl } from "@/lib/video-url";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlayerVideosSectionProps {
  analyses: ShotAnalysis[];
  onVideoClick?: (analysis: ShotAnalysis) => void;
}

export function PlayerVideosSection({ analyses, onVideoClick }: PlayerVideosSectionProps) {
  const { user } = useAuth();
  const [selectedAnalysis, setSelectedAnalysis] = useState<ShotAnalysis | null>(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [comparisonSecond, setComparisonSecond] = useState<ShotAnalysis | null>(null);
  const [modalSize, setModalSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const MIN_MODAL_WIDTH = 400;
  const MIN_MODAL_HEIGHT = 320;

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = modalRef.current?.getBoundingClientRect();
    const w = modalSize?.width ?? rect?.width ?? (comparisonSecond ? 1152 : 896);
    const h = modalSize?.height ?? rect?.height ?? Math.min(window.innerHeight * 0.9, 800);
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w, h };
    setIsResizing(true);
  }, [modalSize, comparisonSecond]);

  useEffect(() => {
    if (!isResizing) return;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const onMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      setModalSize({
        width: Math.max(MIN_MODAL_WIDTH, Math.min(window.innerWidth - 32, start.w + (e.clientX - start.x))),
        height: Math.max(MIN_MODAL_HEIGHT, Math.min(window.innerHeight - 32, start.h + (e.clientY - start.y))),
      });
    };
    const onUp = () => {
      resizeStartRef.current = null;
      setIsResizing(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isResizing]);

  const isNonBasketballAnalysis = (analysis: ShotAnalysis) => {
    const warning = (analysis as any)?.advertencia || (analysis as any)?.analysisResult?.advertencia || '';
    const summary = analysis?.analysisSummary || '';
    const text = `${warning} ${summary}`.toLowerCase();
    return /no corresponde a basquet|no detectamos/.test(text);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getShotTypeLabel = (shotType: string) => {
    switch (shotType) {
      case 'Tiro Libre':
        return 'Tiro Libre';
      case 'Lanzamiento de Media Distancia (Jump Shot)':
        return 'Jump Shot';
      case 'Lanzamiento de Tres':
        return 'Tres Puntos';
      default:
        return shotType;
    }
  };

  // Obtener puntaje raw del análisis (API puede enviar displayScore 0..100; si no, leer de score/analysisResult/scoreMetadata)
  const getScoreRaw = (a: ShotAnalysis | any): number | undefined => {
    const x = a as any;
    if (typeof x?.displayScore === "number") return x.displayScore;
    const raw =
      x?.score ??
      x?.analysisResult?.score ??
      x?.analysisResult?.overallScore ??
      x?.analysisResult?.scoreMetadata?.weightedScore ??
      x?.scoreMetadata?.weightedScore;
    return typeof raw === "number" ? raw : undefined;
  };

  // score 0..100 (compat: si viene 0..10 o 0..5, convertir a 0..100)
  const toPct = (score: number): number => {
    if (score <= 10) {
      // Heurística: si es decimal con un dígito típico (7.2, 8.5) asumir escala 0..10
      return Math.round(score * 10);
    }
    if (score <= 5) {
      return Math.round((score / 5) * 100);
    }
    return Math.round(score);
  };

  const getScoreColor = (scoreRaw: number) => {
    const score = toPct(scoreRaw);
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (scoreRaw: number) => {
    const score = toPct(scoreRaw);
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };


  const handleVideoClick = (analysis: ShotAnalysis) => {
    setSelectedAnalysis(analysis);
    setComparisonSecond(null);
    onVideoClick?.(analysis);
  };

  useEffect(() => {
    let cancelled = false;
    const loadDetails = async () => {
      if (!selectedAnalysis?.id) {
        setDetailedAnalysis(null);
        return;
      }
      try {
        setDetailsLoading(true);
        const token = user ? await user.getIdToken() : null;
        const res = await fetch(`/api/analyses/${selectedAnalysis.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          if (!cancelled) setDetailedAnalysis(null);
          return;
        }
        const raw = await res.json();
        const analysisData = raw?.analysis ?? raw;
        const normalized = normalizeAnalysisFromApi(analysisData, selectedAnalysis);
        if (!cancelled) setDetailedAnalysis(normalized);
      } catch {
        if (!cancelled) setDetailedAnalysis(null);
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };
    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedAnalysis?.id, user]);

  const sortedAnalyses = [...analyses].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Promedio solo sobre análisis que tienen puntaje (escala 0..100)
  const analysesWithScore = sortedAnalyses.filter((a) => getScoreRaw(a) != null);
  const averageScore =
    analysesWithScore.length > 0
      ? Math.round(
          analysesWithScore.reduce((sum, a) => sum + toPct(getScoreRaw(a)!), 0) / analysesWithScore.length
        )
      : 0;

  const modalAnalysis = (detailedAnalysis || selectedAnalysis) as any;
  const selectedVideoUrl = modalAnalysis?.videoUrl
    ? normalizeVideoUrl(modalAnalysis.videoUrl)
    : null;

  const scoreTrend = sortedAnalyses.length >= 2 ? (() => {
    const newest = sortedAnalyses[0];
    const oldest = sortedAnalyses[sortedAnalyses.length - 1];
    return toPct(getScoreRaw(newest) ?? 0) - toPct(getScoreRaw(oldest) ?? 0);
  })() : 0;

  const getThumbnailUrl = (analysis: ShotAnalysis) => {
    const keyframes = analysis.keyframes || { front: [], back: [], left: [], right: [] };
    return (
      keyframes.front?.[0] ||
      keyframes.back?.[0] ||
      keyframes.left?.[0] ||
      keyframes.right?.[0] ||
      null
    );
  };

  const getAnalysisLabel = (analysis: ShotAnalysis) => {
    const summary = (analysis.analysisSummary || "").trim();
    if (summary.length > 0) return summary;
    return `Análisis de ${getShotTypeLabel(analysis.shotType)}`;
  };

  const getCoachSummary = (analysis: any) => {
    const raw =
      analysis?.coachSummary ??
      analysis?.coachFeedback?.coachSummary ??
      analysis?.coachFeedback?.summary ??
      analysis?.coachSummaryText ??
      "";
    return typeof raw === "string" ? raw : "";
  };

  const normalizeAnalysisFromApi = (analysisData: any, fallback: ShotAnalysis) => {
    const analysisResult = analysisData?.analysisResult || {};
    return {
      ...fallback,
      ...analysisData,
      analysisSummary:
        analysisResult?.analysisSummary ||
        analysisData?.analysisSummary ||
        fallback.analysisSummary ||
        "",
      strengths:
        analysisResult?.technicalAnalysis?.strengths ||
        analysisResult?.strengths ||
        analysisData?.strengths ||
        fallback.strengths ||
        [],
      weaknesses:
        analysisResult?.technicalAnalysis?.weaknesses ||
        analysisResult?.weaknesses ||
        analysisData?.weaknesses ||
        fallback.weaknesses ||
        [],
      recommendations:
        analysisResult?.technicalAnalysis?.recommendations ||
        analysisResult?.recommendations ||
        analysisData?.recommendations ||
        fallback.recommendations ||
        [],
      score:
        analysisResult?.score ||
        analysisResult?.overallScore ||
        analysisData?.score ||
        fallback.score,
      coachSummary: getCoachSummary(analysisData),
    };
  };

  return (
    <div className="space-y-6">
      {/* Resumen de Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Resumen de Análisis de Videos
          </CardTitle>
          <CardDescription>
            Estadísticas generales de todos los análisis realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">{analyses.length}</div>
              <p className="text-sm text-muted-foreground">Total de Análisis</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
                {averageScore}
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <p className="text-sm text-muted-foreground">Puntuación Promedio</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
                {scoreTrend > 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : scoreTrend < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="h-5 w-5" />
                )}
                {Math.abs(scoreTrend).toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground">
                {scoreTrend > 0 ? 'Mejora' : scoreTrend < 0 ? 'Disminución' : 'Sin Cambio'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Videos */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold">Videos de Análisis</h3>
          <p className="text-xs text-muted-foreground">Ordenados por fecha (más reciente primero)</p>
        </div>
        
        {sortedAnalyses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedAnalyses.map((analysis) => {
              const strengths = Array.isArray(analysis.strengths) ? analysis.strengths : [];
              const weaknesses = Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [];
              const isNonBasketball = isNonBasketballAnalysis(analysis);
              const thumbnailUrl = getThumbnailUrl(analysis);
              const videoPreviewUrl = !thumbnailUrl && analysis.videoUrl
                ? normalizeVideoUrl(analysis.videoUrl)
                : null;
              const analysisLabel = getAnalysisLabel(analysis);
              const shortId = analysis.id ? analysis.id.slice(0, 8).toUpperCase() : "";
              const hasVideo = Boolean(analysis.videoUrl);
              const keyframesStatus = analysis.keyframesStatus;
              return (
              <Card 
                key={analysis.id} 
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleVideoClick(analysis)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {getShotTypeLabel(analysis.shotType)}
                    </Badge>
                    {typeof getScoreRaw(analysis) === 'number' && (
                      <Badge variant={getScoreBadgeVariant(getScoreRaw(analysis)!)}>
                        {toPct(getScoreRaw(analysis)!)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Ref: {shortId || 'N/A'}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(analysis.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Thumbnail del Video */}
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden group-hover:bg-muted/80 transition-colors">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={analysisLabel}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : videoPreviewUrl ? (
                      <video
                        src={videoPreviewUrl}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        aria-label={`Vista previa de ${analysisLabel}`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-12 w-12 text-primary opacity-80 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        {hasVideo ? "Video disponible" : "Sin video"}
                      </Badge>
                    </div>
                    {keyframesStatus === 'pending' && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-xs">
                          Generando preview
                        </Badge>
                      </div>
                    )}
                    {keyframesStatus === 'error' && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="destructive" className="text-xs">
                          Preview fallida
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Información del Análisis */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm line-clamp-2">
                      {analysisLabel}
                    </h4>
                    
                    {typeof getScoreRaw(analysis) === 'number' && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Puntuación</span>
                        <span className={`font-semibold ${getScoreColor(getScoreRaw(analysis)!)}`}>
                          {toPct(getScoreRaw(analysis)!)}/100
                        </span>
                      </div>
                    )}

                    {/* Fortalezas y Debilidades */}
                    <div className="space-y-2">
                      {!isNonBasketball && strengths.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-600 mb-1">Fortalezas</p>
                          <div className="flex flex-wrap gap-1">
                            {strengths.slice(0, 2).map((strength, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {strength}
                              </Badge>
                            ))}
                            {strengths.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{strengths.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {!isNonBasketball && weaknesses.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-orange-600 mb-1">Áreas de Mejora</p>
                          <div className="flex flex-wrap gap-1">
                            {weaknesses.slice(0, 2).map((weakness, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {weakness}
                              </Badge>
                            ))}
                            {weaknesses.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{weaknesses.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón de Acción */}
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleVideoClick(analysis);
                      }}
                      disabled={!hasVideo}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {hasVideo ? "Ver video" : "Video no disponible"}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="w-full">
                      <Link href={`/analysis/${analysis.id}`}>
                        Ver análisis completo
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );})}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="mx-auto h-16 w-16 mb-4 opacity-50" />
            <h4 className="text-lg font-semibold mb-2">No hay videos analizados</h4>
            <p>Este jugador aún no tiene videos subidos para análisis.</p>
          </div>
        )}
      </div>

      {/* Modal de Video Seleccionado */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className={`bg-background rounded-lg overflow-y-auto relative select-none ${!modalSize ? `w-full max-h-[90vh] ${comparisonSecond ? "max-w-6xl" : "max-w-4xl"}` : ""}`}
            style={modalSize ? { width: modalSize.width, height: modalSize.height, minWidth: MIN_MODAL_WIDTH, minHeight: MIN_MODAL_HEIGHT } : undefined}
          >
            {/* Asa de redimensionado: borde inferior derecho */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Redimensionar ventana"
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1.5 z-10 rounded-br-lg hover:bg-muted/50 transition-colors"
              onMouseDown={startResize}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground shrink-0" aria-hidden>
                <path d="M14 14L10 10M14 14V10M14 14H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">
                  Análisis: {getShotTypeLabel(modalAnalysis?.shotType || selectedAnalysis.shotType)}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedAnalysis(null);
                    setDetailedAnalysis(null);
                    setComparisonSecond(null);
                    setModalSize(null);
                  }}
                >
                  ✕
                </Button>
              </div>
              
            <div className="space-y-4">
                {/* Comparación: dos videos lado a lado */}
                {comparisonSecond && selectedVideoUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Comparación visual</span>
                      <Button variant="ghost" size="sm" onClick={() => setComparisonSecond(null)}>
                        <X className="h-4 w-4 mr-1" />
                        Cerrar comparación
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground truncate">
                          {getShotTypeLabel(modalAnalysis?.shotType || selectedAnalysis.shotType)} · {formatDate(modalAnalysis?.createdAt || selectedAnalysis.createdAt)}
                        </p>
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                          <VideoPlayer src={selectedVideoUrl} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground truncate">
                          {getShotTypeLabel(comparisonSecond.shotType)} · {formatDate(comparisonSecond.createdAt)}
                        </p>
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                          <VideoPlayer src={normalizeVideoUrl(comparisonSecond.videoUrl ?? '') ?? ''} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedVideoUrl ? (
                  <>
                    <div className="space-y-2">
                      <VideoPlayer src={selectedVideoUrl} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={selectedVideoUrl} target="_blank" rel="noopener noreferrer">
                            Abrir video en otra pestaña
                          </a>
                        </Button>
                        {sortedAnalyses.filter((a) => a.id !== selectedAnalysis?.id && a.videoUrl).length > 0 && (
                          <div className="flex items-center gap-2">
                            <GitCompare className="h-4 w-4 text-muted-foreground" />
                            <Select
                              value={comparisonSecond?.id ?? ""}
                              onValueChange={(id) => {
                                const other = sortedAnalyses.find((a) => a.id === id);
                                setComparisonSecond(other ?? null);
                              }}
                            >
                              <SelectTrigger className="w-[220px]" aria-label="Comparar con otro video">
                                <SelectValue placeholder="Comparar con otro video" />
                              </SelectTrigger>
                              <SelectContent>
                                {sortedAnalyses
                                  .filter((a) => a.id !== selectedAnalysis?.id && a.videoUrl)
                                  .map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {getShotTypeLabel(a.shotType)} · {formatDate(a.createdAt)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Play className="h-16 w-16 text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Video no disponible</p>
                      <p className="text-sm text-muted-foreground">
                        Este análisis no tiene un video asociado.
                      </p>
                    </div>
                  </div>
                )}

                {/* Información del Análisis (oculta en modo comparación) */}
                {!comparisonSecond && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="text-sm font-medium">
                        {getShotTypeLabel(modalAnalysis?.shotType || selectedAnalysis.shotType)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="text-sm font-medium">
                        {formatDate(modalAnalysis?.createdAt || selectedAnalysis.createdAt)}
                      </p>
                    </div>
                    {typeof getScoreRaw(modalAnalysis) === 'number' && (
                      <div>
                        <p className="text-xs text-muted-foreground">Puntuación</p>
                        <div className="text-2xl font-bold text-primary">
                          {toPct(getScoreRaw(modalAnalysis)!)}/100
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Resumen</h4>
                    <p className="text-sm text-muted-foreground">
                      {detailsLoading
                        ? "Cargando detalles del análisis..."
                        : modalAnalysis?.analysisSummary?.trim()
                        ? modalAnalysis.analysisSummary
                        : "Sin resumen disponible para este análisis."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Devolución del entrenador</h4>
                    <p className="text-sm text-muted-foreground">
                      {detailsLoading
                        ? "Cargando devolución del entrenador..."
                        : getCoachSummary(modalAnalysis)?.trim()
                        ? getCoachSummary(modalAnalysis)
                        : "Todavía no hay devolución del entrenador."}
                    </p>
                  </div>
                </div>
                )}

                {/* Detalles Completos (oculto en modo comparación) */}
                {!comparisonSecond && !isNonBasketballAnalysis(modalAnalysis || selectedAnalysis) && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-semibold mb-2">Fortalezas</h4>
                        {Array.isArray(modalAnalysis?.strengths) && modalAnalysis.strengths.length > 0 ? (
                          <ul className="space-y-1">
                            {modalAnalysis.strengths.map((strength: string, index: number) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
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
                        <h4 className="font-semibold mb-2">Áreas de Mejora</h4>
                        {Array.isArray(modalAnalysis?.weaknesses) && modalAnalysis.weaknesses.length > 0 ? (
                          <ul className="space-y-1">
                            {modalAnalysis.weaknesses.map((weakness: string, index: number) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                                {weakness}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin áreas de mejora registradas.</p>
                        )}
                      </div>
                    </div>

                    {Array.isArray(modalAnalysis?.recommendations) && modalAnalysis.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Recomendaciones</h4>
                        <ul className="space-y-1">
                          {modalAnalysis.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

