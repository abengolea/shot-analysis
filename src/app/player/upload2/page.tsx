'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, ArrowLeft, Video } from 'lucide-react';
import Link from 'next/link';
import { startAnalysis } from '@/app/actions';

export default function Upload2Page() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user) {
      setMessage('Debes estar logueado para subir videos');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const formData = new FormData(e.currentTarget);
      formData.append('userId', user.uid);
      
      // Valores pre-configurados para analysis2
      formData.append('ageCategory', 'adult');
      formData.append('playerLevel', 'intermediate');
      
      // Asegurar que shotType siempre tenga un valor válido
      const shotType = formData.get('shotType') as string;
            if (!shotType || shotType === 'undefined') {
        formData.set('shotType', 'Lanzamiento de Tres'); // Valor por defecto
              }
      
      const result = await startAnalysis(null, formData);
      
      if (result.error) {
        setMessage(result.message);
      } else if (result.success && result.redirectTo) {
        setMessage('Análisis iniciado exitosamente. Redirigiendo...');
        setTimeout(() => {
          router.push(result.redirectTo!);
        }, 1000);
      } else {
        setMessage(result.message || 'Análisis iniciado');
      }
    } catch (error) {
      console.error('Error en upload2:', error);
      setMessage('Error al procesar el análisis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/player/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">🎯 Análisis Híbrido</h1>
            <p className="text-muted-foreground">
              Prompt simplificado + Preprocesamiento FFmpeg
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Subir Videos para Análisis Híbrido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de tiro */}
            <div className="space-y-2">
              <Label htmlFor="shotType">Tipo de Lanzamiento</Label>
              <Select name="shotType" defaultValue="Lanzamiento de Tres" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de tiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tiro Libre">Tiro Libre</SelectItem>
                  <SelectItem value="Lanzamiento de Media Distancia (Jump Shot)">Lanzamiento de Media Distancia (Jump Shot)</SelectItem>
                  <SelectItem value="Lanzamiento de Tres">Lanzamiento de Tres</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Videos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Video 1 (Obligatorio) */}
              <div className="space-y-2">
                <Label htmlFor="video1" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video 1 (Trasero) *
                </Label>
                <Input
                  id="video1"
                  name="video1"
                  type="file"
                  accept="video/*"
                  required
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              {/* Video 2 (Opcional) */}
              <div className="space-y-2">
                <Label htmlFor="video2" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video 2 (Frontal)
                </Label>
                <Input
                  id="video2"
                  name="video2"
                  type="file"
                  accept="video/*"
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              {/* Video 3 (Opcional) */}
              <div className="space-y-2">
                <Label htmlFor="video3" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video 3 (Lateral Izquierdo)
                </Label>
                <Input
                  id="video3"
                  name="video3"
                  type="file"
                  accept="video/*"
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              {/* Video 4 (Opcional) */}
              <div className="space-y-2">
                <Label htmlFor="video4" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video 4 (Lateral Derecho)
                </Label>
                <Input
                  id="video4"
                  name="video4"
                  type="file"
                  accept="video/*"
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
            </div>

            {/* Información adicional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">🎯 Análisis Híbrido</h3>
              <p className="text-sm text-blue-800">
                Este análisis combina lo mejor de ambos mundos:
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>✅ <strong>Prompt simplificado</strong> - 23 parámetros básicos sin timestamps</li>
                <li>✅ <strong>Preprocesamiento FFmpeg</strong> - Videos optimizados para IA</li>
                <li>✅ <strong>Almacenamiento completo</strong> - Historial permanente</li>
                <li>✅ <strong>Costo optimizado</strong> - Videos comprimidos</li>
              </ul>
            </div>

            {/* Botón de envío */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando Análisis Híbrido...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Iniciar Análisis Híbrido
                </>
              )}
            </Button>

            {/* Mensaje de estado */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('exitosamente') || message.includes('Redirigiendo')
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : message.includes('Error')
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">ℹ️ Información del Análisis Híbrido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">🎯 Prompt Simplificado</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 23 parámetros técnicos</li>
                <li>• Sin timestamps específicos</li>
                <li>• Scoring real (1-100, sin límites)</li>
                <li>• Reglas "no_evaluable" simples</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">⚡ Preprocesamiento FFmpeg</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Compresión a 360p, 4 FPS</li>
                <li>• Máximo 10 segundos</li>
                <li>• Extracción de keyframes</li>
                <li>• Optimización para IA</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
