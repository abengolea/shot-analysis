import Link from "next/link";
import { mockCoaches, mockPlayers } from "@/lib/mock-data";
import { PlayerCard } from "@/components/player-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, BarChart2, Video } from "lucide-react";

// For this demo, we'll assume we are the first coach
const currentCoach = mockCoaches[0];
const coachPlayers = mockPlayers.filter(p => currentCoach.playerIds?.includes(p.id));

export default function CoachDashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Panel de Entrenador
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona tus jugadores y revisa sus análisis.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Jugadores
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coachPlayers.length}</div>
            <p className="text-xs text-muted-foreground">
              jugadores actualmente bajo tu tutela
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Análisis Realizados
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              este mes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Progreso General
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+8%</div>
            <p className="text-xs text-muted-foreground">
              mejora promedio este mes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Jugadores</CardTitle>
          <CardDescription>
            Selecciona un jugador para ver su perfil detallado y su historial de análisis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coachPlayers.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
          {coachPlayers.length === 0 && (
            <p className="col-span-full py-8 text-center text-muted-foreground">
              Aún no tienes jugadores asignados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
