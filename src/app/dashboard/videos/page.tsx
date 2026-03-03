"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerVideosSection } from "@/components/player-videos-section";
import { Video } from "lucide-react";

export default function PlayerVideosPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shotFilter, setShotFilter] = useState<string>("all");

  useEffect(() => {
    if (!loading && (!user || !userProfile)) {
      router.replace("/login");
    }
  }, [loading, user, userProfile, router]);

  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return;
      try {
        setIsLoading(true);
        const res = await fetch(`/api/analyses?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data.analyses) ? data.analyses : [];
          arr.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setAnalyses(arr);
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.uid) run();
  }, [user?.uid]);

  const filteredAnalyses = useMemo(() => {
    if (shotFilter === "all") return analyses;
    return analyses.filter((a) => a.shotType === shotFilter);
  }, [analyses, shotFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold">Mis Videos</h1>
          <p className="text-muted-foreground">
            Todos tus videos de lanzamiento ordenados por fecha de carga.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Filtros de lanzamiento
          </CardTitle>
          <CardDescription>Filtra por tipo de lanzamiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
              <Select value={shotFilter} onValueChange={setShotFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de lanzamiento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="Tiro Libre">Tiro Libre</SelectItem>
                  <SelectItem value="Lanzamiento de Media Distancia (Jump Shot)">
                    Media Distancia
                  </SelectItem>
                  <SelectItem value="Lanzamiento de Tres">Tres Puntos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Mostrando {filteredAnalyses.length} de {analyses.length} videos.
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando videos...</p>
        </div>
      ) : (
        <PlayerVideosSection analyses={filteredAnalyses} />
      )}
    </div>
  );
}
