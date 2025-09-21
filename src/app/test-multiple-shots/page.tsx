"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

export default function TestMultipleShotsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setResult(null);
    } else {
      alert('Por favor selecciona un archivo de video válido');
    }
  };

  const analyzeMultipleShots = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch('/api/analyze-multiple-shots', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Error al analizar múltiples tiros con IA' });
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

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'PROCEED': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'REJECT': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'REVIEW': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏀 Análisis de Múltiples Tiros
            <Badge variant="outline" className="ml-2">IA + FFmpeg + Detección de Movimiento</Badge>
          </CardTitle>
          <p className="text-muted-foreground">
            La IA detecta y analiza cada tiro individual en el video
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
                <Upload className="w-5 h-5" />
                <span>Seleccionar Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileVideo className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                  <span className="text-gray-400">
                    ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Analyze Button */}
          <Button 
            onClick={analyzeMultipleShots} 
            disabled={loading || !selectedFile}
            className="w-full"
            size="lg"
          >
            {loading ? 'Analizando Múltiples Tiros...' : 'Analizar Múltiples Tiros con IA'}
          </Button>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📋 Cómo Funciona:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Detección de Movimiento:</strong> FFmpeg detecta automáticamente segmentos de tiros</li>
              <li>• <strong>Extracción de Frames:</strong> Se extraen 8-12 frames de alta calidad por tiro</li>
              <li>• <strong>Análisis Individual:</strong> La IA analiza cada tiro por separado</li>
              <li>• <strong>Validación Real:</strong> Ve el contenido visual real, no inventa detalles</li>
            </ul>
          </div>

          {/* Results */}
          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Resultado del Análisis de Múltiples Tiros
                  {result.summary && (
                    <div className="flex items-center gap-2">
                      {getRecommendationIcon(result.summary.recommendation)}
                      <Badge variant={getRecommendationColor(result.summary.recommendation)}>
                        {getRecommendationText(result.summary.recommendation)}
                      </Badge>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.success ? (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{result.summary.totalShots}</div>
                        <div className="text-sm text-gray-600">Tiros Detectados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{result.summary.validShots}</div>
                        <div className="text-sm text-gray-600">Tiros Válidos</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getConfidenceColor(result.summary.confidence)}`}>
                          {result.summary.confidence}%
                        </div>
                        <div className="text-sm text-gray-600">Confianza</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Recomendación</div>
                        <Badge variant={getRecommendationColor(result.summary.recommendation)} className="mt-1">
                          {getRecommendationText(result.summary.recommendation)}
                        </Badge>
                      </div>
                    </div>

                    {/* Summary Text */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-blue-800"><strong>Resumen:</strong> {result.analysis.summary}</p>
                    </div>

                    {/* Individual Shot Analysis */}
                    {result.analysis.shotAnalyses && result.analysis.shotAnalyses.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-lg">Análisis Individual de Tiros:</h4>
                        <div className="grid gap-4">
                          {result.analysis.shotAnalyses.map((shot: any, index: number) => (
                            <Card key={index} className="border-l-4 border-l-blue-500">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium">Tiro #{shot.shotIndex + 1}</h5>
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-600">
                                      {shot.startTime.toFixed(1)}s - {shot.endTime.toFixed(1)}s
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm">Es baloncesto:</span>
                                  {shot.isBasketballShot ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  )}
                                  <span className={`text-sm font-medium ${shot.isBasketballShot ? 'text-green-600' : 'text-red-600'}`}>
                                    {shot.isBasketballShot ? 'SÍ' : 'NO'}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    (Confianza: {Math.round(shot.confidence * 100)}%)
                                  </span>
                                </div>
                                
                                <p className="text-sm text-gray-700 mb-2">{shot.description}</p>
                                
                                {/* Mostrar frames extraídos */}
                                {result.analysis.extractedFrames && result.analysis.extractedFrames[shot.shotIndex] && (
                                  <div className="mb-3">
                                    <span className="text-sm font-medium text-blue-600">📸 Frames extraídos:</span>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {result.analysis.extractedFrames[shot.shotIndex].frames.slice(0, 4).map((frame: any, frameIndex: number) => (
                                        <div key={frameIndex} className="relative">
                                          <img 
                                            src={`data:image/jpeg;base64,${frame.imageData}`}
                                            alt={`Frame ${frameIndex + 1}`}
                                            className="w-20 h-20 object-cover rounded border border-gray-300"
                                          />
                                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b">
                                            {frame.timestamp.toFixed(1)}s
                                          </div>
                                        </div>
                                      ))}
                                      {result.analysis.extractedFrames[shot.shotIndex].frames.length > 4 && (
                                        <div className="w-20 h-20 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                                          <span className="text-xs text-gray-500">
                                            +{result.analysis.extractedFrames[shot.shotIndex].frames.length - 4}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {shot.basketballIndicators.length > 0 && (
                                  <div className="mb-2">
                                    <span className="text-sm font-medium text-green-600">✅ Indicadores de baloncesto:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {shot.basketballIndicators.map((indicator: string, i: number) => (
                                        <Badge key={i} variant="outline" className="text-xs text-green-600 border-green-600">
                                          {indicator}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {shot.nonBasketballIndicators.length > 0 && (
                                  <div>
                                    <span className="text-sm font-medium text-red-600">❌ Indicadores NO de baloncesto:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {shot.nonBasketballIndicators.map((indicator: string, i: number) => (
                                        <Badge key={i} variant="outline" className="text-xs text-red-600 border-red-600">
                                          {indicator}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-green-800">
                        <strong>🎥 Este análisis fue realizado con IA real</strong> que examina frames extraídos de cada segmento de tiro detectado, 
                        proporcionando análisis individual y preciso de cada movimiento.
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
