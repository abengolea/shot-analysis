"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/hooks/use-auth";

// Importar KinoveaWeb dinámicamente para evitar problemas de SSR
const KinoveaWeb = dynamic(() => import("@/components/kinovea-web").then(mod => ({ default: mod.KinoveaWeb })), {
  ssr: false,
  loading: () => <div className="p-4 text-center">Cargando sistema Kinovea Web...</div>
});
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Video } from "lucide-react";

export default function KinoveaDemoPage() {
  const { user, userProfile } = useAuth();
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [players, setPlayers] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [existingAnalyses, setExistingAnalyses] = useState<any[]>([]);
  const [filterShotType, setFilterShotType] = useState<string>('all');

  // Sin creación de nuevos análisis desde aquí

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.uid) return;
        const q = query(collection(db as any, 'players'), where('coachId', '==', user.uid));
        const snap = await getDocs(q as any);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setPlayers(list);
      } catch (e) {
        console.error('Error cargando jugadores del coach:', e);
      }
    };
    load();
  }, [user?.uid]);

  useEffect(() => {
    const loadAnalyses = async () => {
      try {
        if (!selectedPlayerId) { setExistingAnalyses([]); return; }
        const q = query(
          collection(db as any, 'analyses'),
          where('playerId', '==', selectedPlayerId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q as any);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setExistingAnalyses(list);
      } catch (e) {
        console.error('Error cargando análisis del jugador:', e);
      }
    };
    loadAnalyses();
  }, [selectedPlayerId]);

  const filteredAnalyses = useMemo(() => {
    if (!filterShotType || filterShotType === 'all') return existingAnalyses;
    return existingAnalyses.filter(a => String(a.shotType || '').toLowerCase().includes(filterShotType.toLowerCase()));
  }, [existingAnalyses, filterShotType]);

  const getPrimaryVideoUrl = (a: any): string | null => {
    return a.videoBackUrl || a.videoUrl || a.videoFrontUrl || a.videoLeftUrl || a.videoRightUrl || null;
  };

  const handleClearVideo = () => {
    setVideoSrc("");
    if (videoSrc && !videoSrc.startsWith('http')) {
      URL.revokeObjectURL(videoSrc);
    }
  };

  return (
    <AuthGuard>
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

        {/* Guard de rol coach */}
        {userProfile?.role !== 'coach' && (
          <Card>
            <CardHeader>
              <CardTitle>Sólo para entrenadores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Esta herramienta está disponible únicamente para cuentas de entrenador.</p>
              <div className="flex gap-2">
                <Button asChild variant="outline"><Link href="/login">Ingresar</Link></Button>
                <Button asChild><Link href="/coach/dashboard">Ir al panel</Link></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UI simplificada: sin tarjetas informativas */}

        {/* Selector de jugador */}
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar jugador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Jugador</Label>
              <Select onValueChange={setSelectedPlayerId} value={selectedPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder={players.length ? 'Selecciona jugador' : 'Sin jugadores vinculados'} />
                </SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.email || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!players.length && (
                <p className="text-xs text-muted-foreground">No tenés jugadores vinculados. Vinculá desde tu panel.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Videos existentes del jugador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Videos existentes del jugador</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Filtrar por tiro</Label>
                <Select onValueChange={setFilterShotType} value={filterShotType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="libre">Tiro Libre</SelectItem>
                    <SelectItem value="media">Media Distancia</SelectItem>
                    <SelectItem value="tres">Tres Puntos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedPlayerId && (
              <p className="text-sm text-muted-foreground">Seleccioná un jugador para ver sus análisis y videos previos.</p>
            )}
            {selectedPlayerId && filteredAnalyses.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay análisis previos para este jugador{filterShotType ? ' con este tipo de tiro' : ''}.</p>
            )}
            {filteredAnalyses.map((a) => (
              <div key={a.id} className="rounded border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">{a.shotType || '—'} <span className="text-xs text-muted-foreground">({a.createdAt || ''})</span></div>
                  <div className="text-xs text-muted-foreground">ID: {a.id}</div>
                  <div className="text-xs">
                    Disponibles: {a.videoBackUrl ? 'Trasera ' : ''}{a.videoFrontUrl ? 'Frontal ' : ''}{a.videoLeftUrl ? 'Izq ' : ''}{a.videoRightUrl ? 'Der ' : ''}{a.videoUrl && !a.videoBackUrl && !a.videoFrontUrl && !a.videoLeftUrl && !a.videoRightUrl ? 'Principal' : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getPrimaryVideoUrl(a) && (
                    <Button type="button" variant="outline" onClick={() => setVideoSrc(getPrimaryVideoUrl(a) as string)}>Usar principal</Button>
                  )}
                  {a.videoBackUrl && (
                    <Button type="button" variant="outline" onClick={() => setVideoSrc(a.videoBackUrl)}>Usar trasera</Button>
                  )}
                  {a.videoFrontUrl && (
                    <Button type="button" variant="outline" onClick={() => setVideoSrc(a.videoFrontUrl)}>Usar frontal</Button>
                  )}
                  {a.videoLeftUrl && (
                    <Button type="button" variant="outline" onClick={() => setVideoSrc(a.videoLeftUrl)}>Usar izquierda</Button>
                  )}
                  {a.videoRightUrl && (
                    <Button type="button" variant="outline" onClick={() => setVideoSrc(a.videoRightUrl)}>Usar derecha</Button>
                  )}
                  <Button asChild variant="ghost"><Link href={`/analysis/${a.id}`}>Abrir análisis</Link></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Visor Kinovea */}
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
        {/* UI extra eliminada para mantener vista limpia */}
      </div>
    </div>
    </AuthGuard>
  );
}
