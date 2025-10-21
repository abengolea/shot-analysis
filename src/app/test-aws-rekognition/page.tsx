'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface AnalysisResult {
  verificacion_inicial: {
    duracion_video: string;
    mano_tiro: string;
    salta: boolean;
    canasta_visible: boolean;
    angulo_camara: string;
    elementos_entorno: string[];
    tiros_detectados: number;
    tiros_por_segundo: number;
    deteccion_ia: {
      angulo_detectado: string;
      estrategia_usada: string;
      tiros_individuales: Array<{
        numero: number;
        timestamp: string;
        descripcion: string;
      }>;
      total_tiros: number;
    };
  };
  analysisSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  selectedKeyframes: number[];
  keyframeAnalysis: string;
  detailedChecklist: Array<{
    category: string;
    items: Array<{
      id: string;
      name: string;
      description: string;
      status: 'Correcto' | 'Mejorable' | 'Incorrecto' | 'no_evaluable';
      rating: number;
      na: boolean;
      comment: string;
      timestamp?: string;
      evidencia?: string;
    }>;
  }>;
  resumen_evaluacion: {
    parametros_evaluados: number;
    parametros_no_evaluables: number;
    lista_no_evaluables: string[];
    score_global: number;
    nota: string;
    confianza_analisis: 'alta' | 'media' | 'baja';
  };
  caracteristicas_unicas: string[];
}

export default function TestAWSRekognitionPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [ageCategory, setAgeCategory] = useState('');
  const [playerLevel, setPlayerLevel] = useState('');
  const [shotType, setShotType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) {
      setError('Por favor ingresa una URL de video');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test-aws-rekognition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          ageCategory: ageCategory || 'Sub-15',
          playerLevel: playerLevel || 'Intermedio',
          shotType: shotType || 'Tiro libre',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el análisis');
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Correcto':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Mejorable':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'Incorrecto':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'no_evaluable':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'alta':
        return 'bg-green-100 text-green-800';
      case 'media':
        return 'bg-yellow-100 text-yellow-800';
      case 'baja':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prueba AWS Rekognition</h1>
        <p className="text-gray-600">
          Prueba el análisis de videos de baloncesto usando AWS Rekognition
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario de entrada */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración del Análisis</CardTitle>
            <CardDescription>
              Configura los parámetros para el análisis con AWS Rekognition
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="videoUrl">URL del Video *</Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://ejemplo.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ageCategory">Categoría de Edad</Label>
              <Select value={ageCategory} onValueChange={setAgeCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sub-10">Sub-10</SelectItem>
                  <SelectItem value="Sub-13">Sub-13</SelectItem>
                  <SelectItem value="Sub-15">Sub-15</SelectItem>
                  <SelectItem value="Sub-18">Sub-18</SelectItem>
                  <SelectItem value="Amateur adulto">Amateur adulto</SelectItem>
                  <SelectItem value="Profesional">Profesional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="playerLevel">Nivel del Jugador</Label>
              <Input
                id="playerLevel"
                placeholder="Principiante, Intermedio, Avanzado"
                value={playerLevel}
                onChange={(e) => setPlayerLevel(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="shotType">Tipo de Tiro</Label>
              <Input
                id="shotType"
                placeholder="Tiro libre, Triple, etc."
                value={shotType}
                onChange={(e) => setShotType(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleAnalyze} 
              disabled={isLoading || !videoUrl.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando con AWS Rekognition...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Analizar Video
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="space-y-6">
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 text-red-800">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-2 text-red-700">{error}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* Verificación inicial */}
              <Card>
                <CardHeader>
                  <CardTitle>Verificación Inicial</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Duración:</span> {result.verificacion_inicial.duracion_video}
                    </div>
                    <div>
                      <span className="font-medium">Mano de tiro:</span> {result.verificacion_inicial.mano_tiro}
                    </div>
                    <div>
                      <span className="font-medium">Salta:</span> {result.verificacion_inicial.salta ? 'Sí' : 'No'}
                    </div>
                    <div>
                      <span className="font-medium">Canasta visible:</span> {result.verificacion_inicial.canasta_visible ? 'Sí' : 'No'}
                    </div>
                    <div>
                      <span className="font-medium">Ángulo:</span> {result.verificacion_inicial.angulo_camara}
                    </div>
                    <div>
                      <span className="font-medium">Tiros detectados:</span> {result.verificacion_inicial.tiros_detectados}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="font-medium">Elementos detectados:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.verificacion_inicial.elementos_entorno.map((element, index) => (
                        <Badge key={index} variant="secondary">{element}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen del análisis */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumen del Análisis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 mb-4">{result.analysisSummary}</p>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-green-700 mb-2">Fortalezas:</h4>
                      <ul className="text-sm space-y-1">
                        {result.strengths.map((strength, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-red-700 mb-2">Debilidades:</h4>
                      <ul className="text-sm space-y-1">
                        {result.weaknesses.map((weakness, index) => (
                          <li key={index} className="flex items-start">
                            <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                            {weakness}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Evaluación detallada */}
              <Card>
                <CardHeader>
                  <CardTitle>Evaluación Detallada</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {result.detailedChecklist.map((category, categoryIndex) => (
                      <div key={categoryIndex}>
                        <h4 className="font-medium mb-2">{category.category}</h4>
                        <div className="space-y-2">
                          {category.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(item.status)}
                                <span className="text-sm font-medium">{item.name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">{item.rating}/5</Badge>
                                <Badge 
                                  className={`text-xs ${getConfidenceColor(item.status === 'Correcto' ? 'alta' : item.status === 'Mejorable' ? 'media' : 'baja')}`}
                                >
                                  {item.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Resumen de evaluación */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumen de Evaluación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Parámetros evaluados:</span> {result.resumen_evaluacion.parametros_evaluados}
                    </div>
                    <div>
                      <span className="font-medium">No evaluables:</span> {result.resumen_evaluacion.parametros_no_evaluables}
                    </div>
                    <div>
                      <span className="font-medium">Score global:</span> {result.resumen_evaluacion.score_global}/5
                    </div>
                    <div>
                      <span className="font-medium">Confianza:</span> 
                      <Badge className={`ml-2 ${getConfidenceColor(result.resumen_evaluacion.confianza_analisis)}`}>
                        {result.resumen_evaluacion.confianza_analisis}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-gray-600">{result.resumen_evaluacion.nota}</p>
                </CardContent>
              </Card>

              {/* Características únicas */}
              <Card>
                <CardHeader>
                  <CardTitle>Características Únicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {result.caracteristicas_unicas.map((characteristic, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {characteristic}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
