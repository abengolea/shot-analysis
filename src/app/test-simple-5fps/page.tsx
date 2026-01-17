'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestSimple5FpsPage() {
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

      const response = await fetch('/api/test-simple-5fps', {
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
      <h1 className="text-3xl font-bold mb-6">🎬 Prueba Simple 5 FPS</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subir Video para Análisis Simple 5 FPS</CardTitle>
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
              {isAnalyzing ? '🎬 Procesando y analizando...' : '🎯 Analizar Simple 5 FPS'}
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
              <CardTitle className="text-green-600">✅ Resultado de Análisis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>🎯 Tiros Detectados:</strong> {result.video_info?.tiros_detectados || 'N/A'}
                </div>
                <div>
                  <strong>⏱️ Duración Detectada:</strong> {result.video_info?.duracion_detectada_ia || 'N/A'}
                </div>
                <div>
                  <strong>🎬 FPS Procesado:</strong> {result.video_info?.fps_procesado || 'N/A'}
                </div>
                <div>
                  <strong>📐 Resolución:</strong> {result.video_info?.resolucion_procesada || 'N/A'}
                </div>
                <div>
                  <strong>📁 Archivo:</strong> {result.video_info?.archivo_original || 'N/A'}
                </div>
                <div>
                  <strong>📊 Tamaño:</strong> {result.video_info?.tamaño_original ? `${(result.video_info.tamaño_original / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                </div>
              </div>
              
              <div className="mt-4">
                <strong>📝 Método:</strong>
                <p className="text-gray-600 mt-1">
                  {result.resumen?.metodo || 'N/A'}
                </p>
              </div>
              
              {result.resumen?.warning && (
                <div className="mt-4 p-4 bg-yellow-50 rounded">
                  <strong>⚠️ Advertencia:</strong>
                  <p className="text-yellow-700 mt-1">
                    {result.resumen.warning}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔍 Análisis Completo de la IA</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(result.analysis, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
















