'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, RefreshCw, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

interface Weights {
  // Fluidez (47.5%)
  tiro_un_solo_tiempo: number;
  sincronia_piernas: number;

  // Preparación (16.15%)
  alineacion_pies: number;
  alineacion_cuerpo: number;
  muneca_cargada: number;
  flexion_rodillas: number;
  hombros_relajados: number;
  enfoque_visual: number;

  // Ascenso (21.15%)
  mano_no_dominante_ascenso: number;
  codos_cerca_cuerpo: number;
  angulo_codo_fijo_ascenso: number;
  trayectoria_hasta_set_point: number;
  subida_recta_balon: number;
  set_point: number;
  tiempo_lanzamiento: number;

  // Liberación (9.5%)
  mano_no_dominante_liberacion: number;
  extension_completa_brazo: number;
  giro_pelota: number;
  angulo_salida: number;

  // Seguimiento (5.7%)
  mantenimiento_equilibrio: number;
  equilibrio_aterrizaje: number;
  duracion_follow_through: number;
  consistencia_repetitiva: number;
}

const DEFAULT_WEIGHTS: Weights = {
  // Fluidez (47.5%)
  tiro_un_solo_tiempo: 23.75,
  sincronia_piernas: 23.75,

  // Preparación (16.15%)
  alineacion_pies: 1.9,
  alineacion_cuerpo: 1.9,
  muneca_cargada: 3.8,
  flexion_rodillas: 3.8,
  hombros_relajados: 2.85,
  enfoque_visual: 1.9,

  // Ascenso (21.15%)
  mano_no_dominante_ascenso: 2.85,
  codos_cerca_cuerpo: 1.9,
  angulo_codo_fijo_ascenso: 5,
  trayectoria_hasta_set_point: 2.85,
  subida_recta_balon: 2.85,
  set_point: 1.9,
  tiempo_lanzamiento: 3.8,

  // Liberación (9.5%)
  mano_no_dominante_liberacion: 1.9,
  extension_completa_brazo: 3.8,
  giro_pelota: 1.9,
  angulo_salida: 1.9,

  // Seguimiento (5.7%)
  mantenimiento_equilibrio: 1.9,
  equilibrio_aterrizaje: 0.95,
  duracion_follow_through: 0.95,
  consistencia_repetitiva: 1.9,
};

const PARAMETER_LABELS: Record<keyof Weights, string> = {
  tiro_un_solo_tiempo: 'Tiro en un solo tiempo',
  sincronia_piernas: 'Sincronía con piernas',
  alineacion_pies: 'Alineación de pies',
  alineacion_cuerpo: 'Alineación corporal',
  muneca_cargada: 'Muñeca cargada',
  flexion_rodillas: 'Flexión de rodillas',
  hombros_relajados: 'Hombros relajados',
  enfoque_visual: 'Enfoque visual',
  mano_no_dominante_ascenso: 'Mano no dominante (ascenso)',
  codos_cerca_cuerpo: 'Codos cerca del cuerpo',
  angulo_codo_fijo_ascenso: 'Ángulo de codo estable en ascenso',
  trayectoria_hasta_set_point: 'Trayectoria hasta set point',
  subida_recta_balon: 'Subida recta del balón',
  set_point: 'Set point',
  tiempo_lanzamiento: 'Tiempo de lanzamiento',
  mano_no_dominante_liberacion: 'Mano no dominante (liberación)',
  extension_completa_brazo: 'Extensión completa del brazo',
  giro_pelota: 'Giro de la pelota',
  angulo_salida: 'Ángulo de salida',
  mantenimiento_equilibrio: 'Mantenimiento del equilibrio',
  equilibrio_aterrizaje: 'Equilibrio en aterrizaje',
  duracion_follow_through: 'Duración del follow-through',
  consistencia_repetitiva: 'Consistencia técnica',
};

const CATEGORIES = {
  'Fluidez (47.5%)': ['tiro_un_solo_tiempo', 'sincronia_piernas'],
  'Preparación (16.15%)': ['alineacion_pies', 'alineacion_cuerpo', 'muneca_cargada', 'flexion_rodillas', 'hombros_relajados', 'enfoque_visual'],
  'Ascenso (21.15%)': ['mano_no_dominante_ascenso', 'codos_cerca_cuerpo', 'angulo_codo_fijo_ascenso', 'trayectoria_hasta_set_point', 'subida_recta_balon', 'set_point', 'tiempo_lanzamiento'],
  'Liberación (9.5%)': ['mano_no_dominante_liberacion', 'extension_completa_brazo', 'giro_pelota', 'angulo_salida'],
  'Seguimiento (5.7%)': ['mantenimiento_equilibrio', 'equilibrio_aterrizaje', 'duracion_follow_through', 'consistencia_repetitiva'],
};

export default function WeightsAdminPage() {
  const [shotType, setShotType] = useState<'tres' | 'media' | 'libre'>('tres');
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastModified, setLastModified] = useState<string | null>(null);
  const { toast } = useToast();

  // Cargar pesos desde Firestore
  useEffect(() => {
    loadWeights();
  }, [shotType]);

  const loadWeights = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/weights?shotType=${shotType}`);
      if (response.ok) {
        const data = await response.json();
        if (data.weights) {
          setWeights(data.weights);
          setLastModified(data.lastModified);
        }
      }
    } catch (error) {
      console.error('Error cargando pesos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular el total actual
  const currentTotal = Object.values(weights).reduce((sum, val) => sum + val, 0);

  // Función para ajustar pesos proporcionalmente
  const handleWeightChange = (paramId: keyof Weights, newValue: number) => {
    const oldValue = weights[paramId];
    const diff = newValue - oldValue;
    
    // Si el nuevo valor es el mismo, no hacer nada
    if (diff === 0) {
      return;
    }

    // Crear una copia de los pesos
    const newWeights = { ...weights };
    newWeights[paramId] = newValue;

    // Calcular la suma de los otros parámetros
    const otherParams = (Object.keys(weights) as (keyof Weights)[]).filter(key => key !== paramId);
    const otherSum = otherParams.reduce((sum, key) => sum + weights[key], 0);

    // Si otros suman 0, no podemos distribuir
    if (otherSum === 0) {
      setWeights(newWeights);
      return;
    }

    // Distribuir la diferencia proporcionalmente entre los otros parámetros
    const targetOtherSum = 100 - newValue;
    const ratio = targetOtherSum / otherSum;

    // Ajustar todos los otros parámetros proporcionalmente
    otherParams.forEach(key => {
      newWeights[key] = parseFloat((weights[key] * ratio).toFixed(2));
    });

    // Ajustar por errores de redondeo
    const newTotal = Object.values(newWeights).reduce((sum, val) => sum + val, 0);
    const adjustment = 100 - newTotal;
    if (Math.abs(adjustment) > 0.01) {
      // Aplicar el ajuste al parámetro con mayor peso
      const maxKey = otherParams.reduce((a, b) => newWeights[a] > newWeights[b] ? a : b);
      newWeights[maxKey] = parseFloat((newWeights[maxKey] + adjustment).toFixed(2));
    }

    setWeights(newWeights);
  };

  // Guardar pesos en Firestore
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotType, weights }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar pesos');
      }

      const data = await response.json();
      setLastModified(data.lastModified);

      toast({
        title: 'Pesos guardados',
        description: `Los pesos para ${shotType} se guardaron correctamente.`,
      });
    } catch (error) {
      console.error('Error guardando pesos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los pesos.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Resetear a valores por defecto
  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">⚖️ Configuración de Pesos</h1>
          <p className="text-muted-foreground">
            Ajusta los pesos de cada parámetro para el cálculo del score global
          </p>
        </div>
        <Link href="/admin/dashboard">
          <Button variant="outline">Volver al Admin</Button>
        </Link>
      </div>

      {/* Selector de tipo de tiro */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tipo de Tiro</CardTitle>
          <CardDescription>
            Selecciona el tipo de tiro para configurar sus pesos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={shotType} onValueChange={(value: any) => setShotType(value)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tres">Lanzamiento de Tres</SelectItem>
              <SelectItem value="media">Lanzamiento de Media Distancia</SelectItem>
              <SelectItem value="libre">Tiro Libre</SelectItem>
            </SelectContent>
          </Select>
          {lastModified && (
            <p className="text-sm text-muted-foreground mt-2">
              Última modificación: {new Date(lastModified).toLocaleString('es-ES')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Información del total */}
      <Card className={`mb-6 ${Math.abs(currentTotal - 100) > 0.1 ? 'border-red-500' : 'border-green-500'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              <span className="font-medium">Total de pesos:</span>
            </div>
            <div className={`text-3xl font-bold ${Math.abs(currentTotal - 100) > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
              {currentTotal.toFixed(2)}%
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {Math.abs(currentTotal - 100) > 0.1 
              ? '⚠️ Los pesos deben sumar exactamente 100%' 
              : '✅ Los pesos están correctamente balanceados'}
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* Grid de parámetros por categoría */}
          <div className="space-y-6">
            {Object.entries(CATEGORIES).map(([categoryName, paramIds]) => {
              const categoryTotal = paramIds.reduce((sum, id) => sum + weights[id as keyof Weights], 0);
              
              return (
                <Card key={categoryName}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{categoryName}</CardTitle>
                      <span className="text-2xl font-bold text-primary">
                        {categoryTotal.toFixed(2)}%
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paramIds.map((paramId) => (
                        <div key={paramId} className="space-y-2">
                          <Label htmlFor={paramId} className="text-sm">
                            {PARAMETER_LABELS[paramId as keyof Weights]}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={paramId}
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={weights[paramId as keyof Weights]}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                handleWeightChange(paramId as keyof Weights, value);
                              }}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between mt-6 gap-4">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restaurar Valores por Defecto
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || Math.abs(currentTotal - 100) > 0.1}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Pesos
                </>
              )}
            </Button>
          </div>

          {/* Información adicional */}
          <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">ℹ️ Cómo funciona</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-800 space-y-2">
              <p>
                • <strong>Ajuste automático:</strong> Cuando modificas un peso, los demás se ajustan proporcionalmente para mantener el total en 100%.
              </p>
              <p>
                • <strong>Pesos actuales:</strong> Los pesos se guardan específicamente para cada tipo de tiro.
              </p>
              <p>
                • <strong>Cálculo del score:</strong> score_global = Σ(peso_i × score_i) / 100
              </p>
              <p>
                • <strong>Ejemplo:</strong> Si "Fluidez" pesa 47.5% y tiene score 80, aporta 38 puntos al score global.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

