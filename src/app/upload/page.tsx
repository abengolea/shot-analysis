"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/app/actions";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref as storageRef, uploadBytesResumable, UploadTask } from "firebase/storage";
import { Switch } from "@/components/ui/switch";

interface VideoFrame {
  dataUrl: string;
  timestamp: number;
  description: string;
}

// ffmpeg.wasm singleton (cargado bajo demanda en cliente)
let _ffmpeg: any | null = null;
async function getFfmpegInstance() {
  if (_ffmpeg) return _ffmpeg;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
  });
  _ffmpeg = ffmpeg;
  return ffmpeg;
}

async function fileToUint8Array(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function SubmitButton({ analyzing }: { analyzing: boolean }) {
  const { pending } = useFormStatus();
  const isBusy = pending || analyzing;
  return (
    <Button type="submit" className="w-full" disabled={isBusy}>
      {isBusy ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analizando...
        </>
      ) : (
        "Iniciar Análisis"
      )}
    </Button>
  );
}

function PendingNotice() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="rounded-lg border bg-card p-6 text-center shadow-lg">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Analizando tu video… Esto puede tardar entre 30 segundos y 2 minutos.</p>
      </div>
    </div>
  );
}

type StartState = { message: string; error?: boolean; redirectTo?: string; analysisId?: string; videoUrl?: string; shotType?: string; status?: string; analysisResult?: any };

export default function UploadPage() {
  const [state, formAction] = useActionState<StartState, FormData>(startAnalysis as any, { message: "", error: false });
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false);
  const [confirmedPartial, setConfirmedPartial] = useState(false);
  const [noBalanceOpen, setNoBalanceOpen] = useState(false);
  const [analyzingOpen, setAnalyzingOpen] = useState(false);
  const analyzingTimerRef = useRef<number | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [dontShowTipsAgain, setDontShowTipsAgain] = useState(false);
  const [profileIncompleteOpen, setProfileIncompleteOpen] = useState(false);
  
  // Estados para los videos (sin frames)
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null); // frontal
  const [leftVideo, setLeftVideo] = useState<File | null>(null);
  const [rightVideo, setRightVideo] = useState<File | null>(null);
  const [backVideo, setBackVideo] = useState<File | null>(null);
  const [shotType, setShotType] = useState<string>("");
  const [wallet, setWallet] = useState<{ credits: number; freeLeft: number; freeUsed: number; lastFreeAnalysisDate?: string | null } | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [compressEnabled, setCompressEnabled] = useState(true);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<Record<string, number>>({});

  const isPlayerProfileComplete = (p: any | null | undefined): boolean => {
    if (!p) return false;
    const hasName = typeof p.name === 'string' && p.name.trim().length > 1;
    const hasDob = Boolean(p.dob);
    const hasCountry = typeof p.country === 'string' && p.country.trim().length > 0;
    const hasAgeGroup = typeof p.ageGroup === 'string' && p.ageGroup.trim().length > 0;
    const hasPlayerLevel = typeof p.playerLevel === 'string' && p.playerLevel.trim().length > 0;
    const hasPosition = typeof p.position === 'string' && p.position.trim().length > 0;
    const heightOk = p.height !== undefined && p.height !== null && !Number.isNaN(Number(p.height)) && Number(p.height) > 0;
    const wingspanOk = p.wingspan !== undefined && p.wingspan !== null && !Number.isNaN(Number(p.wingspan)) && Number(p.wingspan) > 0;
    return hasName && hasDob && hasCountry && hasAgeGroup && hasPlayerLevel && hasPosition && heightOk && wingspanOk;
  };

  const handleSubmit = async (formData: FormData) => {
    // Chequeos de conectividad previos
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({ title: 'Sin conexión', description: 'Estás sin Internet. Conéctate a Wi‑Fi o datos y vuelve a intentar.', variant: 'destructive' });
      return;
    }
    try {
      const anyConn: any = (navigator as any).connection;
      if (anyConn && (anyConn.saveData || anyConn.effectiveType === 'slow-2g' || anyConn.effectiveType === '2g')) {
        toast({ title: 'Conexión lenta detectada', description: 'La subida puede demorar o fallar. Te recomendamos usar Wi‑Fi.', variant: 'default' });
      }
    } catch {}
    if (!isPlayerProfileComplete(userProfile)) {
      toast({
        title: 'Perfil incompleto',
        description: 'Te recomendamos completar nombre, fecha de nacimiento, país, grupo de edad, nivel, posición, altura y envergadura para mejorar el análisis. Igual vamos a continuar.',
        variant: 'default',
      });
    }
    if (!shotType) {
      toast({
        title: "Error",
        description: "Debes seleccionar el tipo de lanzamiento",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVideo && !backVideo) {
      toast({
        title: "Error",
        description: "Debes subir el video trasero o, si no lo tenés, el frontal.",
        variant: "destructive",
      });
      return;
    }

    // Asegurar tipo de lanzamiento en el FormData
    formData.set('shotType', shotType);

    // Parámetros de límites
    const PER_FILE_LIMIT = 90 * 1024 * 1024; // 90 MB por archivo
    const TOTAL_LIMIT = 250 * 1024 * 1024; // 250 MB total

    // Compresión en cliente (si está habilitada)
    async function compressIfNeeded(label: string, file: File): Promise<File> {
      try {
        // Heurística: si ya es pequeño, evitar recomprimir
        if (!compressEnabled || file.size < 20 * 1024 * 1024) return file;
        setCompressing(true);
        setCompressionProgress((p) => ({ ...p, [label]: 0 }));
        const ffmpeg = await getFfmpegInstance();
        const onProgress = ({ progress }: { progress: number }) => {
          setCompressionProgress((p) => ({
            ...p,
            [label]: Math.min(99, Math.round((progress || 0) * 100)),
          }));
        };
        try { ffmpeg.on('progress', onProgress); } catch {}
        const inName = `${label}_in.mp4`;
        const outName = `${label}_out.mp4`;
        await ffmpeg.writeFile(inName, await fileToUint8Array(file));
        try {
          await ffmpeg.exec([
            '-y',
            '-i', inName,
            '-vf', 'scale=-2:720,fps=24',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '28',
            '-c:a', 'aac',
            '-b:a', '96k',
            '-movflags', '+faststart',
            outName,
          ]);
        } catch (e) {
          console.warn('[ffmpeg] Falla al usar libx264; devolviendo original.', e);
          try { await ffmpeg.deleteFile(inName); } catch {}
          try { ffmpeg.off('progress', onProgress); } catch {}
          return file;
        }
        const data = await ffmpeg.readFile(outName) as Uint8Array;
        const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '') + '-compressed.mp4', { type: 'video/mp4' });
        try { await ffmpeg.deleteFile(inName); } catch {}
        try { await ffmpeg.deleteFile(outName); } catch {}
        try { ffmpeg.off('progress', onProgress); } catch {}
        setCompressionProgress((p) => ({ ...p, [label]: 100 }));
        return compressed.size > 0 ? compressed : file;
      } catch (e) {
        console.warn('[ffmpeg] Compresión falló; usando original.', e);
        return file;
      } finally {
        // estado visual se cierra más abajo
      }
    }

    // Preparar lista de cargas
    const uploads: Array<{ label: string; file: File | null; path: string }> = [
      { label: 'back', file: backVideo, path: `videos/${user!.uid}/back-${Date.now()}.mp4` },
      { label: 'front', file: selectedVideo, path: `videos/${user!.uid}/front-${Date.now()}.mp4` },
      { label: 'left', file: leftVideo, path: `videos/${user!.uid}/left-${Date.now()}.mp4` },
      { label: 'right', file: rightVideo, path: `videos/${user!.uid}/right-${Date.now()}.mp4` },
    ];

    // Ejecutar compresión secuencial por archivo (si corresponde)
    const fileByLabel: Record<string, File> = {};
    try {
      for (const u of uploads) {
        if (!u.file) continue;
        const f = await compressIfNeeded(u.label, u.file);
        fileByLabel[u.label] = f;
      }
    } finally {
      setCompressing(false);
    }

    // Validaciones post-compresión
    const presentLabels = Object.keys(fileByLabel);
    if (presentLabels.length === 0) {
      toast({ title: 'Error', description: 'No se encontró ningún video válido para subir.', variant: 'destructive' });
      return;
    }
    for (const lbl of presentLabels) {
      const f = fileByLabel[lbl];
      if (f.size > PER_FILE_LIMIT) {
        toast({ title: 'Archivo muy grande', description: `El video "${lbl}" supera 90 MB tras comprimir. Recórtalo o baja la calidad.`, variant: 'destructive' });
        return;
      }
    }
    const totalAfter = presentLabels.reduce((sum, k) => sum + fileByLabel[k].size, 0);
    if (totalAfter > TOTAL_LIMIT) {
      toast({ title: 'Tamaño total excedido', description: 'La suma de los videos supera 250 MB. Subí menos ángulos o recorta la duración.', variant: 'destructive' });
      return;
    }

    const urlByLabel: Record<string, string> = {};

    async function uploadWithRetry(label: string, file: File, path: string, maxRetries = 3): Promise<string> {
      let attempt = 0;
      let lastError: any = null;
      while (attempt <= maxRetries) {
        try {
          const url = await new Promise<string>((resolve, reject) => {
            const ref = storageRef(storage as any, path);
            const task: UploadTask = uploadBytesResumable(ref, file, { contentType: file.type || 'video/mp4' });

            let idleTimer: number | null = null;
            const startedAt = Date.now();
            let lastLoggedPct = -10;
            let lastBytes = 0;
            let lastTime = startedAt;
            const resetIdle = () => {
              if (idleTimer) window.clearTimeout(idleTimer);
              idleTimer = window.setTimeout(() => {
                task.cancel();
                reject(new Error('timeout'));
              }, 180_000); // 180s sin progreso
            };
            resetIdle();

            task.on('state_changed', (snap) => {
              const pct = Math.round((snap.bytesTransferred / Math.max(1, snap.totalBytes)) * 100);
              setUploadProgress((p) => ({ ...p, [label]: pct }));
              const now = Date.now();
              const deltaBytes = snap.bytesTransferred - lastBytes;
              const deltaMs = Math.max(1, now - lastTime);
              const speedMbps = (deltaBytes * 8) / (deltaMs / 1000) / 1_000_000; // megabits/s
              const remainingBytes = Math.max(0, snap.totalBytes - snap.bytesTransferred);
              const estSeconds = speedMbps > 0 ? (remainingBytes * 8) / (speedMbps * 1_000_000) : Infinity;
              if (pct >= lastLoggedPct + 10 || pct === 100) {
                // Log cada ~10%
                console.log(`[upload:${label}] intento ${attempt + 1}/${maxRetries + 1} ${pct}% | ${(snap.bytesTransferred/1024/1024).toFixed(2)}MB/${(snap.totalBytes/1024/1024).toFixed(2)}MB | velocidad ~${speedMbps.toFixed(2)} Mb/s | ETA ~${Number.isFinite(estSeconds) ? Math.ceil(estSeconds) + 's' : 'N/A'}`);
                lastLoggedPct = pct;
              }
              lastBytes = snap.bytesTransferred;
              lastTime = now;
              resetIdle();
            }, (err) => {
              if (idleTimer) window.clearTimeout(idleTimer);
              console.error(`[upload:${label}] error:`, err?.message || err);
              reject(err);
            }, async () => {
              if (idleTimer) window.clearTimeout(idleTimer);
              try {
                const url = await getDownloadURL(task.snapshot.ref);
                const totalMs = Date.now() - startedAt;
                console.log(`[upload:${label}] completado en ${(totalMs/1000).toFixed(1)}s → ${url}`);
                resolve(url);
              } catch (e) {
                reject(e);
              }
            });
          });
          return url;
        } catch (e) {
          lastError = e;
          attempt++;
          if (attempt > maxRetries) break;
          const backoffMs = 1000 * Math.pow(2, attempt - 1);
          console.warn(`[upload:${label}] reintentando en ${backoffMs}ms (intento ${attempt + 1}/${maxRetries + 1})`);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
      throw lastError || new Error('upload failed');
    }

    let fallbackToServer = false;
    setUploading(true);
    setUploadProgress({});
    for (const u of uploads) {
      if (!u.file) continue;
      // Aviso previo si la red es mala
      try {
        const anyConn: any = (navigator as any).connection;
        if (anyConn && anyConn.downlink && anyConn.downlink < 1.0) {
          toast({ title: `Subiendo ${u.label}…`, description: 'Conexión lenta, puede tardar más de lo normal.', variant: 'default' });
        }
      } catch {}
      const eff = fileByLabel[u.label] || u.file; // comprimido si existe
      console.log(`[upload:${u.label}] iniciando → ${u.path} | ${(eff.size/1024/1024).toFixed(2)} MB | tipo=${eff.type || 'video/mp4'}`);
      try {
        const url = await uploadWithRetry(u.label, eff, u.path, 2);
        urlByLabel[u.label] = url;
      } catch (err) {
        console.warn(`[upload:${u.label}] fallo subida a Storage; haré fallback a subida vía servidor.`, (err as any)?.message || err);
        fallbackToServer = true;
        break;
      }
    }
    setUploading(false);

    if (!fallbackToServer) {
      // Adjuntar URLs en el FormData y NO adjuntar archivos binarios
      if (urlByLabel['back']) formData.set('uploadedBackUrl', urlByLabel['back']);
      if (urlByLabel['front']) formData.set('uploadedFrontUrl', urlByLabel['front']);
      if (urlByLabel['left']) formData.set('uploadedLeftUrl', urlByLabel['left']);
      if (urlByLabel['right']) formData.set('uploadedRightUrl', urlByLabel['right']);
    } else {
      // Fallback: adjuntar archivos binarios para subida server-side
      try { toast({ title: 'Subida alternativa', description: 'Usando subida desde el servidor para evitar CORS.', variant: 'default' }); } catch {}
      if (backVideo) formData.set('video-back', fileByLabel['back'] || backVideo);
      if (selectedVideo) formData.set('video-front', fileByLabel['front'] || selectedVideo);
      if (leftVideo) formData.set('video-left', fileByLabel['left'] || leftVideo);
      if (rightVideo) formData.set('video-right', fileByLabel['right'] || rightVideo);
    }

    // Mostrar modal de análisis en curso
    setAnalyzingOpen(true);
    if (analyzingTimerRef.current) {
      window.clearTimeout(analyzingTimerRef.current);
      analyzingTimerRef.current = null;
    }
    analyzingTimerRef.current = window.setTimeout(() => {
      setAnalyzingOpen(false);
      toast({
        title: 'Demora inusual',
        description: 'El análisis está tardando más de lo normal. Verifica tu conexión y vuelve a intentar.',
        variant: 'destructive',
      });
    }, 120000);
    startTransition(() => (formAction as any)(formData));
  };

  useEffect(() => {
    const fetchWallet = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/wallet?userId=${user.uid}`);
        const data = await res.json();
        const freeUsed = Number(data.freeAnalysesUsed || 0);
        const lastFreeAnalysisDate = typeof data.lastFreeAnalysisDate === 'string' ? data.lastFreeAnalysisDate : null;
        setWallet({
          credits: data.credits || 0,
          freeLeft: Math.max(0, 2 - freeUsed),
          freeUsed,
          lastFreeAnalysisDate,
        });
      } catch {}
    };
    fetchWallet();
  }, [user]);

  // Abrir recomendaciones automáticamente la primera vez
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('uploadTipsDismissed');
      if (!dismissed) setTipsOpen(true);
    } catch {}
  }, []);

  // Cargar última selección del tipo de lanzamiento
  useEffect(() => {
    try {
      const last = localStorage.getItem('lastShotType');
      if (last) setShotType(last);
    } catch {}
  }, []);

  // Persistir selección del tipo de lanzamiento
  useEffect(() => {
    try {
      if (shotType) localStorage.setItem('lastShotType', shotType);
    } catch {}
  }, [shotType]);
  
  const handleFormSubmit: React.FormEventHandler<HTMLFormElement> = () => {
    setConfirmedPartial(false);
  };

  useEffect(() => {
      if (state?.message) {
          if (state.error) {
              setAnalyzingOpen(false);
              if (analyzingTimerRef.current) { window.clearTimeout(analyzingTimerRef.current); analyzingTimerRef.current = null; }
              toast({
                  title: "Error de Análisis",
                  description: state.message,
                  variant: "destructive",
              });
              if (typeof state.message === 'string' && (state.message.includes('no tenés créditos') || state.message.toLowerCase().includes('límite') || state.message.toLowerCase().includes('crédit'))) {
                  setNoBalanceOpen(true);
              }
          } else {
              setAnalyzingOpen(false);
              if (analyzingTimerRef.current) { window.clearTimeout(analyzingTimerRef.current); analyzingTimerRef.current = null; }
              toast({
                  title: "¡Éxito!",
                  description: state.message,
                  variant: "default",
              });
              if (formRef.current) {
                  formRef.current.reset();
              }
              setSelectedVideo(null);
              setLeftVideo(null);
              setRightVideo(null);
              setBackVideo(null);
              if (state && typeof state.redirectTo === 'string' && !state.error) {
                  setTimeout(() => {
                      router.push(state.redirectTo as string);
                  }, 2000);
              }
          }
      }
  }, [state, toast, router]);

  // Ya no abrimos modal automático por perfil incompleto al entrar.

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        <p>Cargando...</p>
      </div>
    );
  }

  const anyVideoSelected = !!(selectedVideo || backVideo || leftVideo || rightVideo);
  const addMonths = (date: Date, months: number) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  };
  const formatShortDate = (date: Date) =>
    date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const freeNextEligibility = (() => {
    if (!wallet?.lastFreeAnalysisDate) return null;
    const last = new Date(wallet.lastFreeAnalysisDate);
    if (Number.isNaN(last.getTime())) return null;
    return addMonths(last, 6);
  })();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Analizar Nuevo Lanzamiento
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sube o graba un video y analizaremos tu técnica con IA
        </p>
        <div className="mt-2 text-xs text-blue-700">
          Recomendado: subir con conexión Wi‑Fi y mantener la app en primer plano durante la subida.
        </div>
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={() => setTipsOpen(true)}>
            Ver recomendaciones
          </Button>
        </div>
      </div>

      {wallet && (
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📊 Tu estado de análisis gratuitos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-1">
            <div>• Análisis gratuitos usados este año: {wallet.freeUsed}/2</div>
            <div>• Análisis gratuitos disponibles: {wallet.freeLeft}</div>
            {wallet.freeUsed >= 1 && freeNextEligibility && (
              <div>
                • Tu segundo análisis gratuito estará disponible {new Date() < freeNextEligibility ? `el ${formatShortDate(freeNextEligibility)}` : 'desde ahora'}
              </div>
            )}
            <div>• Créditos disponibles: {wallet.credits}</div>
            <div className="pt-1 text-slate-600">💡 Política: 2 análisis gratuitos por año con 6 meses de separación entre cada uno</div>
          </CardContent>
        </Card>
      )}

      {/* Tipo de lanzamiento (visible siempre) */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Lanzamiento</CardTitle>
          <CardDescription>Selecciona el tipo de tiro para ajustar el análisis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="shotType">Tipo de Lanzamiento</Label>
            <Select value={shotType} onValueChange={(v) => setShotType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de lanzamiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tiro Libre">Tiro Libre</SelectItem>
                <SelectItem value="Lanzamiento de Media Distancia (Jump Shot)">Lanzamiento de Media Distancia (Jump Shot)</SelectItem>
                <SelectItem value="Lanzamiento de Tres">Lanzamiento de Tres</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Esto nos ayuda a evaluar con reglas específicas para cada tipo de tiro.</p>
          </div>
        </CardContent>
      </Card>

      {/* Selector de videos (unificado) */}
      <Card>
        <CardHeader>
          <CardTitle>Videos para el análisis</CardTitle>
          <CardDescription>
            Para un mejor análisis, usá los 4 ángulos: Trasera (obligatoria), Frontal, Lateral Izquierdo y Lateral Derecho. Te recomendamos grabarlos primero y luego subirlos. Si subís menos de 4, la precisión puede ser menor. Duraciones sugeridas: Trasera hasta 40s; Frontal y laterales hasta 30s.
          </CardDescription>
          {!shotType && (
            <div className="text-xs text-amber-600 mt-2">Seleccioná el tipo de lanzamiento arriba para habilitar la subida.</div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="video-back">Trasera (preferida)</Label>
              <Button type="button" onClick={() => backInputRef.current?.click()} className="w-full" disabled={!shotType}>
                Subir trasera desde archivos
              </Button>
              <Input ref={backInputRef} id="video-back" type="file" accept="video/*" onChange={(e) => setBackVideo(e.target.files?.[0] || null)} className="hidden" />
              {backVideo && (
                <p className="text-xs text-muted-foreground">
                  {backVideo.name} — {(backVideo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-front">Frontal (alternativa)</Label>
              <Button type="button" onClick={() => frontInputRef.current?.click()} className="w-full" disabled={!shotType}>
                Subir frontal desde archivos
              </Button>
              <Input ref={frontInputRef} id="video-front" type="file" accept="video/*" onChange={(e) => setSelectedVideo(e.target.files?.[0] || null)} className="hidden" />
              {selectedVideo && (
                <p className="text-xs text-muted-foreground">
                  {selectedVideo.name} — {(selectedVideo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-left">Lateral Izquierdo (opcional)</Label>
              <Button type="button" onClick={() => leftInputRef.current?.click()} className="w-full" disabled={!shotType}>
                Subir lateral izquierdo desde archivos
              </Button>
              <Input ref={leftInputRef} id="video-left" type="file" accept="video/*" onChange={(e) => setLeftVideo(e.target.files?.[0] || null)} className="hidden" />
              {leftVideo && (
                <p className="text-xs text-muted-foreground">
                  {leftVideo.name} — {(leftVideo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-right">Lateral Derecho (opcional)</Label>
              <Button type="button" onClick={() => rightInputRef.current?.click()} className="w-full" disabled={!shotType}>
                Subir lateral derecho desde archivos
              </Button>
              <Input ref={rightInputRef} id="video-right" type="file" accept="video/*" onChange={(e) => setRightVideo(e.target.files?.[0] || null)} className="hidden" />
              {rightVideo && (
                <p className="text-xs text-muted-foreground">
                  {rightVideo.name} — {(rightVideo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración del Análisis */}
      {anyVideoSelected && (
        <Card>
          <CardHeader>
            <CardTitle>Configuración del Análisis</CardTitle>
            <CardDescription>
              Completa los detalles para el análisis de IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} onSubmit={handleFormSubmit} className="space-y-4">
              {/* Usuario ID oculto */}
              <input type="hidden" name="userId" value={user.uid} />
              {/* Tipo de lanzamiento (solo para envío) */}
              <input type="hidden" name="shotType" value={shotType} />

              {/* Información del video */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Videos Seleccionados</h3>
                <p className="text-sm text-blue-600">
                  {backVideo && (<><strong>Trasera:</strong> {backVideo.name} — {(backVideo.size / 1024 / 1024).toFixed(2)} MB<br/></>)}
                  {selectedVideo && (<><strong>Frontal:</strong> {selectedVideo.name} — {(selectedVideo.size / 1024 / 1024).toFixed(2)} MB<br/></>)}
                  {leftVideo && (<><strong>Lateral Izquierdo:</strong> {leftVideo.name} — {(leftVideo.size / 1024 / 1024).toFixed(2)} MB<br/></>)}
                  {rightVideo && (<><strong>Lateral Derecho:</strong> {rightVideo.name} — {(rightVideo.size / 1024 / 1024).toFixed(2)} MB<br/></>)}
                  {!backVideo && !selectedVideo && <>Aún no seleccionaste video principal</>}
                </p>
                <p className="text-xs text-blue-700 mt-2">Recordá: Trasera es obligatoria. Usar los 4 ángulos mejora la precisión. Duraciones sugeridas: Trasera 40s; Frontal/Laterales 30s. Subí con Wi‑Fi si es posible.</p>
              </div>

              {/* Compresión en cliente */}
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">Comprimir antes de subir</div>
                  <div className="text-xs text-muted-foreground">Reduce el peso a 720p/24fps para subir más rápido. Recomendado.</div>
                </div>
                <Switch checked={compressEnabled} onCheckedChange={(v) => setCompressEnabled(Boolean(v))} />
              </div>

              <SubmitButton analyzing={analyzingOpen} />
              <PendingNotice />
              {(compressing || uploading) && (
                <div className="text-sm text-muted-foreground">
                  {compressing && <div className="mt-2">Comprimiendo videos…</div>}
                  {compressing && (['back','front','left','right'] as const).map((k) => (
                    <div key={`cmp-${k}`} className="mt-1">
                      <span className="mr-2 capitalize">{k}:</span>
                      <span>{(compressionProgress[k] ?? 0)}%</span>
                      <div className="h-1 bg-muted rounded mt-1">
                        <div className="h-1 bg-primary rounded" style={{ width: `${compressionProgress[k] ?? 0}%` }} />
                      </div>
                    </div>
                  ))}
                  {uploading && <div className="mt-4">Subiendo a la nube…</div>}
                  {(['back','front','left','right'] as const).map((k) => (
                    <div key={k} className="mt-1">
                      <span className="mr-2 capitalize">{k}:</span>
                      <span>{(uploadProgress[k] ?? 0)}%</span>
                      <div className="h-1 bg-muted rounded mt-1">
                        <div className="h-1 bg-primary rounded" style={{ width: `${uploadProgress[k] ?? 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Instrucciones */}
      {(!anyVideoSelected) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="text-center text-amber-800">
              <Video className="h-12 w-12 mx-auto mb-2 text-amber-600" />
              <h3 className="font-semibold mb-2">Pasos para el Análisis</h3>
              <ol className="text-sm space-y-1 text-left max-w-md mx-auto">
                <li>1. Seleccioná el tipo de lanzamiento.</li>
                <li>2. Grabá los 4 ángulos (recomendado) y luego subilos.</li>
                <li>3. La cámara Trasera es obligatoria; Frontal y laterales son opcionales.</li>
                <li>4. Envía para análisis.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recomendaciones de grabación */}
      <AlertDialog
        open={tipsOpen}
        onOpenChange={(open) => {
          if (!open) {
            try {
              if (dontShowTipsAgain) localStorage.setItem('uploadTipsDismissed', '1');
            } catch {}
          }
          setTipsOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Consejos para grabar tu video</AlertDialogTitle>
            <AlertDialogDescription>
              Seguí estas recomendaciones para mejorar la calidad del análisis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm space-y-2">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Graba 40 segundos para la cámara trasera; 30 segundos para las demás.</li>
              <li>Subí con conexión Wi‑Fi para evitar cortes o demoras.</li>
              <li>Iluminación: buena luz; evitá contraluces fuertes y escenas oscuras.</li>
              <li>Encuadre: que se vea el cuerpo entero y, desde atrás, el aro.</li>
              <li>Estabilidad: apoyá el teléfono o usá trípode.</li>
              <li>Orientación: horizontal (apaisado) recomendada.</li>
              <li>Distancia: 4 a 6 metros para que entre el cuerpo completo.</li>
              <li>Calidad: 1080p a 30 fps o más.</li>
            </ol>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="dont-show-tips" checked={dontShowTipsAgain} onCheckedChange={(v) => setDontShowTipsAgain(Boolean(v))} />
              <label htmlFor="dont-show-tips" className="text-sm text-muted-foreground select-none cursor-pointer">
                No volver a mostrar
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                try {
                  if (dontShowTipsAgain) localStorage.setItem('uploadTipsDismissed', '1');
                } catch {}
                setTipsOpen(false);
              }}
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de envío parcial */}
      <AlertDialog open={confirmPartialOpen} onOpenChange={setConfirmPartialOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Analizar con información incompleta?</AlertDialogTitle>
            <AlertDialogDescription>
              Faltan videos de otros ángulos. El análisis se realizará parcialmente y podría ser menos preciso. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPartialOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmedPartial(true); setConfirmPartialOpen(false); formRef.current?.requestSubmit(); }}>Confirmar y analizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Perfil incompleto: ya no bloquea; mostramos opción de ir al perfil solo si se abre explícitamente */}
      {profileIncompleteOpen && (
        <AlertDialog open={profileIncompleteOpen} onOpenChange={setProfileIncompleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Completar perfil (opcional)</AlertDialogTitle>
              <AlertDialogDescription>
                Completar nombre, fecha de nacimiento, país, grupo de edad, nivel, posición, altura y envergadura mejora la precisión del análisis.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProfileIncompleteOpen(false)}>Cerrar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setProfileIncompleteOpen(false); router.push('/profile'); }}>Ir a mi perfil</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Modal de saldo insuficiente */}
      <AlertDialog open={noBalanceOpen} onOpenChange={setNoBalanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sin saldo disponible</AlertDialogTitle>
            <AlertDialogDescription>
              Ya usaste tus análisis gratis anuales o no tenés créditos. Podés comprar un análisis o un pack y volver a intentar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                if (!user) return;
                const res = await fetch('/api/payments/create-preference', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, productId: 'analysis_1' }),
                });
                const pref = await res.json();
                if (pref?.init_point) window.location.href = pref.init_point;
              }}
            >
              Comprar 1 análisis
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (!user) return;
                const res = await fetch('/api/payments/create-preference', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, productId: 'pack_3' }),
                });
                const pref = await res.json();
                if (pref?.init_point) window.location.href = pref.init_point;
              }}
            >
              Comprar pack 3
            </Button>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overlay de análisis en curso (seguro visual) */}
      {analyzingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-lg border bg-card p-6 text-center shadow-lg">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Analizando tu video… Esto puede tardar entre 30 segundos y 2 minutos.</p>
          </div>
        </div>
      )}

      {/* Modal de análisis en progreso */}
      <AlertDialog open={analyzingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Analizando tu video…</AlertDialogTitle>
            <AlertDialogDescription>
              Este proceso puede tardar entre 30 segundos y 2 minutos según el tamaño del video. No cierres esta ventana.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando…
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
