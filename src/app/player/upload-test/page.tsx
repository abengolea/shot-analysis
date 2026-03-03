'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { startAnalysis } from '@/app/actions';

export default function UploadTestPage() {
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
      
      // Valores pre-configurados para testing (como en /test-simple-prompt)
      formData.append('ageCategory', 'adult');
      formData.append('playerLevel', 'intermediate');
      
      // Asegurar que shotType siempre tenga un valor válido
      const shotType = formData.get('shotType') as string;
            if (!shotType || shotType === 'undefined') {
        formData.set('shotType', 'jump_shot'); // Valor por defecto
              }
      
      const result = await startAnalysis(null, formData);
      
      if (result.error) {
        setMessage(result.message);
      } else {
        setMessage(result.message);
        if (result.redirectTo) {
          router.push(result.redirectTo);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error al procesar el análisis');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-muted-foreground mb-4">
            Debes estar logueado para acceder a esta página.
          </p>
          <Link href="/login">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold">🧪 Subir Video - TEST</h1>
            <p className="text-muted-foreground">
              Página de prueba con prompt simplificado
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Tiro con Prompt Simplificado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Video Back */}
            <div className="space-y-2">
              <Label htmlFor="video-back">📹 Video Trasero (Obligatorio)</Label>
              <Input
                id="video-back"
                name="video-back"
                type="file"
                accept="video/*"
                required
              />
              <p className="text-sm text-muted-foreground">
                Video desde atrás del jugador - REQUERIDO para el análisis
              </p>
            </div>

            {/* Video Front */}
            <div className="space-y-2">
              <Label htmlFor="video-front">📹 Video Frontal (Opcional)</Label>
              <Input
                id="video-front"
                name="video-front"
                type="file"
                accept="video/*"
              />
              <p className="text-sm text-muted-foreground">
                Video desde el frente del jugador - Mejora la precisión del análisis
              </p>
            </div>

            {/* Video Left */}
            <div className="space-y-2">
              <Label htmlFor="video-left">📹 Video Lateral Izquierdo (Opcional)</Label>
              <Input
                id="video-left"
                name="video-left"
                type="file"
                accept="video/*"
              />
              <p className="text-sm text-muted-foreground">
                Video desde el lado izquierdo - Análisis más completo
              </p>
            </div>

            {/* Video Right */}
            <div className="space-y-2">
              <Label htmlFor="video-right">📹 Video Lateral Derecho (Opcional)</Label>
              <Input
                id="video-right"
                name="video-right"
                type="file"
                accept="video/*"
              />
              <p className="text-sm text-muted-foreground">
                Video desde el lado derecho - Análisis más completo
              </p>
            </div>

            {/* Información sobre videos opcionales */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-900 mb-2">ℹ️ Información sobre Videos</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Video Trasero:</strong> Obligatorio - Es el ángulo principal para el análisis</p>
                <p><strong>Videos Adicionales:</strong> Opcionales - Mejoran la precisión pero no son necesarios</p>
                <p><strong>Análisis Mínimo:</strong> Solo con el video trasero obtienes los 22 parámetros</p>
              </div>
            </div>

            {/* Tipo de Tiro */}
            <div className="space-y-2">
              <Label htmlFor="shotType">Tipo de Tiro</Label>
              <Select name="shotType" defaultValue="jump_shot">
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo de tiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jump_shot">Tiro en Suspensión</SelectItem>
                  <SelectItem value="free_throw">Tiro Libre</SelectItem>
                  <SelectItem value="layup">Entrada</SelectItem>
                  <SelectItem value="three_pointer">Triple</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mensaje */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('Error') || message.includes('error') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}

            {/* Botón de envío */}
            <Button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analizando con Prompt Simplificado...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  🧪 Iniciar Análisis de Prueba
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">ℹ️ Información de Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Prompt:</strong> Simplificado (funciona mejor)</p>
            <p><strong>Configuración:</strong> Adulto, Intermedio, pre-configurado</p>
            <p><strong>Videos:</strong> Solo el trasero es obligatorio</p>
            <p><strong>Resultado:</strong> 22 parámetros técnicos + verificación</p>
            <p><strong>Página de resultados:</strong> /analysis-test/[id]</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
