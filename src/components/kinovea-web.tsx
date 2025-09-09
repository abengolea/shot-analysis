"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Video, 
  Ruler, 
  Brain, 
  Download, 
  Settings,
  Split,
  RotateCcw,
  FileText,
  BarChart3
} from "lucide-react";
import { VideoPlayer } from "./video-player";
import { MeasurementTools, type MeasurementTool, type MeasurementLayer } from "./measurement-tools";
import dynamic from "next/dynamic";
import { PoseDetection } from "./pose-detection";

// Importar MeasurementCanvas dinámicamente para evitar problemas de SSR
const MeasurementCanvas = dynamic(() => import("./measurement-canvas").then(mod => ({ default: mod.MeasurementCanvas })), {
  ssr: false,
  loading: () => <div className="p-4 text-center">Cargando canvas de medición...</div>
});

interface KinoveaWebProps {
  videoSrc: string;
  width?: number;
  height?: number;
}

export function KinoveaWeb({ videoSrc, width = 800, height = 600 }: KinoveaWebProps) {
  // Estados principales
  const [selectedTool, setSelectedTool] = useState<MeasurementTool>('select');
  const [measurementLayers, setMeasurementLayers] = useState<MeasurementLayer[]>([]);
  const [calibrationFactor, setCalibrationFactor] = useState(0);
  const [bookmarks, setBookmarks] = useState<Array<{ time: number; label: string; id: string }>>([]);
  const [poseData, setPoseData] = useState<any[]>([]);
  const [biomechanicalMetrics, setBiomechanicalMetrics] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [comparisonVideo, setComparisonVideo] = useState<string | null>(null);

  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Manejadores de eventos
  const handleFrameChange = (time: number, frame: number) => {
    setCurrentTime(time);
    setCurrentFrame(frame);
  };

  const handleBookmarkAdd = (time: number, label: string) => {
    const newBookmark = {
      id: `bookmark_${Date.now()}`,
      time,
      label
    };
    setBookmarks(prev => [...prev, newBookmark]);
  };

  const handleLayerChange = (layers: MeasurementLayer[]) => {
    setMeasurementLayers(layers);
  };

  const handleLayerToggle = (layerId: string, visible: boolean) => {
    setMeasurementLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, visible } : layer
      )
    );
  };

  const handleLayerLock = (layerId: string, locked: boolean) => {
    setMeasurementLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, locked } : layer
      )
    );
  };

  const handleLayerDelete = (layerId: string) => {
    setMeasurementLayers(prev => prev.filter(layer => layer.id !== layerId));
  };

  const handleExport = () => {
    // Exportar mediciones como JSON
    const exportData = {
      measurements: measurementLayers,
      calibration: calibrationFactor,
      bookmarks,
      poseData,
      biomechanicalMetrics,
      metadata: {
        videoSrc,
        timestamp: new Date().toISOString(),
        totalMeasurements: measurementLayers.length
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kinovea_analysis_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    setMeasurementLayers([]);
    setBookmarks([]);
    setPoseData([]);
    setBiomechanicalMetrics([]);
  };

  const handleCalibrationChange = (factor: number) => {
    setCalibrationFactor(factor);
  };

  const handlePoseDataChange = (data: any[]) => {
    setPoseData(data);
  };

  const handleMetricsChange = (metrics: any[]) => {
    setBiomechanicalMetrics(metrics);
  };

  const handleComparisonVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setComparisonVideo(url);
    }
  };

  const exportCanvasAsImage = () => {
    if (canvasRef.current) {
      const dataURL = canvasRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = `kinovea_canvas_${Date.now()}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  const exportVideoWithOverlay = () => {
    // Implementar exportación de video con overlay usando ffmpeg.wasm
    alert('Funcionalidad de exportación de video en desarrollo');
  };

  return (
    <div className="w-full space-y-6">
      {/* Header principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="h-6 w-6" />
              <span>Kinovea Web - Análisis Biomecánico</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Frame: {currentFrame}
              </Badge>
              <Badge variant="outline">
                {currentTime.toFixed(2)}s
              </Badge>
              <Badge variant={calibrationFactor > 0 ? "default" : "secondary"}>
                {calibrationFactor > 0 ? 'Calibrado' : 'Sin calibrar'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setShowSideBySide(!showSideBySide)}
              className="flex items-center gap-2"
            >
              <Split className="h-4 w-4" />
              {showSideBySide ? 'Vista Simple' : 'Vista Lado a Lado'}
            </Button>
            
            <input
              type="file"
              accept="video/*"
              onChange={handleComparisonVideoUpload}
              className="hidden"
              id="comparison-video"
            />
            <label htmlFor="comparison-video">
              <Button variant="outline" asChild>
                <span>Video de Comparación</span>
              </Button>
            </label>

            <Separator orientation="vertical" className="h-6" />
            
            <Button onClick={exportCanvasAsImage} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar Canvas
            </Button>
            
            <Button onClick={exportVideoWithOverlay} variant="outline">
              <Video className="h-4 w-4 mr-2" />
              Exportar Video
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      <div className={`grid gap-6 ${showSideBySide ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Panel izquierdo - Video y Canvas */}
        <div className="space-y-6">
          {/* Reproductor de video */}
          <VideoPlayer
            src={videoSrc}
            onFrameChange={handleFrameChange}
            onBookmarkAdd={handleBookmarkAdd}
            bookmarks={bookmarks}
          />

          {/* Canvas de medición */}
          <MeasurementCanvas
            videoSrc={videoSrc}
            selectedTool={selectedTool}
            layers={measurementLayers}
            onLayerChange={handleLayerChange}
            calibrationFactor={calibrationFactor}
            width={width}
            height={height}
          />
        </div>

        {/* Panel derecho - Herramientas y análisis */}
        <div className="space-y-6">
          {/* Herramientas de medición */}
          <MeasurementTools
            selectedTool={selectedTool}
            onToolSelect={setSelectedTool}
            layers={measurementLayers}
            onLayerToggle={handleLayerToggle}
            onLayerLock={handleLayerLock}
            onLayerDelete={handleLayerDelete}
            onExport={handleExport}
            onClearAll={handleClearAll}
            calibrationFactor={calibrationFactor}
            onCalibrationChange={handleCalibrationChange}
          />

          {/* Análisis de pose con IA */}
          <PoseDetection
            videoSrc={videoSrc}
            onPoseDataChange={handlePoseDataChange}
            onMetricsChange={handleMetricsChange}
            width={width}
            height={height}
          />
        </div>
      </div>

      {/* Vista lado a lado */}
      {showSideBySide && comparisonVideo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Split className="h-5 w-5" />
              Comparación Lado a Lado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Video Original</h4>
                <VideoPlayer
                  src={videoSrc}
                  onFrameChange={handleFrameChange}
                  onBookmarkAdd={handleBookmarkAdd}
                  bookmarks={bookmarks}
                />
              </div>
              <div>
                <h4 className="font-medium mb-3">Video de Comparación</h4>
                <VideoPlayer
                  src={comparisonVideo}
                  onFrameChange={() => {}}
                  onBookmarkAdd={() => {}}
                  bookmarks={[]}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análisis y reportes */}
      <Tabs defaultValue="measurements" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="measurements">
            <Ruler className="mr-2 h-4 w-4" />
            Mediciones
          </TabsTrigger>
          <TabsTrigger value="pose-analysis">
            <Brain className="mr-2 h-4 w-4" />
            Análisis de Pose
          </TabsTrigger>
          <TabsTrigger value="biomechanics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Biomecánica
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="measurements" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Mediciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {measurementLayers.filter(l => l.type === 'ruler').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Distancias</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {measurementLayers.filter(l => l.type === 'angle').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Ángulos</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {measurementLayers.filter(l => l.type === 'line').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Líneas</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {measurementLayers.filter(l => l.type === 'text').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Anotaciones</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pose-analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Pose con IA</CardTitle>
            </CardHeader>
            <CardContent>
              {poseData.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">{poseData.length}</div>
                      <div className="text-sm text-muted-foreground">Frames Analizados</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {biomechanicalMetrics.filter(m => m.overallPosture === 'good').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Buena Postura</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {((biomechanicalMetrics.filter(m => m.overallPosture === 'good').length / biomechanicalMetrics.length) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Porcentaje</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay datos de análisis de pose</p>
                  <p className="text-sm">Ejecuta el análisis de pose para ver los resultados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biomechanics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Métricas Biomecánicas</CardTitle>
            </CardHeader>
            <CardContent>
              {biomechanicalMetrics.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h5 className="font-medium">Ángulos Promedio</h5>
                      <div className="text-sm space-y-1">
                        <div>Hombro-Codo-Muñeca: {
                          (biomechanicalMetrics.reduce((sum, m) => sum + m.shoulderElbowWristAngle, 0) / biomechanicalMetrics.length).toFixed(1)
                        }°</div>
                        <div>Cadera-Rodilla-Tobillo: {
                          (biomechanicalMetrics.reduce((sum, m) => sum + m.hipKneeAnkleAngle, 0) / biomechanicalMetrics.length).toFixed(1)
                        }°</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-medium">Alineaciones</h5>
                      <div className="text-sm space-y-1">
                        <div>Hombro-Cadera: {
                          (biomechanicalMetrics.reduce((sum, m) => sum + m.shoulderHipAlignment, 0) / biomechanicalMetrics.length).toFixed(1)
                        }°</div>
                        <div>Codo-Rodilla: {
                          (biomechanicalMetrics.reduce((sum, m) => sum + m.elbowKneeAlignment, 0) / biomechanicalMetrics.length).toFixed(1)
                        }px</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay métricas biomecánicas</p>
                  <p className="text-sm">Ejecuta el análisis de pose para calcular las métricas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Exportar Análisis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={handleExport} className="h-20">
                  <FileText className="h-6 w-6 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Datos JSON</div>
                    <div className="text-sm opacity-80">Todas las mediciones y análisis</div>
                  </div>
                </Button>
                
                <Button onClick={exportCanvasAsImage} variant="outline" className="h-20">
                  <Download className="h-6 w-6 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Imagen PNG</div>
                    <div className="text-sm opacity-80">Canvas con mediciones</div>
                  </div>
                </Button>
                
                <Button onClick={exportVideoWithOverlay} variant="outline" className="h-20">
                  <Video className="h-6 w-6 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Video con Overlay</div>
                    <div className="text-sm opacity-80">Video con mediciones</div>
                  </div>
                </Button>
                
                <Button variant="outline" className="h-20" disabled>
                  <Settings className="h-6 w-6 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Reporte PDF</div>
                    <div className="text-sm opacity-80">Próximamente</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Canvas oculto para exportación */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="hidden"
      />
    </div>
  );
}
