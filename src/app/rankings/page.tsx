"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

type PublicCategory = 'U11' | 'U13' | 'U15' | 'U17' | 'U21' | 'Mayores';

type PublicPlayer = {
  id: string;
  displayName: string;
  category: PublicCategory;
  publicHighestScore: number | null;
  publicGeneralAverageScore: number | null;
  publicBestByShot: { libre?: number; media?: number; tres?: number };
  publicBestDates: { libre?: string; media?: string; tres?: string; overall?: string };
  country: string | null;
  club: string | null;
  avatarUrl: string | null;
};

const categories: PublicCategory[] = ['U11', 'U13', 'U15', 'U17', 'U21', 'Mayores'];

export default function RankingsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const role = (userProfile as any)?.role;
  const [category, setCategory] = useState<PublicCategory>('U15');
  const [shotType, setShotType] = useState<'libre' | 'media' | 'tres'>('tres');
  const [general, setGeneral] = useState<PublicPlayer[]>([]);
  const [byShot, setByShot] = useState<PublicPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (role !== 'admin') {
      const target = role === 'coach' ? '/coach/dashboard' : '/dashboard';
      router.replace(target);
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (authLoading || role !== 'admin') return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const genResp = await fetch(`/api/rankings?category=${category}&type=general&limit=50`);
        const genData = await genResp.json();
        setGeneral(genData.players || []);

        const shotResp = await fetch(`/api/rankings?category=${category}&type=shot&shotType=${shotType}&limit=50`);
        const shotData = await shotResp.json();
        setByShot(shotData.players || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, role, category, shotType]);

  if (authLoading || role !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rankings</h1>
        <p className="text-muted-foreground">Top 50 por categoría (General y por tipo de tiro)</p>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">Categoría</span>
          <Select value={category} onValueChange={(v) => setCategory(v as PublicCategory)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">Tiro</span>
          <Select value={shotType} onValueChange={(v) => setShotType(v as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="libre">Tiro Libre</SelectItem>
              <SelectItem value="media">Media Distancia</SelectItem>
              <SelectItem value="tres">Tres Puntos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tiro">Por tiro</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General - {category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
                {!loading && general.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-10 justify-center">#{idx + 1}</Badge>
                      <div>
                        <div className="font-medium">{p.displayName}</div>
                        <div className="text-xs text-muted-foreground">{p.club || p.country || ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Promedio: <span className="font-semibold">{p.publicGeneralAverageScore ?? '—'}</span></div>
                      <div className="text-xs text-muted-foreground">Mejor: {p.publicHighestScore ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiro">
          <Card>
            <CardHeader>
              <CardTitle>Por tiro - {category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
                {!loading && byShot.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-10 justify-center">#{idx + 1}</Badge>
                      <div>
                        <div className="font-medium">{p.displayName}</div>
                        <div className="text-xs text-muted-foreground">{p.club || p.country || ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Mejor ({shotType}): <span className="font-semibold">{p.publicBestByShot?.[shotType] ?? '—'}</span></div>
                      <div className="text-xs text-muted-foreground">Promedio: {p.publicGeneralAverageScore ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


