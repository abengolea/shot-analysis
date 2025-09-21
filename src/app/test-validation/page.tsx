"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestValidationPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testVideo = async () => {
    if (!videoUrl) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/validate-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          shotType: 'Lanzamiento de prueba'
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Error al procesar el video' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rejected': return 'destructive';
      case 'approved': return 'default';
      case 'review': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'rejected': return 'RECHAZADO';
      case 'approved': return 'APROBADO';
      case 'review': return 'REVISIÓN';
      default: return 'DESCONOCIDO';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Prueba de Validación de Contenido</CardTitle>
          <p className="text-muted-foreground">
            Prueba la validación de contenido de videos localmente
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL del Video:</label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/party-video.mp4"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={testVideo} 
              disabled={loading || !videoUrl}
              className="flex-1"
            >
              {loading ? 'Procesando...' : 'Probar Validación'}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Ejemplos para probar:</h3>
            <div className="grid gap-2 text-sm">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setVideoUrl('https://example.com/party-video.mp4')}
              >
                🎉 Video de fiesta (debería rechazar)
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setVideoUrl('https://example.com/basketball-shot.mp4')}
              >
                🏀 Video de baloncesto (debería aprobar)
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setVideoUrl('https://example.com/sports-video.mp4')}
              >
                ❓ Video ambiguo (debería requerir revisión)
              </Button>
            </div>
          </div>

          {result && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Resultado
                  {result.status && (
                    <Badge variant={getStatusColor(result.status)}>
                      {getStatusText(result.status)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.success ? (
                  <div className="space-y-2">
                    <p><strong>Mensaje:</strong> {result.message}</p>
                    {result.reason && <p><strong>Razón:</strong> {result.reason}</p>}
                    <p><strong>ID del Análisis:</strong> {result.analysisId}</p>
                    {result.status === 'approved' && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-green-800">
                          ✅ Este video sería analizado con IA real
                        </p>
                      </div>
                    )}
                    {result.status === 'rejected' && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-800">
                          ❌ Este video sería rechazado automáticamente
                        </p>
                      </div>
                    )}
                    {result.status === 'review' && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-yellow-800">
                          ⚠️ Este video requeriría revisión manual
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-red-600">Error: {result.error}</p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
