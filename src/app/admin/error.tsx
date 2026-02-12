"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en Admin:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Error en el panel de administración
          </CardTitle>
          <CardDescription>
            Algo falló al cargar esta sección. Reintentá o volvé al inicio de admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reintentar
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">Volver a Admin</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Inicio
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
