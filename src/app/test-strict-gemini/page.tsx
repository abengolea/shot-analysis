'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Eye, Brain, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StrictAnalysisResult {
  success: boolean;
  visibility: {
    playerVisible: string;
    hoopVisible: string;
    ballVisible: string;
    videoQuality: string;
    cameraAngle: string;
  };
  preparation: {
    feetPosition: string;
    kneeFlexion: string;
    handPosition: string;
  };
  execution: {
    playerJumps: string;
    armExtension: string;
    movementDuration: string | number;
  };
  result: {
    shotOutcome: string;
    confidence: string;
  };
  isHallucinating?: boolean;
  testType?: string;
  videoUrl?: string;
  timestamp?: string;
  error?: string;
}

export default function TestStrictGeminiPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [testType, setTestType] = useState('party-video');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<StrictAnalysisResult | null>(null);

  const handleTest = async () => {
    if (!videoUrl) return;

    setTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-strict-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          testType
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error en prueba:', error);
      setResult({
        success: false,
        visibility: {
          playerVisible: 'no',
          hoopVisible: 'no',
          ballVisible: 'no',
          videoQuality: 'mala',
          cameraAngle: 'otro'
        },
        preparation: {
          feetPosition: 'no_visible',
          kneeFlexion: 'no_visible',
          handPosition: 'no_visible'
        },
        execution: {
          playerJumps: 'no_claro',
          armExtension: 'no_claro',
          movementDuration: 'no_determinable'
        },
        result: {
          shotOutcome: 'no_visible',
          confidence: 'baja'
        },
        error: 'Error de conexión'
      });
    } finally {
      setTesting(false);
    }
  };

  const getResultIcon = () => {
    if (!result) return null;
    
    if (result.isHallucinating) {
      return <XCircle className="h-6 w-6 text-red-500" />;
    } else {
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
  };

  const getResultColor = () => {
    if (!result) return 'bg-gray-50';
    
    if (result.isHallucinating) {
      return 'bg-red-50 border-red-200';
    } else {
      return 'bg-green-50 border-green-200';
    }
  };

  const renderVisibilityBadge = (value: string, label: string) => {
    const isVisible = value === 'sí' || value === 'visible' || value === 'buena' || value === 'frontal';
    const isPartial = value === 'parcial';
    const isNotVisible = value === 'no' || value === 'no_visible' || value === 'mala' || value === 'otro';

    return (
      <div className="flex items-center justify-between p-2 border rounded">
        <span className="text-sm">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono">{value}</span>
          {isVisible && <CheckCircle className="h-4 w-4 text-green-500" />}
          {isPartial && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
          {isNotVisible && <XCircle className="h-4 w-4 text-red-500" />}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          🧠 Prueba Anti-Alucinación de Gemini
        </h1>
        <p className="text-muted-foreground">
          Prueba con prompts estrictos que evitan que Gemini invente contenido.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Configurar Prueba Anti-Alucinación
            </CardTitle>
            <CardDescription>
              Prompts estrictos que solo reportan lo 100% visible
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="testType">Tipo de Prueba</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="party-video">
                    🎉 Video de Fiesta (debería ver "no_visible")
                  </SelectItem>
                  <SelectItem value="basketball-video">
                    🏀 Video de Baloncesto (debería ver elementos)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {testType === 'party-video' && 'Si ve elementos de baloncesto, está alucinando'}
                {testType === 'basketball-video' && 'Si no ve nada, puede estar siendo demasiado estricto'}
              </p>
            </div>

            <div>
              <Label htmlFor="videoUrl">URL del Video</Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL pública del video a analizar
              </p>
            </div>

            <Button 
              onClick={handleTest} 
              disabled={!videoUrl || testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando con Prompts Estrictos...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Probar Anti-Alucinación
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Panel de Resultados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getResultIcon()}
              Resultados del Análisis Estricto
            </CardTitle>
            <CardDescription>
              Análisis detallado de visibilidad y elementos detectados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configura una prueba y haz clic en "Probar Anti-Alucinación"</p>
              </div>
            ) : (
              <div className={`p-4 rounded-lg border ${getResultColor()}`}>
                {/* Indicador de Alucinación */}
                {result.isHallucinating !== undefined && (
                  <div className="mb-4 p-3 rounded border">
                    {result.isHallucinating ? (
                      <div className="flex items-center gap-2 text-red-700">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">❌ GEMINI ESTÁ ALUCINANDO</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">✅ GEMINI ESTÁ VIENDO CONTENIDO REAL</span>
                      </div>
                    )}
                  </div>
                )}

                {result.error ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <h4 className="font-medium text-red-800 mb-1">Error:</h4>
                    <p className="text-sm text-red-700">{result.error}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Visibilidad */}
                    <div>
                      <h4 className="font-medium mb-2">👁️ Visibilidad</h4>
                      <div className="space-y-1">
                        {renderVisibilityBadge(result.visibility.playerVisible, 'Jugador visible')}
                        {renderVisibilityBadge(result.visibility.hoopVisible, 'Canasta visible')}
                        {renderVisibilityBadge(result.visibility.ballVisible, 'Balón visible')}
                        {renderVisibilityBadge(result.visibility.videoQuality, 'Calidad del video')}
                        {renderVisibilityBadge(result.visibility.cameraAngle, 'Ángulo de cámara')}
                      </div>
                    </div>

                    {/* Preparación */}
                    <div>
                      <h4 className="font-medium mb-2">🏃 Preparación</h4>
                      <div className="space-y-1">
                        {renderVisibilityBadge(result.preparation.feetPosition, 'Posición de pies')}
                        {renderVisibilityBadge(result.preparation.kneeFlexion, 'Flexión de rodillas')}
                        {renderVisibilityBadge(result.preparation.handPosition, 'Posición de manos')}
                      </div>
                    </div>

                    {/* Ejecución */}
                    <div>
                      <h4 className="font-medium mb-2">⚡ Ejecución</h4>
                      <div className="space-y-1">
                        {renderVisibilityBadge(result.execution.playerJumps, 'Jugador salta')}
                        {renderVisibilityBadge(result.execution.armExtension, 'Extensión del brazo')}
                        <div className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">Duración del movimiento</span>
                          <span className="text-xs font-mono">{result.execution.movementDuration}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resultado */}
                    <div>
                      <h4 className="font-medium mb-2">🎯 Resultado</h4>
                      <div className="space-y-1">
                        {renderVisibilityBadge(result.result.shotOutcome, 'Resultado del tiro')}
                        {renderVisibilityBadge(result.result.confidence, 'Confianza en el análisis')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Información de la prueba */}
                <div className="mt-4 p-3 bg-gray-50 border rounded text-xs text-muted-foreground">
                  <p><strong>Video:</strong> {result.videoUrl}</p>
                  <p><strong>Tipo:</strong> {result.testType}</p>
                  <p><strong>Timestamp:</strong> {result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instrucciones */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>📋 Cómo Interpretar los Resultados Anti-Alucinación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium text-green-800 mb-1">✅ Análisis Real</h4>
              <p className="text-sm text-green-700">
                Gemini reporta "no_visible" para elementos que no puede ver claramente.
              </p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <h4 className="font-medium text-red-800 mb-1">❌ Alucinación Detectada</h4>
              <p className="text-sm text-red-700">
                Gemini inventa elementos que no están presentes en el video.
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <strong>Clave:</strong> Los prompts estrictos fuerzan a Gemini a usar "no_visible" 
            cuando no puede ver algo claramente, evitando la invención de contenido.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
