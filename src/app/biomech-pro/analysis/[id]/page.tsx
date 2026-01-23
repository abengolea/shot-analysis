"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { BiomechVideoPanel } from "@/components/biomech/biomech-video-panel";
import { TimelinePhases } from "@/components/biomech/timeline-phases";
import { normalizeVideoUrl } from "@/lib/video-url";

type Analysis = {
  id: string;
  playerId?: string;
  playerName?: string;
  shotType?: string;
  status?: string;
  createdAt?: string;
  analysisMode?: string;
  videoUrl?: string;
  videoBackUrl?: string;
  videoFrontUrl?: string;
  videoLeftUrl?: string;
  videoRightUrl?: string;
};

type PoseFrame = {
  tMs: number;
  keypoints: Array<{ name: string; x: number; y: number; score?: number }>;
};

export default function BiomechProAnalysisPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params?.id ?? "sin-id";
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(30);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [poseFrames, setPoseFrames] = useState<PoseFrame[] | null>(null);
  const [poseError, setPoseError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!analysisId || analysisId === "sin-id") return;
      setLoading(true);
      setError(null);
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch(`/api/analyses/${analysisId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "No se pudo cargar el análisis.");
        }
        const data = await res.json();
        const payload = data?.analysis ?? data;
        setAnalysis(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar el análisis.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [analysisId, user]);

  useEffect(() => {
    const loadPlayer = async () => {
      const pid = analysis?.playerId;
      if (!pid) return;
      if (analysis?.playerName) {
        setPlayerName(analysis.playerName);
        return;
      }
      try {
        const res = await fetch(`/api/players/${pid}`);
        if (!res.ok) return;
        const data = await res.json();
        const name = data?.player?.name;
        if (typeof name === 'string' && name.trim().length > 0) {
          setPlayerName(name);
        }
      } catch {}
    };
    loadPlayer();
  }, [analysis]);

  useEffect(() => {
    let active = true;
    const loadPoseFrames = async () => {
      if (!analysisId || analysisId === "sin-id") return;
      setPoseError(null);
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch(`/api/pose-frames/${analysisId}?targetFrames=10`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "No se pudieron cargar los puntos de pose.");
        }
        const data = await res.json();
        const frames = Array.isArray(data?.frames) ? data.frames : [];
        if (active) {
          setPoseFrames(frames.length > 0 ? frames : null);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Error al cargar la pose.";
          setPoseError(message);
        }
      }
    };
    loadPoseFrames();
    return () => {
      active = false;
    };
  }, [analysisId, user]);

  const videos = [
    { label: "Trasera", url: normalizeVideoUrl(analysis?.videoBackUrl) },
    { label: "Frontal", url: normalizeVideoUrl(analysis?.videoFrontUrl) },
    { label: "Lateral Izq.", url: normalizeVideoUrl(analysis?.videoLeftUrl) },
    { label: "Lateral Der.", url: normalizeVideoUrl(analysis?.videoRightUrl) },
    { label: "Principal", url: normalizeVideoUrl(analysis?.videoUrl) },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url));

  const totalFrames = Math.max(1, Math.round(duration * fps));

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>BIOMECH PRO · Resultado biomecánico</CardTitle>
          <CardDescription>
            Este análisis está separado del flujo clásico. ID: {analysisId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge className="bg-emerald-100 text-emerald-800">Biomech Pro</Badge>
          <Badge variant="outline">Análisis #{analysisId}</Badge>
          <Button asChild variant="outline">
            <Link href="/biomech-pro">Volver a BIOMECH PRO</Link>
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado del análisis</CardTitle>
            <CardDescription>
              Mostramos los videos y el estado mientras integramos el reporte biomecánico completo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando análisis…</div>
            ) : error ? (
              <div className="text-sm text-red-700">{error}</div>
            ) : analysis ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant="secondary">
                    {playerName || analysis.playerName || (analysis.playerId ? "Cargando jugador..." : "Jugador")}
                  </Badge>
                  <Badge variant="outline">
                    {analysis.playerId ? `ID jugador: ${analysis.playerId}` : "ID jugador no disponible"}
                  </Badge>
                  <Badge variant="secondary">{analysis.shotType || "Tiro"}</Badge>
                  <Badge variant="outline">{analysis.status || "pendiente"}</Badge>
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString() : "Fecha"}
                  </span>
                </div>
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Videos detectados</div>
                  <div className="mt-2 grid gap-1">
                    <div>Trasera: {analysis.videoBackUrl ? "OK" : "No disponible"}</div>
                    <div>Frontal: {analysis.videoFrontUrl ? "OK" : "No disponible"}</div>
                    <div>Lateral Izq.: {analysis.videoLeftUrl ? "OK" : "No disponible"}</div>
                    <div>Lateral Der.: {analysis.videoRightUrl ? "OK" : "No disponible"}</div>
                    <div>Principal: {analysis.videoUrl ? "OK" : "No disponible"}</div>
                  </div>
                </div>
                {videos.length > 0 ? (
                  <BiomechVideoPanel
                    sources={videos}
                    poseFrames={poseFrames ?? undefined}
                    requirePose
                    onReady={(videoDuration, detectedFps) => {
                      setDuration(videoDuration);
                      setFps(detectedFps);
                    }}
                    onTimeChange={(seconds, videoDuration, detectedFps) => {
                      setDuration(videoDuration);
                      setFps(detectedFps);
                      setCurrentFrame(Math.floor(seconds * detectedFps));
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Video className="h-4 w-4" />
                    No hay videos asociados todavía.
                  </div>
                )}
                {poseError && (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    {poseError}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Análisis no encontrado.</div>
            )}
          </CardContent>
        </Card>
      </section>

      {videos.length > 0 && (
        <section className="grid gap-6">
          <TimelinePhases
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onFrameChange={(frame) => setCurrentFrame(frame)}
          />
        </section>
      )}
    </div>
  );
}
