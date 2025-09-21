'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, CheckCircle, XCircle, Target, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BasketballMetrics {
  // PREPARACIÓN
  footAlignment: number;
  bodyAlignment: number;
  wristLoaded: boolean;
  kneeFlexion: number;
  shouldersRelaxed: boolean;
  visualFocus: boolean;

  // ASCENSO
  nonDominantHandPosition: number;
  elbowsCloseToBody: boolean;
  ballStraightUp: boolean;
  ballTrajectoryToSetPoint: number;
  setPointHeight: number;
  shotTiming: number;

  // FLUIDEZ
  singleMotion: boolean;
  legSync: number;

  // LIBERACIÓN
  nonDominantHandRelease: boolean;
  fullArmExtension: number;
  ballBackspin: boolean;
  releaseAngle: number;

  // SEGUIMIENTO
  balanceMaintenance: boolean;
  landingBalance: number;
  followThroughDuration: number;
  repetitiveConsistency: number;
}

interface PoseAnalysisResult {
  success: boolean;
  metrics?: BasketballMetrics;
  keyframePoses: any[];
  analysisSummary: string;
  technicalRecommendations: string[];
  overallScore: number;
  error?: string;
}

export default function TestPoseAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [shotType, setShotType] = useState('jump-shot');
  const [ageCategory, setAgeCategory] = useState('adult');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PoseAnalysisResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null); // Limpiar resultado anterior
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('shotType', shotType);
      formData.append('ageCategory', ageCategory);

      const response = await fetch('/api/analyze-pose', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error analizando video:', error);
      setResult({
        success: false,
        keyframePoses: [],
        analysisSummary: 'Error al analizar el video',
        technicalRecommendations: [],
        overallScore: 0,
        error: 'Error de conexión'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const renderMetricCard = (title: string, value: any, unit?: string, target?: string) => {
    const isGood = typeof value === 'number' ? 
      (target ? value >= parseFloat(target.split('-')[0]) && value <= parseFloat(target.split('-')[1]) : value > 0) :
      (typeof value === 'boolean' ? value : true);

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <h4 className="font-medium text-sm">{title}</h4>
          {target && <p className="text-xs text-muted-foreground">Objetivo: {target}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            {typeof value === 'number' ? `${value.toFixed(1)}${unit || ''}` : 
             typeof value === 'boolean' ? (value ? '✅' : '❌') : 
             `${value}${unit || ''}`}
          </span>
          {isGood ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🏀 Análisis Técnico con OpenPose</h1>
        <p className="text-muted-foreground">
          Analiza videos de lanzamiento de baloncesto con tecnología OpenPose para obtener métricas técnicas precisas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Subir Video
            </CardTitle>
            <CardDescription>
              Selecciona un video de lanzamiento de baloncesto para análisis técnico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="video">Video de Lanzamiento</Label>
              <Input
                id="video"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="mt-1"
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-1">
                  Archivo seleccionado: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="shotType">Tipo de Tiro</Label>
              <Select value={shotType} onValueChange={setShotType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jump-shot">Jump Shot (Lanzamiento con Salto)</SelectItem>
                  <SelectItem value="free-throw">Free Throw (Tiro Libre)</SelectItem>
                  <SelectItem value="three-pointer">Three Pointer (Tiro de Tres)</SelectItem>
                  <SelectItem value="layup">Layup (Entrada)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ageCategory">Categoría de Edad</Label>
              <Select value={ageCategory} onValueChange={setAgeCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub-10">Sub-10</SelectItem>
                  <SelectItem value="sub-13">Sub-13</SelectItem>
                  <SelectItem value="sub-15">Sub-15</SelectItem>
                  <SelectItem value="sub-18">Sub-18</SelectItem>
                  <SelectItem value="adult">Adulto Amateur</SelectItem>
                  <SelectItem value="professional">Profesional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleAnalyze} 
              disabled={!file || analyzing}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando con OpenPose...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Analizar Técnica
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Panel de Resultados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resultados del Análisis
            </CardTitle>
            <CardDescription>
              Métricas técnicas extraídas con OpenPose
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sube un video y haz clic en "Analizar Técnica" para ver los resultados</p>
              </div>
            ) : !result.success ? (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h3 className="font-semibold text-red-600 mb-2">Error en el Análisis</h3>
                <p className="text-sm text-muted-foreground">{result.error || 'Error desconocido'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Puntuación General */}
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {result.overallScore}/100
                  </div>
                  <p className="text-sm text-muted-foreground">Puntuación Técnica General</p>
                </div>

                {/* Resumen */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Resumen del Análisis</h3>
                  <p className="text-sm text-muted-foreground">{result.analysisSummary}</p>
                </div>

                {/* Recomendaciones */}
                {result.technicalRecommendations.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold mb-2 text-yellow-800">Recomendaciones Técnicas</h3>
                    <ul className="space-y-1">
                      {result.technicalRecommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-yellow-700">
                          • {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Métricas Técnicas */}
                {result.metrics && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Métricas Técnicas Detalladas</h3>
                    
                    {/* PREPARACIÓN */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-blue-600">🏃 PREPARACIÓN</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {renderMetricCard('Flexión de Rodillas', result.metrics.kneeFlexion, '°', '45-70°')}
                        {renderMetricCard('Alineación de Pies', result.metrics.footAlignment, '°')}
                        {renderMetricCard('Muñeca Cargada', result.metrics.wristLoaded)}
                        {renderMetricCard('Hombros Relajados', result.metrics.shouldersRelaxed)}
                        {renderMetricCard('Enfoque Visual', result.metrics.visualFocus)}
                      </div>
                    </div>

                    {/* LIBERACIÓN */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-green-600">🎯 LIBERACIÓN</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {renderMetricCard('Ángulo de Salida', result.metrics.releaseAngle, '°', '45-52°')}
                        {renderMetricCard('Extensión del Brazo', result.metrics.fullArmExtension, '°')}
                        {renderMetricCard('Backspin', result.metrics.ballBackspin)}
                        {renderMetricCard('Mano No Dominante', result.metrics.nonDominantHandRelease)}
                      </div>
                    </div>

                    {/* FLUIDEZ */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-purple-600">🌊 FLUIDEZ</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {renderMetricCard('Tiro Continuo', result.metrics.singleMotion)}
                        {renderMetricCard('Sincronía Piernas', result.metrics.legSync, '%')}
                      </div>
                    </div>

                    {/* SEGUIMIENTO */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-orange-600">📈 SEGUIMIENTO</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {renderMetricCard('Mantenimiento Equilibrio', result.metrics.balanceMaintenance)}
                        {renderMetricCard('Equilibrio Aterrizaje', result.metrics.landingBalance, '%')}
                        {renderMetricCard('Duración Follow-through', result.metrics.followThroughDuration, 'ms')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Keyframes Detectados */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Keyframes Analizados</h3>
                  <p className="text-sm text-muted-foreground">
                    Se detectaron {result.keyframePoses.length} poses clave en el video
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}