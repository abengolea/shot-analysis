"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Target, Play, Star, TrendingUp, TrendingDown } from "lucide-react";
import { ShotAnalysis } from "@/lib/types";

interface PlayerVideosSectionProps {
  analyses: ShotAnalysis[];
  onVideoClick?: (analysis: ShotAnalysis) => void;
}

export function PlayerVideosSection({ analyses, onVideoClick }: PlayerVideosSectionProps) {
  const [selectedAnalysis, setSelectedAnalysis] = useState<ShotAnalysis | null>(null);

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

  const getProgressColor = (scoreRaw: number) => {
    const score = toPct(scoreRaw);
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleVideoClick = (analysis: ShotAnalysis) => {
    setSelectedAnalysis(analysis);
    onVideoClick?.(analysis);
  };

  const sortedAnalyses = [...analyses].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const averageScore = analyses.length > 0 
    ? Math.round(analyses.reduce((sum, a) => sum + toPct(a.score || 0), 0) / analyses.length)
    : 0;

  const scoreTrend = analyses.length >= 2 ? 
    (toPct(analyses[analyses.length - 1].score || 0) - toPct(analyses[0].score || 0)) : 0;

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
        <h3 className="text-lg font-semibold mb-4">Videos de Análisis</h3>
        
        {sortedAnalyses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedAnalyses.map((analysis) => {
              const strengths = Array.isArray(analysis.strengths) ? analysis.strengths : [];
              const weaknesses = Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [];
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
                    {typeof analysis.score === 'number' && (
                      <Badge variant={getScoreBadgeVariant(analysis.score)}>
                        {toPct(analysis.score)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Thumbnail del Video */}
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden group-hover:bg-muted/80 transition-colors">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="h-12 w-12 text-primary opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        {formatDate(analysis.createdAt)}
                      </Badge>
                    </div>
                  </div>

                  {/* Información del Análisis */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm line-clamp-2">
                      {analysis.analysisSummary}
                    </h4>
                    
                    {typeof analysis.score === 'number' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Puntuación</span>
                          <span className={`font-semibold ${getScoreColor(analysis.score)}`}>
                            {toPct(analysis.score)}/100
                          </span>
                        </div>
                        <Progress 
                          value={toPct(analysis.score)} 
                          className={`h-2 ${getProgressColor(analysis.score)}`}
                        />
                      </div>
                    )}

                    {/* Fortalezas y Debilidades */}
                    <div className="space-y-2">
                      {strengths.length > 0 && (
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

                      {weaknesses.length > 0 && (
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
                  <Button 
                    asChild
                    variant="outline" 
                    size="sm" 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  >
                    <Link href={`/analysis/${analysis.id}`}>
                      <Play className="mr-2 h-4 w-4" />
                      Ver Checklist (IA)
                    </Link>
                  </Button>
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
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">
                  Análisis: {getShotTypeLabel(selectedAnalysis.shotType)}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAnalysis(null)}
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Video Player Placeholder */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Play className="h-16 w-16 text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Reproductor de Video</p>
                    <p className="text-sm text-muted-foreground">
                      URL: {selectedAnalysis.videoUrl}
                    </p>
                  </div>
                </div>

                {/* Información del Análisis */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-2">Resumen</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedAnalysis.analysisSummary}
                    </p>
                  </div>
                  
                  {typeof selectedAnalysis.score === 'number' && (
                    <div>
                      <h4 className="font-semibold mb-2">Puntuación</h4>
                      <div className="text-2xl font-bold text-primary">
                        {toPct(selectedAnalysis.score)}/100
                      </div>
                    </div>
                  )}
                </div>

                {/* Detalles Completos */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-2">Fortalezas</h4>
                    <ul className="space-y-1">
                      {(Array.isArray(selectedAnalysis.strengths) ? selectedAnalysis.strengths : []).map((strength, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Áreas de Mejora</h4>
                    <ul className="space-y-1">
                      {(Array.isArray(selectedAnalysis.weaknesses) ? selectedAnalysis.weaknesses : []).map((weakness, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {Array.isArray(selectedAnalysis.recommendations) && selectedAnalysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recomendaciones</h4>
                    <ul className="space-y-1">
                      {(Array.isArray(selectedAnalysis.recommendations) ? selectedAnalysis.recommendations : []).map((rec, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

