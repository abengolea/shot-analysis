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

export function AnalysisPageClient({ id }: { id: string }) {
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
          videoBackUrl: analysisData.videoBackUrl,
          videoFrontUrl: analysisData.videoFrontUrl,
          videoLeftUrl: analysisData.videoLeftUrl,
          videoRightUrl: analysisData.videoRightUrl,
          shotType: analysisData.shotType,
          analysisSummary: analysisData.analysisResult?.analysisSummary || analysisData.analysisSummary || '',
          strengths: analysisData.analysisResult?.technicalAnalysis?.strengths || analysisData.analysisResult?.strengths || analysisData.strengths || [],
          weaknesses: analysisData.analysisResult?.technicalAnalysis?.weaknesses || analysisData.analysisResult?.weaknesses || analysisData.weaknesses || [],
          recommendations: analysisData.analysisResult?.technicalAnalysis?.recommendations || analysisData.analysisResult?.recommendations || analysisData.recommendations || [],
          keyframes: analysisData.analysisResult?.keyframes || analysisData.keyframes || { front: [], back: [], left: [], right: [] },
          detailedChecklist: (() => {
            // Obtener los parámetros originales
            const parameters = analysisData.analysisResult?.technicalAnalysis?.parameters || analysisData.analysisResult?.detailedChecklist || analysisData.detailedChecklist || [];
            
            // Si son parámetros individuales, aplicar lógica de conversión
            if (Array.isArray(parameters) && parameters.length > 0 && parameters[0].score !== undefined) {
              return [{
                category: "TODOS LOS PARÁMETROS",
                items: parameters.map((p: any) => ({
                  id: p.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
                  name: p.name || 'Parámetro desconocido',
                  description: p.comment || '',
                  score: p.score || 0, // PRESERVAR el score original
                  status: (() => {
                    const score = p.score || 0;
                    if (score >= 70) return 'Correcto';
                    if (score >= 36) return 'Mejorable';
                    return 'Incorrecto';
                  })(), // Forzar cálculo basado en score
                  rating: (() => {
                    const score = p.score || 0;
                    if (score >= 90) return 5; // Excelente
                    if (score >= 70) return 4; // Correcto
                    if (score >= 50) return 3; // Mejorable
                    if (score >= 30) return 2; // Incorrecto leve
                    return 1; // Incorrecto
                  })(),
                  comment: p.comment || '',
                  na: p.status === 'no_evaluable',
                  razon: p.razon || '',
                  evidencia: p.evidencia || '',
                  timestamp: p.timestamp || ''
                }))
              }];
            }
            
            // Si ya es un detailedChecklist procesado, devolverlo tal como está
            return parameters;
          })(),
          score: analysisData.analysisResult?.score || analysisData.analysisResult?.overallScore || analysisData.score,
          fluidezScore10: analysisData.fluidezScore10,
          // Agregar verificación y otros campos del análisis
          verification: analysisData.analysisResult?.verification || analysisData.verification,
          shotSummary: analysisData.analysisResult?.shotSummary || analysisData.shotSummary,
          shots: analysisData.analysisResult?.shots || analysisData.shots,
          // ⚖️ Agregar metadatos del score calculado
          scoreMetadata: analysisData.analysisResult?.scoreMetadata || null,
          // 🔢 Calcular resumen de evaluación automáticamente
          resumen_evaluacion: (() => {
            const parameters = analysisData.analysisResult?.technicalAnalysis?.parameters || analysisData.analysisResult?.detailedChecklist || analysisData.detailedChecklist || [];
            let parametros_evaluados = 0;
            let parametros_no_evaluables = 0;
            const lista_no_evaluables: string[] = [];
            
            // Contar UNO POR UNO cada parámetro
            if (Array.isArray(parameters) && parameters.length > 0) {
              // Si son parámetros individuales (tienen score directamente)
              if (parameters[0].score !== undefined) {
                parameters.forEach((p: any, index: number) => {
                                    if (p.status === 'no_evaluable' || p.na === true) {
                    parametros_no_evaluables++;
                    lista_no_evaluables.push(`${p.name}: ${p.razon || p.comment || 'no evaluable'}`);
                  } else {
                    parametros_evaluados++;
                  }
                });
              } else {
                // Si es detailedChecklist procesado, contar desde items
                const flatItems = parameters.flatMap((c: any) => c.items || []);
                flatItems.forEach((item: any, index: number) => {
                                    if (item.na === true || item.status === 'no_evaluable') {
                    parametros_no_evaluables++;
                    lista_no_evaluables.push(`${item.name}: ${item.razon || item.comment || 'no evaluable'}`);
                  } else {
                    parametros_evaluados++;
                  }
                });
              }
            }

                                                                        console.log(`📋 Lista no evaluables:`, lista_no_evaluables);
                        // FORZAR el uso del cálculo automático, ignorar el resumen de la IA
                        console.log(`✅ Parámetros evaluables: ${parametros_evaluados} (calculado automáticamente)`);
            console.log(`❌ Parámetros no evaluables: ${parametros_no_evaluables} (calculado automáticamente)`);
            
            return {
              parametros_evaluados,
              parametros_no_evaluables,
              lista_no_evaluables,
              score_global: analysisData.analysisResult?.score || analysisData.analysisResult?.overallScore || analysisData.score || 0,
              nota: `Score calculado con ${parametros_evaluados} de 21 parámetros evaluables (${parametros_no_evaluables} no evaluables por limitaciones del video)`,
              confianza_analisis: parametros_evaluados >= 15 ? 'alta' : parametros_evaluados >= 10 ? 'media' : 'baja'
            };
          })(),
        } as any;

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
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error || 'Análisis no encontrado'}</p>
            <Link href="/player/dashboard">
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header con info del jugador */}
      <div className="mb-6">
        <Link href="/player/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>
        
        {player && (
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={player.avatarUrl} alt={player.name} />
              <AvatarFallback>{player.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{player.name || 'Jugador'}</h1>
              <p className="text-muted-foreground">{formattedDate}</p>
            </div>
          </div>
        )}
      </div>

      {/* Componente principal de análisis */}
      <AnalysisView analysis={analysis} player={player || {} as Player} />

      {/* Sección de comentarios (deshabilitada por ahora) */}
      {/* <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentarios
          </CardTitle>
          <CardDescription>
            Deja tus comentarios sobre este análisis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommentForm analysisId={analysis.id} />
        </CardContent>
      </Card> */}
    </div>
  );
}
