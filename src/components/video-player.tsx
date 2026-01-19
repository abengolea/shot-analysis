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
}

export function VideoPlayer({ 
  src, 
  onFrameChange, 
  onBookmarkAdd, 
  bookmarks = [] 
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Fallback seguro: usar 30fps por defecto para evitar CORS/tainted canvas
      setFps(30);
      setLoadError(null);
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      const frame = Math.floor(time * fps);
      setCurrentFrame(frame);
      onFrameChange?.(time, frame);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [fps, onFrameChange]);

  useEffect(() => {
    setLoadError(null);
    setIsPlaying(false);
  }, [src]);

  const getErrorMessage = (code?: number) => {
    switch (code) {
      case 1:
        return "La carga fue interrumpida.";
      case 2:
        return "Error de red al cargar el video.";
      case 3:
        return "El video está corrupto o no puede decodificarse.";
      case 4:
        return "Formato de video no soportado.";
      default:
        return "No se pudo cargar el video.";
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
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
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              const el = e.currentTarget as HTMLVideoElement;
              const err = (el && (el.error as any)) || {};
              const message = getErrorMessage(err?.code);
              setLoadError(message);
              if (process.env.NODE_ENV !== 'production') {
                console.warn('Error loading video:', {
                  code: err?.code,
                  message: err?.message,
                  networkState: el?.networkState,
                  readyState: el?.readyState,
                  src,
                });
              }
            }}
            controls
          />
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
              <div className="text-center px-4">
                <p className="text-sm font-medium">{loadError}</p>
                <p className="text-xs opacity-80 mt-1">
                  Verifica permisos del archivo o intenta abrir el video en otra pestaña.
                </p>
              </div>
            </div>
          )}
          {!src && (
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
