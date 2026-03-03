"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SkeletonOverlay, type Keypoint } from "@/components/biomech/skeleton-overlay";
import { analyzeEnergyTransfer } from "@/lib/energy-transfer";

type VideoSource = {
  label: string;
  url: string;
};

type PoseKeypoint = {
  name: string;
  x: number;
  y: number;
  score?: number;
};

type PoseFrame = {
  tMs: number;
  keypoints: PoseKeypoint[];
};

type BiomechVideoPanelProps = {
  sources: VideoSource[];
  poseFrames?: PoseFrame[];
  requirePose?: boolean;
  onTimeChange?: (seconds: number, duration: number, fps: number) => void;
  onReady?: (duration: number, fps: number) => void;
};

const fallbackFps = 30;
const bodyKeypointNames = new Set([
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
]);
const defaultPlaybackRate = 0.5;

const baseKeypoints: Record<string, { x: number; y: number }> = {
  left_shoulder: { x: 0.42, y: 0.28 },
  right_shoulder: { x: 0.58, y: 0.28 },
  left_elbow: { x: 0.36, y: 0.4 },
  right_elbow: { x: 0.64, y: 0.4 },
  left_wrist: { x: 0.32, y: 0.52 },
  right_wrist: { x: 0.68, y: 0.52 },
  left_hip: { x: 0.45, y: 0.52 },
  right_hip: { x: 0.55, y: 0.52 },
  left_knee: { x: 0.44, y: 0.72 },
  right_knee: { x: 0.56, y: 0.72 },
  left_ankle: { x: 0.43, y: 0.9 },
  right_ankle: { x: 0.57, y: 0.9 },
};

function buildKeypoints(frame: number, offset = 0): Keypoint[] {
  const wobble = Math.sin(frame / 8) * 0.02;
  const lift = Math.cos(frame / 10) * 0.03;
  return Object.entries(baseKeypoints).map(([name, point]) => ({
    name,
    x: point.x + wobble + offset,
    y: point.y - lift,
    visibility: 0.85,
  }));
}

export function BiomechVideoPanel({
  sources,
  poseFrames,
  requirePose = false,
  onTimeChange,
  onReady,
}: BiomechVideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(defaultPlaybackRate);
  const lastPoseRef = useRef<Record<string, { x: number; y: number; v: number }> | null>(null);
  const comparisonLastPoseRef = useRef<Record<string, { x: number; y: number; v: number }> | null>(
    null
  );

  const currentSource = sources[activeIndex];
  const fps = fallbackFps;
  const currentFrame = Math.floor(currentTime * fps);

  const energyAnalysis = useMemo(() => {
    if (!poseFrames || poseFrames.length === 0) return null;
    return analyzeEnergyTransfer(poseFrames);
  }, [poseFrames]);

  const poseKeypoints = useMemo(() => {
    if (!poseFrames || poseFrames.length === 0) return null;
    const targetMs = Math.round(currentTime * 1000);
    let best = poseFrames[0];
    let bestDelta = Math.abs(best.tMs - targetMs);
    for (const frame of poseFrames) {
      const delta = Math.abs(frame.tMs - targetMs);
      if (delta < bestDelta) {
        best = frame;
        bestDelta = delta;
      }
    }
    const filtered = best.keypoints.filter((kp) => bodyKeypointNames.has(kp.name));
    const smoothing = 0.65;
    const prev = lastPoseRef.current ?? {};
    const next: Record<string, { x: number; y: number; v: number }> = {};
    const smoothed = filtered.map((kp) => {
      const prevPoint = prev[kp.name];
      const x = prevPoint ? prevPoint.x * smoothing + kp.x * (1 - smoothing) : kp.x;
      const y = prevPoint ? prevPoint.y * smoothing + kp.y * (1 - smoothing) : kp.y;
      const v = typeof kp.score === "number" ? kp.score : 1;
      next[kp.name] = { x, y, v };
      return {
        name: kp.name,
        x,
        y,
        visibility: v,
      };
    });
    lastPoseRef.current = next;
    return smoothed;
  }, [poseFrames, currentTime]);

  const comparisonPoseKeypoints = useMemo(() => {
    if (!poseFrames || poseFrames.length === 0) return null;
    if (!showComparison) return null;

    const targetReleaseMs = 600;
    const releaseOffsetMs =
      typeof energyAnalysis?.releaseVsLegsMs === "number"
        ? energyAnalysis.releaseVsLegsMs - targetReleaseMs
        : 0;
    const comparisonTime = Math.max(0, currentTime - releaseOffsetMs / 1000);
    const targetMs = Math.round(comparisonTime * 1000);

    let best = poseFrames[0];
    let bestDelta = Math.abs(best.tMs - targetMs);
    for (const frame of poseFrames) {
      const delta = Math.abs(frame.tMs - targetMs);
      if (delta < bestDelta) {
        best = frame;
        bestDelta = delta;
      }
    }

    const filtered = best.keypoints.filter((kp) => bodyKeypointNames.has(kp.name));
    const smoothing = 0.6;
    const prev = comparisonLastPoseRef.current ?? {};
    const next: Record<string, { x: number; y: number; v: number }> = {};
    const smoothed = filtered.map((kp) => {
      const prevPoint = prev[kp.name];
      const x = prevPoint ? prevPoint.x * smoothing + kp.x * (1 - smoothing) : kp.x;
      const y = prevPoint ? prevPoint.y * smoothing + kp.y * (1 - smoothing) : kp.y;
      const v = typeof kp.score === "number" ? kp.score : 1;
      next[kp.name] = { x, y, v };
      return {
        name: kp.name,
        x,
        y,
        visibility: v,
      };
    });
    comparisonLastPoseRef.current = next;
    return smoothed;
  }, [poseFrames, currentTime, showComparison, energyAnalysis]);

  const hasPose = Boolean(poseKeypoints && poseKeypoints.length > 0);
  const keypoints = useMemo(() => {
    if (poseKeypoints) return poseKeypoints;
    if (requirePose) return [];
    return buildKeypoints(currentFrame);
  }, [poseKeypoints, requirePose, currentFrame]);
  const comparison = useMemo(() => {
    if (comparisonPoseKeypoints) return comparisonPoseKeypoints;
    if (poseKeypoints || requirePose) return null;
    return buildKeypoints(currentFrame, 0.03);
  }, [comparisonPoseKeypoints, poseKeypoints, requirePose, currentFrame]);

  const handleLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
    setDuration(video.duration || 0);
    setVideoSize({ width: video.videoWidth || 1280, height: video.videoHeight || 720 });
    setVideoError(null);
    setVideoLoaded(true);
    onReady?.(video.duration || 0, fps);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime || 0;
    setCurrentTime(time);
    onTimeChange?.(time, video.duration || 0, fps);
  };

  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime || 0;
    setCurrentTime(time);
    onTimeChange?.(time, video.duration || 0, fps);
  };

  const handleError = () => {
    const mediaError = videoRef.current?.error;
    const detail = mediaError
      ? {
          1: "La carga fue abortada.",
          2: "Error de red mientras se descargaba.",
          3: "Error de decodificación del video.",
          4: "Formato o URL no soportado.",
        }[mediaError.code]
      : null;
    setVideoError(
      `No se pudo cargar el video.${detail ? ` ${detail}` : ""} Abrilo en una pestaña nueva para validar el link.`
    );
    setVideoLoaded(false);
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const reset = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setCurrentTime(0);
  };

  const scrubTo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const applyPlaybackRate = (rate: number) => {
    const video = videoRef.current;
    setPlaybackRate(rate);
    if (video) {
      video.playbackRate = rate;
    }
  };

  useEffect(() => {
    setVideoLoaded(false);
    setVideoError(null);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    lastPoseRef.current = null;
    comparisonLastPoseRef.current = null;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.load();
    }
  }, [currentSource?.url]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const time = video.currentTime || 0;
        setCurrentTime(time);
        onTimeChange?.(time, video.duration || 0, fps);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, onTimeChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video biomecánico conectado</CardTitle>
        <CardDescription>
          El overlay y el timeline se sincronizan con el video seleccionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {sources.map((source, idx) => (
            <Button
              key={source.label}
              variant={idx === activeIndex ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveIndex(idx)}
            >
              {source.label}
            </Button>
          ))}
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <div className="relative overflow-hidden rounded-lg border bg-black">
            <video
              key={currentSource?.url}
              ref={videoRef}
              className="block h-auto w-full"
              src={currentSource?.url}
              controls
              crossOrigin="anonymous"
              playsInline
              preload="metadata"
              onLoadedData={handleLoaded}
              onLoadedMetadata={handleLoaded}
              onTimeUpdate={handleTimeUpdate}
              onSeeked={handleSeeked}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={handleError}
            />
            {(!requirePose || hasPose) && (
              <div className="pointer-events-none absolute inset-0">
                <SkeletonOverlay
                  keypoints={keypoints}
                  comparisonKeypoints={comparison ?? undefined}
                  videoWidth={videoSize.width}
                  videoHeight={videoSize.height}
                  currentFrame={currentFrame}
                  showSkeleton={showSkeleton}
                  showEnergyFlow={showEnergy}
                  showComparison={showComparison}
                  showBackground={false}
                />
              </div>
            )}
          </div>
        </div>
        {requirePose && !hasPose && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Pose no disponible todavía. Falta que el servicio de pose analice el video y genere keypoints.
          </div>
        )}
        {videoError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {videoError}{" "}
            {currentSource?.url && (
              <a className="underline" href={currentSource.url} target="_blank" rel="noreferrer">
                Abrir video
              </a>
            )}
          </div>
        )}
        {!videoError && currentSource?.url && !videoLoaded && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Cargando video…{" "}
            <a className="underline" href={currentSource.url} target="_blank" rel="noreferrer">
              Abrir video
            </a>
          </div>
        )}
        {currentSource?.url && (
          <div className="text-xs text-muted-foreground">
            URL: <a className="underline" href={currentSource.url} target="_blank" rel="noreferrer">{currentSource.url}</a>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={togglePlay}>
            {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? "Pausar" : "Reproducir"}
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reiniciar
          </Button>
          <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <span>Velocidad</span>
            <Button
              size="sm"
              variant={playbackRate === 0.5 ? "default" : "outline"}
              onClick={() => applyPlaybackRate(0.5)}
            >
              0.5x
            </Button>
            <Button
              size="sm"
              variant={playbackRate === 1 ? "default" : "outline"}
              onClick={() => applyPlaybackRate(1)}
            >
              1x
            </Button>
          </div>
          <Badge variant="secondary">
            {Math.floor(currentTime * 10) / 10}s / {Math.floor(duration * 10) / 10}s
          </Badge>
          <Badge variant="outline">Frame #{currentFrame}</Badge>
        </div>

        <div className="space-y-2">
          <Label>Scrub de video</Label>
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={0.05}
            onValueChange={(value) => scrubTo(value[0] ?? 0)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Switch checked={showSkeleton} onCheckedChange={setShowSkeleton} id="toggle-skeleton" />
            <Label htmlFor="toggle-skeleton">Esqueleto</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showEnergy} onCheckedChange={setShowEnergy} id="toggle-energy" />
            <Label htmlFor="toggle-energy">Energía</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showComparison} onCheckedChange={setShowComparison} id="toggle-comparison" />
            <Label htmlFor="toggle-comparison">Comparación ideal</Label>
          </div>
          {!currentSource?.url && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Video className="h-4 w-4" />
              No hay video disponible.
            </div>
          )}
        </div>
        {showComparison && (
          <div className="text-xs text-muted-foreground">
            Comparación: fantasma alineado al timing ideal (liberación ~0.6s).
          </div>
        )}
      </CardContent>
    </Card>
  );
}
