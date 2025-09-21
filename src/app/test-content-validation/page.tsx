'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationResult {
  success: boolean;
  testType: string;
  videoName: string;
  result: {
    isBasketballContent: boolean;
    confidence: number;
    recommendation: 'PROCEED' | 'REJECT' | 'REVIEW';
    reason: string;
    detectedElements: string[];
    nonBasketballIndicators: string[];
  };
  timestamp: string;
  error?: string;
}

export default function TestContentValidationPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleTest = async () => {
    if (!videoFile) return;

    setTesting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-content-validation', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error en prueba:', error);
      setResult({
        success: false,
        testType: 'validación de contenido',
        videoName: videoFile.name,
        result: {
          isBasketballContent: false,
          confidence: 0,
          recommendation: 'REJECT',
          reason: 'Error en la validación',
          detectedElements: [],
          nonBasketballIndicators: ['Error técnico']
        },
        timestamp: new Date().toISOString(),
        error: 'Error de conexión'
      });
    } finally {
      setTesting(false);
    }
  };

  const getResultIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'PROCEED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'REJECT':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'REVIEW':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getResultColor = (recommendation: string) => {
    switch (recommendation) {
      case 'PROCEED':
        return 'border-green-200 bg-green-50';
      case 'REJECT':
        return 'border-red-200 bg-red-50';
      case 'REVIEW':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prueba de Validación de Contenido</h1>
        <p className="text-muted-foreground">
          Prueba el sistema de validación automática de contenido de baloncesto.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Configuración de Prueba */}
        <Card>
          <CardHeader>
            <CardTitle>Configurar Prueba</CardTitle>
            <CardDescription>
              Sube un video para probar la validación automática de contenido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="videoFile">Video a Validar</Label>
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
              <p className="text-xs text-muted-foreground mt-1">
                Sube cualquier video para ver si el sistema lo detecta como baloncesto o no
              </p>
            </div>

            <Button 
              onClick={handleTest} 
              disabled={!videoFile || testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando Contenido...
                </>
              ) : (
                'Validar Contenido'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {result && (
          <Card className={getResultColor(result.result.recommendation)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getResultIcon(result.result.recommendation)}
                Resultado de la Validación
              </CardTitle>
              <CardDescription>
                Video: {result.videoName} • {new Date(result.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border">
                  <div className="text-2xl font-bold">
                    {result.result.isBasketballContent ? '✅ SÍ' : '❌ NO'}
                  </div>
                  <div className="text-sm text-muted-foreground">Es Baloncesto</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <div className="text-2xl font-bold">
                    {Math.round(result.result.confidence * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Confianza</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <div className="text-lg font-bold">
                    {result.result.recommendation}
                  </div>
                  <div className="text-sm text-muted-foreground">Recomendación</div>
                </div>
              </div>

              {/* Razón */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Razón:</strong> {result.result.reason}
                </AlertDescription>
              </Alert>

              {/* Elementos Detectados */}
              {result.result.detectedElements.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">✅ Elementos de Baloncesto Detectados:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.result.detectedElements.map((element, index) => (
                      <li key={index} className="text-sm">{element}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Indicadores No-Baloncesto */}
              {result.result.nonBasketballIndicators.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">❌ Indicadores NO de Baloncesto:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.result.nonBasketballIndicators.map((indicator, index) => (
                      <li key={index} className="text-sm">{indicator}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error */}
              {result.error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {result.error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Instrucciones */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tipos de Videos para Probar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-600 mb-2">✅ Deberían APROBAR:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Tiros al aro de baloncesto</li>
                <li>• Jugadores practicando tiros</li>
                <li>• Partidos de baloncesto</li>
                <li>• Entrenamientos de tiro</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-600 mb-2">❌ Deberían RECHAZAR:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Videos de fiestas/baile</li>
                <li>• Fútbol u otros deportes</li>
                <li>• Videos de música</li>
                <li>• Contenido no deportivo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
