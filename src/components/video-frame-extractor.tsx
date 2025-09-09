"use client";

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Video, Play, Pause, Camera, Circle, Square } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface VideoFrame {
  dataUrl: string;
  timestamp: number;
  description: string;
}

interface VideoFrameExtractorProps {
  onFramesExtracted: (frames: VideoFrame[]) => void;
  onVideoSelected: (file: File) => void;
  onRangeConfirmed?: (startSec: number, endSec: number) => void;
}

export function VideoFrameExtractor({ onFramesExtracted, onVideoSelected, onRangeConfirmed }: VideoFrameExtractorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState<VideoFrame[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'record'>('upload');
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const lastProcessedSrcRef = useRef<string | null>(null);
  const [detectedStart, setDetectedStart] = useState(0);
  const [manualStart, setManualStart] = useState<number | null>(null);
  const [detectedEnd, setDetectedEnd] = useState(0);
  const [manualEnd, setManualEnd] = useState<number | null>(null);
  const [showManualEdit, setShowManualEdit] = useState(false);

  // Recording state
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const MAX_RECORDING_MS = 30000;

  // Cleanup object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      // Stop camera if active
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      // Clear timers
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [videoSrc]);

  // Stop camera when leaving record tab
  useEffect(() => {
    if (mode !== 'record') {
      if (isRecording) {
        // Ensure recording stops
        if (mediaRecorderRef.current) {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
        setIsRecording(false);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingElapsedMs(0);
      recordingStartRef.current = null;
    }
  }, [mode]);

  const handleVideoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      console.log("🎬 Video seleccionado:", file.name, file.size);
      setVideoFile(file);
      onVideoSelected(file);
      setError(null);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      // Validación de duración y orientación al cargar metadatos
      setTimeout(() => {
        const el = document.createElement('video');
        el.src = url;
        el.addEventListener('loadedmetadata', () => {
          const dur = el.duration;
          const w = el.videoWidth;
          const h = el.videoHeight;
          if (dur && dur > 30.5) {
            setError('El video supera 30s. Se recortará automáticamente al analizar.');
          }
          if (w && h && h > w) {
            setError(prev => (prev ? prev + ' Además, rota a paisaje si es posible.' : 'Recomendación: grabar en modo paisaje.'));
          }
        }, { once: true });
      }, 0);
    }
  }, [onVideoSelected]);

  const extractKeyFrames = useCallback(async () => {
    console.log("🎬 Iniciando extracción de frames...");
    if (!videoRef.current || !canvasRef.current) {
      setError("Video o canvas no disponible");
      return;
    }
    setIsExtracting(true);
    setError(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError("No se pudo inicializar el canvas");
      setIsExtracting(false);
      return;
    }
    if (!video.duration || isNaN(video.duration) || video.duration <= 0) {
      setError("El video aún se está cargando. Reproduce 1-2s y vuelve a intentar.");
      setIsExtracting(false);
      return;
    }
    try {
      const frames: VideoFrame[] = [];
      const totalFrames = 16;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 1) Detectar inicio de movimiento (heurística de diferencia de fotogramas) ~ "toma de balón"
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.max(96, Math.floor(video.videoWidth / 10));
      tempCanvas.height = Math.max(54, Math.floor(video.videoHeight / 10));
      const tctx = tempCanvas.getContext('2d');
      let startTime = 0;
      if (tctx) {
        // Buscar el inicio temprano del gesto (primeros ~2s o 40% del video)
        const scanEnd = Math.min(video.duration * 0.4, 2.0);
        const scanStep = Math.max(0.02, Math.min(0.08, video.duration / 150));
        let previousImage: ImageData | null = null;
        // ROI a nivel cintura-pecho: franja central media para detectar subida inicial del balón
        const roi = {
          x: Math.floor(tempCanvas.width * 0.30),
          y: Math.floor(tempCanvas.height * 0.35),
          w: Math.floor(tempCanvas.width * 0.40),
          h: Math.floor(tempCanvas.height * 0.35),
        };
        const getDiffScore = (img: ImageData, prev: ImageData) => {
          let sum = 0;
          let count = 0;
          for (let yy = roi.y; yy < roi.y + roi.h; yy++) {
            for (let xx = roi.x; xx < roi.x + roi.w; xx++) {
              const idx = (yy * img.width + xx) * 4;
              const ya = 0.299 * img.data[idx] + 0.587 * img.data[idx + 1] + 0.114 * img.data[idx + 2];
              const yb = 0.299 * prev.data[idx] + 0.587 * prev.data[idx + 1] + 0.114 * prev.data[idx + 2];
              sum += Math.abs(ya - yb);
              count++;
            }
          }
          return count > 0 ? sum / count : 0;
        };

        let baselineSum = 0;
        let baselineCount = 0;
        let detected = false;
        let prevDiff = 0;
        for (let t = 0; t <= scanEnd; t += scanStep) {
          video.pause();
          video.currentTime = Math.min(Math.max(0, t), video.duration - 0.001);
          await new Promise<void>((resolve) => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
            video.addEventListener('seeked', onSeeked);
          });
          tctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
          const img = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          if (previousImage) {
            const diff = getDiffScore(img, previousImage);
            // construir baseline en los primeros samples
            if (baselineCount < 8 || t < 0.3) {
              baselineSum += diff;
              baselineCount++;
            }
            const baseline = baselineCount > 0 ? baselineSum / baselineCount : 0;
            // activación: superar baseline y aumento pronunciado (derivada positiva)
            const threshold = Math.max(4, baseline + 2.5);
            const derivativeTrigger = prevDiff > 0 ? diff > prevDiff * 1.6 : false;
            if ((diff > threshold && derivativeTrigger) && !detected) {
              // comprobar persistencia del cambio
              let sustained = 0;
              for (let k = 1; k <= 3; k++) {
                const t2 = Math.min(t + k * scanStep, scanEnd);
                video.currentTime = Math.min(Math.max(0, t2), video.duration - 0.001);
                await new Promise<void>((resolve) => {
                  const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
                  video.addEventListener('seeked', onSeeked);
                });
                tctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
                const img2 = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const diff2 = getDiffScore(img2, img);
                if (diff2 > threshold) sustained++;
              }
              if (sustained >= 2) {
                // Retroceder más para capturar el instante previo
                startTime = Math.max(0, t - Math.max(0.25, 2 * scanStep));
                detected = true;
                break;
              }
            }
            prevDiff = diff;
          }
          previousImage = img;
        }
      }

      // 2) Determinar FIN del segmento (mid-flight) con IA y fallback heurístico
      // Respetar detecciones previas de IA
      if (manualStart == null && detectedStart > 0) {
        startTime = detectedStart;
      }
      setDetectedStart(startTime);
      const anchor = manualStart != null
        ? Math.max(0, Math.min(manualStart, video.duration - 0.001))
        : (detectedStart > 0 ? Math.max(0, Math.min(detectedStart, video.duration - 0.001)) : startTime);
      const remaining = Math.max(0.2, video.duration - anchor);
      const fallbackEnd = Math.min(video.duration - 0.001, anchor + Math.max(0.5 * remaining, Math.min(1.2, remaining)));
      let endTime = fallbackEnd;

      const buildSamplesBetween = async (from: number, to: number, steps: number) => {
        const samples: Array<{ index: number; timestamp: number; url: string }> = [];
        const prevW = canvas.width, prevH = canvas.height;
        const width = Math.max(160, Math.floor(video.videoWidth / 4));
        const height = Math.max(160, Math.floor((video.videoHeight / video.videoWidth) * width));
        canvas.width = width;
        canvas.height = height;
        const step = (to - from) / (steps + 1);
        for (let i = 1; i <= steps; i++) {
          const t = Math.min(from + step * i, video.duration - 0.001);
          video.pause();
          video.currentTime = t;
          await new Promise<void>((resolve) => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
            video.addEventListener('seeked', onSeeked);
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const url = canvas.toDataURL('image/jpeg', 0.7);
          samples.push({ index: i - 1, timestamp: t, url });
        }
        canvas.width = prevW; canvas.height = prevH;
        return samples;
      };

      if (manualEnd != null) {
        endTime = Math.max(anchor + 0.05, Math.min(manualEnd, video.duration - 0.001));
        setDetectedEnd(endTime);
      } else {
        // Si ya tenemos un fin detectado previamente, úsalo
        if (detectedEnd > anchor + 0.05) {
          endTime = Math.min(Math.max(detectedEnd, anchor + 0.05), video.duration - 0.001);
        } else try {
          const scanHorizon = Math.min(anchor + Math.min(3.0, remaining * 0.7), video.duration - 0.001);
          const endSamples = await buildSamplesBetween(anchor, scanHorizon, 8);
          if (endSamples.length >= 3) {
            const res = await fetch('/api/detect-end', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ frames: endSamples.map(s => ({ ...s, dataUrl: s.url })), shotType: undefined })
            });
            if (res.ok) {
              const data = await res.json();
              if (typeof data.endTimestamp === 'number' && data.endTimestamp > anchor + 0.05) {
                endTime = Math.min(Math.max(data.endTimestamp, anchor + 0.05), video.duration - 0.001);
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ No se pudo usar IA para detectar fin, usando heurística.', e);
        }
        setDetectedEnd(endTime);
      }

      // 3) Extraer frames uniformes SOLO dentro del lapso detectado/confirmado
      const endForFrames = Math.min(video.duration - 0.001, endTime);
      const clampedStart = Math.max(0, Math.min(anchor, endForFrames - 0.05));
      const segment = Math.max(0.2, endForFrames - clampedStart);
      const interval = segment / (totalFrames + 1);
      for (let i = 1; i <= totalFrames; i++) {
        const time = Math.min(clampedStart + interval * i, endForFrames);
        video.pause();
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const description = i === 1 ? 'Toma de balón (estimada)' : `Frame ${i}`;
        frames.push({ dataUrl, timestamp: time, description });
      }
      // Asegurar orden cronológico
      frames.sort((a, b) => a.timestamp - b.timestamp);

      // 4) Deduplicación: evitar frames demasiado cercanos o visualmente idénticos
      const minGapSec = Math.max(0.06, segment / (totalFrames * 2));
      const off = document.createElement('canvas');
      off.width = 64; off.height = 64;
      const octx = off.getContext('2d');
      const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      const diffRatio = (a: ImageData, b: ImageData) => {
        let sum = 0; const len = a.data.length;
        for (let i = 0; i < len; i += 4) {
          const ya = 0.299 * a.data[i] + 0.587 * a.data[i + 1] + 0.114 * a.data[i + 2];
          const yb = 0.299 * b.data[i] + 0.587 * b.data[i + 1] + 0.114 * b.data[i + 2];
          sum += Math.abs(ya - yb);
        }
        return sum / (len / 4); // 0..255
      };
      const filtered: VideoFrame[] = [];
      let prevID: ImageData | null = null;
      for (const f of frames) {
        if (filtered.length > 0) {
          const last = filtered[filtered.length - 1];
          if (f.timestamp - last.timestamp < minGapSec) continue;
        }
        try {
          if (octx) {
            const img = await loadImg(f.dataUrl);
            octx.clearRect(0, 0, off.width, off.height);
            octx.drawImage(img, 0, 0, off.width, off.height);
            const id = octx.getImageData(0, 0, off.width, off.height);
            if (prevID) {
              const d = diffRatio(id, prevID);
              if (d < 6) continue; // casi idéntico
            }
            prevID = id;
          }
        } catch {}
        filtered.push(f);
        if (filtered.length >= totalFrames) break;
      }
      const finalFrames = filtered.length > 0 ? filtered : frames;
      video.currentTime = 0;
      setIsPlaying(false);
      setExtractedFrames(finalFrames);
      onFramesExtracted(finalFrames);
    } catch (e) {
      console.error("❌ Error durante la extracción:", e);
      setError(`Error extrayendo frames: ${e instanceof Error ? e.message : 'desconocido'}`);
    } finally {
      setIsExtracting(false);
    }
  }, [onFramesExtracted]);

  const handleVideoLoad = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      setDuration(video.duration);
      console.log("✅ Video cargado:", {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState
      });
      setMetadataLoaded(true);
      // Auto extraer frames al cargar los metadatos
      const currentSrc = video.currentSrc || videoSrc || null;
      if (currentSrc && lastProcessedSrcRef.current !== currentSrc) {
        lastProcessedSrcRef.current = currentSrc;
        // Ejecutar asincrónicamente para no bloquear el hilo del evento
        setTimeout(async () => {
          // 1) Construir thumbs tempranos (hasta ~2s) y pedir a la IA el inicio
          try {
            const samples = await buildEarlySamplesForAI();
            if (samples.length >= 2) {
              const res = await fetch('/api/detect-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frames: samples.map(s => ({ ...s, dataUrl: s.url })), shotType: undefined })
              });
              if (res.ok) {
                const data = await res.json();
                if (typeof data.startTimestamp === 'number') {
                  setManualStart(data.startTimestamp);
                }
              }
            }
          } catch (e) {
            console.warn('⚠️ No se pudo usar IA para detectar inicio, usando heurística.', e);
          }
          // 2) No extraer aún; esperar botones claros del usuario
        }, 0);
      }
    }
  }, []);

  // Fallback: si por alguna razón no se disparó en loadedmetadata, intentar tras pequeños cambios de estado
  useEffect(() => {
    if (metadataLoaded && videoSrc && extractedFrames.length === 0 && !isExtracting) {
      const id = window.setTimeout(() => { void extractKeyFrames(); }, 200);
      return () => window.clearTimeout(id);
    }
  }, [metadataLoaded, videoSrc, extractedFrames.length, isExtracting, extractKeyFrames]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("❌ Error reproduciendo video:", err);
      setError("No se pudo reproducir el video. Haz clic en el video y vuelve a intentar.");
    }
  }, [isPlaying]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream as unknown as MediaStream;
        await liveVideoRef.current.play();
      }
      setError(null);
    } catch (e) {
      console.error('❌ No se pudo acceder a la cámara/micrófono:', e);
      setError('No se pudo acceder a la cámara/micrófono. Revisa los permisos del navegador.');
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!mediaStreamRef.current) {
      setError('Activa la cámara antes de grabar.');
      return;
    }
    recordedChunksRef.current = [];
    try {
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options.mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options.mimeType = 'video/webm';
      }
      const recorder = new MediaRecorder(mediaStreamRef.current, options);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };
      recorder.onstop = () => {
        // Clear timers
        if (recordingTimeoutRef.current) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
        if (recordingIntervalRef.current) {
          window.clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const file = new File([blob], `grabacion-${Date.now()}.webm`, { type: blob.type });
        setVideoFile(file);
        onVideoSelected(file);
        if (videoSrc) URL.revokeObjectURL(videoSrc);
        const url = URL.createObjectURL(blob);
        setVideoSrc(url);
        setIsPlaying(false);
        // Stop camera tracks after recording
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setRecordingElapsedMs(0);
        recordingStartRef.current = null;
      };
      recorder.start();
      setIsRecording(true);
      setError(null);
      // Timers for limit and elapsed
      recordingStartRef.current = Date.now();
      if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = window.setInterval(() => {
        if (recordingStartRef.current != null) {
          setRecordingElapsedMs(Date.now() - recordingStartRef.current);
        }
      }, 200);
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = window.setTimeout(() => {
        // Auto-stop at 20s
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
        setIsRecording(false);
      }, MAX_RECORDING_MS);
    } catch (e) {
      console.error('❌ Error al iniciar la grabación:', e);
      setError('No se pudo iniciar la grabación.');
    }
  }, [onVideoSelected, videoSrc]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [isRecording]);


  const clearFrames = useCallback(() => {
    setExtractedFrames([]);
    setError(null);
  }, []);

  // Construye muestras tempranas para la IA (pequeños thumbnails con URL temporal dataURL)
  const buildEarlySamplesForAI = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return [] as Array<{ index: number; timestamp: number; url: string }>;
    const ctx = canvas.getContext('2d');
    if (!ctx || !video.duration) return [] as Array<{ index: number; timestamp: number; url: string }>;
    const samples: Array<{ index: number; timestamp: number; url: string }> = [];
    const end = Math.min(2, video.duration * 0.4);
    const steps = 6;
    const step = end / (steps + 1);
    const width = Math.max(160, Math.floor(video.videoWidth / 4));
    const height = Math.max(160, Math.floor((video.videoHeight / video.videoWidth) * width));
    const prevW = canvas.width, prevH = canvas.height;
    canvas.width = width;
    canvas.height = height;
    for (let i = 1; i <= steps; i++) {
      const t = Math.min(step * i, video.duration - 0.001);
      video.pause();
      video.currentTime = t;
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', 0.7);
      samples.push({ index: i - 1, timestamp: t, url });
    }
    // restore canvas
    canvas.width = prevW;
    canvas.height = prevH;
    return samples;
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Video Frontal (obligatorio)
        </CardTitle>
        <CardDescription>
          Este paso es para el video de frente. Luego podrás subir los otros tres ángulos opcionales (Lateral Izquierdo, Lateral Derecho y Trasera) en la sección de "Configuración del Análisis".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'upload' | 'record')}>
          <TabsList>
            <TabsTrigger value="upload">Subir frontal</TabsTrigger>
            <TabsTrigger value="record">Grabar frontal</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-2">
            <Button onClick={() => fileInputRef.current?.click()} className="w-full">
              Subir video frontal desde archivos
            </Button>
            <input
              ref={fileInputRef}
              id="video-input"
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="hidden"
            />
          </TabsContent>

          <TabsContent value="record" className="space-y-3">
            <div className="space-y-2">
              <Label>Cámara</Label>
              <div className="relative">
                <video
                  ref={liveVideoRef}
                  className="w-full rounded-lg border bg-black"
                  muted
                  playsInline
                  autoPlay
                  style={{ maxHeight: 360 }}
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-black/50 rounded-lg p-2">
                  {!mediaStreamRef.current && (
                    <Button size="sm" variant="secondary" onClick={startCamera}>
                      Activar Cámara
                    </Button>
                  )}
                  {mediaStreamRef.current && !isRecording && (
                    <Button size="sm" variant="destructive" onClick={startRecording} className="h-8 px-2">
                      <Circle className="h-4 w-4 mr-1" /> Grabar
                    </Button>
                  )}
                  {isRecording && (
                    <Button size="sm" variant="secondary" onClick={stopRecording} className="h-8 px-2">
                      <Square className="h-4 w-4 mr-1" /> Detener
                    </Button>
                  )}
                  {isRecording && (
                    <span className="ml-auto text-xs text-white/90">
                      {`${new Date(recordingElapsedMs).toISOString().slice(14,19)} / 00:20`}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Nota: La grabación requiere permisos de cámara/micrófono y funciona mejor en HTTPS o localhost.</p>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Canvas oculto - siempre presente */}
        <canvas ref={canvasRef} className="hidden" style={{ display: 'none' }} />

        {videoFile && (
          <div className="space-y-2">
            <Label>Vista Previa del Video</Label>
            <div className="relative">
              <video
                ref={videoRef}
                src={videoSrc ?? undefined}
                className="w-full rounded-lg border"
                onLoadedMetadata={handleVideoLoad}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setError('No se pudo cargar el video seleccionado')}
                controls
                preload="auto"
                muted
                playsInline
                style={{ maxHeight: 480 }}
              />
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-black/50 rounded-lg p-2">
                <Button size="sm" variant="secondary" onClick={togglePlayPause} className="h-8 w-8 p-0">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                {isExtracting && (
                  <span className="text-xs text-white/90 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Extrayendo frames...
                  </span>
                )}
              </div>
            </div>

            {/* Controles claros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Button size="sm" onClick={async () => {
                try {
                  const samples = await buildEarlySamplesForAI();
                  if (samples.length >= 2) {
                    const res = await fetch('/api/detect-start', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ frames: samples.map(s => ({ ...s, dataUrl: s.url })) })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (typeof data.startTimestamp === 'number') setManualStart(data.startTimestamp);
                    }
                  }
                } catch (e) { console.warn('No se pudo detectar inicio (IA)', e); }
              }}>Detectar inicio (IA)</Button>

              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  if (!videoRef.current || !canvasRef.current) return;
                  const video = videoRef.current;
                  const from = manualStart != null ? manualStart : detectedStart;
                  const to = Math.min(duration, from + 2.0);
                  // construir 8 muestras entre from y to
                  const samples: Array<{ index:number; timestamp:number; url:string }> = [];
                  const prevW = canvasRef.current.width, prevH = canvasRef.current.height;
                  const width = Math.max(160, Math.floor(video.videoWidth / 4));
                  const height = Math.max(160, Math.floor((video.videoHeight / video.videoWidth) * width));
                  const ctx = canvasRef.current.getContext('2d');
                  if (!ctx) return;
                  canvasRef.current.width = width; canvasRef.current.height = height;
                  const step = (to - from) / 9;
                  for (let i = 1; i <= 8; i++) {
                    const t = Math.min(from + step * i, duration - 0.001);
                    video.pause(); video.currentTime = t;
                    await new Promise<void>((r) => { const onS=()=>{video.removeEventListener('seeked', onS); r();}; video.addEventListener('seeked', onS); });
                    ctx.drawImage(video, 0, 0, width, height);
                    samples.push({ index: i-1, timestamp: t, url: canvasRef.current.toDataURL('image/jpeg', 0.7) });
                  }
                  canvasRef.current.width = prevW; canvasRef.current.height = prevH;
                  const res = await fetch('/api/detect-end', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ frames: samples.map(s=>({ ...s, dataUrl: s.url })) })});
                  if (res.ok) {
                    const data = await res.json();
                    if (typeof data.endTimestamp === 'number') setDetectedEnd(data.endTimestamp);
                  }
                } catch (e) { console.warn('No se pudo detectar fin (IA)', e); }
              }}>Detectar fin (IA)</Button>

              <Button size="sm" variant="outline" onClick={extractKeyFrames}><Camera className="h-4 w-4 mr-1" /> Extraer frames</Button>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>Inicio: {(manualStart ?? detectedStart).toFixed(2)}s • Fin: {Math.max(detectedEnd, manualEnd ?? detectedEnd).toFixed(2)}s</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const s = manualStart ?? detectedStart;
                  const e = manualEnd ?? detectedEnd;
                  onRangeConfirmed?.(Math.max(0, s), Math.max(s + 0.05, e));
                }}>Confirmar rango</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowManualEdit(v=>!v)}>{showManualEdit ? 'Ocultar edición' : 'Editar tiempos'}</Button>
              </div>
            </div>

            {showManualEdit && (
              <div className="space-y-2 p-2 rounded border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Inicio manual: {manualStart != null ? manualStart.toFixed(2)+'s' : '(auto)'}</span>
                </div>
                <Slider value={[manualStart != null ? manualStart : detectedStart]} min={0} max={Math.max(0.01, duration - 0.01)} step={0.01} onValueChange={([v]) => setManualStart(v)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setManualStart(null)}>Usar auto</Button>
                  <Button size="sm" onClick={extractKeyFrames}>Aplicar</Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Fin manual: {manualEnd != null ? manualEnd.toFixed(2)+'s' : '(auto)'}</span>
                </div>
                <Slider value={[manualEnd != null ? manualEnd : Math.max(detectedEnd, detectedStart)]} min={0} max={Math.max(0.02, duration - 0.01)} step={0.01} onValueChange={([v]) => setManualEnd(v)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setManualEnd(null)}>Usar auto</Button>
                  <Button size="sm" onClick={extractKeyFrames}>Aplicar</Button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{currentTime.toFixed(1)}s</span>
                <span>{duration.toFixed(1)}s</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        )}

        {extractedFrames.length > 0 && (
          <div className="space-y-2">
            <Label>Frames extraídos ({extractedFrames.length})</Label>
            <div className="grid grid-cols-4 gap-2">
              {extractedFrames.map((frame, index) => (
                <div key={index} className="space-y-1">
                  <img src={frame.dataUrl} alt={`Frame ${index + 1}`} className="w-full h-20 object-cover rounded border" />
                  <div className="text-xs text-center text-muted-foreground">{frame.timestamp.toFixed(1)}s</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={clearFrames} variant="outline" size="sm">Limpiar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
