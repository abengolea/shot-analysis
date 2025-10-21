'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VerifyVideoPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return;

    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/verify-video', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la verificación');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Verificación Real del Video</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subir Video para Verificación</CardTitle>
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
                required
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={!videoFile || isVerifying}
              className="w-full"
            >
              {isVerifying ? '🔍 Verificando video...' : '🎯 Verificar Video Real'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <div className="text-red-600">
              <strong>❌ Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          <Card className="border-blue-500">
            <CardHeader>
              <CardTitle className="text-blue-600">✅ Información Real del Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>⏱️ Duración Real:</strong> {result.video_info?.duracion_real_segundos?.toFixed(1)}s ({result.video_info?.duracion_real_minutos} min)
                </div>
                <div>
                  <strong>📐 Resolución:</strong> {result.video_info?.resolucion}
                </div>
                <div>
                  <strong>🎬 FPS:</strong> {result.video_info?.fps}
                </div>
                <div>
                  <strong>📊 Tamaño:</strong> {result.video_info?.tamaño_mb} MB
                </div>
                <div>
                  <strong>🔗 Bitrate:</strong> {result.video_info?.bitrate}
                </div>
                <div>
                  <strong>📁 Archivo:</strong> {result.video_info?.archivo_original}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-600">⚠️ Comparación IA vs Realidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-lg">
                <strong>🔍 Duración:</strong> {result.comparacion?.duracion_ia_vs_real}
              </div>
              <div className="text-lg">
                <strong>📊 Diferencia:</strong> {result.comparacion?.diferencia}
              </div>
              <div className="text-lg">
                <strong>❌ Error:</strong> {result.comparacion?.porcentaje_error}
              </div>
              
              <div className="mt-4 p-4 bg-yellow-50 rounded">
                <strong>🎯 CONCLUSIÓN:</strong>
                <p className="mt-2">
                  La IA está detectando incorrectamente la duración del video. 
                  Esto explica por qué no puede contar todos los tiros correctamente.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔍 Detalles Técnicos</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

