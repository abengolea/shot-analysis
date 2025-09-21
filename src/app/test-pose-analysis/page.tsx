"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, Target, TrendingUp, Activity } from 'lucide-react';

export default function TestPoseAnalysisPage() {
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

  const analyzePose = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch('/api/analyze-pose-basketball', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Error al analizar poses de baloncesto' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏀 Análisis de Pose de Baloncesto
            <Badge variant="outline" className="ml-2">OpenPose + FFmpeg + IA</Badge>
          </CardTitle>
          <p className="text-muted-foreground">
            Análisis avanzado de poses y movimientos de tiro basado en keypoints del cuerpo
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
            onClick={analyzePose} 
            disabled={loading || !selectedFile}
            className="w-full"
            size="lg"
          >
            {loading ? 'Analizando Poses de Baloncesto...' : 'Analizar Poses con IA'}
          </Button>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📋 Tecnologías Utilizadas:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>OpenPose:</strong> Detección de keypoints del cuerpo (17 puntos)</li>
              <li>• <strong>FFmpeg:</strong> Extracción de frames de alta calidad</li>
              <li>• <strong>Análisis de Ángulos:</strong> Codos, rodillas, ángulo de liberación</li>
              <li>• <strong>Detección de Movimiento:</strong> Identificación de patrones de tiro</li>
              <li>• <strong>Faster R-CNN:</strong> Detección de balón (próximamente)</li>
            </ul>
          </div>

          {/* Results */}
          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Resultado del Análisis de Pose
                  {result.success && (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      ✅ Análisis Completo
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.success ? (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{result.summary.shotsDetected}</div>
                        <div className="text-sm text-gray-600">Tiros Detectados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{result.summary.successfulShots}</div>
                        <div className="text-sm text-gray-600">Tiros Exitosos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{result.summary.missedShots}</div>
                        <div className="text-sm text-gray-600">Tiros Fallidos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{result.summary.successRate}%</div>
                        <div className="text-sm text-gray-600">Tasa de Éxito</div>
                      </div>
                    </div>

                    {/* Technical Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4" />
                            Detección de Tiros
                          </h4>
                          <p className="text-sm text-gray-600">
                            Se analizaron <strong>{result.summary.framesAnalyzed} frames</strong> del video
                          </p>
                          <p className="text-sm text-gray-600">
                            Tiros detectados: <strong>{result.analysis.shotDetected ? 'Sí' : 'No'}</strong>
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4" />
                            Análisis de Poses
                          </h4>
                          <p className="text-sm text-gray-600">
                            Poses analizadas: <strong>{result.analysis.poseAnalyses.length}</strong>
                          </p>
                          <p className="text-sm text-gray-600">
                            Detecciones de balón: <strong>{result.analysis.ballDetections.length}</strong>
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Shot Timing */}
                    {result.analysis.shotTiming && result.analysis.shotTiming.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Timing de Tiros
                        </h4>
                        <div className="grid gap-2">
                          {result.analysis.shotTiming.map((timing: any, index: number) => (
                            <div key={index} className="p-3 bg-gray-50 rounded border">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">Tiro #{index + 1}</span>
                                <div className="text-sm text-gray-600">
                                  Frame {timing.startFrame} → {timing.releaseFrame} → {timing.endFrame}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-green-800">
                        <strong>🎯 Este análisis utiliza tecnologías avanzadas</strong> inspiradas en el repositorio 
                        <a href="https://github.com/chonyy/AI-basketball-analysis" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                          AI Basketball Analysis
                        </a> para detectar poses, ángulos y movimientos reales de tiro.
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
