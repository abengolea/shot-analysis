"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AnalysisView } from '@/components/analysis-view';
import type { ShotAnalysis, Player as PlayerType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Analysis {
  id: string;
  playerId: string;
  playerName: string;
  shotType: string;
  createdAt: string;
  videoUrl: string;
  status: string;
  analysisResult?: any;
}

interface Player {
  id: string;
  name: string;
  avatarUrl: string;
  playerLevel?: string;
  ageGroup?: string;
}

export default function AnalysisPage() {
  const params = useParams();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const analysisId = params.id as string;

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!analysisId || !user?.uid) return;

      try {
        setLoading(true);
        
        // Obtener el análisis específico
        const response = await fetch(`/api/analyses/${analysisId}`);
        if (!response.ok) {
          throw new Error('Análisis no encontrado');
        }
        
        const analysisData = await response.json();
        setAnalysis(analysisData.analysis);
        
        // Obtener datos del jugador
        const playerResponse = await fetch(`/api/players/${analysisData.analysis.playerId}`);
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
  }, [analysisId, user?.uid]);

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
            <Link href="/dashboard">
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
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Adaptar a tipos fuertes de AnalysisView
  const shotAnalysis: ShotAnalysis = {
    id: analysis.id,
    playerId: analysis.playerId,
    createdAt: analysis.createdAt,
    videoUrl: analysis.videoUrl,
    shotType: analysis.shotType as any,
    analysisSummary: (analysis as any).analysisSummary || analysis.analysisResult?.analysisSummary || '',
    strengths: (analysis as any).strengths || analysis.analysisResult?.strengths || [],
    weaknesses: (analysis as any).weaknesses || analysis.analysisResult?.weaknesses || [],
    recommendations: (analysis as any).recommendations || analysis.analysisResult?.recommendations || [],
    keyframes: (analysis as any).keyframes || { front: [], back: [], left: [], right: [] },
    detailedChecklist: (analysis as any).detailedChecklist || analysis.analysisResult?.detailedChecklist || [],
    score: (analysis as any).score,
    fluidezScore10: (analysis as any).fluidezScore10,
  } as any;

  // Inyectar URLs adicionales de videos si existen
  (shotAnalysis as any).videoFrontUrl = (analysis as any).videoFrontUrl || (analysis as any).videoUrl || null;
  (shotAnalysis as any).videoBackUrl = (analysis as any).videoBackUrl || null;
  (shotAnalysis as any).videoLeftUrl = (analysis as any).videoLeftUrl || null;
  (shotAnalysis as any).videoRightUrl = (analysis as any).videoRightUrl || null;

  const playerStrong: PlayerType = {
    id: player.id,
    name: player.name,
    email: '',
    role: 'player',
    avatarUrl: player.avatarUrl,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    playerLevel: player.playerLevel as any,
    ageGroup: player.ageGroup as any,
  } as any;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        
        <Avatar className="h-16 w-16">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                Análisis de {analysis.shotType}
                {Array.isArray((analysis as any).attempts) && ( (analysis as any).attempts.length > 0) && (
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                    Intentos: {(analysis as any).attempts.length}
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground">
                Jugador: {player.name} • {new Date(analysis.createdAt).toLocaleDateString('es-ES')}
              </p>
              <p className="text-sm text-muted-foreground">
                Nivel: {player.playerLevel || 'Por definir'} • Grupo: {player.ageGroup || 'Por definir'}
              </p>
            </div>
            {/* Botones de compartir movidos debajo del resumen */}
          </div>
        </div>
      </div>

      <AnalysisView analysis={shotAnalysis} player={playerStrong} />
    </div>
  );
}
