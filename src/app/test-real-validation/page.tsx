"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileVideo, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function TestRealValidationPage() {
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

  const testRealVideo = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch('/api/validate-real-video', {
        method: 'POST',
        body: formData,
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎥 Validación Real con Análisis de Frames
            <Badge variant="outline" className="ml-2">IA + FFmpeg</Badge>
          </CardTitle>
          <p className="text-muted-foreground">
            La IA analiza frames reales extraídos del video para determinar si es baloncesto
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
            onClick={testRealVideo} 
            disabled={loading || !selectedFile}
            className="w-full"
            size="lg"
          >
            {loading ? 'Analizando Frames del Video...' : 'Analizar Video con IA Real'}
          </Button>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📋 Instrucciones:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Selecciona un archivo de video real (MP4, AVI, MOV, etc.)</li>
              <li>• La IA extraerá frames del video y los analizará</li>
              <li>• Verá elementos reales como canastas, balones, canchas, etc.</li>
              <li>• No analiza solo la URL, sino el contenido visual real</li>
            </ul>
          </div>

          {/* Results */}
          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Resultado del Análisis Real
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Resumen</h4>
                        <p><strong>Es baloncesto:</strong> {result.summary.isBasketball ? '✅ SÍ' : '❌ NO'}</p>
                        <p><strong>Confianza:</strong> 
                          <span className={getConfidenceColor(result.summary.confidence)}>
                            {result.summary.confidence}%
                          </span>
                        </p>
                        <p><strong>Frames analizados:</strong> {result.summary.analyzedFrames}</p>
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

                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-green-800">
                        <strong>🎥 Este análisis fue realizado con IA real</strong> que examina frames extraídos del video, 
                        no solo palabras clave. La IA ve el contenido visual real del archivo.
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
