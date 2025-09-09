"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Play, 
  Pause, 
  RotateCw, 
  Download,
  Brain,
  Target,
  Zap
} from "lucide-react";

interface PosePoint {
  x: number;
  y: number;
  confidence: number;
}

interface PoseData {
  keypoints: {
    [key: string]: PosePoint;
  };
  timestamp: number;
  frame: number;
}

interface BiomechanicalMetrics {
  shoulderElbowWristAngle: number;
  hipKneeAnkleAngle: number;
  shoulderHipAlignment: number;
  elbowKneeAlignment: number;
  overallPosture: 'good' | 'fair' | 'poor';
}

interface PoseDetectionProps {
  videoSrc: string;
  onPoseDataChange: (poseData: PoseData[]) => void;
  onMetricsChange: (metrics: BiomechanicalMetrics[]) => void;
  width: number;
  height: number;
}

export function PoseDetection({
  videoSrc,
  onPoseDataChange,
  onMetricsChange,
  width,
  height
}: PoseDetectionProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [poseData, setPoseData] = useState<PoseData[]>([]);
  const [biomechanicalMetrics, setBiomechanicalMetrics] = useState<BiomechanicalMetrics[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [detectionSpeed, setDetectionSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseDetectorRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();

  // Inicializar MediaPipe Pose
  useEffect(() => {
    console.log('🔄 useEffect ejecutándose...');
    console.log('Video src:', videoSrc);
    console.log('Width:', width, 'Height:', height);
    
    const initializePoseDetection = async () => {
      try {
        console.log('🚀 Iniciando carga de MediaPipe...');
        setError('Cargando modelo...');
        
        // Simular carga exitosa por ahora
        setTimeout(() => {
          console.log('✅ Simulando modelo cargado');
          setIsModelLoaded(true);
          setError(null);
        }, 2000);
        
        // TODO: Implementar MediaPipe real
        console.log('⚠️ MediaPipe temporalmente deshabilitado para pruebas');
        
      } catch (err) {
        console.error('❌ Error loading MediaPipe:', err);
        setError(`Error al cargar el modelo: ${err.message}`);
      }
    };

    initializePoseDetection();
  }, [videoSrc, width, height]);

  // Procesar resultados de detección de pose
  const processPoseResults = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;

    const keypoints: { [key: string]: PosePoint } = {};
    const poseNames = [
      'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner', 'right_eye', 'right_eye_outer',
      'left_ear', 'right_ear', 'mouth_left', 'mouth_right', 'left_shoulder', 'right_shoulder', 'left_elbow',
      'right_elbow', 'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky', 'left_index', 'right_index',
      'left_thumb', 'right_thumb', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
      'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index'
    ];

    landmarks.forEach((landmark, index) => {
      if (index < poseNames.length) {
        keypoints[poseNames[index]] = {
          x: landmark.x * width,
          y: landmark.y * height,
          confidence: landmark.visibility || 0
        };
      }
    });

    const newPoseData: PoseData = {
      keypoints,
      timestamp: Date.now(),
      frame: currentFrame
    };

    setPoseData(prev => [...prev, newPoseData]);
    onPoseDataChange([...poseData, newPoseData]);

    // Calcular métricas biomecánicas
    const metrics = calculateBiomechanicalMetrics(keypoints);
    setBiomechanicalMetrics(prev => [...prev, metrics]);
    onMetricsChange([...biomechanicalMetrics, metrics]);
  }, [currentFrame, width, height, poseData, biomechanicalMetrics, onPoseDataChange, onMetricsChange]);

  // Calcular métricas biomecánicas
  const calculateBiomechanicalMetrics = (keypoints: { [key: string]: PosePoint }): BiomechanicalMetrics => {
    const metrics: BiomechanicalMetrics = {
      shoulderElbowWristAngle: 0,
      hipKneeAnkleAngle: 0,
      shoulderHipAlignment: 0,
      elbowKneeAlignment: 0,
      overallPosture: 'fair'
    };

    try {
      // Ángulo hombro-codo-muñeca (brazo derecho)
      if (keypoints.right_shoulder && keypoints.right_elbow && keypoints.right_wrist) {
        metrics.shoulderElbowWristAngle = calculateAngle(
          keypoints.right_shoulder,
          keypoints.right_elbow,
          keypoints.right_wrist
        );
        console.log(`Frame: Ángulo brazo derecho: ${metrics.shoulderElbowWristAngle.toFixed(1)}°`);
      }

      // Ángulo hombro-codo-muñeca (brazo izquierdo)
      if (keypoints.left_shoulder && keypoints.left_elbow && keypoints.left_wrist) {
        const leftArmAngle = calculateAngle(
          keypoints.left_shoulder,
          keypoints.left_elbow,
          keypoints.left_wrist
        );
        console.log(`Frame: Ángulo brazo izquierdo: ${leftArmAngle.toFixed(1)}°`);
      }

      // Ángulo cadera-rodilla-tobillo (pierna derecha)
      if (keypoints.right_hip && keypoints.right_knee && keypoints.right_ankle) {
        metrics.hipKneeAnkleAngle = calculateAngle(
          keypoints.right_hip,
          keypoints.right_knee,
          keypoints.right_ankle
        );
        console.log(`Frame: Ángulo pierna derecha: ${metrics.hipKneeAnkleAngle.toFixed(1)}°`);
      }

      // Alineación hombro-cadera
      if (keypoints.left_shoulder && keypoints.right_shoulder && keypoints.left_hip && keypoints.right_hip) {
        const shoulderSlope = Math.atan2(
          keypoints.right_shoulder.y - keypoints.left_shoulder.y,
          keypoints.right_shoulder.x - keypoints.left_shoulder.x
        );
        const hipSlope = Math.atan2(
          keypoints.right_hip.y - keypoints.left_hip.y,
          keypoints.right_hip.x - keypoints.left_hip.x
        );
        metrics.shoulderHipAlignment = Math.abs(shoulderSlope - hipSlope) * (180 / Math.PI);
        console.log(`Frame: Alineación hombro-cadera: ${metrics.shoulderHipAlignment.toFixed(1)}°`);
      }

      // Alineación codo-rodilla
      if (keypoints.right_elbow && keypoints.right_knee) {
        metrics.elbowKneeAlignment = Math.abs(keypoints.right_elbow.x - keypoints.right_knee.x);
        console.log(`Frame: Alineación codo-rodilla: ${metrics.elbowKneeAlignment.toFixed(1)}px`);
      }

      // Evaluar postura general
      let score = 0;
      if (metrics.shoulderElbowWristAngle > 80 && metrics.shoulderElbowWristAngle < 120) score++;
      if (metrics.hipKneeAnkleAngle > 160 && metrics.hipKneeAnkleAngle < 180) score++;
      if (metrics.shoulderHipAlignment < 10) score++;
      if (metrics.elbowKneeAlignment < 20) score++;

      if (score >= 3) metrics.overallPosture = 'good';
      else if (score >= 1) metrics.overallPosture = 'fair';
      else metrics.overallPosture = 'poor';

      console.log(`Frame: Postura evaluada: ${metrics.overallPosture} (score: ${score}/4)`);

    } catch (err) {
      console.error('Error calculating metrics:', err);
    }

    return metrics;
  };

  // Calcular ángulo entre tres puntos
  const calculateAngle = (A: PosePoint, B: PosePoint, C: PosePoint): number => {
    const v1 = { x: A.x - B.x, y: A.y - B.y };
    const v2 = { x: C.x - B.x, y: C.y - B.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const m1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const m2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const cos = Math.min(1, Math.max(-1, dot / (m1 * m2 || 1)));
    return Math.acos(cos) * 180 / Math.PI;
  };

  // Iniciar detección automática
  const startDetection = useCallback(async () => {
    console.log('🎯 startDetection ejecutándose...');
    console.log('Video ref:', videoRef.current);
    console.log('Video src:', videoSrc);
    
    if (!videoRef.current) {
      console.log('❌ No hay video ref');
      setError('No hay video disponible');
      return;
    }

    setIsDetecting(true);
    setDetectionProgress(0);
    setPoseData([]);
    setBiomechanicalMetrics([]);
    setError(null);

    const video = videoRef.current;
    console.log('📹 Video duration:', video.duration);
    
         // Simular detección por ahora - analizar múltiples frames
     let progress = 0;
     let frameCount = 0;
     const totalFramesToAnalyze = 30; // Analizar 30 frames
     setTotalFrames(totalFramesToAnalyze);
     
     const interval = setInterval(() => {
       progress += 3.33; // 100% / 30 frames
       frameCount++;
       
       setDetectionProgress(progress);
       setCurrentFrame(frameCount);
       
       // Simular datos de pose para cada frame
       const mockPoseData = {
         keypoints: {
           right_shoulder: { x: 100 + frameCount * 2, y: 50 + frameCount, confidence: 0.9 },
           right_elbow: { x: 120 + frameCount * 2, y: 80 + frameCount, confidence: 0.8 },
           right_wrist: { x: 140 + frameCount * 2, y: 110 + frameCount, confidence: 0.7 },
           left_shoulder: { x: 80 + frameCount * 2, y: 50 + frameCount, confidence: 0.9 },
           left_elbow: { x: 60 + frameCount * 2, y: 80 + frameCount, confidence: 0.8 },
           left_wrist: { x: 40 + frameCount * 2, y: 110 + frameCount, confidence: 0.7 },
           right_hip: { x: 100 + frameCount * 2, y: 120 + frameCount, confidence: 0.9 },
           right_knee: { x: 120 + frameCount * 2, y: 150 + frameCount, confidence: 0.8 },
           right_ankle: { x: 140 + frameCount * 2, y: 180 + frameCount, confidence: 0.7 }
         },
         timestamp: Date.now() + frameCount * 100,
         frame: frameCount
       };
       
       setPoseData(prev => [...prev, mockPoseData]);
       onPoseDataChange([...poseData, mockPoseData]);
       
       // Calcular métricas biomecánicas para este frame
       const metrics = calculateBiomechanicalMetrics(mockPoseData.keypoints);
       setBiomechanicalMetrics(prev => [...prev, metrics]);
       onMetricsChange([...biomechanicalMetrics, metrics]);
       
       if (frameCount >= totalFramesToAnalyze) {
         clearInterval(interval);
         setIsDetecting(false);
         console.log('✅ Simulación de detección completada - 30 frames analizados');
       }
     }, 100); // Más rápido para mejor experiencia
    
  }, [videoSrc, onPoseDataChange]);

  // Detener detección
  const stopDetection = () => {
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Exportar datos de pose
  const exportPoseData = () => {
    const data = {
      poseData,
      biomechanicalMetrics,
      metadata: {
        videoSrc,
        totalFrames,
        timestamp: new Date().toISOString()
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pose_analysis_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Análisis Biomecánico con IA
          <Badge variant={isModelLoaded ? "default" : "secondary"}>
            {isModelLoaded ? "Modelo Cargado" : "Cargando..."}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video de entrada */}
        <div className="relative">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-auto max-h-64 rounded-lg"
            muted
            loop
          />
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          />
        </div>

        {/* Controles de detección */}
        <div className="flex items-center gap-4">
          <Button
            onClick={isDetecting ? stopDetection : startDetection}
            disabled={!isModelLoaded || !videoSrc}
            className="flex-1"
          >
            {isDetecting ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Detener Detección
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Detección
              </>
            )}
          </Button>
          
          {/* Estado del modelo */}
          <div className="text-sm">
            {!isModelLoaded && (
              <div className="text-orange-600">
                <span className="animate-pulse">⏳ Cargando modelo...</span>
              </div>
            )}
            {isModelLoaded && (
              <div className="text-green-600">
                ✅ Modelo listo
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={exportPoseData}
            disabled={poseData.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Datos
          </Button>
          
          {/* Botón de prueba */}
          <Button
            variant="outline"
            onClick={() => {
              console.log('Botón de prueba clickeado');
              console.log('Estado del modelo:', isModelLoaded);
              console.log('Pose detector:', poseDetectorRef.current);
              console.log('Video src:', videoSrc);
              alert(`Estado del modelo: ${isModelLoaded ? 'Cargado' : 'No cargado'}`);
            }}
            className="bg-blue-500 text-white hover:bg-blue-600"
          >
            🧪 Probar Estado
          </Button>
        </div>

        {/* Progreso de detección */}
        {isDetecting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso: {detectionProgress.toFixed(1)}%</span>
              <span>Frame: {currentFrame} / {totalFrames}</span>
            </div>
            <Progress value={detectionProgress} className="w-full" />
            <div className="text-sm text-muted-foreground">
              Velocidad: {detectionSpeed.toFixed(1)} FPS
            </div>
          </div>
        )}

        {/* Métricas biomecánicas */}
        {biomechanicalMetrics.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Métricas Biomecánicas
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Ángulo Hombro-Codo-Muñeca:</span>
                  <div className="text-lg font-bold text-primary">
                    {biomechanicalMetrics[biomechanicalMetrics.length - 1]?.shoulderElbowWristAngle.toFixed(1)}°
                  </div>
                </div>
                
                <div className="text-sm">
                  <span className="font-medium">Ángulo Cadera-Rodilla-Tobillo:</span>
                  <div className="text-lg font-bold text-primary">
                    {biomechanicalMetrics[biomechanicalMetrics.length - 1]?.hipKneeAnkleAngle.toFixed(1)}°
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Alineación Hombro-Cadera:</span>
                  <div className="text-lg font-bold text-primary">
                    {biomechanicalMetrics[biomechanicalMetrics.length - 1]?.shoulderHipAlignment.toFixed(1)}°
                  </div>
                </div>
                
                <div className="text-sm">
                  <span className="font-medium">Postura General:</span>
                  <Badge 
                    variant={
                      biomechanicalMetrics[biomechanicalMetrics.length - 1]?.overallPosture === 'good' ? 'default' :
                      biomechanicalMetrics[biomechanicalMetrics.length - 1]?.overallPosture === 'fair' ? 'secondary' : 'destructive'
                    }
                    className="text-lg px-3 py-1"
                  >
                    {biomechanicalMetrics[biomechanicalMetrics.length - 1]?.overallPosture === 'good' ? 'Buena' :
                     biomechanicalMetrics[biomechanicalMetrics.length - 1]?.overallPosture === 'fair' ? 'Regular' : 'Mala'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Gráfico de progreso temporal */}
            <div className="mt-4">
              <h5 className="text-sm font-medium mb-2">Evolución Temporal de la Postura</h5>
              <div className="h-20 bg-muted rounded-lg p-2 flex items-end gap-1">
                {biomechanicalMetrics.slice(-20).map((metric, index) => (
                  <div
                    key={index}
                    className={`flex-1 rounded-sm ${
                      metric.overallPosture === 'good' ? 'bg-green-500' :
                      metric.overallPosture === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${(index + 1) * 5}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

                 {/* Estadísticas */}
         {poseData.length > 0 && (
           <div className="space-y-4">
             <h4 className="font-medium text-center">📊 Resumen del Análisis Completo</h4>
             <div className="grid grid-cols-3 gap-4 text-center">
               <div className="p-3 bg-muted rounded-lg">
                 <div className="text-2xl font-bold text-primary">{poseData.length}</div>
                 <div className="text-sm text-muted-foreground">Frames Analizados</div>
               </div>
               <div className="p-3 bg-muted rounded-lg">
                 <div className="text-2xl font-bold text-primary">
                   {biomechanicalMetrics.filter(m => m.overallPosture === 'good').length}
                 </div>
                 <div className="text-sm text-muted-foreground">Frames con Buena Postura</div>
               </div>
               <div className="p-3 bg-muted rounded-lg">
                 <div className="text-2xl font-bold text-primary">
                   {biomechanicalMetrics.length > 0 ? 
                     ((biomechanicalMetrics.filter(m => m.overallPosture === 'good').length / biomechanicalMetrics.length) * 100).toFixed(1) : 
                     '0'
                   }%
                 </div>
                 <div className="text-sm text-muted-foreground">Porcentaje de Buena Postura</div>
               </div>
             </div>
             
             {/* Métricas promedio */}
             {biomechanicalMetrics.length > 0 && (
               <div className="grid grid-cols-2 gap-4 text-center">
                 <div className="p-3 bg-blue-50 rounded-lg">
                   <div className="text-sm font-medium text-blue-700">Ángulo Promedio Brazo</div>
                   <div className="text-lg font-bold text-blue-800">
                     {(biomechanicalMetrics.reduce((sum, m) => sum + m.shoulderElbowWristAngle, 0) / biomechanicalMetrics.length).toFixed(1)}°
                   </div>
                 </div>
                 <div className="p-3 bg-green-50 rounded-lg">
                   <div className="text-sm font-medium text-green-700">Ángulo Promedio Pierna</div>
                   <div className="text-lg font-bold text-green-800">
                     {(biomechanicalMetrics.reduce((sum, m) => sum + m.hipKneeAnkleAngle, 0) / biomechanicalMetrics.length).toFixed(1)}°
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}

        {/* Mensaje de error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
