'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Target } from 'lucide-react';

export default function TestTechnicalAnalysisPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTest = async () => {
    if (!videoFile) return;

    setTesting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-technical-analysis-multiple', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'Error en la prueba' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prueba de Consistencia Técnica</h1>
        <p className="text-muted-foreground">
          Verifica si Gemini mide consistentemente los 22 parámetros técnicos del lanzamiento de baloncesto.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurar Análisis Técnico</CardTitle>
          <CardDescription>
            Sube un video de lanzamiento para analizar los 22 parámetros técnicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="videoFile">Video de Lanzamiento</Label>
            <Input
              id="videoFile"
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setVideoFile(file);
                }
              }}
              className="mt-1"
            />
          </div>

          <Button 
            onClick={handleTest} 
            disabled={!videoFile || testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Analizar Técnica Completa
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
