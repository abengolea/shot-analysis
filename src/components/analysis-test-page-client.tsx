"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnalysisView } from "@/components/analysis-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Send, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ShotAnalysis, Player } from "@/lib/types";
// import { moderateAndAddComment } from "@/app/actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

function CommentForm({ analysisId }: { analysisId: string }) {
    // TODO: Implementar funcionalidad de comentarios
    // const [state, formAction] = useActionState(moderateAndAddComment, { message: "" });
    // const { pending } = useFormStatus();

    return (
        <div className="grid w-full gap-2 p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
                Funcionalidad de comentarios en desarrollo
            </p>
            <Textarea placeholder="Escribe tu mensaje aquí." name="comment" disabled />
            <Button disabled>
                <Send className="mr-2 h-4 w-4" />
                Publicar Comentario
            </Button>
        </div>
    );
}

export function AnalysisTestPageClient({ id }: { id: string }) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<ShotAnalysis | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
                const response = await fetch(`/api/analyses/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Análisis no encontrado');
            return;
          }
          throw new Error(`Error: ${response.status}`);
        }

        const analysisData = await response.json();
                // Mapear la respuesta para que coincida con el tipo esperado
        const shotAnalysis: ShotAnalysis = {
          id: analysisData.id,
          playerId: analysisData.playerId,
          status: analysisData.status,
          createdAt: analysisData.createdAt,
          updatedAt: analysisData.updatedAt,
          videoUrls: analysisData.videoUrls || [],
          keyframes: analysisData.keyframes || [],
          analysisResult: analysisData.analysisResult,
          detailedChecklist: analysisData.detailedChecklist || analysisData.analysisResult?.detailedChecklist,
          analysisSummary: analysisData.analysisSummary || analysisData.analysisResult?.analysisSummary,
          overallScore: analysisData.overallScore || analysisData.analysisResult?.overallScore,
          strengths: analysisData.strengths || analysisData.analysisResult?.strengths,
          weaknesses: analysisData.weaknesses || analysisData.analysisResult?.weaknesses,
          recommendations: analysisData.recommendations || analysisData.analysisResult?.recommendations,
          score: analysisData.score || analysisData.overallScore || analysisData.analysisResult?.overallScore,
          // Campos de verificación de video real
          verification: analysisData.analysisResult?.verification || analysisData.verification,
          shotSummary: analysisData.analysisResult?.shotSummary || analysisData.shotSummary,
          shots: analysisData.analysisResult?.shots || analysisData.shots,
        } as any;

                        console.log('🔍 Debug - detailedChecklist mapping:', {
          analysisDataDetailedChecklist: !!analysisData.detailedChecklist,
          analysisDataDetailedChecklistLength: analysisData.detailedChecklist?.length || 0,
          analysisResultDetailedChecklist: !!analysisData.analysisResult?.detailedChecklist,
          analysisResultDetailedChecklistLength: analysisData.analysisResult?.detailedChecklist?.length || 0,
          finalDetailedChecklist: !!shotAnalysis.detailedChecklist,
          finalDetailedChecklistLength: shotAnalysis.detailedChecklist?.length || 0,
          shotAnalysisSample: shotAnalysis.detailedChecklist?.slice(0, 2) || 'N/A'
        });

        setAnalysis(shotAnalysis);

        // Obtener información del jugador
        if (analysisData.playerId) {
          const playerResponse = await fetch(`/api/players/${analysisData.playerId}`);
          if (playerResponse.ok) {
            const playerData = await playerResponse.json();
                        setPlayer(playerData);
          }
        }
      } catch (err) {
        console.error('Error fetching analysis:', err);
        setError('Error al cargar el análisis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Cargando análisis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'Análisis no encontrado'}
          </p>
          <Link href="/player/dashboard">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/player/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">🧪 Análisis de Tiro - TEST</h1>
            <p className="text-muted-foreground">
              Página de prueba con prompt simplificado
            </p>
          </div>
        </div>
        
        {player && (
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={player.photoURL || undefined} />
              <AvatarFallback>
                {player.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-right">
              <p className="font-medium">{player.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(analysis.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Información del análisis */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Estado del Análisis
            </CardTitle>
            <CardDescription>
              Información general del análisis de tiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estado</p>
                <p className="text-lg font-semibold capitalize">
                  {analysis.status === 'analyzed' ? 'Completado' : analysis.status}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Puntuación</p>
                <p className="text-lg font-semibold">
                  {analysis.score || analysis.overallScore || 0}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                <p className="text-lg font-semibold">
                  {new Date(analysis.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Componente principal de análisis */}
        <AnalysisView
          analysis={analysis}
          player={player || ({
            id: analysis.playerId,
            name: 'Usuario',
            email: '',
            role: 'player',
            avatarUrl: '',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            displayName: 'Usuario',
          } as Player)}
        />

        {/* Sección de comentarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comentarios
            </CardTitle>
            <CardDescription>
              Comparte tu opinión sobre este análisis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CommentForm analysisId={analysis.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
