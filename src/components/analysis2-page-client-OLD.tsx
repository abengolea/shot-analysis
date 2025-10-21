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

export function Analysis2PageClient({ id }: { id: string }) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<ShotAnalysis | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formattedDate, setFormattedDate] = useState("");

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!id) return;

      try {
        setLoading(true);
        
        // Obtener el análisis específico
        const response = await fetch(`/api/analyses/${id}`);
        if (!response.ok) {
          throw new Error('Análisis no encontrado');
        }
        
        const analysisData = await response.json();
        
        // Validar que tenemos datos válidos
        if (!analysisData || !analysisData.id) {
          throw new Error('Datos de análisis inválidos');
        }
        
        // Adaptar a tipo ShotAnalysis
        const shotAnalysis: ShotAnalysis = {
          id: analysisData.id,
          playerId: analysisData.playerId,
          createdAt: analysisData.createdAt,
          videoUrl: analysisData.videoUrl,
          shotType: analysisData.shotType,
          analysisSummary: analysisData.analysisResult?.analysisSummary || analysisData.analysisSummary || '',
          strengths: analysisData.analysisResult?.technicalAnalysis?.strengths || analysisData.analysisResult?.strengths || analysisData.strengths || [],
          weaknesses: analysisData.analysisResult?.technicalAnalysis?.weaknesses || analysisData.analysisResult?.weaknesses || analysisData.weaknesses || [],
          recommendations: analysisData.analysisResult?.technicalAnalysis?.recommendations || analysisData.analysisResult?.recommendations || analysisData.recommendations || [],
          keyframes: analysisData.analysisResult?.keyframes || analysisData.keyframes || { front: [], back: [], left: [], right: [] },
          detailedChecklist: analysisData.analysisResult?.technicalAnalysis?.parameters || analysisData.analysisResult?.detailedChecklist || analysisData.detailedChecklist || [],
          score: analysisData.analysisResult?.score || analysisData.analysisResult?.overallScore || analysisData.score,
          fluidezScore10: analysisData.fluidezScore10,
          // Agregar verificación y otros campos del análisis
          verification: analysisData.analysisResult?.verification || analysisData.verification,
          shotSummary: analysisData.analysisResult?.shotSummary || analysisData.shotSummary,
          shots: analysisData.analysisResult?.shots || analysisData.shots,
          // ⚖️ Agregar metadatos del score calculado
          scoreMetadata: analysisData.analysisResult?.scoreMetadata || null,
        } as any;

                        console.log('🔍 Debug - Analysis2 analysisResult completo:', JSON.stringify(analysisData, null, 2));
        
        console.log('🔍 Debug - Analysis2 detailedChecklist específico:', {
          hasDetailedChecklist: !!analysisData.detailedChecklist,
          detailedChecklistType: typeof analysisData.detailedChecklist,
          detailedChecklistLength: Array.isArray(analysisData.detailedChecklist) ? analysisData.detailedChecklist.length : 'No es array',
          detailedChecklistStructure: analysisData.detailedChecklist
        });
        
        setAnalysis(shotAnalysis);
        setFormattedDate(new Date(analysisData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'}));
        
        // Obtener datos del jugador
        const playerResponse = await fetch(`/api/players/${analysisData.playerId}`);
        if (playerResponse.ok) {
          const playerData = await playerResponse.json();
          setPlayer(playerData.player);
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el análisis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [id]); // Removido user?.uid de las dependencias

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Cargando análisis...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Error</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'No se pudo cargar el análisis'}
          </p>
          <Button asChild>
            <Link href="/player/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Error</h2>
          <p className="text-muted-foreground mb-4">
            No se pudo cargar la información del jugador
          </p>
          <Button asChild>
            <Link href="/player/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  
  const coach = null; // TODO: Implementar carga de coach
  const comments: any[] = [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/players/${player.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">{player.name}</p>
          <h1 className="font-headline text-2xl font-bold">
            Análisis de {analysis.shotType} (Prompt Simplificado)
          </h1>
          <p className="font-semibold text-muted-foreground">
            {formattedDate || "..."}
            {coach && (
              <span className="ml-2 inline-flex items-center gap-1.5 font-normal">
                <UserCheck className="h-4 w-4" />
                Entrenador: {coach.name}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="w-full">
         <AnalysisView analysis={analysis} player={player} />
      </div>
    </div>
  );
}
