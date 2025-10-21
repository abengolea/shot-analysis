'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TestSimplePage() {
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

      const response = await fetch('/api/test-simple', {
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
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🧪 Prueba Simple - Detección de Tiros</h1>
      
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
              {isAnalyzing ? '🔍 Detectando tiros...' : '🎯 Detectar Tiros'}
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
        <Card className="mb-6 border-green-500">
          <CardHeader>
            <CardTitle className="text-green-600">✅ Resultado de Detección</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>🎯 Tiros Detectados:</strong> {result.analysis.verificacion_inicial?.tiros_detectados || 'N/A'}
              </div>
              <div>
                <strong>⏱️ Duración:</strong> {result.analysis.verificacion_inicial?.duracion_video || 'N/A'}
              </div>
              <div>
                <strong>📁 Archivo:</strong> {result.video_info?.archivo_original || 'N/A'}
              </div>
              <div>
                <strong>📊 Tamaño:</strong> {result.video_info?.tamaño ? `${(result.video_info.tamaño / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
              </div>
            </div>
            
            <div className="mt-4">
              <strong>📝 Resumen:</strong>
              <p className="text-gray-600 mt-1">
                {result.analysis.analysisSummary || 'N/A'}
              </p>
            </div>

            <div className="mt-4">
              <strong>🔍 Detalles Técnicos:</strong>
              <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-auto">
                {JSON.stringify(result.analysis, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

