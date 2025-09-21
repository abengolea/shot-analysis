"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export default function TestAIPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testWithAI = async () => {
    if (!videoUrl) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/test-ai-validation', {
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
      setResult({ error: 'Error al procesar el video con IA' });
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'PROCEED': return 'default';
      case 'REJECT': return 'destructive';
      case 'REVIEW': return 'secondary';
      default: return 'outline';
    }
  };

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'PROCEED': return 'APROBAR';
      case 'REJECT': return 'RECHAZAR';
      case 'REVIEW': return 'REVISAR';
      default: return 'DESCONOCIDO';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>🤖 Análisis de Contenido con IA Real</CardTitle>
          <p className="text-muted-foreground">
            La IA analiza el contenido real del video para determinar si es baloncesto
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL del Video:</label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
            />
          </div>
          
          <Button 
            onClick={testWithAI} 
            disabled={loading || !videoUrl}
            className="w-full"
          >
            {loading ? 'Analizando con IA...' : 'Analizar Video con IA'}
          </Button>

          <div className="space-y-2">
            <h3 className="font-medium">Ejemplos para probar:</h3>
            <div className="grid gap-2 text-sm">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setVideoUrl('https://example.com/party-celebration.mp4')}
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
                onClick={() => setVideoUrl('https://example.com/football-game.mp4')}
              >
                ⚽ Video de fútbol (debería rechazar)
              </Button>
            </div>
          </div>

          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Resultado del Análisis con IA
                  {result.summary && (
                    <Badge variant={getRecommendationColor(result.summary.recommendation)}>
                      {getRecommendationText(result.summary.recommendation)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.success ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Resumen</h4>
                        <p><strong>Es baloncesto:</strong> {result.summary.isBasketball ? '✅ SÍ' : '❌ NO'}</p>
                        <p><strong>Confianza:</strong> 
                          <span className={getConfidenceColor(result.summary.confidence)}>
                            {result.summary.confidence}%
                          </span>
                        </p>
                        <p><strong>Recomendación:</strong> {getRecommendationText(result.summary.recommendation)}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Análisis Detallado</h4>
                        <p><strong>Razón:</strong> {result.aiAnalysis.reason}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Descripción del Video</h4>
                      <Textarea 
                        value={result.aiAnalysis.videoDescription} 
                        readOnly 
                        className="min-h-[80px]"
                      />
                    </div>

                    {result.aiAnalysis.detectedElements.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Elementos Detectados</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.aiAnalysis.detectedElements.map((element: string, index: number) => (
                            <Badge key={index} variant="outline">{element}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.aiAnalysis.basketballIndicators.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-green-600">✅ Indicadores de Baloncesto</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.aiAnalysis.basketballIndicators.map((indicator: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-green-600 border-green-600">
                              {indicator}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.aiAnalysis.nonBasketballIndicators.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-red-600">❌ Indicadores NO de Baloncesto</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.aiAnalysis.nonBasketballIndicators.map((indicator: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-red-600 border-red-600">
                              {indicator}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-blue-800">
                        <strong>🤖 Este análisis fue realizado por IA real</strong> que examina el contenido del video, 
                        no solo palabras clave en la URL.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-red-600">❌ Error: {result.error}</p>
                    {result.details && (
                      <details className="text-sm text-gray-600">
                        <summary>Detalles del error</summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                          {result.details}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
