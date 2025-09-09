"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Ruler, 
  Move, 
  Pencil, 
  Circle, 
  Eraser, 
  Download, 
  RotateCw,
  Square,
  Triangle,
  Type,
  Layers,
  Eye,
  EyeOff,
  Trash2
} from "lucide-react";

export type MeasurementTool = 
  | 'select' 
  | 'line' 
  | 'angle' 
  | 'ruler' 
  | 'circle' 
  | 'rectangle' 
  | 'text' 
  | 'eraser';

export type MeasurementLayer = {
  id: string;
  type: MeasurementTool;
  visible: boolean;
  locked: boolean;
  data: any;
  label?: string;
};

interface MeasurementToolsProps {
  selectedTool: MeasurementTool;
  onToolSelect: (tool: MeasurementTool) => void;
  layers: MeasurementLayer[];
  onLayerToggle: (layerId: string, visible: boolean) => void;
  onLayerLock: (layerId: string, locked: boolean) => void;
  onLayerDelete: (layerId: string) => void;
  onExport: () => void;
  onClearAll: () => void;
  calibrationFactor: number;
  onCalibrationChange: (factor: number) => void;
}

export function MeasurementTools({
  selectedTool,
  onToolSelect,
  layers,
  onLayerToggle,
  onLayerLock,
  onLayerDelete,
  onExport,
  onClearAll,
  calibrationFactor,
  onCalibrationChange
}: MeasurementToolsProps) {
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationInput, setCalibrationInput] = useState(calibrationFactor.toString());

  const tools = [
    { id: 'select', icon: Move, label: 'Seleccionar', description: 'Mover y editar elementos' },
    { id: 'line', icon: Pencil, label: 'Línea', description: 'Dibujar líneas rectas' },
    { id: 'angle', icon: RotateCw, label: 'Ángulo', description: 'Medir ángulos entre 3 puntos' },
    { id: 'ruler', icon: Ruler, label: 'Regla', description: 'Medir distancias' },
    { id: 'circle', icon: Circle, label: 'Círculo', description: 'Dibujar círculos' },
    { id: 'rectangle', icon: Square, label: 'Rectángulo', description: 'Dibujar rectángulos' },
    { id: 'text', icon: Type, label: 'Texto', description: 'Añadir anotaciones' },
    { id: 'eraser', icon: Eraser, label: 'Borrador', description: 'Eliminar elementos' },
  ];

  const handleCalibrationSave = () => {
    const factor = parseFloat(calibrationInput);
    if (!isNaN(factor) && factor > 0) {
      onCalibrationChange(factor);
      setShowCalibration(false);
    }
  };

  const formatMeasurement = (value: number, unit: string = 'px') => {
    if (unit === 'px' && calibrationFactor > 0) {
      const cm = value / calibrationFactor;
      return `${value.toFixed(1)}px (${cm.toFixed(1)}cm)`;
    }
    return `${value.toFixed(1)}${unit}`;
  };

  return (
    <div className="space-y-4">
      {/* Herramientas de Dibujo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Herramientas de Medición
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isSelected = selectedTool === tool.id;
              
              return (
                <Button
                  key={tool.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => onToolSelect(tool.id as MeasurementTool)}
                  title={`${tool.label}: ${tool.description}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{tool.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Calibración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Calibración de Escala
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalibration(!showCalibration)}
            >
              {showCalibration ? 'Ocultar' : 'Configurar'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showCalibration ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Marca un segmento conocido en el video (ej: 1 metro) y establece su longitud real.
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Factor px/cm:</label>
                <input
                  type="number"
                  value={calibrationInput}
                  onChange={(e) => setCalibrationInput(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md"
                  placeholder="ej: 10"
                  step="0.1"
                  min="0.1"
                />
                <Button onClick={handleCalibrationSave} size="sm">
                  Guardar
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Factor actual: {calibrationFactor > 0 ? `${calibrationFactor.toFixed(1)} px/cm` : 'No configurado'}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Factor de calibración: {calibrationFactor > 0 ? `${calibrationFactor.toFixed(1)} px/cm` : 'No configurado'}
              </span>
              <Badge variant={calibrationFactor > 0 ? "default" : "secondary"}>
                {calibrationFactor > 0 ? 'Calibrado' : 'Sin calibrar'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capas de Medición */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Capas de Medición ({layers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {layers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Pencil className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay mediciones aún</p>
              <p className="text-xs">Usa las herramientas para crear mediciones</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onLayerToggle(layer.id, !layer.visible)}
                    >
                      {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onLayerLock(layer.id, !layer.locked)}
                    >
                      <div className={`h-3 w-3 ${layer.locked ? 'bg-primary' : 'border border-muted-foreground'}`} />
                    </Button>
                    
                    <span className="text-sm font-medium">{layer.label || `${layer.type} ${layer.id.slice(0, 4)}`}</span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onLayerDelete(layer.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <Separator className="my-3" />
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={layers.length === 0}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar Todo
            </Button>
            <Button
              onClick={onExport}
              disabled={layers.length === 0}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Información de Medición */}
      {layers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen de Mediciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {layers.filter(l => l.type === 'ruler').length > 0 && (
                <div className="flex justify-between">
                  <span>Distancias:</span>
                  <span className="font-medium">{layers.filter(l => l.type === 'ruler').length}</span>
                </div>
              )}
              {layers.filter(l => l.type === 'angle').length > 0 && (
                <div className="flex justify-between">
                  <span>Ángulos:</span>
                  <span className="font-medium">{layers.filter(l => l.type === 'angle').length}</span>
                </div>
              )}
              {layers.filter(l => l.type === 'line').length > 0 && (
                <div className="flex justify-between">
                  <span>Líneas:</span>
                  <span className="font-medium">{layers.filter(l => l.type === 'line').length}</span>
                </div>
              )}
              {layers.filter(l => l.type === 'text').length > 0 && (
                <div className="flex justify-between">
                  <span>Anotaciones:</span>
                  <span className="font-medium">{layers.filter(l => l.type === 'text').length}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
