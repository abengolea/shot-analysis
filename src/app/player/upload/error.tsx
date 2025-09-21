"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, WifiOff, RotateCcw } from "lucide-react";

export default function UploadError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("Error en página de Upload:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            No pudimos subir o analizar tu video
          </CardTitle>
          <CardDescription>
            Puede deberse a conexión inestable o muy lenta, archivo muy pesado o cierre de la app durante la subida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Usa conexión Wi‑Fi estable y mantén la app en primer plano.</li>
            <li>Si es posible, reduce la duración/calidad del video.</li>
            <li>Intenta nuevamente en unos minutos.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => reset()}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/upload")}>
              Volver a intentar desde Upload
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/") }>
              Inicio
            </Button>
          </div>
          <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            Consejos: Wi‑Fi, mantener pantalla activa, evitar zonas con poca señal.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


