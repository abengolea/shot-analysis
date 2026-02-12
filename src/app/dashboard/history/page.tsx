"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

// Utilidades locales para derivar puntuaciones desde análisis existentes
function mapStatusToRating(s?: string): number | null {
  if (!s) return null;
  if (s === 'Incorrecto') return 1;
  if (s === 'Incorrecto leve') return 2;
  if (s === 'Mejorable') return 3;
  if (s === 'Correcto') return 4;
  if (s === 'Excelente') return 5;
  return null;
}

function getDerivedScore(a: any): number | null {
  if (!a) return null;
  if (typeof a.score === 'number') return Number(a.score);
  const cats = Array.isArray(a.detailedChecklist) ? a.detailedChecklist : (a.analysisResult && Array.isArray(a.analysisResult.detailedChecklist) ? a.analysisResult.detailedChecklist : []);
  if (!cats.length) return null;
  const vals = cats.flatMap((c: any) => c.items || [])
    .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
    .filter((v: any) => typeof v === 'number');
  if (!vals.length) return null;
  return Number((vals.reduce((s: number, v: number) => s + v, 0) / vals.length).toFixed(2));
}

function getCategoryAverages(a: any): Record<string, number> {
  const cats = Array.isArray(a?.detailedChecklist) ? a.detailedChecklist : (a?.analysisResult && Array.isArray(a.analysisResult.detailedChecklist) ? a.analysisResult.detailedChecklist : []);
  const result: Record<string, number> = {};
  for (const c of cats) {
    const vals = (c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : mapStatusToRating(it.status)))
      .filter((v: any) => typeof v === 'number');
    if (vals.length) {
      result[c.category] = Number((vals.reduce((s: number, v: number) => s + v, 0) / vals.length).toFixed(2));
    }
  }
  return result;
}

const chartConfig = {
  overall: { label: "Puntaje General", color: "hsl(var(--primary))" },
} as const;

export default function HistoryPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shotFilter, setShotFilter] = useState<string>("all");
  const [range, setRange] = useState<string>("12m");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return;
      try {
        setIsLoading(true);
        const res = await fetch(`/api/analyses?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data.analyses) ? data.analyses : [];
          arr.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // ascendente para líneas
          setAnalyses(arr);
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.uid) run();
  }, [user?.uid]);

  useEffect(() => {
    if (!loading && (!user || !userProfile)) {
      router.push('/login');
    }
  }, [loading, user, userProfile, router]);

  const shotTypeMap: Record<string, string> = {
    three: 'Lanzamiento de Tres',
    jump: 'Lanzamiento de Media Distancia (Jump Shot)',
    free: 'Tiro Libre',
  };

  const getStartDateForRange = (r: string) => {
    const now = new Date();
    const d = new Date(now);
    if (r === '3m') { d.setMonth(now.getMonth() - 3); return d; }
    if (r === '6m') { d.setMonth(now.getMonth() - 6); return d; }
    if (r === '12m') { d.setMonth(now.getMonth() - 12); return d; }
    if (r === '5y') { d.setFullYear(now.getFullYear() - 5); return d; }
    return new Date(0);
  };

  // Datos diarios finos (un punto por análisis)
  const dailySeries = useMemo(() => {
    const from = getStartDateForRange(range);
    const filtered = analyses.filter((a) => {
      const created = new Date(a.createdAt);
      if (created < from) return false;
      if (a.status !== 'analyzed') return false;
      if (shotFilter === 'all') return true;
      return a.shotType === shotTypeMap[shotFilter];
    });

    const points = filtered.map((a) => ({
      date: new Date(a.createdAt).toLocaleDateString('es-AR'),
      overall: getDerivedScore(a),
      _raw: a,
    })).filter((p) => typeof p.overall === 'number');

    return points;
  }, [analyses, range, shotFilter]);

  // Multi-línea por categorías
  const categoryLines = useMemo(() => {
    const from = getStartDateForRange(range);
    const filtered = analyses.filter((a) => {
      const created = new Date(a.createdAt);
      if (created < from) return false;
      if (a.status !== 'analyzed') return false;
      if (shotFilter === 'all') return true;
      return a.shotType === shotTypeMap[shotFilter];
    });

    const rows: Array<Record<string, any>> = [];
    for (const a of filtered) {
      const date = new Date(a.createdAt).toLocaleDateString('es-AR');
      const perCat = getCategoryAverages(a);
      rows.push({ date, ...perCat });
    }

    // Obtener lista de todas las categorías presentes
    const catSet = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => { if (k !== 'date') catSet.add(k); }));
    return { rows, categories: Array.from(catSet) };
  }, [analyses, range, shotFilter]);

  // Seleccionar categoría por defecto cuando haya datos
  useEffect(() => {
    if (!selectedCategory && categoryLines.categories.length > 0) {
      setSelectedCategory(categoryLines.categories[0]);
    }
    // Si la categoría actual deja de existir, reajustar
    if (selectedCategory && !categoryLines.categories.includes(selectedCategory)) {
      setSelectedCategory(categoryLines.categories[0] || "");
    }
  }, [categoryLines.categories, selectedCategory]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold">Historial del Jugador</h1>
          <p className="text-muted-foreground">Evolución diaria y por categorías del checklist.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución Diaria</CardTitle>
          <CardDescription>Puntos por análisis (línea fina). Escala 1–5.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rango</span>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="12m">Último año</SelectItem>
                  <SelectItem value="5y">Últimos 5 años</SelectItem>
                  <SelectItem value="all">Todo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <Select value={shotFilter} onValueChange={setShotFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="three">Lanzamiento de Tres</SelectItem>
                  <SelectItem value="jump">Lanzamiento de Media Distancia (Jump)</SelectItem>
                  <SelectItem value="free">Tiro Libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={dailySeries}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis domain={[1, 5]} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Legend />
              <Line type="monotone" dataKey="overall" stroke="var(--color-overall)" strokeWidth={1.25} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolución por Categorías</CardTitle>
          <CardDescription>Promedios por categoría del checklist en cada análisis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Categoría</span>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {categoryLines.categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ChartContainer config={{ overall: { label: "", color: "hsl(var(--primary))" } }} className="h-[320px] w-full">
            <LineChart data={categoryLines.rows}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis domain={[1, 5]} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              {selectedCategory ? (
                <Line type="monotone" dataKey={selectedCategory} strokeWidth={1.25} dot={false} />
              ) : null}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}


