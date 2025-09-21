'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, Clock, Eye, EyeOff } from 'lucide-react';

interface VerificationData {
  duracion_video: string;
  mano_tiro: string;
  salta: boolean;
  canasta_visible: boolean;
  angulo_camara: string;
  elementos_entorno: string[];
}

interface EvaluationSummary {
  parametros_evaluados: number;
  parametros_no_evaluables: number;
  lista_no_evaluables: string[];
  score_global: number;
  nota: string;
  confianza_analisis: 'alta' | 'media' | 'baja';
}

interface ChecklistItem {
  id: string;
  name: string;
  status: 'Correcto' | 'Mejorable' | 'Incorrecto' | 'no_evaluable';
  rating: number;
  timestamp?: string;
  evidencia?: string;
  na: boolean;
  razon?: string;
  comment: string;
}

interface ChecklistCategory {
  category: string;
  items: ChecklistItem[];
}

interface AnalysisResult {
  verificacion_inicial: VerificationData;
  analysisSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  selectedKeyframes: number[];
  keyframeAnalysis: string;
  detailedChecklist: ChecklistCategory[];
  resumen_evaluacion: EvaluationSummary;
  caracteristicas_unicas: string[];
  advertencia?: string;
}

export default function TestNewPromptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const analyzeVideo = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/test-new-prompt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el análisis');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'alta': return 'bg-green-100 text-green-800';
      case 'media': return 'bg-yellow-100 text-yellow-800';
      case 'baja': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Correcto': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Mejorable': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'Incorrecto': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'no_evaluable': return <EyeOff className="h-4 w-4 text-gray-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Correcto': return 'bg-green-100 text-green-800';
      case 'Mejorable': return 'bg-yellow-100 text-yellow-800';
      case 'Incorrecto': return 'bg-red-100 text-red-800';
      case 'no_evaluable': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🧪 Prueba del Nuevo Prompt Anti-Simulación</h1>
        <p className="text-muted-foreground">
          Prueba el prompt definitivo que combina análisis forense + sistema "no evaluable"
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📹 Subir Video de Prueba</CardTitle>
          <CardDescription>
            Sube un video de lanzamiento para probar el nuevo sistema de análisis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="w-full p-2 border rounded-md"
                disabled={loading}
              />
            </div>
            <Button 
              onClick={analyzeVideo} 
              disabled={!file || loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Analizando...
                </div>
              ) : (
                'Analizar Video'
              )}
            </Button>
          </div>
          {file && (
            <div className="mt-2 text-sm text-muted-foreground">
              Archivo seleccionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              <br />
              <span className="text-xs">
                ⏱️ El análisis puede tardar 1-3 minutos dependiendo del tamaño del video
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Verification Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Verificación Inicial (Anti-Simulación)
              </CardTitle>
              <CardDescription>
                Demuestra que la IA realmente está viendo el video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <strong>Duración:</strong> {result.verificacion_inicial.duracion_video}
                </div>
                <div>
                  <strong>Mano de tiro:</strong> {result.verificacion_inicial.mano_tiro}
                </div>
                <div>
                  <strong>Salta:</strong> {result.verificacion_inicial.salta ? 'Sí' : 'No'}
                </div>
                <div>
                  <strong>Canasta visible:</strong> {result.verificacion_inicial.canasta_visible ? 'Sí' : 'No'}
                </div>
                <div>
                  <strong>Ángulo:</strong> {result.verificacion_inicial.angulo_camara}
                </div>
                <div>
                  <strong>Elementos entorno:</strong> {result.verificacion_inicial.elementos_entorno.join(', ')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evaluation Summary */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Resumen de Evaluación</CardTitle>
              <CardDescription>
                Transparencia total sobre qué se pudo y qué no se pudo evaluar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.resumen_evaluacion.parametros_evaluados}
                  </div>
                  <div className="text-sm text-muted-foreground">Evaluados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.resumen_evaluacion.parametros_no_evaluables}
                  </div>
                  <div className="text-sm text-muted-foreground">No Evaluables</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.resumen_evaluacion.score_global.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Score Global</div>
                </div>
                <div className="text-center">
                  <Badge className={getConfidenceColor(result.resumen_evaluacion.confianza_analisis)}>
                    {result.resumen_evaluacion.confianza_analisis.toUpperCase()}
                  </Badge>
                  <div className="text-sm text-muted-foreground mt-1">Confianza</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <p><strong>Nota:</strong> {result.resumen_evaluacion.nota}</p>
                {result.resumen_evaluacion.lista_no_evaluables.length > 0 && (
                  <div>
                    <strong>Parámetros no evaluables:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1">
                      {result.resumen_evaluacion.lista_no_evaluables.map((item, index) => (
                        <li key={index} className="text-sm text-muted-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Unique Characteristics */}
          <Card>
            <CardHeader>
              <CardTitle>🔍 Características Únicas del Video</CardTitle>
              <CardDescription>
                Detalles específicos que prueban análisis real (no simulación)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {result.caracteristicas_unicas.map((char, index) => (
                  <li key={index}>{char}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Warning */}
          {result.advertencia && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{result.advertencia}</AlertDescription>
            </Alert>
          )}

          {/* Analysis Results */}
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="strengths">Fortalezas</TabsTrigger>
              <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>📝 Resumen del Análisis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{result.analysisSummary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>⚠️ Debilidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1">
                    {result.weaknesses.map((weakness, index) => (
                      <li key={index}>{weakness}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              {result.detailedChecklist.map((category, categoryIndex) => (
                <Card key={categoryIndex}>
                  <CardHeader>
                    <CardTitle>{category.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(item.status)}
                              <span className="font-medium">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(item.status)}>
                                {item.status}
                              </Badge>
                              {item.rating > 0 && (
                                <Badge variant="outline">
                                  {item.rating}/5
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {item.timestamp && (
                              <div><Clock className="h-3 w-3 inline mr-1" />{item.timestamp}</div>
                            )}
                            {item.evidencia && (
                              <div><strong>Evidencia:</strong> {item.evidencia}</div>
                            )}
                            {item.razon && (
                              <div><strong>Razón:</strong> {item.razon}</div>
                            )}
                            <div><strong>Comentario:</strong> {item.comment}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="strengths" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>💪 Fortalezas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1">
                    {result.strengths.map((strength, index) => (
                      <li key={index}>{strength}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>🎯 Recomendaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1">
                    {result.recommendations.map((recommendation, index) => (
                      <li key={index}>{recommendation}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
