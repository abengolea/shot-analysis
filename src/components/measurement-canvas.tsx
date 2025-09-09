"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Line, Circle, Rect, Text, Group } from "react-konva";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  RotateCw, 
  Trash2, 
  Eye, 
  EyeOff,
  Lock,
  Unlock
} from "lucide-react";
import type { MeasurementTool, MeasurementLayer } from "./measurement-tools";

interface Point {
  x: number;
  y: number;
}

interface MeasurementData {
  points: Point[];
  distance?: number;
  angle?: number;
  text?: string;
  radius?: number;
  width?: number;
  height?: number;
}

interface MeasurementCanvasProps {
  videoSrc: string;
  selectedTool: MeasurementTool;
  layers: MeasurementLayer[];
  onLayerChange: (layers: MeasurementLayer[]) => void;
  calibrationFactor: number;
  width: number;
  height: number;
}

export function MeasurementCanvas({
  videoSrc,
  selectedTool,
  layers,
  onLayerChange,
  calibrationFactor,
  width,
  height
}: MeasurementCanvasProps) {
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoImage, setVideoImage] = useState<HTMLImageElement | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);

  const stageRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Inicializar video
  useEffect(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current);
    }
  }, []);

  // Capturar frame actual del video
  const captureCurrentFrame = useCallback(() => {
    if (!videoElement || !videoElement.videoWidth) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0);
      const img = new Image();
      img.src = canvas.toDataURL();
      setVideoImage(img);
      return img;
    }
    return null;
  }, [videoElement]);

  // Calcular distancia entre dos puntos
  const calculateDistance = (p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // Calcular ángulo entre tres puntos (B es el vértice)
  const calculateAngle = (A: Point, B: Point, C: Point): number => {
    const v1 = { x: A.x - B.x, y: A.y - B.y };
    const v2 = { x: C.x - B.x, y: C.y - B.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const m1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const m2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const cos = Math.min(1, Math.max(-1, dot / (m1 * m2 || 1)));
    return Math.acos(cos) * 180 / Math.PI;
  };

  // Convertir px a cm usando factor de calibración
  const pxToCm = (px: number): number => {
    return calibrationFactor > 0 ? px / calibrationFactor : px;
  };

  // Manejadores de eventos del canvas
  const handleMouseDown = (e: any) => {
    if (selectedTool === 'eraser') return;
    
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setCurrentPoints([pos]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || selectedTool === 'eraser') return;
    
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;

    if (selectedTool === 'line' || selectedTool === 'ruler') {
      setCurrentPoints([currentPoints[0], pos]);
    } else if (selectedTool === 'angle') {
      if (currentPoints.length < 3) {
        setCurrentPoints([...currentPoints, pos]);
      }
    } else if (selectedTool === 'circle') {
      const radius = calculateDistance(currentPoints[0], pos);
      setCurrentPoints([currentPoints[0], { x: pos.x, y: pos.y, radius } as any]);
    } else if (selectedTool === 'rectangle') {
      setCurrentPoints([currentPoints[0], pos]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || selectedTool === 'eraser') return;

    if (currentPoints.length > 0) {
      createMeasurement();
    }
    
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  // Crear nueva medición
  const createMeasurement = () => {
    if (currentPoints.length === 0) return;

    const newLayer: MeasurementLayer = {
      id: `measurement_${Date.now()}`,
      type: selectedTool,
      visible: true,
      locked: false,
      data: {},
      label: generateLabel(selectedTool)
    };

    switch (selectedTool) {
      case 'line':
        newLayer.data = {
          points: currentPoints,
          distance: calculateDistance(currentPoints[0], currentPoints[1])
        };
        break;
      
      case 'ruler':
        newLayer.data = {
          points: currentPoints,
          distance: calculateDistance(currentPoints[0], currentPoints[1])
        };
        break;
      
      case 'angle':
        if (currentPoints.length === 3) {
          newLayer.data = {
            points: currentPoints,
            angle: calculateAngle(currentPoints[0], currentPoints[1], currentPoints[2])
          };
        }
        break;
      
      case 'circle':
        if (currentPoints.length === 2) {
          const radius = calculateDistance(currentPoints[0], currentPoints[1]);
          newLayer.data = {
            points: [currentPoints[0]],
            radius
          };
        }
        break;
      
      case 'rectangle':
        if (currentPoints.length === 2) {
          const width = Math.abs(currentPoints[1].x - currentPoints[0].x);
          const height = Math.abs(currentPoints[1].y - currentPoints[0].y);
          newLayer.data = {
            points: currentPoints,
            width,
            height
          };
        }
        break;
      
      case 'text':
        const text = prompt('Ingresa el texto de la anotación:');
        if (text) {
          newLayer.data = {
            points: currentPoints,
            text
          };
        }
        break;
    }

    if (newLayer.data.points && newLayer.data.points.length > 0) {
      onLayerChange([...layers, newLayer]);
    }
  };

  // Generar etiqueta para la medición
  const generateLabel = (tool: MeasurementTool): string => {
    const count = layers.filter(l => l.type === tool).length + 1;
    switch (tool) {
      case 'line': return `Línea ${count}`;
      case 'ruler': return `Regla ${count}`;
      case 'angle': return `Ángulo ${count}`;
      case 'circle': return `Círculo ${count}`;
      case 'rectangle': return `Rectángulo ${count}`;
      case 'text': return `Texto ${count}`;
      default: return `Medición ${count}`;
    }
  };

  // Renderizar mediciones
  const renderMeasurements = () => {
    return layers.map((layer) => {
      if (!layer.visible) return null;

      const { data } = layer;
      
      switch (layer.type) {
        case 'line':
        case 'ruler':
          if (data.points && data.points.length === 2) {
            return (
              <Group key={layer.id}>
                <Line
                  points={[data.points[0].x, data.points[0].y, data.points[1].x, data.points[1].y]}
                  stroke={layer.locked ? "#666" : "#00ff00"}
                  strokeWidth={2}
                  dash={layer.type === 'ruler' ? [5, 5] : []}
                />
                {layer.type === 'ruler' && data.distance && (
                  <Text
                    x={(data.points[0].x + data.points[1].x) / 2}
                    y={(data.points[0].y + data.points[1].y) / 2 - 10}
                    text={`${data.distance.toFixed(1)}px (${pxToCm(data.distance).toFixed(1)}cm)`}
                    fontSize={12}
                    fill="#00ff00"
                    backgroundColor="#000"
                    padding={2}
                  />
                )}
              </Group>
            );
          }
          break;

        case 'angle':
          if (data.points && data.points.length === 3 && data.angle) {
            return (
              <Group key={layer.id}>
                <Line
                  points={[data.points[0].x, data.points[0].y, data.points[1].x, data.points[1].y]}
                  stroke="#00ff00"
                  strokeWidth={2}
                />
                <Line
                  points={[data.points[1].x, data.points[1].y, data.points[2].x, data.points[2].y]}
                  stroke="#00ff00"
                  strokeWidth={2}
                />
                <Circle
                  x={data.points[1].x}
                  y={data.points[1].y}
                  radius={3}
                  fill="#00ff00"
                />
                <Text
                  x={data.points[1].x + 10}
                  y={data.points[1].y - 10}
                  text={`${data.angle.toFixed(1)}°`}
                  fontSize={12}
                  fill="#00ff00"
                  backgroundColor="#000"
                  padding={2}
                />
              </Group>
            );
          }
          break;

        case 'circle':
          if (data.points && data.points.length === 1 && data.radius) {
            return (
              <Group key={layer.id}>
                <Circle
                  x={data.points[0].x}
                  y={data.points[0].y}
                  radius={data.radius}
                  stroke="#00ff00"
                  strokeWidth={2}
                  fill="transparent"
                />
                <Text
                  x={data.points[0].x + data.radius + 5}
                  y={data.points[0].y}
                  text={`R: ${data.radius.toFixed(1)}px (${pxToCm(data.radius).toFixed(1)}cm)`}
                  fontSize={12}
                  fill="#00ff00"
                  backgroundColor="#000"
                  padding={2}
                />
              </Group>
            );
          }
          break;

        case 'rectangle':
          if (data.points && data.points.length === 2 && data.width && data.height) {
            return (
              <Group key={layer.id}>
                <Rect
                  x={Math.min(data.points[0].x, data.points[1].x)}
                  y={Math.min(data.points[0].y, data.points[1].y)}
                  width={data.width}
                  height={data.height}
                  stroke="#00ff00"
                  strokeWidth={2}
                  fill="transparent"
                />
                <Text
                  x={Math.min(data.points[0].x, data.points[1].x)}
                  y={Math.min(data.points[0].y, data.points[1].y) - 10}
                  text={`${data.width.toFixed(1)}x${data.height.toFixed(1)}px`}
                  fontSize={12}
                  fill="#00ff00"
                  backgroundColor="#000"
                  padding={2}
                />
              </Group>
            );
          }
          break;

        case 'text':
          if (data.points && data.points.length === 1 && data.text) {
            return (
              <Group key={layer.id}>
                <Text
                  x={data.points[0].x}
                  y={data.points[0].y}
                  text={data.text}
                  fontSize={14}
                  fill="#00ff00"
                  backgroundColor="#000"
                  padding={4}
                />
              </Group>
            );
          }
          break;
      }
      return null;
    });
  };

  // Renderizar preview de la herramienta actual
  const renderToolPreview = () => {
    if (!isDrawing || currentPoints.length === 0) return null;

    switch (selectedTool) {
      case 'line':
      case 'ruler':
        if (currentPoints.length === 2) {
          return (
            <Line
              points={[currentPoints[0].x, currentPoints[0].y, currentPoints[1].x, currentPoints[1].y]}
              stroke="#ff0000"
              strokeWidth={2}
              dash={selectedTool === 'ruler' ? [5, 5] : []}
            />
          );
        }
        break;

      case 'angle':
        if (currentPoints.length === 1) {
          return (
            <Circle
              x={currentPoints[0].x}
              y={currentPoints[0].y}
              radius={3}
              fill="#ff0000"
            />
          );
        } else if (currentPoints.length === 2) {
          return (
            <Group>
              <Line
                points={[currentPoints[0].x, currentPoints[0].y, currentPoints[1].x, currentPoints[1].y]}
                stroke="#ff0000"
                strokeWidth={2}
              />
              <Circle
                x={currentPoints[1].x}
                y={currentPoints[1].y}
                radius={3}
                fill="#ff0000"
              />
            </Group>
          );
        }
        break;

      case 'circle':
        if (currentPoints.length === 2) {
          const radius = calculateDistance(currentPoints[0], currentPoints[1]);
          return (
            <Circle
              x={currentPoints[0].x}
              y={currentPoints[0].y}
              radius={radius}
              stroke="#ff0000"
              strokeWidth={2}
              fill="transparent"
            />
          );
        }
        break;

      case 'rectangle':
        if (currentPoints.length === 2) {
          const width = Math.abs(currentPoints[1].x - currentPoints[0].x);
          const height = Math.abs(currentPoints[1].y - currentPoints[0].y);
          return (
            <Rect
              x={Math.min(currentPoints[0].x, currentPoints[1].x)}
              y={Math.min(currentPoints[0].y, currentPoints[1].y)}
              width={width}
              height={height}
              stroke="#ff0000"
              strokeWidth={2}
              fill="transparent"
            />
          );
        }
        break;
    }
    return null;
  };

  // Exportar canvas como imagen
  const exportCanvas = () => {
    if (stageRef.current) {
      const dataURL = stageRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = `measurement_${Date.now()}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Canvas de Medición</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {calibrationFactor > 0 ? `${calibrationFactor.toFixed(1)} px/cm` : 'Sin calibrar'}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportCanvas}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Video de fondo */}
          <video
            ref={videoRef}
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none"
            muted
            loop
          />
          
          {/* Canvas de medición */}
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="border border-gray-300 rounded-lg"
          >
            <Layer>
              {/* Grid opcional */}
              {showGrid && (
                <Group>
                  {Array.from({ length: Math.ceil(width / gridSize) }, (_, i) => (
                    <Line
                      key={`v${i}`}
                      points={[i * gridSize, 0, i * gridSize, height]}
                      stroke="#333"
                      strokeWidth={0.5}
                      opacity={0.3}
                    />
                  ))}
                  {Array.from({ length: Math.ceil(height / gridSize) }, (_, i) => (
                    <Line
                      key={`h${i}`}
                      points={[0, i * gridSize, width, i * gridSize]}
                      stroke="#333"
                      strokeWidth={0.5}
                      opacity={0.3}
                    />
                  ))}
                </Group>
              )}
              
              {/* Mediciones existentes */}
              {renderMeasurements()}
              
              {/* Preview de la herramienta actual */}
              {renderToolPreview()}
            </Layer>
          </Stage>
          
          {/* Controles del canvas */}
          <div className="absolute top-2 right-2 flex flex-col gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowGrid(!showGrid)}
            >
              <div className="w-4 h-4 border border-current" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={captureCurrentFrame}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Información de la herramienta actual */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">
            <strong>Herramienta:</strong> {selectedTool}
            {currentPoints.length > 0 && (
              <span className="ml-2">
                • Puntos: {currentPoints.length}
                {currentPoints.length === 2 && selectedTool === 'ruler' && (
                  <span className="ml-2">
                    • Distancia: {calculateDistance(currentPoints[0], currentPoints[1]).toFixed(1)}px
                    {calibrationFactor > 0 && (
                      <span className="ml-1">
                        ({pxToCm(calculateDistance(currentPoints[0], currentPoints[1])).toFixed(1)}cm)
                      </span>
                    )}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
