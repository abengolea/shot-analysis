'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, CheckCircle, AlertCircle, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Test22ParametersPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [ageCategory, setAgeCategory] = useState('');
  const [playerLevel, setPlayerLevel] = useState('');
  const [shotType, setShotType] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile || !ageCategory || !playerLevel || !shotType || !playerId) {
      setError('Todos los campos son requeridos');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('ageCategory', ageCategory);
      formData.append('playerLevel', playerLevel);
      formData.append('shotType', shotType);
      formData.append('playerId', playerId);

      const response = await fetch('/api/test-22-parameters', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(300000), // 5 minutos
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el análisis');
      }

      setResult(data);
      toast({
        title: 'Análisis de 22 parámetros completado',
        description: 'El video ha sido analizado y guardado en el historial',
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prueba Análisis 22 Parámetros</h1>
        <p className="text-muted-foreground">
          Analiza un video con los 22 parámetros técnicos y guárdalo en el historial
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Subir Video</CardTitle>
            <CardDescription>
              Selecciona un video y completa los datos para el análisis de 22 parámetros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="video">Video de Baloncesto</Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="mt-1"
                />
                {videoFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Archivo: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="playerId">ID del Jugador</Label>
                <Input
                  id="playerId"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  placeholder="Ej: player123"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ageCategory">Categoría de Edad</Label>
                <Select value={ageCategory} onValueChange={setAgeCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sub-11">Sub-11</SelectItem>
                    <SelectItem value="Sub-13">Sub-13</SelectItem>
                    <SelectItem value="Sub-15">Sub-15</SelectItem>
                    <SelectItem value="Sub-17">Sub-17</SelectItem>
                    <SelectItem value="Sub-21">Sub-21</SelectItem>
                    <SelectItem value="Amateur adulto">Amateur adulto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="playerLevel">Nivel del Jugador</Label>
                <Select value={playerLevel} onValueChange={setPlayerLevel} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Principiante">Principiante</SelectItem>
                    <SelectItem value="Intermedio">Intermedio</SelectItem>
                    <SelectItem value="Avanzado">Avanzado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="shotType">Tipo de Tiro</Label>
                <Select value={shotType} onValueChange={setShotType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo de tiro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tiro Libre">Tiro Libre</SelectItem>
                    <SelectItem value="Lanzamiento de Media Distancia (Jump Shot)">Media Distancia</SelectItem>
                    <SelectItem value="Lanzamiento de Tres">Lanzamiento de Tres</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !videoFile}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizando 22 parámetros...
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    Analizar y Guardar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              Resultado del análisis de 22 parámetros y guardado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Procesando... (puede tomar hasta 2 minutos)</span>
              </div>
            )}

            {error && (
              <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <div>
                  <p className="font-medium text-red-800">Error</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <div>
                    <p className="font-medium text-green-800">Análisis Completado</p>
                    <p className="text-green-600 text-sm">22 parámetros analizados y guardados</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Información del Análisis:</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>ID:</strong> {result.analysisId}</p>
                    <p><strong>Video URL:</strong> 
                      <a 
                        href={result.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                      >
                        Ver video
                      </a>
                    </p>
                  </div>
                </div>

                {/* Verificación Anti-Simulación */}
                {result.analysis?.videoVerification && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Verificación de Video Real:</h4>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Ropa del jugador:</strong> {result.analysis.videoVerification.verification?.player_clothing || 'No especificado'}</p>
                          <p><strong>Tiros detectados:</strong> {result.analysis.videoVerification.verification?.shots_count || 'No especificado'}</p>
                          <p><strong>Canasta visible:</strong> {result.analysis.videoVerification.verification?.basket_visible ? 'Sí' : 'No'}</p>
                          <p><strong>Ángulo cámara:</strong> {result.analysis.videoVerification.verification?.camera_angle || 'No especificado'}</p>
                        </div>
                        <div>
                          <p><strong>Entorno:</strong> {result.analysis.videoVerification.verification?.environment || 'No especificado'}</p>
                          <p><strong>Mano de tiro:</strong> {result.analysis.videoVerification.verification?.player_hand || 'No especificado'}</p>
                          <p><strong>Salta:</strong> {result.analysis.videoVerification.verification?.jumps ? 'Sí' : 'No'}</p>
                          <p><strong>Confianza:</strong> {result.analysis.videoVerification.reality_check?.confidence || 0}%</p>
                        </div>
                      </div>
                      {result.analysis.videoVerification.reality_check?.suspicious_elements?.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-100 rounded">
                          <p className="text-yellow-800 text-xs">
                            <strong>Elementos sospechosos:</strong> {result.analysis.videoVerification.reality_check.suspicious_elements.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Descripción Natural */}
                {result.analysis?.natural_description && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Descripción del Video:</h4>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">{result.analysis.natural_description}</p>
                    </div>
                  </div>
                )}

                {/* Análisis de 22 Parámetros */}
                {result.analysis && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Análisis de 22 Parámetros:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <Textarea
                        value={JSON.stringify(result.analysis, null, 2)}
                        readOnly
                        className="min-h-[200px] text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && !result && (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sube un video para comenzar el análisis de 22 parámetros</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
