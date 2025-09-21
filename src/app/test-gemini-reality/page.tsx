'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Eye, Brain } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TestResult {
  success: boolean;
  testType: string;
  videoUrl: string;
  result: {
    prompt: string;
    response?: string;
    expectedResult?: string;
    actualResult?: string;
    error?: string;
  };
  timestamp: string;
}

export default function TestGeminiRealityPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [testType, setTestType] = useState('party-video');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!videoFile) return;

    setTesting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('testType', testType);

      const response = await fetch('/api/test-gemini-reality', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error en prueba:', error);
      setResult({
        success: false,
        testType,
        videoUrl,
        result: {
          prompt: 'Error de conexión',
          error: 'No se pudo conectar con el servidor'
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };

  const getResultIcon = () => {
    if (!result) return null;
    
    if (result.result.expectedResult && result.result.actualResult) {
      if (result.result.expectedResult === result.result.actualResult) {
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      } else {
        return <XCircle className="h-6 w-6 text-red-500" />;
      }
    }
    
    return <Eye className="h-6 w-6 text-blue-500" />;
  };

  const getResultColor = () => {
    if (!result) return 'bg-gray-50';
    
    if (result.result.expectedResult && result.result.actualResult) {
      if (result.result.expectedResult === result.result.actualResult) {
        return 'bg-green-50 border-green-200';
      } else {
        return 'bg-red-50 border-red-200';
      }
    }
    
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          🧠 Prueba de Realidad de Gemini
        </h1>
        <p className="text-muted-foreground">
          Verifica si Gemini está analizando contenido REAL o alucinando información.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Configurar Prueba
            </CardTitle>
            <CardDescription>
              Selecciona el tipo de prueba para verificar si Gemini alucina contenido
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
                    🎉 Video de Fiesta (debería RECHAZAR)
                  </SelectItem>
                  <SelectItem value="basketball-video">
                    🏀 Video de Baloncesto (debería APROBAR)
                  </SelectItem>
                  <SelectItem value="general">
                    👁️ Análisis General
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {testType === 'party-video' && 'Prueba crítica: Si Gemini dice que es baloncesto, está alucinando'}
                {testType === 'basketball-video' && 'Prueba positiva: Si Gemini dice que no es baloncesto, hay problema'}
                {testType === 'general' && 'Análisis libre para ver qué ve realmente'}
              </p>
            </div>

            <div>
              <Label htmlFor="videoFile">Video Local</Label>
              <Input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setVideoUrl(file.name);
                    setVideoFile(file);
                  }
                }}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sube un video local para análisis directo
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
                  Probando Realidad de Gemini...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Ejecutar Prueba
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
              Resultados de la Prueba
            </CardTitle>
            <CardDescription>
              Análisis de si Gemini está viendo contenido real o alucinando
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configura una prueba y haz clic en "Ejecutar Prueba"</p>
              </div>
            ) : (
              <div className={`p-4 rounded-lg border ${getResultColor()}`}>
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Prueba: {result.result.prompt}</h3>
                  <p className="text-sm text-muted-foreground">
                    Video: {result.videoUrl}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(result.timestamp).toLocaleString()}
                  </p>
                </div>

                {result.result.expectedResult && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">Resultado Esperado:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        result.result.expectedResult === 'APPROVE' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.result.expectedResult}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">Resultado Real:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        result.result.actualResult === 'APPROVE' 
                          ? 'bg-green-100 text-green-800' 
                          : result.result.actualResult === 'REJECT'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {result.result.actualResult}
                      </span>
                    </div>
                  </div>
                )}

                {result.result.error ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <h4 className="font-medium text-red-800 mb-1">Error:</h4>
                    <p className="text-sm text-red-700">{result.result.error}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border rounded">
                    <h4 className="font-medium mb-2">Respuesta de Gemini:</h4>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                      {result.result.response}
                    </pre>
                  </div>
                )}

                {/* Indicador de Alucinación */}
                {result.result.expectedResult && result.result.actualResult && (
                  <div className="mt-4 p-3 rounded border">
                    {result.result.expectedResult === result.result.actualResult ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">✅ Gemini está analizando contenido REAL</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">❌ Gemini está ALUCINANDO contenido</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instrucciones */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>📋 Cómo Interpretar los Resultados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium text-green-800 mb-1">✅ Prueba Exitosa</h4>
              <p className="text-sm text-green-700">
                Gemini ve el contenido real y responde correctamente según lo esperado.
              </p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <h4 className="font-medium text-red-800 mb-1">❌ Alucinación Detectada</h4>
              <p className="text-sm text-red-700">
                Gemini inventa contenido que no está presente en el video.
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <strong>Importante:</strong> Si Gemini aprueba un video de fiesta como baloncesto, 
            significa que está alucinando y no es confiable para análisis técnico.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
