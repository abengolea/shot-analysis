'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Loader2, Target, Zap, Eye, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RealityTestResult {
  success: boolean;
  videoName: string;
  testType: string;
  results: {
    prompt1: {
      shotType: string;
      response: string;
      timestamp: string;
    };
    prompt2: {
      shotType: string;
      response: string;
      timestamp: string;
    };
    prompt3: {
      shotType: string;
      response: string;
      timestamp: string;
    };
  };
  analysis: {
    isSimulating: boolean;
    evidence: string[];
    confidence: number;
  };
  timestamp: string;
  error?: string;
}

export default function TestAnalysisRealityPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<RealityTestResult | null>(null);

  const handleTest = async () => {
    if (!videoFile) return;

    setTesting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-analysis-reality', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error en prueba de realidad:', error);
      setResult({
        success: false,
        videoName: videoFile.name,
        testType: 'prueba de realidad',
        results: {
          prompt1: { shotType: '', response: '', timestamp: '' },
          prompt2: { shotType: '', response: '', timestamp: '' },
          prompt3: { shotType: '', response: '', timestamp: '' }
        },
        analysis: {
          isSimulating: true,
          evidence: ['Error de conexión'],
          confidence: 1.0
        },
        timestamp: new Date().toISOString(),
        error: 'Error de conexión'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prueba de Realidad del Análisis</h1>
        <p className="text-muted-foreground">
          Verifica si Gemini está realmente analizando el video o simulando resultados.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Configuración de Prueba */}
        <Card>
          <CardHeader>
            <CardTitle>Configurar Prueba de Realidad</CardTitle>
            <CardDescription>
              Sube un video y veremos si Gemini da respuestas consistentes o diferentes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="videoFile">Video a Analizar</Label>
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
                Mismo video será analizado 3 veces con prompts diferentes
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
                  Probando Realidad del Análisis...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Iniciar Prueba de Realidad
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {result && (
          <div className="space-y-6">
            {/* Análisis de Realidad */}
            <Card className={result.analysis.isSimulating ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.analysis.isSimulating ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  Análisis de Realidad
                </CardTitle>
                <CardDescription>
                  Video: {result.videoName} • {new Date(result.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {result.analysis.isSimulating ? '⚠️ POSIBLEMENTE SIMULANDO' : '✅ ANALIZANDO REALIDAD'}
                    </h4>
                    <div className="text-2xl font-bold mb-2">
                      {Math.round(result.analysis.confidence * 100)}% Confianza
                    </div>
                    <Badge variant={result.analysis.isSimulating ? 'destructive' : 'default'}>
                      {result.analysis.isSimulating ? 'SIMULACIÓN DETECTADA' : 'ANÁLISIS REAL'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Evidencia:</h4>
                    <ul className="space-y-1">
                      {result.analysis.evidence.map((evidence, index) => (
                        <li key={index} className="text-sm flex items-center gap-2">
                          {result.analysis.isSimulating ? (
                            <XCircle className="h-3 w-3 text-red-500" />
                          ) : (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resultados de las 3 Pruebas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Prueba 1 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Prueba 1: Tiro Libre
                  </CardTitle>
                  <CardDescription>
                    Le dijimos que era un tiro libre
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">Tipo de tiro:</span>
                      <Badge variant="outline" className="ml-2">
                        {result.results.prompt1.shotType}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Respuesta:</span>
                      <p className="text-sm text-muted-foreground mt-1 p-2 bg-gray-50 rounded">
                        {result.results.prompt1.response}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(result.results.prompt1.timestamp).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prueba 2 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Prueba 2: Tiro de Media Distancia
                  </CardTitle>
                  <CardDescription>
                    Le dijimos que era un tiro de media distancia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">Tipo de tiro:</span>
                      <Badge variant="outline" className="ml-2">
                        {result.results.prompt2.shotType}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Respuesta:</span>
                      <p className="text-sm text-muted-foreground mt-1 p-2 bg-gray-50 rounded">
                        {result.results.prompt2.response}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(result.results.prompt2.timestamp).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prueba 3 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Prueba 3: Tiro de Tres Puntos
                  </CardTitle>
                  <CardDescription>
                    Le dijimos que era un tiro de tres puntos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">Tipo de tiro:</span>
                      <Badge variant="outline" className="ml-2">
                        {result.results.prompt3.shotType}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Respuesta:</span>
                      <p className="text-sm text-muted-foreground mt-1 p-2 bg-gray-50 rounded">
                        {result.results.prompt3.response}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(result.results.prompt3.timestamp).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error */}
            {result.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {result.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Cómo Funciona la Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">🧪 Prueba de Control:</h4>
              <p className="text-sm text-muted-foreground">
                El mismo video se analiza 3 veces, pero le decimos que es diferentes tipos de tiro.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">✅ Si está analizando REALIDAD:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Las respuestas serán similares (mismo video)</li>
                <li>• Los scores técnicos serán consistentes</li>
                <li>• Solo cambiarán detalles específicos del tipo de tiro</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">❌ Si está SIMULANDO:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Las respuestas serán muy diferentes</li>
                <li>• Scores completamente distintos para el mismo video</li>
                <li>• Inventará detalles que no están en el video</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

