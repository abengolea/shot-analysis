'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VerifySimplePage() {
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

      const response = await fetch('/api/verify-simple', {
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
      <h1 className="text-3xl font-bold mb-6">🔍 Verificación Simple del Video</h1>
      
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
              {isVerifying ? '🔍 Verificando...' : '🎯 Verificar Video'}
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
              <CardTitle className="text-blue-600">✅ Información del Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>📁 Archivo:</strong> {result.video_info?.archivo_original}
                </div>
                <div>
                  <strong>📊 Tamaño:</strong> {result.video_info?.tamaño_mb} MB
                </div>
                <div>
                  <strong>🎬 Tipo:</strong> {result.video_info?.tipo_archivo}
                </div>
                <div>
                  <strong>📅 Modificado:</strong> {new Date(result.video_info?.ultima_modificacion).toLocaleString()}
                </div>
                <div>
                  <strong>🔗 URL:</strong> 
                  <a href={result.video_info?.url_video} target="_blank" className="text-blue-500 hover:underline ml-2">
                    Ver video
                  </a>
                </div>
                <div>
                  <strong>✅ Buffer:</strong> {result.video_info?.buffer_vs_file}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500">
            <CardHeader>
              <CardTitle className="text-yellow-600">⚠️ Análisis del Problema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <strong>🔍 Problema Detectado:</strong>
                <p className="mt-1 text-gray-700">{result.analisis?.problema_detectado}</p>
              </div>
              <div>
                <strong>🎯 Posible Causa:</strong>
                <p className="mt-1 text-gray-700">{result.analisis?.posible_causa}</p>
              </div>
              <div>
                <strong>💡 Recomendación:</strong>
                <p className="mt-1 text-gray-700">{result.analisis?.recomendacion}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-600">📊 Comparación IA vs Realidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>⏱️ Duración IA:</strong> {result.comparacion?.duracion_ia_detectada}
                </div>
                <div>
                  <strong>⏱️ Duración Real:</strong> {result.comparacion?.duracion_real}
                </div>
                <div>
                  <strong>📊 Diferencia:</strong> {result.comparacion?.diferencia}
                </div>
                <div>
                  <strong>🎯 Tiros IA:</strong> {result.comparacion?.tiros_ia_detectados}
                </div>
                <div>
                  <strong>🎯 Tiros Esperados:</strong> {result.comparacion?.tiros_reales_esperados}
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-red-50 rounded">
                <strong>🚨 CONCLUSIÓN:</strong>
                <p className="mt-2 text-red-700">
                  La IA NO está viendo el video completo. Está procesando solo una parte del video, 
                  por eso detecta duración incorrecta y cuenta tiros incorrectamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
















