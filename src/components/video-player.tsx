"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  RotateCw,
  FastForward,
  Rewind,
  Bookmark,
  Settings
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoPlayerProps {
  src: string;
  onFrameChange?: (currentTime: number, currentFrame: number) => void;
  onBookmarkAdd?: (time: number, label: string) => void;
  bookmarks?: Array<{ time: number; label: string; id: string }>;
  analysisId?: string; // Opcional: ID del análisis para refrescar URLs expiradas
}

export function VideoPlayer({ 
  src, 
  onFrameChange, 
  onBookmarkAdd, 
  bookmarks = [],
  analysisId 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(30);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Fallback seguro: usar 30fps por defecto para evitar CORS/tainted canvas
      setFps(30);
      setVideoError(null); // Limpiar error cuando el video se carga correctamente
      setIsVideoReady(true); // Marcar video como listo
    };

    const handleCanPlay = () => {
      setIsVideoReady(true);
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      const frame = Math.floor(time * fps);
      setCurrentFrame(frame);
      onFrameChange?.(time, frame);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [fps, onFrameChange]);

  // Limpiar error cuando cambie la fuente del video
  useEffect(() => {
    setVideoError(null);
    setIsVideoReady(false);
  }, [src]);

  const togglePlay = async () => {
    if (!videoRef.current || !isVideoReady) return;
    
    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        // Usar await para manejar la promesa de play()
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      // Manejar errores de reproducción (incluyendo interrupciones)
      console.warn('Error en reproducción:', error);
      setIsPlaying(false);
      
      // Si es un error de interrupción, no mostrar como error crítico
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Reproducción interrumpida (normal)');
      } else {
        setVideoError('Error al reproducir el video');
      }
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const seekFrame = (direction: 'forward' | 'backward') => {
    if (videoRef.current) {
      const frameTime = 1 / fps;
      const newTime = direction === 'forward' 
        ? currentTime + frameTime 
        : currentTime - frameTime;
      seekTo(Math.max(0, Math.min(newTime, duration)));
    }
  };

  const setSpeed = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const addBookmark = () => {
    if (bookmarkLabel.trim() && onBookmarkAdd) {
      onBookmarkAdd(currentTime, bookmarkLabel.trim());
      setBookmarkLabel("");
      setShowBookmarkInput(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const frames = Math.floor((time % 1) * fps);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const formatFrame = (frame: number) => {
    return `Frame ${frame}`;
  };

  // Validar que src sea válido antes de renderizar
  if (!src || (typeof src === 'string' && src.trim() === '')) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Reproductor de Video</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">No hay video disponible</p>
              <p className="text-sm text-muted-foreground">La URL del video no está disponible</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Reproductor de Video</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{formatFrame(currentFrame)}</Badge>
            <Badge variant="outline">{formatTime(currentTime)}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Element */}
        <div className="relative w-full bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={src}
            className="w-full h-auto max-h-96"
            playsInline
            onPlay={() => {
              setIsPlaying(true);
              setVideoError(null); // Limpiar errores al reproducir exitosamente
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onLoadStart={() => setIsVideoReady(false)}
            onCanPlay={() => setIsVideoReady(true)}
            onError={async (e) => {
              const el = e.currentTarget as HTMLVideoElement;
              const err = el?.error;
              
              // Validar src primero
              if (!src || (typeof src === 'string' && src.trim() === '')) {
                console.warn('[VideoPlayer] No video source provided');
                setVideoError('No se proporcionó una URL de video válida');
                return;
              }
              
              // Construir información de error filtrando valores nulos
              const errorInfo: Record<string, any> = {};
              if (err) {
                if (err.code !== null && err.code !== undefined) errorInfo.code = err.code;
                if (err.message) errorInfo.message = err.message;
              }
              if (el?.networkState !== null && el?.networkState !== undefined) errorInfo.networkState = el.networkState;
              if (el?.readyState !== null && el?.readyState !== undefined) errorInfo.readyState = el.readyState;
              if (src) {
                errorInfo.src = src.length > 100 ? src.substring(0, 100) + '...' : src;
                errorInfo.srcLength = src.length;
              }
              
              // Loggear solo si hay información útil o un error real
              // Usar console.warn en lugar de console.error para evitar stack traces en Next.js
              if (err && err.code) {
                const errorParts = [
                  '[VideoPlayer] Error loading video',
                  `Code: ${err.code}`,
                  err.message ? `Message: ${err.message}` : null,
                  `NetworkState: ${el?.networkState ?? 'unknown'}`,
                  `ReadyState: ${el?.readyState ?? 'unknown'}`,
                  src ? `URL length: ${src.length}` : null
                ].filter(Boolean);
                // Usar console.warn para evitar que Next.js lo trate como error crítico
                console.warn(errorParts.join(' | '));
              } else if (Object.keys(errorInfo).length > 0) {
                console.warn('[VideoPlayer] Video error event (partial info):', errorInfo);
              } else {
                console.warn('[VideoPlayer] Video error event triggered but no detailed information available');
              }
              
              // Intentar refrescar la URL si parece ser un problema de URL expirada o inválida
              const shouldTryRefresh = err?.code === 4 || err?.code === 2 || err?.code === 3;
              
              if (shouldTryRefresh && src && analysisId && !isRefreshingUrl) {
                console.warn('[VideoPlayer] Intentando refrescar URL del video para análisis:', analysisId);
                setIsRefreshingUrl(true);
                
                try {
                  const refreshResponse = await fetch(`/api/analyses/${analysisId}/refresh-video-url`);
                  if (refreshResponse.ok) {
                    const { url: newUrl } = await refreshResponse.json();
                    console.log('[VideoPlayer] ✅ URL refrescada exitosamente, recargando video...');
                    // Actualizar el src del video con la nueva URL
                    if (videoRef.current) {
                      videoRef.current.src = newUrl;
                      videoRef.current.load();
                      setVideoError(null);
                      setIsRefreshingUrl(false);
                      return; // Salir temprano si el refresh funcionó
                    }
                  } else {
                    const errorData = await refreshResponse.json().catch(() => ({}));
                    console.warn('[VideoPlayer] No se pudo refrescar la URL:', errorData);
                  }
                } catch (refreshError) {
                  console.warn('[VideoPlayer] Error al refrescar la URL:', refreshError);
                }
                
                setIsRefreshingUrl(false);
              }
              
              // Establecer mensaje de error apropiado para el usuario
              // Código 4 puede ser CORS o Format error, verificar el mensaje
              if (err?.code === 4) {
                const message = err.message?.toLowerCase() || '';
                if (message.includes('format') || message.includes('decodificación')) {
                  setVideoError('Error de formato: El formato del video no es compatible con el navegador o el archivo está corrupto. Si la URL ha expirado, intenta recargar la página.');
                } else if (message.includes('cors') || message.includes('cross-origin')) {
                  setVideoError('Error de CORS: El video no se puede cargar debido a restricciones de seguridad del navegador');
                } else {
                  setVideoError('Error al cargar el video: La URL puede haber expirado o el formato no es compatible. Intenta recargar la página.');
                }
              } else if (err?.code === 3) {
                setVideoError('Error de decodificación: El formato del video no es compatible con este navegador');
              } else if (err?.code === 2) {
                setVideoError('Error de red: No se pudo descargar el video. La URL puede haber expirado o hay un problema de conexión.');
              } else if (err?.code === 1) {
                setVideoError('Error al obtener el video: La solicitud fue abortada');
              } else if (err && err.code) {
                setVideoError(`Error al cargar el video (Código ${err.code}). Por favor, intenta recargar la página.`);
              } else {
                setVideoError('Error al cargar el video. La URL puede haber expirado o el archivo no está disponible.');
              }
            }}
            controls
          />
          {videoError && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900/80">
              <div className="text-center p-4">
                <p className="text-lg font-medium text-red-100">Error al cargar el video</p>
                <p className="text-sm opacity-80 text-red-200">{videoError}</p>
                <button 
                  onClick={() => {
                    setVideoError(null);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}
          {src && !isVideoReady && !videoError && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm opacity-80">Cargando video...</p>
              </div>
            </div>
          )}
          {!src && !videoError && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <p className="text-lg font-medium">No hay video seleccionado</p>
                <p className="text-sm opacity-80">Sube un video o usa el video de demostración</p>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <Slider
            value={[currentTime]}
            max={duration}
            step={1/fps}
            onValueChange={([value]) => seekTo(value)}
            className="w-full"
          />
          
          {/* Bookmarks on timeline */}
          {bookmarks.length > 0 && (
            <div className="relative h-4">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="absolute top-0 w-2 h-4 bg-blue-500 rounded cursor-pointer hover:bg-blue-600"
                  style={{ left: `${(bookmark.time / duration) * 100}%` }}
                  title={bookmark.label}
                  onClick={() => seekTo(bookmark.time)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => seekFrame('backward')}
              title="Frame anterior"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => seekTo(Math.max(0, currentTime - 1))}
              title="Retroceder 1s"
            >
              <Rewind className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => seekTo(Math.min(duration, currentTime + 1))}
              title="Avanzar 1s"
            >
              <FastForward className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => seekFrame('forward')}
              title="Frame siguiente"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowBookmarkInput(!showBookmarkInput)}
              title="Añadir marcador"
            >
              <Bookmark className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSpeed(0.25)}
                className={playbackRate === 0.25 ? "bg-primary text-primary-foreground" : ""}
              >
                0.25x
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSpeed(0.5)}
                className={playbackRate === 0.5 ? "bg-primary text-primary-foreground" : ""}
              >
                0.5x
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSpeed(1)}
                className={playbackRate === 1 ? "bg-primary text-primary-foreground" : ""}
              >
                1x
              </Button>
            </div>
          </div>
        </div>

        {/* Bookmark Input */}
        {showBookmarkInput && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <input
              type="text"
              placeholder="Etiqueta del marcador..."
              value={bookmarkLabel}
              onChange={(e) => setBookmarkLabel(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md"
              onKeyPress={(e) => e.key === 'Enter' && addBookmark()}
            />
            <Button onClick={addBookmark} size="sm">
              Añadir
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowBookmarkInput(false)}
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Bookmarks List */}
        {bookmarks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Marcadores:</h4>
            <div className="flex flex-wrap gap-2">
              {bookmarks.map((bookmark) => (
                <Badge
                  key={bookmark.id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => seekTo(bookmark.time)}
                >
                  {bookmark.label} ({formatTime(bookmark.time)})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
