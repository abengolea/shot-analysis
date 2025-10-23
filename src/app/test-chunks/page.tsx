'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestChunksPage() {
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

      const response = await fetch('/api/test-chunks', {
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
      <h1 className="text-3xl font-bold mb-6">🧪 Prueba por Chunks - Solución al Problema</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subir Video para Análisis por Chunks</CardTitle>
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
              {isAnalyzing ? '🔍 Analizando por chunks...' : '🎯 Analizar por Chunks (5s cada uno)'}
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
              <CardTitle className="text-green-600">✅ Resultado de Análisis por Chunks</CardTitle>
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
                  <strong>📊 Chunks Analizados:</strong> {result.video_info?.chunks_analizados || 'N/A'}
                </div>
                <div>
                  <strong>✅ Chunks Exitosos:</strong> {result.resumen?.chunks_exitosos || 'N/A'}
                </div>
                <div>
                  <strong>❌ Chunks con Error:</strong> {result.resumen?.chunks_con_error || 'N/A'}
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
              
              <div className="mt-4">
                <strong>💡 Ventaja:</strong>
                <p className="text-gray-600 mt-1">
                  {result.resumen?.ventaja || 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📊 Análisis por Chunks (5 segundos cada uno)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.chunks?.map((chunk: any, index: number) => (
                  <div key={index} className={`flex justify-between items-center p-3 rounded ${
                    chunk.shots > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div>
                      <strong>Chunk {chunk.chunk}:</strong> {chunk.startTime}s - {chunk.endTime}s
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${chunk.shots > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {chunk.shots} tiros
                      </div>
                      <div className="text-sm text-gray-500">{chunk.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500">
            <CardHeader>
              <CardTitle className="text-blue-600">🎯 Comparación con Método Anterior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>🔴 Método Anterior (IA completa):</strong>
                  <ul className="mt-2 text-sm text-gray-600">
                    <li>• Solo 7.5 segundos detectados</li>
                    <li>• Solo 6 tiros detectados</li>
                    <li>• Video incompleto procesado</li>
                  </ul>
                </div>
                <div>
                  <strong>🟢 Método Chunks (5s cada uno):</strong>
                  <ul className="mt-2 text-sm text-gray-600">
                    <li>• {result.video_info?.duracion_real?.toFixed(1) || 'N/A'} segundos procesados</li>
                    <li>• {result.video_info?.tiros_detectados_total || 'N/A'} tiros detectados</li>
                    <li>• Video completo analizado</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-green-50 rounded">
                <strong>✅ SOLUCIÓN ENCONTRADA:</strong>
                <p className="mt-2 text-green-700">
                  Dividir el video en chunks pequeños evita los límites de procesamiento de la IA. 
                  Ahora podemos analizar videos completos y detectar todos los tiros.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


