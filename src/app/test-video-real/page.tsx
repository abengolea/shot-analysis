'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TestVideoRealPage() {
  const [videoFile1, setVideoFile1] = useState<File | null>(null);
  const [videoFile2, setVideoFile2] = useState<File | null>(null);
  const [videoFile3, setVideoFile3] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<{
    testPrompt: any;
    productionPrompt: any;
  } | null>(null);
  const { toast } = useToast();

  const handleFileChange1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile1(file);
      setError(null);
    }
  };

  const handleFileChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile2(file);
      setError(null);
    }
  };

  const handleFileChange3 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile3(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile1) {
      setError('Selecciona al menos el primer video (lateral)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setComparisonResults(null);

    try {
      // Preparar datos para ambos análisis
      const formData = new FormData();
      formData.append('video1', videoFile1);
      if (videoFile2) {
        formData.append('video2', videoFile2);
      }
      if (videoFile3) {
        formData.append('video3', videoFile3);
      }

      // Hacer ambos análisis en paralelo
      const [testResponse, productionResponse] = await Promise.all([
        // Análisis con prompt de test (actual)
        fetch('/api/test-video-real', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(300000),
        }),
        // Análisis con prompt de producción (simulando /analysis)
        fetch('/api/test-video-real-production', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(300000),
        })
      ]);

      const [testData, productionData] = await Promise.all([
        testResponse.json(),
        productionResponse.json()
      ]);

      if (!testResponse.ok) {
        throw new Error(testData.error || 'Error en análisis de test');
      }
      if (!productionResponse.ok) {
        throw new Error(productionData.error || 'Error en análisis de producción');
      }

      setComparisonResults({
        testPrompt: testData,
        productionPrompt: productionData
      });

      const videoCount = [videoFile1, videoFile2, videoFile3].filter(Boolean).length;
      toast({
        title: 'Comparación completada',
        description: `Análisis comparativo (${videoCount} videos) completado exitosamente`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comparación de Prompts</h1>
        <p className="text-muted-foreground">
          Análisis con prompt de test vs prompt de producción
        </p>
      </div>

      <div className="space-y-6">
        {/* Formulario de subida */}
        <Card>
          <CardHeader>
            <CardTitle>Subir Videos para Comparación</CardTitle>
            <CardDescription>
              Sube hasta 3 videos para comparar ambos prompts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="video1">Sesión 1 - Tiros Laterales (Obligatorio)</Label>
                  <Input
                    id="video1"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange1}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video2">Sesión 2 - Tiros Frontales (Opcional)</Label>
                  <Input
                    id="video2"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video3">Sesión 3 - Tiros Adicionales (Opcional)</Label>
                  <Input
                    id="video3"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange3}
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {[videoFile1, videoFile2, videoFile3].filter(Boolean).length > 1 
                      ? `Análisis Multi-Sesión (${[videoFile1, videoFile2, videoFile3].filter(Boolean).length} sesiones)` 
                      : 'Análisis Sesión 1'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultados de Comparación */}
        <Card>
          <CardHeader>
            <CardTitle>Comparación de Prompts</CardTitle>
            <CardDescription>
              Análisis con prompt de test vs prompt de producción
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Ejecutando análisis comparativo...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <div>
                  <p className="font-medium text-red-800">Error</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {comparisonResults && (
              <div className="space-y-6">
                <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <div>
                    <p className="font-medium text-green-800">Comparación Completada</p>
                    <p className="text-green-600 text-sm">Ambos análisis ejecutados exitosamente</p>
                  </div>
                </div>

                {/* Cuadro de Verificación - Descripción del Video */}
                <Card className="border-2 border-orange-300 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-900">
                      <Eye className="h-5 w-5 mr-2" />
                      🔍 Verificación: ¿Qué ve la IA del video?
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      Esta descripción confirma que la IA realmente está analizando el video y no está simulando la respuesta
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Descripción Principal */}
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-gray-900 mb-2">📝 Descripción del Video:</h4>
                      {(comparisonResults.testPrompt.verification?.description || comparisonResults.productionPrompt.verification?.description) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {comparisonResults.testPrompt.verification?.description && (
                            <div>
                              <p className="text-xs font-medium text-blue-600 mb-1">Prompt de Test:</p>
                              <p className="text-sm text-gray-700">{comparisonResults.testPrompt.verification.description}</p>
                            </div>
                          )}
                          {comparisonResults.productionPrompt.verification?.description && (
                            <div>
                              <p className="text-xs font-medium text-purple-600 mb-1">Prompt de Producción:</p>
                              <p className="text-sm text-gray-700">{comparisonResults.productionPrompt.verification.description}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No se encontró descripción del video en la respuesta</p>
                      )}
                    </div>

                    {/* Detalles Visuales */}
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-gray-900 mb-3">👁️ Detalles Visuales Específicos:</h4>
                      {(comparisonResults.testPrompt.details || comparisonResults.productionPrompt.details) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Prompt de Test */}
                          {comparisonResults.testPrompt.details && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-blue-600 mb-2">Prompt de Test:</p>
                              <div className="space-y-2 text-sm">
                                {comparisonResults.testPrompt.details.colors && (
                                  <div>
                                    <span className="font-medium text-gray-700">🎨 Colores:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.testPrompt.details.colors}</p>
                                  </div>
                                )}
                                {comparisonResults.testPrompt.details.objects && (
                                  <div>
                                    <span className="font-medium text-gray-700">🏀 Objetos:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.testPrompt.details.objects}</p>
                                  </div>
                                )}
                                {comparisonResults.testPrompt.details.actions && (
                                  <div>
                                    <span className="font-medium text-gray-700">⚡ Acciones:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.testPrompt.details.actions}</p>
                                  </div>
                                )}
                                {comparisonResults.testPrompt.details.environment && (
                                  <div>
                                    <span className="font-medium text-gray-700">🏟️ Entorno:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.testPrompt.details.environment}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Prompt de Producción */}
                          {comparisonResults.productionPrompt.details && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-purple-600 mb-2">Prompt de Producción:</p>
                              <div className="space-y-2 text-sm">
                                {comparisonResults.productionPrompt.details.colors && (
                                  <div>
                                    <span className="font-medium text-gray-700">🎨 Colores:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.productionPrompt.details.colors}</p>
                                  </div>
                                )}
                                {comparisonResults.productionPrompt.details.objects && (
                                  <div>
                                    <span className="font-medium text-gray-700">🏀 Objetos:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.productionPrompt.details.objects}</p>
                                  </div>
                                )}
                                {comparisonResults.productionPrompt.details.actions && (
                                  <div>
                                    <span className="font-medium text-gray-700">⚡ Acciones:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.productionPrompt.details.actions}</p>
                                  </div>
                                )}
                                {comparisonResults.productionPrompt.details.environment && (
                                  <div>
                                    <span className="font-medium text-gray-700">🏟️ Entorno:</span>
                                    <p className="text-gray-600 ml-2">{comparisonResults.productionPrompt.details.environment}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No se encontraron detalles visuales en la respuesta</p>
                      )}
                    </div>

                    {/* Información de Verificación */}
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-gray-900 mb-3">✅ Estado de Verificación:</h4>
                      {(comparisonResults.testPrompt.verification || comparisonResults.productionPrompt.verification) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {comparisonResults.testPrompt.verification && (
                            <div>
                              <p className="text-xs font-medium text-blue-600 mb-2">Prompt de Test:</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center">
                                  <span className="font-medium text-gray-700">Video Real:</span>
                                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                                    comparisonResults.testPrompt.verification.isReal 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {comparisonResults.testPrompt.verification.isReal ? 'Sí ✓' : 'No ✗'}
                                  </span>
                                </div>
                                {comparisonResults.testPrompt.verification.confidence !== undefined && (
                                  <div>
                                    <span className="font-medium text-gray-700">Confianza:</span>
                                    <span className="ml-2 text-gray-600">{comparisonResults.testPrompt.verification.confidence}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {comparisonResults.productionPrompt.verification && (
                            <div>
                              <p className="text-xs font-medium text-purple-600 mb-2">Prompt de Producción:</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center">
                                  <span className="font-medium text-gray-700">Video Real:</span>
                                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                                    comparisonResults.productionPrompt.verification.isReal 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {comparisonResults.productionPrompt.verification.isReal ? 'Sí ✓' : 'No ✗'}
                                  </span>
                                </div>
                                {comparisonResults.productionPrompt.verification.confidence !== undefined && (
                                  <div>
                                    <span className="font-medium text-gray-700">Confianza:</span>
                                    <span className="ml-2 text-gray-600">{comparisonResults.productionPrompt.verification.confidence}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No se encontró información de verificación en la respuesta</p>
                      )}
                    </div>

                    {/* Debug: Mostrar estructura de datos para debugging */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="bg-gray-100 p-3 rounded-lg border border-gray-300">
                        <h4 className="font-semibold text-gray-900 mb-2 text-xs">🐛 Debug (solo desarrollo):</h4>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 mb-2">Ver estructura de datos</summary>
                          <pre className="text-xs overflow-auto max-h-40 bg-white p-2 rounded border">
                            {JSON.stringify(comparisonResults, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Comparación lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Prompt de Test */}
                  <div className="space-y-4">
                    <div className="bg-blue-100 p-3 rounded-lg border border-blue-200">
                      <h3 className="font-bold text-blue-800 text-lg">🔬 PROMPT DE TEST</h3>
                      <p className="text-blue-600 text-sm">Análisis con prompt de desarrollo</p>
                    </div>
                    
                    {/* Puntuación General */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Puntuación General:</span>
                        <span className="text-2xl font-bold text-blue-700">
                          {comparisonResults.testPrompt.technicalAnalysis?.overallScore || 0}/100
                        </span>
                      </div>
                    </div>

                    {/* Fortalezas y Debilidades */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-blue-800">Fortalezas:</h4>
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <ul className="text-sm space-y-1">
                          {(comparisonResults.testPrompt.technicalAnalysis?.strengths || []).map((strength: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-blue-800">Debilidades:</h4>
                      <div className="bg-red-50 p-2 rounded border border-red-200">
                        <ul className="text-sm space-y-1">
                          {(comparisonResults.testPrompt.technicalAnalysis?.weaknesses || []).map((weakness: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-red-500 mr-2">✗</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-blue-800">Recomendaciones:</h4>
                      <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                        <ul className="text-sm space-y-1">
                          {(comparisonResults.testPrompt.technicalAnalysis?.recommendations || []).map((rec: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-yellow-500 mr-2">💡</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Prompt de Producción */}
                  <div className="space-y-4">
                    <div className="bg-purple-100 p-3 rounded-lg border border-purple-200">
                      <h3 className="font-bold text-purple-800 text-lg">🏭 PROMPT DE PRODUCCIÓN</h3>
                      <p className="text-purple-600 text-sm">Análisis con prompt de producción (mismo que /analysis)</p>
                    </div>
                    
                    {/* Puntuación General */}
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Puntuación General:</span>
                        <span className="text-2xl font-bold text-purple-700">
                          {comparisonResults.productionPrompt.technicalAnalysis?.overallScore || 0}/100
                        </span>
                      </div>
                    </div>

                    {/* Fortalezas y Debilidades */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-purple-800">Fortalezas:</h4>
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <ul className="text-sm space-y-1">
                          {(comparisonResults.productionPrompt.technicalAnalysis?.strengths || []).map((strength: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-purple-800">Debilidades:</h4>
                      <div className="bg-red-50 p-2 rounded border border-red-200">
                        <ul className="text-sm space-y-1">
                          {(comparisonResults.productionPrompt.technicalAnalysis?.weaknesses || []).map((weakness: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-red-500 mr-2">✗</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-purple-800">Recomendaciones:</h4>
                      <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                        <ul className="text-sm space-y-1">
                          {(comparisonResults.productionPrompt.technicalAnalysis?.recommendations || []).map((rec: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-yellow-500 mr-2">💡</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparación de Puntuaciones */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-3">📊 Comparación de Puntuaciones</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-1">Prompt de Test</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {comparisonResults.testPrompt.technicalAnalysis?.overallScore || 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-1">Prompt de Producción</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {comparisonResults.productionPrompt.technicalAnalysis?.overallScore || 0}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-sm text-gray-600">
                      Diferencia: 
                      <span className={`font-bold ml-1 ${
                        (comparisonResults.productionPrompt.technicalAnalysis?.overallScore || 0) - 
                        (comparisonResults.testPrompt.technicalAnalysis?.overallScore || 0) > 0 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(comparisonResults.productionPrompt.technicalAnalysis?.overallScore || 0) - 
                         (comparisonResults.testPrompt.technicalAnalysis?.overallScore || 0) > 0 ? '+' : ''}
                        {(comparisonResults.productionPrompt.technicalAnalysis?.overallScore || 0) - 
                         (comparisonResults.testPrompt.technicalAnalysis?.overallScore || 0)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}