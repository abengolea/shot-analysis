"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/app/actions";
import { useAuth } from "@/hooks/use-auth";
import { VideoFrameExtractor } from "@/components/video-frame-extractor";
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

interface VideoFrame {
  dataUrl: string;
  timestamp: number;
  description: string;
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

export default function UploadPage() {
  const [state, formAction] = useActionState(startAnalysis, { message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false);
  const [confirmedPartial, setConfirmedPartial] = useState(false);
  const [noBalanceOpen, setNoBalanceOpen] = useState(false);
  const [analyzingOpen, setAnalyzingOpen] = useState(false);
  const analyzingTimerRef = useRef<number | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [dontShowTipsAgain, setDontShowTipsAgain] = useState(false);
  
  // Estados para el video y frames
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<VideoFrame[]>([]);
  const [leftVideo, setLeftVideo] = useState<File | null>(null);
  const [rightVideo, setRightVideo] = useState<File | null>(null);
  const [backVideo, setBackVideo] = useState<File | null>(null);
  const [shotType, setShotType] = useState<string>("");
  const [wallet, setWallet] = useState<{ credits: number; freeLeft: number } | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleVideoSelected = (file: File) => {
    setSelectedVideo(file);
  };

  const handleFramesExtracted = (frames: VideoFrame[]) => {
    setExtractedFrames(frames);
    toast({
      title: "Frames Extraídos",
      description: `${frames.length} frames extraídos del video`,
      variant: "default",
    });
  };

  const handleSubmit = async (formData: FormData) => {
    if (!shotType) {
      toast({
        title: "Error",
        description: "Debes seleccionar el tipo de lanzamiento",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVideo) {
      toast({
        title: "Error",
        description: "Debes seleccionar un video primero",
        variant: "destructive",
      });
      return;
    }

    // En modo Lite backend puede extraer frames; no forzar aquí

    // Agregar el video y frames al FormData
    formData.append('video-front', selectedVideo);
    if (leftVideo) formData.append('video-left', leftVideo);
    if (rightVideo) formData.append('video-right', rightVideo);
    if (backVideo) formData.append('video-back', backVideo);
    // Ya no enviamos frames del cliente; el backend extrae con FFmpeg
    
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
    }, 120000); // 120s watchdog
    // Llamar a la acción del servidor
    formAction(formData);
  };

  useEffect(() => {
    const fetchWallet = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/wallet?userId=${user.uid}`);
        const data = await res.json();
        setWallet({ credits: data.credits || 0, freeLeft: Math.max(0, 2 - (data.freeAnalysesUsed || 0)) });
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

  const handleFormSubmit: React.FormEventHandler<HTMLFormElement> = () => {
    // Permitimos enviar siempre; si faltan ángulos, solo avisamos (no bloqueamos)
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
              // Abrir modal de saldo si corresponde
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
              
              // Limpiar el formulario después del éxito
              if (formRef.current) {
                  formRef.current.reset();
              }
              
              // Limpiar estados
              setSelectedVideo(null);
              setExtractedFrames([]);
              
              // Redirigir al dashboard después de un análisis exitoso
              if (state.redirectTo && !state.error) {
                  setTimeout(() => {
                      router.push(state.redirectTo);
                  }, 2000); // Esperar 2 segundos para que el usuario vea el mensaje de éxito
              }
          }
      }
  }, [state, toast, router]);

  // Si no hay usuario, mostrar mensaje de carga
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Analizar Nuevo Lanzamiento
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sube o graba un video y automáticamente extraeremos los frames clave para el análisis con IA
        </p>
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={() => setTipsOpen(true)}>
            Ver recomendaciones
          </Button>
        </div>
      </div>

      {/* Extracción de frames */}
      <VideoFrameExtractor
        onVideoSelected={handleVideoSelected}
        onFramesExtracted={handleFramesExtracted}
        onRangeConfirmed={(s, e) => {
          // Guardar en atributos data para enviarlo en el form
          if (formRef.current) {
            let sEl = formRef.current.querySelector('input[name="rangeStart"]') as HTMLInputElement | null;
            let eEl = formRef.current.querySelector('input[name="rangeEnd"]') as HTMLInputElement | null;
            if (!sEl) {
              sEl = document.createElement('input');
              sEl.type = 'hidden'; sEl.name = 'rangeStart';
              formRef.current.appendChild(sEl);
            }
            if (!eEl) {
              eEl = document.createElement('input');
              eEl.type = 'hidden'; eEl.name = 'rangeEnd';
              formRef.current.appendChild(eEl);
            }
            sEl.value = String(s);
            eEl.value = String(e);
          }
          toast({ title: 'Rango confirmado', description: `Inicio ${s.toFixed(2)}s • Fin ${e.toFixed(2)}s (se usará para el análisis)` });
        }}
      />

      {/* Subida de otros ángulos (opcional) - aparece antes que configuración */}
      {selectedVideo && (
        <Card>
          <CardHeader>
            <CardTitle>Subir otros ángulos (opcional)</CardTitle>
            <CardDescription>
              Para mejor precisión, podés agregar Lateral Izquierdo, Lateral Derecho y Trasera.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video-left">Lateral Izquierdo</Label>
                <Button type="button" onClick={() => leftInputRef.current?.click()} className="w-full">
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
                <Label htmlFor="video-right">Lateral Derecho</Label>
                <Button type="button" onClick={() => rightInputRef.current?.click()} className="w-full">
                  Subir lateral derecho desde archivos
                </Button>
                <Input ref={rightInputRef} id="video-right" type="file" accept="video/*" onChange={(e) => setRightVideo(e.target.files?.[0] || null)} className="hidden" />
                {rightVideo && (
                  <p className="text-xs text-muted-foreground">
                    {rightVideo.name} — {(rightVideo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-back">Trasera</Label>
                <Button type="button" onClick={() => backInputRef.current?.click()} className="w-full">
                  Subir trasera desde archivos
                </Button>
                <Input ref={backInputRef} id="video-back" type="file" accept="video/*" onChange={(e) => setBackVideo(e.target.files?.[0] || null)} className="hidden" />
                {backVideo && (
                  <p className="text-xs text-muted-foreground">
                    {backVideo.name} — {(backVideo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Configuración del Análisis (parámetros) */}
      {selectedVideo && (
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
              
              {/* Tipo de lanzamiento */}
              <div className="space-y-2">
                <Label htmlFor="shotType">Tipo de Lanzamiento</Label>
                <input type="hidden" name="shotType" value={shotType} />
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
              </div>

              {/* Los otros ángulos se suben en la tarjeta anterior */}

              {/* Información del video */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Video Seleccionado</h3>
                <p className="text-sm text-blue-600">
                  <strong>Archivo:</strong> {selectedVideo.name}<br/>
                  <strong>Tamaño:</strong> {(selectedVideo.size / 1024 / 1024).toFixed(2)} MB<br/>
                  Los frames clave se generan automáticamente al analizar
                </p>
              </div>


              {/* Submit siempre visible con estado de carga */}
              <SubmitButton analyzing={analyzingOpen} />
              <PendingNotice />
            </form>
          </CardContent>
          {/* CardFooter eliminado para evitar botón fuera del form */}
        </Card>
      )}

      {/* Instrucciones */}
      {(!selectedVideo || extractedFrames.length === 0) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="text-center text-amber-800">
              <Video className="h-12 w-12 mx-auto mb-2 text-amber-600" />
              <h3 className="font-semibold mb-2">Pasos para el Análisis</h3>
              <ol className="text-sm space-y-1 text-left max-w-md mx-auto">
                <li>1. Sube o graba el video Frontal (obligatorio)</li>
                <li>2. Opcional: Sube videos Lateral Izquierdo, Lateral Derecho y Trasera</li>
                <li>3. Espera la extracción automática de 8 frames clave del frontal</li>
                <li>4. Completa el tipo de lanzamiento y envía para análisis</li>
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
              <li>Graba ~30 segundos por video e intentá incluir la mayor cantidad de lanzamientos posibles.</li>
              <li>Iluminación: buena luz; evitá contraluces fuertes y escenas oscuras.</li>
              <li>Encuadre: que se vea el cuerpo entero. Si filmás desde atrás, que se vea también el aro.</li>
              <li>Estabilidad: apoyá el teléfono o usá trípode; evitá el zoom digital y los movimientos bruscos.</li>
              <li>Orientación: horizontal (apaisado) recomendada.</li>
              <li>Distancia: 4 a 6 metros para que entre el cuerpo completo sin recortes.</li>
              <li>Calidad: 1080p a 30 fps o más.</li>
              <li>Fondo: que contraste con tu ropa para facilitar la detección.</li>
              <li>Recomendación final: grabá los videos con calma y subí los archivos cuando estés conforme.</li>
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
