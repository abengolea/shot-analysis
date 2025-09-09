"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, TrendingUp, Calendar, Star } from "lucide-react";
import { PlayerEvaluation } from "@/lib/types";

interface PlayerEvaluationCardProps {
  evaluation: PlayerEvaluation;
  onEdit?: (evaluation: PlayerEvaluation) => void;
  isEditable?: boolean;
}

export function PlayerEvaluationCard({ evaluation, onEdit, isEditable = false }: PlayerEvaluationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 8) return "default";
    if (score >= 6) return "secondary";
    return "destructive";
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={evaluation.coachAvatarUrl} alt={evaluation.coachName} />
              <AvatarFallback className="text-sm">
                {evaluation.coachName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{evaluation.coachName}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {formatDate(evaluation.evaluationDate)}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-2xl font-bold">{evaluation.overallScore}</span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
            <Badge variant={getScoreBadgeVariant(evaluation.overallScore)}>
              {evaluation.overallScore >= 8 ? 'Excelente' : 
               evaluation.overallScore >= 6 ? 'Bueno' : 'Necesita Mejora'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Puntuaciones por Categoría */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Técnica</span>
            <div className="flex items-center gap-2">
              <Progress value={evaluation.technicalScore * 10} className="w-20" />
              <span className={`text-sm font-semibold ${getScoreColor(evaluation.technicalScore)}`}>
                {evaluation.technicalScore}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Física</span>
            <div className="flex items-center gap-2">
              <Progress value={evaluation.physicalScore * 10} className="w-20" />
              <span className={`text-sm font-semibold ${getScoreColor(evaluation.physicalScore)}`}>
                {evaluation.physicalScore}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mental</span>
            <div className="flex items-center gap-2">
              <Progress value={evaluation.mentalScore * 10} className="w-20" />
              <span className={`text-sm font-semibold ${getScoreColor(evaluation.mentalScore)}`}>
                {evaluation.mentalScore}
              </span>
            </div>
          </div>
        </div>

        {/* Resumen Expandible */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between p-0 h-auto"
          >
            <span className="text-sm font-medium">Ver Detalles</span>
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </Button>

          {isExpanded && (
            <div className="space-y-4 pt-2 border-t">
              {/* Fortalezas */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Fortalezas
                </h4>
                <ul className="space-y-1">
                  {evaluation.strengths.map((strength, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Debilidades */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Áreas de Mejora
                </h4>
                <ul className="space-y-1">
                  {evaluation.weaknesses.map((weakness, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recomendaciones */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Recomendaciones
                </h4>
                <ul className="space-y-1">
                  {evaluation.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Notas */}
              {evaluation.notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Notas del Entrenador</h4>
                  <p className="text-sm text-muted-foreground italic">{evaluation.notes}</p>
                </div>
              )}

              {/* Próximos Pasos */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Próximos Pasos</h4>
                <ul className="space-y-1">
                  {evaluation.nextSteps.map((step, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Botón de Edición */}
        {isEditable && onEdit && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onEdit(evaluation)}
            >
              Editar Evaluación
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

