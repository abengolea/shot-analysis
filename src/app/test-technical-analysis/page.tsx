'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Loader2, Target, Zap, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface TechnicalAnalysisResult {
  success: boolean;
  videoName: string;
  result: {
    // Preparación (6 parámetros)
    preparacion: {
      alineacion_pies: { score: number; feedback: string };
      alineacion_cuerpo: { score: number; feedback: string };
      muneca_cargada: { score: number; feedback: string };
      flexion_rodillas: { score: number; feedback: string };
      hombros_relajados: { score: number; feedback: string };
      mirada_enfoque: { score: number; feedback: string };
    };
    // Ascenso (6 parámetros)
    ascenso: {
      mano_guia: { score: number; feedback: string };
      codos_cuerpo: { score: number; feedback: string };
      balon_recto: { score: number; feedback: string };
      trayectoria_suave: { score: number; feedback: string };
      set_point: { score: number; feedback: string };
      timing: { score: number; feedback: string };
    };
    // Fluidez (2 parámetros)
    fluidez: {
      movimiento_continuo: { score: number; feedback: string };
      sincronizacion: { score: number; feedback: string };
    };
    // Liberación (4 parámetros)
    liberacion: {
      mano_guia_retira: { score: number; feedback: string };
      extension_completa: { score: number; feedback: string };
      muneca_snap: { score: number; feedback: string };
      angulo_salida: { score: number; feedback: string };
    };
    // Seguimiento (4 parámetros)
    seguimiento: {
      follow_through: { score: number; feedback: string };
      equilibrio_aterrizaje: { score: number; feedback: string };
      duracion_follow: { score: number; feedback: string };
      consistencia: { score: number; feedback: string };
    };
    score_global: number;
    principales_mejoras: string[];
    principales_fortalezas: string[];
  };
  timestamp: string;
  error?: string;
}

export default function TestTechnicalAnalysisPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TechnicalAnalysisResult | null>(null);

  const handleTest = async () => {
    if (!videoFile) return;

    setTesting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-technical-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error en análisis técnico:', error);
      setResult({
        success: false,
        videoName: videoFile.name,
        result: {
          preparacion: {
            alineacion_pies: { score: 0, feedback: 'Error en análisis' },
            alineacion_cuerpo: { score: 0, feedback: 'Error en análisis' },
            muneca_cargada: { score: 0, feedback: 'Error en análisis' },
            flexion_rodillas: { score: 0, feedback: 'Error en análisis' },
            hombros_relajados: { score: 0, feedback: 'Error en análisis' },
            mirada_enfoque: { score: 0, feedback: 'Error en análisis' },
          },
          ascenso: {
            mano_guia: { score: 0, feedback: 'Error en análisis' },
            codos_cuerpo: { score: 0, feedback: 'Error en análisis' },
            balon_recto: { score: 0, feedback: 'Error en análisis' },
            trayectoria_suave: { score: 0, feedback: 'Error en análisis' },
            set_point: { score: 0, feedback: 'Error en análisis' },
            timing: { score: 0, feedback: 'Error en análisis' },
          },
          fluidez: {
            movimiento_continuo: { score: 0, feedback: 'Error en análisis' },
            sincronizacion: { score: 0, feedback: 'Error en análisis' },
          },
          liberacion: {
            mano_guia_retira: { score: 0, feedback: 'Error en análisis' },
            extension_completa: { score: 0, feedback: 'Error en análisis' },
            muneca_snap: { score: 0, feedback: 'Error en análisis' },
            angulo_salida: { score: 0, feedback: 'Error en análisis' },
          },
          seguimiento: {
            follow_through: { score: 0, feedback: 'Error en análisis' },
            equilibrio_aterrizaje: { score: 0, feedback: 'Error en análisis' },
            duracion_follow: { score: 0, feedback: 'Error en análisis' },
            consistencia: { score: 0, feedback: 'Error en análisis' },
          },
          score_global: 0,
          principales_mejoras: ['Error en análisis'],
          principales_fortalezas: ['Error en análisis']
        },
        timestamp: new Date().toISOString(),
        error: 'Error de conexión'
      });
    } finally {
      setTesting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (score >= 6) return <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>;
    return <Badge className="bg-red-100 text-red-800">Necesita Mejora</Badge>;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Análisis Técnico de Lanzamiento</h1>
        <p className="text-muted-foreground">
          Prueba la precisión de Gemini en el análisis de los 22 parámetros técnicos del lanzamiento de baloncesto.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Configuración de Prueba */}
        <Card>
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
              <p className="text-xs text-muted-foreground mt-1">
                Sube un video que muestre claramente un lanzamiento de baloncesto
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
                  Analizando 22 Parámetros Técnicos...
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

        {/* Resultados */}
        {result && (
          <div className="space-y-6">
            {/* Resumen General */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Resumen del Análisis
                </CardTitle>
                <CardDescription>
                  Video: {result.videoName} • {new Date(result.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {result.result.score_global.toFixed(1)}/10
                    </div>
                    <div className="text-sm text-muted-foreground">Score Global</div>
                    <Progress value={result.result.score_global * 10} className="mt-2" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-green-600">Fortalezas:</h4>
                    <ul className="text-sm space-y-1">
                      {result.result.principales_fortalezas.map((fortaleza, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {fortaleza}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">Mejoras:</h4>
                    <ul className="text-sm space-y-1">
                      {result.result.principales_mejoras.map((mejora, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <XCircle className="h-3 w-3 text-red-500" />
                          {mejora}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Análisis por Categorías */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Preparación */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Preparación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(result.result.preparacion).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(value.score)}`}>
                            {value.score}/10
                          </span>
                          {getScoreBadge(value.score)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{value.feedback}</p>
                      <Progress value={value.score * 10} className="h-1" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Ascenso */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Ascenso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(result.result.ascenso).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(value.score)}`}>
                            {value.score}/10
                          </span>
                          {getScoreBadge(value.score)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{value.feedback}</p>
                      <Progress value={value.score * 10} className="h-1" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Fluidez */}
              <Card>
                <CardHeader>
                  <CardTitle>Fluidez</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(result.result.fluidez).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(value.score)}`}>
                            {value.score}/10
                          </span>
                          {getScoreBadge(value.score)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{value.feedback}</p>
                      <Progress value={value.score * 10} className="h-1" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Liberación */}
              <Card>
                <CardHeader>
                  <CardTitle>Liberación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(result.result.liberacion).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(value.score)}`}>
                            {value.score}/10
                          </span>
                          {getScoreBadge(value.score)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{value.feedback}</p>
                      <Progress value={value.score * 10} className="h-1" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Seguimiento */}
            <Card>
              <CardHeader>
                <CardTitle>Seguimiento / Post-liberación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(result.result.seguimiento).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(value.score)}`}>
                            {value.score}/10
                          </span>
                          {getScoreBadge(value.score)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{value.feedback}</p>
                      <Progress value={value.score * 10} className="h-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
          <CardTitle>Parámetros Técnicos Analizados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Preparación (6):</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Alineación de pies</li>
                <li>• Alineación del cuerpo</li>
                <li>• Muñeca cargada</li>
                <li>• Flexión de rodillas</li>
                <li>• Hombros relajados</li>
                <li>• Mirada enfocada</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Ascenso (6):</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Mano guía</li>
                <li>• Codos cerca del cuerpo</li>
                <li>• Balón en línea recta</li>
                <li>• Trayectoria suave</li>
                <li>• Set point</li>
                <li>• Timing correcto</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Fluidez (2):</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Movimiento continuo</li>
                <li>• Sincronización</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Liberación (4):</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Mano guía se retira</li>
                <li>• Extensión completa</li>
                <li>• Muñeca con snap</li>
                <li>• Ángulo de salida</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Seguimiento (4):</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Follow-through</li>
                <li>• Equilibrio al aterrizar</li>
                <li>• Duración del follow</li>
                <li>• Consistencia</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
