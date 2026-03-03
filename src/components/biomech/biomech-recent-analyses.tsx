"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Eye, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

type Analysis = {
  id: string;
  shotType?: string;
  status?: string;
  createdAt?: string;
  analysisMode?: string;
};

export function BiomechRecentAnalyses() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/analyses?userId=${user.uid}`);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.analyses) ? data.analyses : [];
        setAnalyses(list);
      } catch {}
      setLoading(false);
    };
    load();
  }, [user?.uid]);

  const biomechAnalyses = useMemo(
    () => analyses.filter((item) => item.analysisMode === "biomech-pro"),
    [analyses]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos análisis BIOMECH PRO</CardTitle>
        <CardDescription>
          Tus videos biomecánicos aparecen acá apenas finaliza el procesamiento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : biomechAnalyses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todavía no hay análisis BIOMECH PRO. Subí un video desde el flujo nuevo.
          </div>
        ) : (
          <div className="space-y-3">
            {biomechAnalyses.slice(0, 5).map((analysis) => (
              <div key={analysis.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-100 p-2">
                    <Video className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{analysis.shotType || "Tiro"}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString() : "Fecha"}
                      <Badge variant="outline">{analysis.status || "pendiente"}</Badge>
                    </div>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/biomech-pro/analysis/${analysis.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
