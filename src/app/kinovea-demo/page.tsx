"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Importar KinoveaWeb dinámicamente para evitar problemas de SSR
const KinoveaWeb = dynamic(() => import("@/components/kinovea-web").then(mod => ({ default: mod.KinoveaWeb })), {
  ssr: false,
  loading: () => <div className="p-4 text-center">Cargando sistema Kinovea Web...</div>
});
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  Video, 
  Info, 
  BookOpen,
  Zap,
  Target,
  Ruler,
  Brain
} from "lucide-react";

export default function KinoveaDemoPage() {
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleDemoVideo = () => {
    // URL de un video de ejemplo que funciona
    setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
    setShowDemo(true);
  };

  const handleClearVideo = () => {
    setVideoSrc("");
    setVideoFile(null);
    setShowDemo(false);
    if (videoSrc && !videoSrc.startsWith('http')) {
      URL.revokeObjectURL(videoSrc);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Video className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">Kinovea Web</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Sistema completo de análisis biomecánico de video con herramientas de medición, 
            detección de pose con IA y análisis avanzado para deportes y biomecánica
          </p>
        </div>

        {/* Características principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="text-center">
              <Ruler className="h-12 w-12 mx-auto text-primary mb-2" />
              <CardTitle>Mediciones Precisas</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              <p>Herramientas avanzadas para medir distancias, ángulos, áreas y más con calibración de escala real</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Brain className="h-12 w-12 mx-auto text-primary mb-2" />
              <CardTitle>Análisis con IA</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              <p>Detección automática de pose con MediaPipe y análisis biomecánico en tiempo real</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Target className="h-12 w-12 mx-auto text-primary mb-2" />
              <CardTitle>Análisis Biomecánico</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              <p>Métricas avanzadas de postura, alineación y eficiencia del movimiento</p>
            </CardContent>
          </Card>
        </div>

        {/* Selector de video */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Seleccionar Video para Análisis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video-upload">Subir video desde tu dispositivo</Label>
                <Input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  placeholder="Selecciona un archivo de video"
                />
                <p className="text-sm text-muted-foreground">
                  Formatos soportados: MP4, AVI, MOV, WebM
                </p>
              </div>

                             <div className="space-y-2">
                 <Label>O usar video de demostración</Label>
                 <div className="space-y-2">
                   <Button 
                     onClick={() => setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4")} 
                     variant="outline" 
                     className="w-full"
                     disabled={showDemo}
                   >
                     <Zap className="h-4 w-4 mr-2" />
                     Big Buck Bunny (MP4)
                   </Button>
                   <Button 
                     onClick={() => setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4")} 
                     variant="outline" 
                     className="w-full"
                     disabled={showDemo}
                   >
                     <Zap className="h-4 w-4 mr-2" />
                     Elephants Dream (MP4)
                   </Button>
                 </div>
                 <p className="text-sm text-muted-foreground">
                   Videos de ejemplo para probar las funcionalidades
                 </p>
               </div>
            </div>

            {videoSrc && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {videoFile ? videoFile.name : 'Video de demostración'}
                  </span>
                </div>
                <Button onClick={handleClearVideo} variant="outline" size="sm">
                  Cambiar Video
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Información del sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Información del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Herramientas de Medición</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Regla:</strong> Medir distancias con calibración real</li>
                  <li>• <strong>Ángulo:</strong> Medir ángulos entre tres puntos</li>
                  <li>• <strong>Línea:</strong> Dibujar líneas de referencia</li>
                  <li>• <strong>Círculo:</strong> Medir radios y áreas circulares</li>
                  <li>• <strong>Rectángulo:</strong> Medir áreas rectangulares</li>
                  <li>• <strong>Texto:</strong> Añadir anotaciones</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Análisis con IA</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Detección de Pose:</strong> MediaPipe para keypoints</li>
                  <li>• <strong>Métricas Biomecánicas:</strong> Ángulos y alineaciones</li>
                  <li>• <strong>Evaluación de Postura:</strong> Análisis automático</li>
                  <li>• <strong>Análisis Temporal:</strong> Evolución del movimiento</li>
                  <li>• <strong>Exportación:</strong> Datos JSON y visualizaciones</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sistema Kinovea Web */}
        {videoSrc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Análisis en Tiempo Real</h2>
              <Button onClick={handleClearVideo} variant="outline">
                Cambiar Video
              </Button>
            </div>
            
            <KinoveaWeb 
              videoSrc={videoSrc} 
              width={800} 
              height={600} 
            />
          </div>
        )}

        {/* Guía de uso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Guía de Uso Rápida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold">1. Configuración Inicial</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Sube o selecciona un video para analizar</li>
                  <li>Configura la calibración de escala (opcional)</li>
                  <li>Selecciona la herramienta de medición deseada</li>
                </ol>

                <h4 className="font-semibold">2. Mediciones Manuales</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Usa la herramienta de regla para medir distancias</li>
                  <li>Usa la herramienta de ángulo para medir ángulos</li>
                  <li>Añade anotaciones de texto donde sea necesario</li>
                  <li>Organiza las mediciones en capas</li>
                </ol>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">3. Análisis Automático</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Inicia el análisis de pose con IA</li>
                  <li>Revisa las métricas biomecánicas generadas</li>
                  <li>Analiza la evolución temporal de la postura</li>
                  <li>Exporta los resultados para análisis posterior</li>
                </ol>

                <h4 className="font-semibold">4. Exportación</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Exporta el canvas como imagen PNG</li>
                  <li>Exporta todos los datos como JSON</li>
                  <li>Guarda las mediciones para comparaciones futuras</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">
            Kinovea Web - Sistema de Análisis Biomecánico Avanzado
          </p>
          <p className="text-xs mt-2">
            Desarrollado con Next.js, React, Konva.js y MediaPipe
          </p>
        </div>
      </div>
    </div>
  );
}
