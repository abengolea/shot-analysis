'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestDebugPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isDebugging, setIsDebugging] = useState(false);
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

    setIsDebugging(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-debug', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el debug');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Debug Completo - Diagnóstico del Problema</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subir Video para Debug</CardTitle>
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
              disabled={!videoFile || isDebugging}
              className="w-full"
            >
              {isDebugging ? '🔍 Debuggeando...' : '🎯 Iniciar Debug Completo'}
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
          <Card className={result.success ? "border-green-500" : "border-red-500"}>
            <CardHeader>
              <CardTitle className={result.success ? "text-green-600" : "text-red-600"}>
                {result.success ? "✅ Debug Exitoso" : "❌ Debug Falló"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>📁 Archivo:</strong> {result.debug_info?.archivo?.name}
                </div>
                <div>
                  <strong>📊 Tamaño:</strong> {result.debug_info?.archivo?.size} bytes
                </div>
                <div>
                  <strong>🎬 Tipo:</strong> {result.debug_info?.archivo?.type}
                </div>
                <div>
                  <strong>☁️ Firebase:</strong> {result.debug_info?.firebase?.uploaded ? "✅ Subido" : "❌ Error"}
                </div>
                <div>
                  <strong>🤖 IA:</strong> {result.debug_info?.ia?.responded ? "✅ Respondió" : "❌ Falló"}
                </div>
                <div>
                  <strong>⏱️ Duración:</strong> {result.debug_info?.ia?.duracion || "N/A"}
                </div>
                <div>
                  <strong>🎯 Tiros:</strong> {result.debug_info?.ia?.tiros || "N/A"}
                </div>
              </div>
              
              {result.debug_info?.ia?.error && (
                <div className="mt-4 p-4 bg-red-50 rounded">
                  <strong>❌ Error de la IA:</strong>
                  <p className="mt-2 text-red-700 font-mono text-sm">
                    {result.debug_info.ia.error}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {result.analysis && (
            <Card>
              <CardHeader>
                <CardTitle>📊 Análisis Completo de la IA</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                  {JSON.stringify(result.analysis, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>🔍 Información de Debug</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(result.debug_info, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}




