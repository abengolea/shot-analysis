"use client";

import { useState, useEffect, useRef } from "react";
import { notFound, useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Send, UserCheck, Loader2, UserCircle, CheckCircle2, Clock } from "lucide-react";
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
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ShotAnalysis | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formattedDate, setFormattedDate] = useState("");
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [unlockStatus, setUnlockStatus] = useState<{
    status: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed';
    paidCoachIds: Array<{ coachId: string; coachName: string }>;
    hasCoachFeedback: boolean;
    unlocks: Array<{ preferenceId?: string | null; paymentProvider?: string | null; paymentId?: string | null }>;
  } | null>(null);
  const mpCheckRef = useRef(false);
  const userRole = (userProfile as any)?.role;
  const resolvedRole = viewerRole || userRole;
  const isCoach = resolvedRole === 'coach';
  const paidCoachNames = unlockStatus?.paidCoachIds
    ?.map((coach) => coach.coachName)
    .filter((name) => typeof name === 'string' && name.trim().length > 0) || [];
  const paidCoachLabel = paidCoachNames.length > 0
    ? paidCoachNames.join(', ')
    : 'un entrenador';

  useEffect(() => {
    // Esperar a que termine la carga de autenticación antes de continuar
    if (authLoading) {
      console.log('[AnalysisPageClient] ⏳ Esperando autenticación...');
      return;
    }

    const fetchAnalysis = async () => {
      if (!id) {
        console.error('[AnalysisPageClient] No hay ID de análisis');
        setError('ID de análisis no proporcionado');
        setLoading(false);
        return;
      }

      try {
        console.log(`[AnalysisPageClient] 🔍 Cargando análisis: ${id}`);
        setLoading(true);
        setError(null);
        
        // Obtener el análisis específico
        console.log(`[AnalysisPageClient] 📡 Llamando a /api/analyses/${id}`);
        const token = user ? await user.getIdToken() : null;
        const response = await fetch(`/api/analyses/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        console.log(`[AnalysisPageClient] 📥 Respuesta recibida:`, response.status, response.statusText);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
          console.error(`[AnalysisPageClient] ❌ Error en respuesta:`, errorData);
          throw new Error(errorData.error || `Error ${response.status}: Análisis no encontrado`);
        }
        
        const rawData = await response.json();
        const analysisData = (rawData && rawData.analysis) ? rawData.analysis : rawData;
        console.log(`[AnalysisPageClient] ✅ Datos del análisis recibidos:`, {
          id: analysisData?.id,
          playerId: analysisData?.playerId,
          status: analysisData?.status,
          hasCoachAccess: !!analysisData?.coachAccess
        });
        
        // Validar que tenemos datos válidos
        if (!analysisData || !analysisData.id) {
          console.error(`[AnalysisPageClient] ❌ Datos de análisis inválidos:`, analysisData);
          throw new Error('Datos de análisis inválidos');
        }
        
        if (analysisData?.analysisMode === 'biomech-pro') {
          setRedirecting(true);
          router.replace(`/biomech-pro/analysis/${analysisData.id}`);
          return;
        }

        // Adaptar a tipo ShotAnalysis
        let shotAnalysis: ShotAnalysis = {
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
          coachCompleted: analysisData.coachCompleted === true,
          shots: analysisData.analysisResult?.shots || analysisData.shots,
          // ⚖️ Agregar metadatos del score calculado
          scoreMetadata: analysisData.analysisResult?.scoreMetadata || analysisData.scoreMetadata || null,
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
              nota: `Score calculado con ${parametros_evaluados} de 22 parámetros evaluables (${parametros_no_evaluables} no evaluables por limitaciones del video)`,
              confianza_analisis: parametros_evaluados >= 15 ? 'alta' : parametros_evaluados >= 10 ? 'media' : 'baja'
            };
          })(),
        } as any;

        const analysisPlayerId = analysisData.playerId;
        const userId = user?.uid || null;
        const coachAccess = userId ? (analysisData.coachAccess || {})[userId] : null;
        const hasCoachAccess = !!coachAccess && coachAccess.status === 'paid';
        const isAssignedCoach = Boolean(
          userId && analysisData.coachId && String(analysisData.coachId) === String(userId)
        );
        const isOwnerPlayer = userId && analysisPlayerId && String(analysisPlayerId) === String(userId);
        const effectiveRole = userRole === 'admin'
          ? 'admin'
          : (hasCoachAccess || isAssignedCoach)
            ? 'coach'
            : isOwnerPlayer
              ? 'player'
              : userRole;

        if (hasCoachAccess || isAssignedCoach) {
          try { localStorage.setItem('preferredRole', 'coach'); } catch {}
        }
        setViewerRole(effectiveRole || null);

        console.log(`[AnalysisPageClient] 👤 Usuario autenticado:`, {
          uid: userId || 'anon',
          role: effectiveRole
        });

        // Si es jugador, verificar que el análisis le pertenece
        if (effectiveRole === 'player' && userId && analysisData.playerId !== userId) {
          console.error(`[AnalysisPageClient] ❌ Jugador no tiene permiso:`, {
            analysisPlayerId: analysisData.playerId,
            userUid: userId
          });
          throw new Error('No tienes permiso para ver este análisis');
        }

        // Si es coach, verificar que tenga acceso pagado al análisis
        if (effectiveRole === 'coach') {
          console.log(`[AnalysisPageClient] 🔐 Verificando acceso del coach:`, {
            coachUid: userId || 'anon',
            hasCoachAccess: !!analysisData.coachAccess,
            coachAccessKeys: analysisData.coachAccess ? Object.keys(analysisData.coachAccess) : [],
            coachAccessForUser: coachAccess,
            status: coachAccess?.status,
            isAssignedCoach
          });
          
          if (!hasCoachAccess && !isAssignedCoach) {
            console.error(`[AnalysisPageClient] ❌ Coach sin acceso:`, {
              hasAccess: !!coachAccess,
              status: coachAccess?.status,
              required: 'paid_or_assigned'
            });
            throw new Error('No tienes acceso a este análisis. Debes comprar el acceso primero.');
          }
          
          console.log(`[AnalysisPageClient] ✅ Coach con acceso`);
        }

        console.log(`[AnalysisPageClient] ✅ Análisis procesado correctamente`);
        const resolveTempUrl = (url?: string | null) => typeof url === 'string' && url.startsWith('temp://');
        const tempTypes: Array<'main' | 'back' | 'front' | 'left' | 'right'> = [];
        if (resolveTempUrl(shotAnalysis.videoUrl)) tempTypes.push('main');
        if (resolveTempUrl(shotAnalysis.videoBackUrl)) tempTypes.push('back');
        if (resolveTempUrl(shotAnalysis.videoFrontUrl)) tempTypes.push('front');
        if (resolveTempUrl(shotAnalysis.videoLeftUrl)) tempTypes.push('left');
        if (resolveTempUrl(shotAnalysis.videoRightUrl)) tempTypes.push('right');

        if (tempTypes.length > 0) {
          const updates: Partial<ShotAnalysis> = {};
          await Promise.all(
            tempTypes.map(async (type) => {
              try {
                const res = await fetch(`/api/analyses/${id}/resolve-temp-video?type=${type}`, { method: 'POST' });
                if (!res.ok) return;
                const data = await res.json();
                if (!data?.url) return;
                if (type === 'main') updates.videoUrl = data.url;
                if (type === 'back') updates.videoBackUrl = data.url;
                if (type === 'front') updates.videoFrontUrl = data.url;
                if (type === 'left') updates.videoLeftUrl = data.url;
                if (type === 'right') updates.videoRightUrl = data.url;
              } catch {}
            })
          );
          shotAnalysis = { ...shotAnalysis, ...updates };
        }

        setAnalysis(shotAnalysis);
        setFormattedDate(new Date(analysisData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'}));
        
        // Obtener datos del jugador
        console.log(`[AnalysisPageClient] 📡 Cargando datos del jugador: ${analysisData.playerId}`);
        const playerResponse = await fetch(`/api/players/${analysisData.playerId}`);
        if (playerResponse.ok) {
          const playerData = await playerResponse.json();
          console.log(`[AnalysisPageClient] ✅ Datos del jugador recibidos:`, playerData.player?.name);
          setPlayer(playerData.player);
        } else {
          console.warn(`[AnalysisPageClient] ⚠️ No se pudieron cargar datos del jugador:`, playerResponse.status);
        }
        
        // Cargar estado de unlock si es jugador
        if (effectiveRole === 'player' && user) {
          try {
            const token = await user.getIdToken();
            const unlockResponse = await fetch(`/api/analyses/${id}/unlock-status`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (unlockResponse.ok) {
              const unlockData = await unlockResponse.json();
              setUnlockStatus({
                status: unlockData.status || 'none',
                paidCoachIds: unlockData.paidCoachIds || [],
                hasCoachFeedback: unlockData.hasCoachFeedback || false,
                unlocks: unlockData.unlocks || [],
              });
            }
          } catch (error) {
            console.error('[AnalysisPageClient] Error cargando unlock status:', error);
          }
        }
        
        console.log(`[AnalysisPageClient] ✅ Carga completada exitosamente`);
      } catch (err) {
        console.error(`[AnalysisPageClient] ❌ Error al cargar análisis:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar el análisis';
        setError(errorMessage);
        console.error(`[AnalysisPageClient] ❌ Mensaje de error establecido:`, errorMessage);
      } finally {
        setLoading(false);
        console.log(`[AnalysisPageClient] 🏁 Estado de carga finalizado`);
      }
    };

    fetchAnalysis();
  }, [id, user, userRole, authLoading]);

  // Si el pago está pendiente en MP, intentar reprocesarlo automáticamente
  useEffect(() => {
    const tryProcessPendingMp = async () => {
      if (mpCheckRef.current) return;
      if (!user || resolvedRole !== 'player' || !unlockStatus || unlockStatus.status !== 'pending_payment') return;
      const mpUnlock = unlockStatus.unlocks.find(
        (u) => u.paymentProvider === 'mercadopago' && u.preferenceId
      );
      if (!mpUnlock?.preferenceId) return;

      mpCheckRef.current = true;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/payments/check-mp-payment', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            preferenceId: mpUnlock.preferenceId,
            analysisId: id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.success) {
            const unlockResponse = await fetch(`/api/analyses/${id}/unlock-status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (unlockResponse.ok) {
              const unlockData = await unlockResponse.json();
              setUnlockStatus({
                status: unlockData.status || 'none',
                paidCoachIds: unlockData.paidCoachIds || [],
                hasCoachFeedback: unlockData.hasCoachFeedback || false,
                unlocks: unlockData.unlocks || [],
              });
            }
          }
        }
      } catch (error) {
        console.error('[AnalysisPageClient] Error reprocesando MP:', error);
      }
    };

    tryProcessPendingMp();
  }, [id, user, resolvedRole, unlockStatus]);

  if (authLoading || loading || redirecting) {
    console.log(`[AnalysisPageClient] ⏳ Mostrando estado de carga (authLoading: ${authLoading}, loading: ${loading})`);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-muted-foreground">
          {authLoading ? 'Verificando autenticación...' : redirecting ? 'Redirigiendo al análisis biomecánico...' : 'Cargando análisis...'}
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    console.error(`[AnalysisPageClient] ❌ Mostrando error:`, { error, hasAnalysis: !!analysis });
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error al cargar el análisis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">{error || 'Análisis no encontrado'}</p>
            <div className="flex flex-col gap-2">
              <Link href={isCoach ? "/coach/dashboard" : "/player/dashboard"}>
                <Button variant="default" className="w-full sm:w-auto">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al Dashboard
                </Button>
              </Link>
              {isCoach && (
                <Link href={`/coach/players/${analysis?.playerId || ''}`}>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Volver al Perfil del Jugador
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log(`[AnalysisPageClient] 🎨 Renderizando página de análisis:`, {
    hasAnalysis: !!analysis,
    hasPlayer: !!player,
    analysisId: analysis?.id,
    playerId: player?.id
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header con info del jugador */}
      <div className="mb-6">
        <Link href={isCoach ? "/coach/dashboard" : "/player/dashboard"}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>
        
        {player && analysis && (
          <div className="flex items-start gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={player.avatarUrl} alt={player.name} />
              <AvatarFallback>{player.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{player.name || 'Jugador'}</h1>
              {analysis.shotType && (
                <div className="mb-2">
                  <Badge variant="default" className="text-base px-4 py-1.5 font-semibold">
                    {analysis.shotType}
                  </Badge>
                </div>
              )}
              <p className="text-muted-foreground text-sm">{formattedDate}</p>
            </div>
          </div>
        )}
        {!player && analysis && analysis.shotType && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-3">{analysis.shotType}</h1>
            <p className="text-muted-foreground">{formattedDate}</p>
          </div>
        )}

        {/* Botón destacado para solicitar revisión con coach real (solo para jugadores) */}
        {!isCoach && analysis && resolvedRole === 'player' && (
          <div className="mb-6 flex flex-col items-end gap-2">
            {unlockStatus?.hasCoachFeedback ? (
              <div className="flex flex-col items-end gap-2">
                <Link href={`/analysis/${analysis.id}#coach-checklist`}>
                  <Button size="default" variant="outline" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Ver revisión del entrenador
                  </Button>
                </Link>
              </div>
            ) : unlockStatus?.status === 'paid_pending_review' ? (
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">✅ Análisis ya abonado</span>
                  </div>
                  <p className="mt-1 text-xs">
                    Pendiente evaluación por {paidCoachLabel}. Te notificaremos cuando esté listo.
                  </p>
                </div>
              </div>
            ) : (
              <Link href={`/player/coaches?analysisId=${analysis.id}`}>
                <Button size="default" variant="outline" className="border-primary/30 hover:bg-primary/5">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Solicitar revisión con coach real
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Componente principal de análisis */}
      {analysis ? (
        <AnalysisView
          analysis={analysis}
          player={player || ({} as Player)}
          viewerRole={resolvedRole}
        />
      ) : (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900">Análisis no disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700">No se pudo cargar el análisis. Por favor, intenta nuevamente.</p>
          </CardContent>
        </Card>
      )}

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
