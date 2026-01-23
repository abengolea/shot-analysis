"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Upload, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type ShotType = "spot" | "free" | "movement";
type ShootingHand = "right" | "left";

type VideoMeta = {
  name: string;
  sizeMb: number;
  duration: number;
  width: number;
  height: number;
  fps: number | null;
};

type ValidationResult = {
  ok: boolean;
  error?: string;
  meta?: VideoMeta;
};

const requirements = {
  duration: { min: 2, max: 10 },
  size: { max: 50 },
  fps: { min: 30 },
  formats: ["video/mp4", "video/quicktime", "video/webm"],
};

const shotTypeLabels: Record<ShotType, string> = {
  spot: "Spot",
  free: "Tiro libre",
  movement: "En movimiento",
};

const orientationByShot: Record<ShotType, "landscape" | "portrait" | "any"> = {
  spot: "any",
  free: "any",
  movement: "any",
};

function formatNumber(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

async function estimateFps(video: HTMLVideoElement, framesToSample = 8) {
  if (!("requestVideoFrameCallback" in HTMLVideoElement.prototype)) {
    return null;
  }

  const fps = await new Promise<number | null>((resolve) => {
    let frameCount = 0;
    let startMediaTime: number | null = null;

    const onFrame: VideoFrameRequestCallback = (_, metadata) => {
      if (startMediaTime == null) {
        startMediaTime = metadata.mediaTime;
      }
      frameCount += 1;
      if (frameCount >= framesToSample) {
        const elapsed = metadata.mediaTime - startMediaTime;
        if (elapsed > 0) {
          resolve((frameCount - 1) / elapsed);
        } else {
          resolve(null);
        }
        return;
      }
      video.requestVideoFrameCallback(onFrame);
    };

    video.requestVideoFrameCallback(onFrame);
  });

  return fps ? formatNumber(fps, 1) : null;
}

async function extractMetadata(file: File): Promise<VideoMeta> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);

  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = video.duration;

  let fps: number | null = null;
  try {
    await video.play();
    fps = await estimateFps(video);
  } catch {
    fps = null;
  } finally {
    video.pause();
    URL.revokeObjectURL(video.src);
  }

  return {
    name: file.name,
    sizeMb: formatNumber(file.size / (1024 * 1024), 2),
    duration: formatNumber(duration, 2),
    width,
    height,
    fps,
  };
}

function validateMetadata(meta: VideoMeta, shotType: ShotType): ValidationResult {
  if (meta.sizeMb > requirements.size.max) {
    return { ok: false, error: `El video supera ${requirements.size.max}MB.` };
  }
  if (meta.duration < requirements.duration.min || meta.duration > requirements.duration.max) {
    return { ok: false, error: "Duración inválida: debe estar entre 2 y 10 segundos." };
  }
  if (meta.fps != null && meta.fps < requirements.fps.min) {
    return { ok: false, error: "FPS insuficiente: mínimo 30 FPS." };
  }

  const orientation = meta.width >= meta.height ? "landscape" : "portrait";
  const expected = orientationByShot[shotType];
  if (expected !== "any" && orientation !== expected) {
    return {
      ok: false,
      error: `Orientación inválida. Este tipo de tiro requiere video ${
        expected === "landscape" ? "horizontal" : "vertical"
      }.`,
    };
  }

  return { ok: true, meta };
}

export function VideoUploaderPro() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [shootingHand, setShootingHand] = useState<ShootingHand>("right");
  const [shotType, setShotType] = useState<ShotType>("spot");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "validating" | "ready" | "uploading" | "done">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);

  const checklist = useMemo(
    () => [
      "Cámara fija y estable",
      "Cuerpo completo visible",
      "Perfil lateral (ideal)",
      "Iluminación clara",
      "Duración 2-10 segundos",
      "Mínimo 30 FPS",
    ],
    []
  );

  const resetState = () => {
    setProgress(0);
    setStatus("idle");
    setError(null);
    setMeta(null);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    resetState();

    const file = files[0];
    if (!requirements.formats.includes(file.type)) {
      setStatus("ready");
      setError("Formato no soportado. Usá MP4, MOV o WebM.");
      return;
    }

    setStatus("validating");
    try {
      const metadata = await extractMetadata(file);
      const validation = validateMetadata(metadata, shotType);
      if (!validation.ok) {
        setStatus("ready");
        setError(validation.error || "No cumple requisitos.");
        setMeta(metadata);
        return;
      }
      setMeta(metadata);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setStatus("ready");
      setError("No se pudo leer el video. Probá con otro archivo.");
    }
  };

  const startUpload = () => {
    setStatus("uploading");
    setProgress(5);
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          window.clearInterval(interval);
          setStatus("done");
          return 100;
        }
        return Math.min(100, prev + 12);
      });
    }, 240);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Video Uploader Pro
        </CardTitle>
        <CardDescription>
          Cargá un video corto para iniciar el análisis biomecánico de BIOMECH PRO.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
              dragActive ? "border-primary bg-primary/5" : "border-muted"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={requirements.formats.join(",")}
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Video className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">
              Arrastrá tu video o hacé click para seleccionar
            </p>
            <p className="text-xs text-muted-foreground">
              Formatos: MP4, MOV, WebM · Máx 50MB
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Seleccionar video
            </Button>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Checklist de requisitos</div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                {checklist.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Mano de tiro</div>
              <RadioGroup
                className="mt-3 grid gap-2"
                value={shootingHand}
                onValueChange={(value) => setShootingHand(value as ShootingHand)}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="right" id="hand-right" />
                  <Label htmlFor="hand-right">Derecha</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="left" id="hand-left" />
                  <Label htmlFor="hand-left">Izquierda</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Tipo de tiro</div>
              <RadioGroup
                className="mt-3 grid gap-2"
                value={shotType}
                onValueChange={(value) => setShotType(value as ShotType)}
              >
                {Object.entries(shotTypeLabels).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem value={value} id={`shot-${value}`} />
                    <Label htmlFor={`shot-${value}`}>{label}</Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="mt-2 text-xs text-muted-foreground">
                Orientación esperada:{" "}
                <span className="font-medium text-foreground">
                  {orientationByShot[shotType] === "any"
                    ? "Horizontal o vertical"
                    : orientationByShot[shotType] === "landscape"
                      ? "Horizontal"
                      : "Vertical"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {meta && (
          <div className="rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{meta.name}</Badge>
              <Badge variant="outline">{meta.sizeMb} MB</Badge>
              <Badge variant="outline">{meta.duration}s</Badge>
              <Badge variant="outline">
                {meta.width}x{meta.height}
              </Badge>
              <Badge variant="outline">{meta.fps ? `${meta.fps} FPS` : "FPS N/D"}</Badge>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={startUpload}
            disabled={status !== "ready" || Boolean(error)}
          >
            Iniciar upload
          </Button>
          <span className="text-xs text-muted-foreground">
            Metadata: mano {shootingHand === "right" ? "derecha" : "izquierda"} · tipo{" "}
            {shotTypeLabels[shotType].toLowerCase()}
          </span>
        </div>

        {status === "uploading" || status === "done" ? (
          <div className="space-y-2">
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground">
              {status === "done" ? "Upload completo." : `Subiendo... ${progress}%`}
            </div>
          </div>
        ) : null}

        {status === "done" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="font-medium">Siguiente paso</div>
            <div className="mt-1 text-emerald-700">
              Este uploader es una demo. Para procesar el análisis real, usá el flujo BIOMECH PRO:
            </div>
            <div className="mt-3">
              <Button asChild>
                <a href="/upload?mode=biomech-pro">Ir al análisis BIOMECH PRO</a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
