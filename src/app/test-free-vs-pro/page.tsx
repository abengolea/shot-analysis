'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, Zap, Target, BarChart3, Eye } from 'lucide-react';
import { EvidenceButton } from '@/components/evidence-button';

interface AnalysisResult {
  verificacion_inicial: {
    duracion_video: string;
    mano_tiro: string;
    salta: boolean;
    canasta_visible: boolean;
    angulo_camara: string;
    elementos_entorno: string[];
    tiros_detectados?: number;
    tiros_por_segundo?: number;
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
      status: string;
      rating: number;
      timestamp?: string;
      evidencia?: string;
      na: boolean;
      razon?: string;
      comment: string;
    }>;
  }>;
  resumen_evaluacion: {
    parametros_evaluados: number;
    parametros_no_evaluables: number;
    lista_no_evaluables: string[];
    score_global: number;
    nota: string;
    confianza_analisis: string;
  };
  caracteristicas_unicas: string[];
  advertencia?: string;
  tiempo_analisis: number;
  parametros_evaluados: number;
  parametros_no_evaluables: number;
  keyframes_analizados: number;
  tipo_analisis: string;
}

interface ComparisonResult {
  free: AnalysisResult;
  pro: AnalysisResult;
  comparison: {
    diferencia_score: number;
    diferencia_confianza: number;
    diferencia_tiempo: number;
    parametros_extra_pro: number;
    keyframes_extra_pro: number;
    ventajas_pro: string[];
  };
  video_info: {
    duracion: string;
    keyframes_extraidos: number;
    calidad_video: string;
  };
  frameAnalysis: {
    totalFrames: number;
    shotsDetected: number;
    freeFrames: number;
    proFrames: number;
    framesPerShot: {
      free: number;
      pro: number;
    } | null;
    shotDetails: Array<{
      shotIndex: number;
      startTime: number;
      endTime: number;
      duration: number;
      freeFrames: number;
      proFrames: number;
      totalFrames: number;
    }>;
  };
}

export default function TestFreeVsProPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [ageCategory, setAgeCategory] = useState('Sub-15');
  const [playerLevel, setPlayerLevel] = useState('Avanzado');
  const [shotType, setShotType] = useState('Lanzamiento de Tres');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      setError('Por favor selecciona un video');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('ageCategory', ageCategory);
      formData.append('playerLevel', playerLevel);
      formData.append('shotType', shotType);

      const response = await fetch('/api/test-free-vs-pro', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en el análisis');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error al procesar el video');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confianza: string) => {
    switch (confianza) {
      case 'alta': return 'text-green-600 bg-green-100';
      case 'media': return 'text-yellow-600 bg-yellow-100';
      case 'baja': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Correcto': return 'text-green-600 bg-green-100';
      case 'Mejorable': return 'text-yellow-600 bg-yellow-100';
      case 'Incorrecto': return 'text-red-600 bg-red-100';
      case 'no_evaluable': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prueba Análisis FREE vs PRO</h1>
        <p className="text-gray-600">
          Compara el análisis básico (FREE) con el análisis completo (PRO) del mismo video
        </p>
      </div>

      {/* Formulario de entrada */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuración del Análisis</CardTitle>
          <CardDescription>
            Sube un video de tiro de baloncesto. Los parámetros están preconfigurados para pruebas rápidas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="video">Video de Tiro</Label>
            <Input
              id="video"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="mt-1"
            />
            {videoFile && (
              <p className="text-sm text-gray-600 mt-1">
                Archivo seleccionado: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ageCategory" className="flex items-center space-x-2">
                <span>Categoría de Edad</span>
                <Badge variant="outline" className="text-xs">Preconfigurado</Badge>
              </Label>
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
              <Label htmlFor="playerLevel" className="flex items-center space-x-2">
                <span>Nivel del Jugador</span>
                <Badge variant="outline" className="text-xs">Preconfigurado</Badge>
              </Label>
              <Select value={playerLevel} onValueChange={setPlayerLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Principiante">Principiante</SelectItem>
                  <SelectItem value="Intermedio">Intermedio</SelectItem>
                  <SelectItem value="Avanzado">Avanzado</SelectItem>
                  <SelectItem value="Elite">Elite</SelectItem>
                  <SelectItem value="Profesional">Profesional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="shotType" className="flex items-center space-x-2">
                <span>Tipo de Tiro</span>
                <Badge variant="outline" className="text-xs">Preconfigurado</Badge>
              </Label>
              <Select value={shotType} onValueChange={setShotType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo de tiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tiro Libre">Tiro Libre</SelectItem>
                  <SelectItem value="Lanzamiento de Media Distancia (Jump Shot)">Lanzamiento de Media Distancia (Jump Shot)</SelectItem>
                  <SelectItem value="Lanzamiento de Tres">Lanzamiento de Tres</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !videoFile}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Comparar Análisis FREE vs PRO
              </>
            )}
          </Button>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {result && (
        <div className="space-y-6">
          {/* Información del Video */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>Información del Video</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Duración</div>
                  <div className="text-lg font-semibold">{result.free.verificacion_inicial.duracion_video}</div>
                </div>
        <div>
          <div className="text-sm text-gray-600">Tiros Detectados</div>
          <div className="text-lg font-semibold text-blue-600">
            {result.free.verificacion_inicial.deteccion_ia?.total_tiros || 
             result.free.verificacion_inicial.tiros_detectados || 1}
          </div>
          {result.free.verificacion_inicial.deteccion_ia && (
            <div className="text-xs text-gray-500">
              {result.free.verificacion_inicial.deteccion_ia.angulo_detectado} - 
              {result.free.verificacion_inicial.deteccion_ia.estrategia_usada}
            </div>
          )}
        </div>
                <div>
                  <div className="text-sm text-gray-600">Frecuencia de Tiros</div>
                  <div className="text-lg font-semibold text-green-600">
                    {result.free.verificacion_inicial.tiros_por_segundo ? 
                      `${result.free.verificacion_inicial.tiros_por_segundo.toFixed(2)} t/s` : 
                      'N/A'
                    }
                  </div>
                </div>
              </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Análisis:</strong> {result.free.verificacion_inicial.deteccion_ia?.total_tiros > 1 ? 
              `Se detectaron ${result.free.verificacion_inicial.deteccion_ia.total_tiros} tiros en el video (IA). Análisis individual de cada tiro y evaluación de consistencia.` :
              'Video con un solo tiro detectado.'
            }
          </div>
          {result.free.verificacion_inicial.deteccion_ia && (
            <div className="mt-2 text-xs text-blue-700">
              <strong>Detección IA:</strong> {result.free.verificacion_inicial.deteccion_ia.angulo_detectado} - {result.free.verificacion_inicial.deteccion_ia.estrategia_usada}
            </div>
          )}
        </div>
            </CardContent>
          </Card>

          {/* Detección de Tiros por IA */}
          {result.free.verificacion_inicial.deteccion_ia && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Detección de Tiros por IA</span>
                </CardTitle>
                <CardDescription>
                  Análisis visual inteligente de cada tiro individual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-800">
                    <strong>Ángulo detectado:</strong> {result.free.verificacion_inicial.deteccion_ia.angulo_detectado}
                  </div>
                  <div className="text-sm text-green-800">
                    <strong>Estrategia usada:</strong> {result.free.verificacion_inicial.deteccion_ia.estrategia_usada}
                  </div>
                  <div className="text-sm text-green-800">
                    <strong>Total de tiros:</strong> {result.free.verificacion_inicial.deteccion_ia.total_tiros}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold">Tiros Individuales Detectados:</h4>
                  {result.free.verificacion_inicial.deteccion_ia.tiros_individuales.map((tiro, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold">
                          {tiro.numero}
                        </div>
                        <div>
                          <div className="font-medium">{tiro.timestamp}</div>
                          <div className="text-sm text-gray-600">{tiro.descripcion}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información de Detección de Tiros */}
          {result.shotDetection && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Detección de Tiros por IA</span>
                </CardTitle>
                <CardDescription>
                  Análisis visual inteligente sin extracción de frames
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-800">
                    <strong>Método:</strong> {result.shotDetection.method}
                  </div>
                  <div className="text-sm text-green-800 mt-1">
                    <strong>Nota:</strong> {result.shotDetection.note}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen de comparación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Resumen de Comparación</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.comparison.diferencia_score > 0 ? '+' : ''}{result.comparison.diferencia_score}
                  </div>
                  <div className="text-sm text-gray-600">Diferencia de Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    +{result.comparison.parametros_extra_pro}
                  </div>
                  <div className="text-sm text-gray-600">Parámetros Extra PRO</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    +{result.comparison.keyframes_extra_pro}
                  </div>
                  <div className="text-sm text-gray-600">Keyframes Extra PRO</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {result.comparison.diferencia_tiempo > 0 ? '+' : ''}{result.comparison.diferencia_tiempo}s
                  </div>
                  <div className="text-sm text-gray-600">Diferencia de Tiempo</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Análisis FREE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>Análisis FREE</span>
                <Badge variant="outline" className="ml-2">Básico</Badge>
              </CardTitle>
              <CardDescription>
                {result.free.tipo_analisis} - {result.free.keyframes_analizados} keyframes analizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Score Global</div>
                  <div className="text-2xl font-bold">{result.free.resumen_evaluacion.score_global.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Parámetros Evaluados</div>
                  <div className="text-2xl font-bold text-green-600">{result.free.parametros_evaluados}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Confianza</div>
                  <Badge className={getConfidenceColor(result.free.resumen_evaluacion.confianza_analisis)}>
                    {result.free.resumen_evaluacion.confianza_analisis}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-2">Resumen del Análisis</div>
                <p className="text-sm">{result.free.analysisSummary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-green-600 mb-2">Fortalezas</div>
                  <ul className="text-sm space-y-1">
                    {result.free.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium text-red-600 mb-2">Áreas de Mejora</div>
                  <ul className="text-sm space-y-1">
                    {result.free.weaknesses.map((weakness, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Análisis PRO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span>Análisis PRO</span>
                <Badge className="ml-2 bg-purple-100 text-purple-800">Completo</Badge>
              </CardTitle>
              <CardDescription>
                {result.pro.tipo_analisis} - {result.pro.keyframes_analizados} keyframes analizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Score Global</div>
                  <div className="text-2xl font-bold">{result.pro.resumen_evaluacion.score_global.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Parámetros Evaluados</div>
                  <div className="text-2xl font-bold text-green-600">{result.pro.parametros_evaluados}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Confianza</div>
                  <Badge className={getConfidenceColor(result.pro.resumen_evaluacion.confianza_analisis)}>
                    {result.pro.resumen_evaluacion.confianza_analisis}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-2">Resumen del Análisis</div>
                <p className="text-sm">{result.pro.analysisSummary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-green-600 mb-2">Fortalezas</div>
                  <ul className="text-sm space-y-1">
                    {result.pro.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium text-red-600 mb-2">Áreas de Mejora</div>
                  <ul className="text-sm space-y-1">
                    {result.pro.weaknesses.map((weakness, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ventajas del análisis PRO */}
          <Card>
            <CardHeader>
              <CardTitle>Ventajas del Análisis PRO</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.comparison.ventajas_pro.map((ventaja, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{ventaja}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-lg mb-3 flex items-center">
                  <Eye className="w-5 h-5 mr-2 text-purple-600" />
                  Evidencia Visual PRO
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-purple-800 mb-2">✅ Análisis PRO incluye:</h5>
                    <ul className="space-y-1 text-purple-700">
                      <li>• Fotogramas específicos por parámetro</li>
                      <li>• Anotaciones técnicas detalladas</li>
                      <li>• Múltiples ángulos de cámara</li>
                      <li>• Evidencia visual de cada evaluación</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-600 mb-2">❌ Análisis FREE solo incluye:</h5>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Descripción textual básica</li>
                      <li>• Timestamps generales</li>
                      <li>• Sin evidencia visual</li>
                      <li>• Botones bloqueados</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist detallado PRO */}
          <Card>
            <CardHeader>
              <CardTitle>Checklist Detallado - Análisis PRO</CardTitle>
              <CardDescription>
                Evaluación completa de {result.pro.parametros_evaluados} parámetros técnicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {result.pro.detailedChecklist.map((category, categoryIndex) => (
                  <div key={categoryIndex}>
                    <h4 className="font-medium text-lg mb-3">{category.category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{item.name}</span>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(item.status)}>
                                {item.status}
                              </Badge>
                              <EvidenceButton
                                analysisId="test-pro-analysis"
                                paramId={item.id}
                                paramName={item.name}
                                isPro={true}
                                className="text-xs"
                                keyframes={result?.keyframes || []}
                              />
                            </div>
                          </div>
                          {!item.na && (
                            <div className="text-sm text-gray-600 mb-1">
                              Rating: {item.rating}/5
                              {item.timestamp && ` - ${item.timestamp}`}
                            </div>
                          )}
                          <p className="text-sm">{item.comment}</p>
                          {item.evidencia && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              Evidencia: {item.evidencia}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
