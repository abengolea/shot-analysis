'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { toast } from 'sonner'; // Comentado temporalmente
import { Loader2, Upload, CheckCircle, XCircle, Star } from 'lucide-react';

interface AnalysisResult {
  verification?: {
    isReal: boolean;
    confidence: number;
    description: string;
    canSeeBasket?: boolean;
    cameraAngle?: string;
    basketVisible?: boolean;
    shotResultsVisible?: boolean;
    environment?: string;
    videoQuality?: string;
    specificColors?: string;
    uniqueObjects?: string;
    specificEnvironment?: string;
    specificActions?: string;
    playerCharacteristics?: {
      height?: string;
      build?: string;
      skinTone?: string;
      hairColor?: string;
      clothing?: string;
      uniqueFeatures?: string[];
      dominantHand?: string;
    };
  };
  shotSummary?: {
    totalShots?: number;
    lateralShots?: number;
    frontalShots?: number;
    additionalShots?: number;
    allAngles?: number;
    lateralOnly?: number;
    frontalOnly?: number;
    additionalOnly?: number;
    lateralAdditional?: number;
    frontalAdditional?: number;
  };
  shots?: Array<{
    id: number;
    videoSource: string;
    shotType: string;
    basketVisible: boolean;
    result: string;
    playerCharacteristics?: any;
    technique?: any;
    keyMoments?: any;
  }>;
  technicalAnalysis?: {
    parameters: Array<{
      name: string;
      score: number;
      status: string;
      comment: string;
      evidencia?: string;
    }>;
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

export default function TestSimplePromptPage() {
  const [videoFile1, setVideoFile1] = useState<File | null>(null);
  const [videoFile2, setVideoFile2] = useState<File | null>(null);
  const [videoFile3, setVideoFile3] = useState<File | null>(null);
  // Valores pre-configurados para testing rápido
  const [ageCategory] = useState('adult');
  const [playerLevel] = useState('intermediate');
  const [shotType] = useState('jump_shot');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile1) {
      alert('Por favor selecciona al menos un video');
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append('videoFile1', videoFile1);
      if (videoFile2) formData.append('videoFile2', videoFile2);
      if (videoFile3) formData.append('videoFile3', videoFile3);
      formData.append('ageCategory', ageCategory);
      formData.append('playerLevel', playerLevel);
      formData.append('shotType', shotType);

      const response = await fetch('/api/test-simple-prompt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result = await response.json();
      setAnalysisResult(result);
      
      const videoCount = [videoFile1, videoFile2, videoFile3].filter(Boolean).length;
      alert(`Análisis completado con prompt simplificado (${videoCount} videos)`);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al analizar el video');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-green-600';
    if (score >= 36) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'correcto': return 'text-green-600 bg-green-50';
      case 'mejorable': return 'text-yellow-600 bg-yellow-50';
      case 'incorrecto': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderStars = (score: number) => {
    const stars = Math.round(score / 20); // Convertir 0-100 a 0-5 estrellas
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium">{stars}/5</span>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">
          🧪 Test Prompt Simplificado
        </h1>
        <p className="text-center text-gray-600">
          Página de prueba con prompt simplificado para los 22 parámetros
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Subir Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Video 1 - Obligatorio */}
              <div className="space-y-2">
                <Label htmlFor="video1">📹 Video de Baloncesto (Obligatorio)</Label>
                <Input
                  id="video1"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile1(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-sm text-gray-500">Sube un video de tiros de baloncesto para analizar</p>
              </div>

              {/* Video 2 - Opcional */}
              <div className="space-y-2">
                <Label htmlFor="video2">📹 Video Adicional (Opcional)</Label>
                <Input
                  id="video2"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile2(e.target.files?.[0] || null)}
                />
                <p className="text-sm text-gray-500">Segundo video desde otro ángulo</p>
              </div>

              {/* Video 3 - Opcional */}
              <div className="space-y-2">
                <Label htmlFor="video3">📹 Video Extra (Opcional)</Label>
                <Input
                  id="video3"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile3(e.target.files?.[0] || null)}
                />
                <p className="text-sm text-gray-500">Tercer video para análisis completo</p>
              </div>

              {/* Configuración pre-establecida */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-bold text-blue-900 mb-2">⚙️ Configuración Pre-establecida</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Categoría:</strong> Adulto</p>
                  <p><strong>Nivel:</strong> Intermedio</p>
                  <p><strong>Tipo de Tiro:</strong> Tiro en Suspensión</p>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  ✅ Listo para analizar - Solo sube tu video y haz clic en "Analizar"
                </p>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analizando con Prompt Simplificado...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    🚀 Analizar Video(s) - 22 Parámetros
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Análisis</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p>Analizando videos con prompt simplificado...</p>
              </div>
            )}

            {analysisResult && (
              <div className="space-y-6">
                {/* Verificación */}
                {analysisResult.verification && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-bold text-blue-900 mb-2">🔍 Verificación de Video Real</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Descripción:</strong> {analysisResult.verification.description}</p>
                      <p><strong>Ángulo:</strong> {analysisResult.verification.cameraAngle}</p>
                      <p><strong>Canasta visible:</strong> {analysisResult.verification.basketVisible ? 'Sí' : 'No'}</p>
                      <p><strong>Calidad:</strong> {analysisResult.verification.videoQuality}</p>
                      {analysisResult.verification.specificColors && (
                        <p><strong>Colores:</strong> {analysisResult.verification.specificColors}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Resumen de Tiros */}
                {analysisResult.shotSummary && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-bold text-green-900 mb-2">📊 Resumen de Tiros</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Total:</strong> {analysisResult.shotSummary.totalShots}</div>
                      <div><strong>Laterales:</strong> {analysisResult.shotSummary.lateralShots}</div>
                      <div><strong>Frontales:</strong> {analysisResult.shotSummary.frontalShots}</div>
                      <div><strong>Adicionales:</strong> {analysisResult.shotSummary.additionalShots}</div>
                    </div>
                  </div>
                )}

                {/* Puntuación General */}
                {analysisResult.technicalAnalysis && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h3 className="font-bold text-purple-900 mb-2">🎯 Puntuación General</h3>
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getScoreColor(analysisResult.technicalAnalysis.overallScore)}`}>
                        {analysisResult.technicalAnalysis.overallScore}/100
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {analysisResult.technicalAnalysis.overallScore >= 80 ? 'Excelente' :
                         analysisResult.technicalAnalysis.overallScore >= 60 ? 'Bueno' : 'Necesita Mejora'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Checklist de 22 Parámetros */}
                {analysisResult.technicalAnalysis?.parameters && analysisResult.technicalAnalysis.parameters.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg">📋 Checklist de 22 Parámetros</h3>
                    <div className="space-y-3">
                      {analysisResult.technicalAnalysis.parameters.map((param, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{param.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${getScoreColor(param.score)}`}>
                                {param.score}/100
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(param.status)}`}>
                                {param.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            {renderStars(param.score)}
                            <span className="text-sm text-gray-600">
                              {Math.round(param.score / 20)}/5 estrellas
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{param.comment}</p>
                          {param.evidencia && (
                            <p className="text-xs text-blue-600 mt-1">
                              <strong>Evidencia:</strong> {param.evidencia}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fortalezas, Debilidades y Recomendaciones */}
                {analysisResult.technicalAnalysis && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysisResult.technicalAnalysis.strengths && analysisResult.technicalAnalysis.strengths.length > 0 && (
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-bold text-green-900 mb-2">✅ Fortalezas</h4>
                        <ul className="text-sm space-y-1">
                          {analysisResult.technicalAnalysis.strengths.map((strength, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.technicalAnalysis.weaknesses && analysisResult.technicalAnalysis.weaknesses.length > 0 && (
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h4 className="font-bold text-red-900 mb-2">❌ Debilidades</h4>
                        <ul className="text-sm space-y-1">
                          {analysisResult.technicalAnalysis.weaknesses.map((weakness, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <span>{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.technicalAnalysis.recommendations && analysisResult.technicalAnalysis.recommendations.length > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-bold text-blue-900 mb-2">💡 Recomendaciones</h4>
                        <ul className="text-sm space-y-1">
                          {analysisResult.technicalAnalysis.recommendations.map((recommendation, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-600 font-bold">•</span>
                              <span>{recommendation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
