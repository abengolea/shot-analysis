"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';

export default function TestStrictAnalysisPage() {
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

  const analyzeStrict = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch('/api/test-strict-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Error al analizar video con IA estricta' });
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
            🔍 Análisis Estricto de Frames
            <Badge variant="outline" className="ml-2">SOLO IMÁGENES REALES</Badge>
          </CardTitle>
          <p className="text-muted-foreground">
            La IA analiza SOLO las imágenes extraídas del video, sin usar URL o contexto
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
            onClick={analyzeStrict} 
            disabled={loading || !selectedFile}
            className="w-full"
            size="lg"
          >
            {loading ? 'Analizando Frames Estrictamente...' : 'Analizar SOLO Imágenes Reales'}
          </Button>

          {/* Instructions */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-medium text-red-900 mb-2">🚨 Análisis MUY Estricto:</h3>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• <strong>SOLO Imágenes:</strong> La IA ve únicamente frames extraídos del video</li>
              <li>• <strong>NO URL:</strong> Ignora completamente el nombre del archivo y URL</li>
              <li>• <strong>NO Inventa:</strong> Solo reporta lo que realmente ve en las imágenes</li>
              <li>• <strong>Muy Estricto:</strong> Solo aprueba si ve canasta COMPLETA + balón COMPLETO</li>
              <li>• <strong>Anti-Fiesta:</strong> Si detecta CUALQUIER fiesta, rechaza TODO</li>
            </ul>
          </div>

          {/* Results */}
          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Resultado del Análisis Estricto
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
                        <div className={`text-2xl font-bold ${result.summary.isBasketballContent ? 'text-green-600' : 'text-red-600'}`}>
                          {result.summary.isBasketballContent ? 'SÍ' : 'NO'}
                        </div>
                        <div className="text-sm text-gray-600">Es Baloncesto</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getConfidenceColor(result.summary.confidence)}`}>
                          {result.summary.confidence}%
                        </div>
                        <div className="text-sm text-gray-600">Confianza</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{result.summary.framesAnalyzed}</div>
                        <div className="text-sm text-gray-600">Frames Analizados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Recomendación</div>
                        <Badge variant={getRecommendationColor(result.summary.recommendation)} className="mt-1">
                          {getRecommendationText(result.summary.recommendation)}
                        </Badge>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-blue-800"><strong>Razón:</strong> {result.analysis.reason}</p>
                    </div>

                    {/* Detected Elements */}
                    {result.analysis.detectedElements.length > 0 && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded">
                        <h4 className="font-medium text-green-900 mb-2">✅ Elementos Detectados:</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.analysis.detectedElements.map((element: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-green-600 border-green-600">
                              {element}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Frame Analysis */}
                    {result.analysis.frameAnalysis && result.analysis.frameAnalysis.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-lg flex items-center gap-2">
                          <Eye className="w-5 h-5" />
                          Análisis Detallado por Frame:
                        </h4>
                        <div className="grid gap-4">
                          {result.analysis.frameAnalysis.slice(0, 8).map((frame: any, index: number) => (
                            <Card key={index} className="border-l-4 border-l-blue-500">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium">Frame #{frame.frameIndex + 1}</h5>
                                  <span className="text-sm text-gray-600">
                                    {frame.timestamp.toFixed(1)}s
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                                  <div className="text-center">
                                    <div className={`text-sm font-medium ${frame.hasBasketballHoop ? 'text-green-600' : 'text-red-600'}`}>
                                      {frame.hasBasketballHoop ? '✅' : '❌'} Canasta
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className={`text-sm font-medium ${frame.hasBasketball ? 'text-green-600' : 'text-red-600'}`}>
                                      {frame.hasBasketball ? '✅' : '❌'} Balón
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className={`text-sm font-medium ${frame.hasBasketballCourt ? 'text-green-600' : 'text-red-600'}`}>
                                      {frame.hasBasketballCourt ? '✅' : '❌'} Cancha
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className={`text-sm font-medium ${frame.hasPartyContent ? 'text-red-600' : 'text-green-600'}`}>
                                      {frame.hasPartyContent ? '🚨' : '✅'} Fiesta
                                    </div>
                                  </div>
                                </div>
                                
                                <p className="text-sm text-gray-700">{frame.description}</p>
                              </CardContent>
                            </Card>
                          ))}
                          {result.analysis.frameAnalysis.length > 8 && (
                            <div className="text-center text-sm text-gray-500">
                              ... y {result.analysis.frameAnalysis.length - 8} frames más
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-green-800">
                        <strong>🎥 Este análisis fue realizado SOLO con imágenes reales</strong> extraídas del video, 
                        sin usar URL, nombre de archivo, o cualquier contexto externo.
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
