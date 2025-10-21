"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Play, Pause, RotateCcw, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SmartKeyframe {
  index: number;
  timestamp: number;
  description: string;
  importance: number;
  phase: 'preparation' | 'loading' | 'release' | 'follow-through' | 'landing';
  imageBuffer: string; // Data URL como string
}

interface SmartKeyframes {
  front: SmartKeyframe[];
  back: SmartKeyframe[];
  left: SmartKeyframe[];
  right: SmartKeyframe[];
}

interface SmartKeyframesViewProps {
  analysisId: string;
  userId: string;
}

const phaseColors = {
  preparation: 'bg-blue-100 text-blue-800',
  loading: 'bg-green-100 text-green-800',
  release: 'bg-yellow-100 text-yellow-800',
  'follow-through': 'bg-orange-100 text-orange-800',
  landing: 'bg-purple-100 text-purple-800'
};

const phaseNames = {
  preparation: 'Preparación',
  loading: 'Carga',
  release: 'Liberación',
  'follow-through': 'Follow-through',
  landing: 'Aterrizaje'
};

export function SmartKeyframesView({ analysisId, userId }: SmartKeyframesViewProps) {
  const [keyframes, setKeyframes] = useState<SmartKeyframes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<keyof SmartKeyframes>('back');
  const [selectedFrame, setSelectedFrame] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    fetchSmartKeyframes();
  }, [analysisId]);

  useEffect(() => {
    if (autoPlay && keyframes) {
      const interval = setInterval(() => {
        const currentFrames = keyframes[selectedAngle];
        if (currentFrames.length > 0) {
          setSelectedFrame((prev) => (prev + 1) % currentFrames.length);
        }
      }, 2000); // Cambiar frame cada 2 segundos

      return () => clearInterval(interval);
    }
  }, [autoPlay, keyframes, selectedAngle]);

  const fetchSmartKeyframes = async () => {
    try {
      setLoading(true);
            const response = await fetch(`/api/analyses/${analysisId}/smart-keyframes`);
            if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [SmartKeyframesView] Error de API:`, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
            setKeyframes(data);
      
    } catch (err) {
      console.error('❌ [SmartKeyframesView] Error cargando keyframes:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (keyframe: SmartKeyframe): string => {
    // imageBuffer ya es un data URL string
    return keyframe.imageBuffer;
  };

  const getImportanceColor = (importance: number): string => {
    if (importance >= 0.8) return 'text-green-600';
    if (importance >= 0.6) return 'text-yellow-600';
    if (importance >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getImportanceLabel = (importance: number): string => {
    if (importance >= 0.8) return 'Muy Alta';
    if (importance >= 0.6) return 'Alta';
    if (importance >= 0.4) return 'Media';
    return 'Baja';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando Keyframes Inteligentes...
          </CardTitle>
          <CardDescription>
            Analizando los mejores momentos del tiro con IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              Detectando los momentos más importantes del lanzamiento...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Keyframes Inteligentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!keyframes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Keyframes Inteligentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No se encontraron keyframes inteligentes para este análisis.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Si no hay keyframes, mostrar mensaje informativo
  const totalKeyframes = Object.values(keyframes).reduce((sum, arr) => sum + arr.length, 0);
  if (totalKeyframes === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🧠 Keyframes Inteligentes</CardTitle>
          <CardDescription>
            Los mejores momentos del tiro detectados por IA (12 por ángulo)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay keyframes disponibles</h3>
            <p className="text-gray-600 mb-4">Los keyframes inteligentes no se pudieron generar para este análisis.</p>
            <div className="text-sm text-gray-500">
              <p>Esto puede deberse a:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Problemas técnicos durante el procesamiento</li>
                <li>Videos muy cortos o de baja calidad</li>
                <li>Error en la extracción de frames</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableAngles = Object.entries(keyframes)
    .filter(([_, frames]) => frames.length > 0)
    .map(([angle, _]) => angle as keyof SmartKeyframes);

  const currentFrames = keyframes[selectedAngle] || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🧠 Keyframes Inteligentes</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoPlay(!autoPlay)}
            >
              {autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoPlay ? 'Pausar' : 'Reproducir'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFrame(0)}
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Los mejores momentos del tiro detectados por IA (12 por ángulo)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedAngle} onValueChange={(value) => {
          setSelectedAngle(value as keyof SmartKeyframes);
          setSelectedFrame(0);
        }}>
          <TabsList className="grid w-full grid-cols-4">
            {availableAngles.map((angle) => (
              <TabsTrigger key={angle} value={angle} className="capitalize">
                {angle === 'back' ? 'Trasera' : 
                 angle === 'front' ? 'Frontal' :
                 angle === 'left' ? 'Izquierda' : 'Derecha'}
                <Badge variant="secondary" className="ml-2">
                  {keyframes[angle].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {availableAngles.map((angle) => (
            <TabsContent key={angle} value={angle} className="space-y-4">
              {currentFrames.length > 0 && (
                <>
                  {/* Frame principal */}
                  <div className="relative">
                    <img
                      src={getImageUrl(currentFrames[selectedFrame])}
                      alt={`Frame ${selectedFrame + 1}`}
                      className="w-full h-64 object-cover rounded-lg border"
                    />
                    <div className="absolute top-2 left-2 flex gap-2">
                      <Badge className={phaseColors[currentFrames[selectedFrame].phase]}>
                        {phaseNames[currentFrames[selectedFrame].phase]}
                      </Badge>
                      <Badge variant="outline">
                        {currentFrames[selectedFrame].timestamp.toFixed(1)}s
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge 
                        variant="outline" 
                        className={getImportanceColor(currentFrames[selectedFrame].importance)}
                      >
                        {getImportanceLabel(currentFrames[selectedFrame].importance)}
                      </Badge>
                    </div>
                  </div>

                  {/* Información del frame */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">
                      {currentFrames[selectedFrame].description}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Frame {selectedFrame + 1} de {currentFrames.length} • 
                      Importancia: {(currentFrames[selectedFrame].importance * 100).toFixed(1)}%
                    </p>
                  </div>

                  {/* Navegación de frames */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFrame(Math.max(0, selectedFrame - 1))}
                      disabled={selectedFrame === 0}
                    >
                      Anterior
                    </Button>
                    
                    <div className="flex gap-1">
                      {currentFrames.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedFrame(index)}
                          className={`w-3 h-3 rounded-full transition-colors ${
                            index === selectedFrame 
                              ? 'bg-primary' 
                              : 'bg-muted hover:bg-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFrame(Math.min(currentFrames.length - 1, selectedFrame + 1))}
                      disabled={selectedFrame === currentFrames.length - 1}
                    >
                      Siguiente
                    </Button>
                  </div>

                  {/* Grid de todos los frames */}
                  <div className="grid grid-cols-4 gap-2">
                    {currentFrames.map((frame, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedFrame(index)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedFrame 
                            ? 'border-primary ring-2 ring-primary/20' 
                            : 'border-muted hover:border-muted-foreground'
                        }`}
                      >
                        <img
                          src={getImageUrl(frame)}
                          alt={`Frame ${index + 1}`}
                          className="w-full h-16 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1">
                          <div className="flex justify-between items-center">
                            <span>{frame.timestamp.toFixed(1)}s</span>
                            <Badge 
                              size="sm" 
                              className={`text-xs ${
                                frame.importance >= 0.8 ? 'bg-green-500' :
                                frame.importance >= 0.6 ? 'bg-yellow-500' :
                                frame.importance >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                            >
                              {(frame.importance * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
