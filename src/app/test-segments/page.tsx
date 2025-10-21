'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestSegmentsPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('ageCategory', 'Sub-15');
      formData.append('playerLevel', 'Avanzado');
      formData.append('shotType', 'Lanzamiento de Tres');

      const response = await fetch('/api/test-segments', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el análisis');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">🧪 Prueba por Segmentos - Detección de Tiros</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subir Video</CardTitle>
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
              disabled={!videoFile || isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? '🔍 Analizando por segmentos...' : '🎯 Analizar por Segmentos'}
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
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="text-green-600">✅ Resultado de Análisis por Segmentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>🎯 Total de Tiros:</strong> {result.video_info?.tiros_detectados_total || 'N/A'}
                </div>
                <div>
                  <strong>⏱️ Duración Real:</strong> {result.video_info?.duracion_real ? `${result.video_info.duracion_real.toFixed(1)}s` : 'N/A'}
                </div>
                <div>
                  <strong>📊 Segmentos:</strong> {result.video_info?.segmentos_analizados || 'N/A'}
                </div>
                <div>
                  <strong>📁 Archivo:</strong> {result.video_info?.archivo_original || 'N/A'}
                </div>
              </div>
              
              <div className="mt-4">
                <strong>📝 Método:</strong>
                <p className="text-gray-600 mt-1">
                  {result.resumen?.metodo || 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📊 Análisis por Segmentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.segmentos?.map((segmento: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <strong>Segmento {segmento.segment}:</strong> {segmento.startTime}s - {segmento.endTime}s
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">{segmento.shots} tiros</div>
                      <div className="text-sm text-gray-500">{segmento.duration}</div>
                    </div>
                  </div>
                ))}
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

