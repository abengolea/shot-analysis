import { CoachAdminForm } from "@/components/coach-admin-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { mockCoaches, mockPlayers } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, ShieldCheck } from "lucide-react";

export default function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const coaches = mockCoaches;
  const players = mockPlayers;
  const defaultTab = searchParams.tab || "coaches";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div>
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Panel de Administración
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona los entrenadores y jugadores de la plataforma.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="coaches">
            <ShieldCheck className="mr-2" />
            Gestión de Entrenadores
          </TabsTrigger>
          <TabsTrigger value="players">
            <Users className="mr-2" />
            Gestión de Jugadores
          </TabsTrigger>
        </TabsList>
        <TabsContent value="coaches">
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <CoachAdminForm />
            </div>
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Entrenadores Actuales</CardTitle>
                  <CardDescription>
                    Lista de todos los entrenadores en el sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coaches.map((coach) => (
                    <div
                      key={coach.id}
                      className="flex items-center gap-4 rounded-md border p-3"
                    >
                      <Avatar>
                        <AvatarImage src={coach.avatarUrl} alt={coach.name} />
                        <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{coach.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${coach.ratePerAnalysis}/análisis
                        </p>
                      </div>
                      <div className="flex max-w-xs flex-wrap justify-end gap-1">
                        {coach.specialties.map((spec) => (
                          <Badge
                            key={spec}
                            variant="secondary"
                            className="text-xs"
                          >
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="players">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Gestión de Jugadores</CardTitle>
              <CardDescription>
                Ver, activar, suspender o editar jugadores de la plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 rounded-md border p-3"
                >
                  <Avatar>
                    <AvatarImage src={player.avatarUrl} alt={player.name} />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {player.ageGroup} - {player.playerLevel}
                    </p>
                  </div>
                  <Badge
                    variant={
                      player.status === "active" ? "default" : "destructive"
                    }
                    className="capitalize"
                  >
                    {player.status === "active" ? "Activo" : "Suspendido"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem>Editar Perfil</DropdownMenuItem>
                      <DropdownMenuItem>Resetear Contraseña</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {player.status === "active" ? (
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                          Suspender
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem>Activar</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
