"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Square, Circle } from "lucide-react";

const MIN_DURATION_SEC = 30;
const MAX_DURATION_SEC = 240;

interface CoachFeedbackVideoRecorderProps {
  onUpload: (file: File, knownDurationSec?: number) => Promise<void>;
  uploading: boolean;
  inputId?: string;
  compact?: boolean;
}

export function CoachFeedbackVideoRecorder({
  onUpload,
  uploading,
  inputId = "coach-feedback-video-input",
  compact = false,
}: CoachFeedbackVideoRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recorderState, setRecorderState] = useState<"idle" | "preview" | "recording">("idle");
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      stopTimer();
    };
  }, [stopStream, stopTimer]);

  const startRecording = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";
      const options: MediaRecorderOptions = { mimeType, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 };

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopStream();
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setRecordedBlob(blob);
          setRecorderState("preview");
        } else {
          setRecorderState("idle");
        }
      };

      recorder.start(1000);
      setRecording(true);
      setRecorderState("recording");
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo acceder a la cámara";
      setCameraError(msg);
      setRecorderState("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecordedDuration(recordingSeconds);
    }
    stopTimer();
    setRecording(false);
  };

  const cancelRecording = () => {
    setRecordedBlob(null);
    setRecordedDuration(0);
    setRecorderState("idle");
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = "";
    }
  };

  const confirmAndUpload = async () => {
    if (!recordedBlob || recordedDuration < MIN_DURATION_SEC || recordedDuration > MAX_DURATION_SEC) return;
    const ext = recordedBlob.type.includes("webm") ? "webm" : "mp4";
    const file = new File([recordedBlob], `feedback-${Date.now()}.${ext}`, { type: recordedBlob.type });
    await onUpload(file, recordedDuration);
    setRecordedBlob(null);
    setRecordedDuration(0);
    setRecorderState("idle");
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const durationValid = recordedDuration >= MIN_DURATION_SEC && recordedDuration <= MAX_DURATION_SEC;

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        id={inputId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />

      {recorderState === "idle" && (
        <div className={`flex flex-wrap gap-2 ${compact ? "" : "flex-col"}`}>
          <Button
            variant="outline"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Subir video (2-4 min)
              </>
            )}
          </Button>
          {canRecord && (
            <Button
              variant="default"
              onClick={startRecording}
              disabled={uploading}
              className="bg-red-600 hover:bg-red-700"
            >
              <Circle className="h-4 w-4 mr-2 fill-current" />
              Grabar desde cámara
            </Button>
          )}
        </div>
      )}

      {recorderState === "recording" && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border bg-black aspect-video max-w-lg">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-mono">
              {formatTime(recordingSeconds)}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant="destructive"
                size="lg"
                onClick={stopRecording}
                className="rounded-full w-14 h-14"
              >
                <Square className="h-6 w-6 fill-current" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Grabando... Detené cuando termines (mínimo 30 segundos, máximo 4 minutos).
          </p>
        </div>
      )}

      {recorderState === "preview" && recordedBlob && (
        <div className="space-y-3">
          <video
            src={URL.createObjectURL(recordedBlob)}
            controls
            className="w-full max-w-lg rounded-lg border bg-black aspect-video"
            playsInline
          />
          <p className="text-sm">
            Duración: {formatTime(recordedDuration)} —{" "}
            {durationValid ? (
              <span className="text-green-600">Duración correcta (30 s - 4 min)</span>
            ) : (
              <span className="text-destructive">
                Debe ser mínimo 30 segundos y máximo 4 minutos. Grabá de nuevo.
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={confirmAndUpload}
              disabled={!durationValid || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Usar este video
                </>
              )}
            </Button>
            <Button variant="outline" onClick={cancelRecording} disabled={uploading}>
              Descartar y grabar de nuevo
            </Button>
          </div>
        </div>
      )}

      {cameraError && (
        <p className="text-sm text-destructive">{cameraError}</p>
      )}

      {!compact && (
        <p className="text-xs text-muted-foreground">
          Subí un archivo o grabá directo desde la cámara del celular. Duración: mínimo 30 segundos, máximo 4 minutos.
        </p>
      )}
    </div>
  );
}
