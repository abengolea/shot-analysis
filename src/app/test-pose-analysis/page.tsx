'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Video, Brain, Target, Zap, CheckCircle, XCircle } from 'lucide-react';

interface PoseAnalysisResult {
  success: boolean;
  message: string;
  video_info: {
    original_name: string;
    original_size: number;
    processed_size: number;
    duration: string;
    fps: number;
    resolution: string;
    video_url: string;
  };
  pose_detection: {
    frames_processed: number;
    keypoints_per_frame: number;
    total_keypoints: number;
  };
  biomechanical_analysis: {
    angles_calculated: number;
    phases_detected: {
      start: number;
      load: number;
      release: number;
      apex: number;
      landing: number;
    };
    sample_angles: Array<{
      tMs: number;
      elbowAngle: number | null;
      kneeAngle: number | null;
      hipAngle: number | null;
      wristAngle: number | null;
    }>;
  };
  ai_analysis: any;
  processing_time: string;
}

export default function TestPoseAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PoseAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);

      // Simular progreso
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 1000);

      const response = await fetch('/api/test-pose-analysis', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Error en el análisis');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatTime = (tMs: number) => {
    return (tMs / 1000).toFixed(1) + 's';
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Análisis con Pose Detection</h1>
          <p className="text-muted-foreground">
            Análisis avanzado de tiros de baloncesto con detección de poses y métricas biomecánicas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Subir Video
            </CardTitle>
            <CardDescription>
              Sube un video de tiro de baloncesto. Se procesará a 5 FPS para IA y 12 FPS para pose detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="w-full p-2 border rounded-md"
              disabled={isAnalyzing}
            />
            
            {file && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)} • {file.type}
                </p>
              </div>
            )}

            <Button 
              onClick={handleAnalyze} 
              disabled={!file || isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Iniciar Análisis Avanzado
                </>
              )}
            </Button>

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Procesando...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Resultado del Análisis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-md">
                    <p className="text-2xl font-bold text-blue-600">{result.video_info.fps} FPS</p>
                    <p className="text-xs text-muted-foreground">Procesamiento</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-md">
                    <p className="text-2xl font-bold text-green-600">{result.video_info.duration}</p>
                    <p className="text-xs text-muted-foreground">Duración</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-md">
                    <p className="text-2xl font-bold text-purple-600">{result.pose_detection.frames_processed}</p>
                    <p className="text-xs text-muted-foreground">Frames</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-md">
                    <p className="text-2xl font-bold text-orange-600">{result.pose_detection.total_keypoints}</p>
                    <p className="text-xs text-muted-foreground">Keypoints</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Detección de Poses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Frames Procesados</h4>
                    <p className="text-2xl font-bold text-blue-600">{result.pose_detection.frames_processed}</p>
                    <p className="text-sm text-muted-foreground">A 12 FPS</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Keypoints por Frame</h4>
                    <p className="text-2xl font-bold text-green-600">{result.pose_detection.keypoints_per_frame}</p>
                    <p className="text-sm text-muted-foreground">Puntos de pose</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Total Keypoints</h4>
                    <p className="text-2xl font-bold text-purple-600">{result.pose_detection.total_keypoints}</p>
                    <p className="text-sm text-muted-foreground">Datos biomecánicos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Análisis Biomecánico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Fases del Tiro</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Inicio:</span>
                        <Badge variant="outline">{formatTime(result.biomechanical_analysis.phases_detected.start * 1000 / 12)}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Carga:</span>
                        <Badge variant="outline">{formatTime(result.biomechanical_analysis.phases_detected.load * 1000 / 12)}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Liberación:</span>
                        <Badge variant="outline">{formatTime(result.biomechanical_analysis.phases_detected.release * 1000 / 12)}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Ápice:</span>
                        <Badge variant="outline">{formatTime(result.biomechanical_analysis.phases_detected.apex * 1000 / 12)}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Aterrizaje:</span>
                        <Badge variant="outline">{formatTime(result.biomechanical_analysis.phases_detected.landing * 1000 / 12)}</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Ángulos Calculados</h4>
                    <p className="text-2xl font-bold text-orange-600">{result.biomechanical_analysis.angles_calculated}</p>
                    <p className="text-sm text-muted-foreground">Frames con datos</p>
                    
                    <div className="mt-3 space-y-1">
                      <h5 className="text-sm font-medium">Muestra de Ángulos:</h5>
                      {result.biomechanical_analysis.sample_angles.slice(0, 3).map((angle, i) => (
                        <div key={i} className="text-xs text-muted-foreground">
                          Frame {i + 1}: Codo {angle.elbowAngle?.toFixed(1)}° | Rodilla {angle.kneeAngle?.toFixed(1)}°
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis de IA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Resumen:</strong> {result.ai_analysis.analysisSummary}</p>
                  <p><strong>Tiros Detectados:</strong> {result.ai_analysis.verificacion_inicial?.tiros_detectados || 'N/A'}</p>
                  <p><strong>Score Global:</strong> {result.ai_analysis.resumen_evaluacion?.score_global || 'N/A'}/5</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}