"use client";

import { useState } from "react";
import Link from "next/link";
import { mockCoaches, mockPlayers, mockConnectionRequests } from "@/lib/mock-data";
import { PlayerCard } from "@/components/player-card";
import { ConnectionRequestCard } from "@/components/connection-request-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BarChart2, Video, MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";
import { ConnectionRequest } from "@/lib/types";

// For this demo, we'll assume we are the first coach
const currentCoach = mockCoaches[0];
const coachPlayers = mockPlayers.filter(p => currentCoach.playerIds?.includes(p.id));

// Filtrar solicitudes para el entrenador actual
const coachRequests = mockConnectionRequests.filter(req => req.coachId === "coach1");

export default function CoachDashboardPage() {
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>(coachRequests);

  const handleStatusUpdate = (requestId: string, newStatus: 'accepted' | 'rejected') => {
    setConnectionRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: newStatus, updatedAt: new Date() }
          : req
      )
    );
  };

  const pendingRequests = connectionRequests.filter(req => req.status === 'pending');
  const acceptedRequests = connectionRequests.filter(req => req.status === 'accepted');
  const rejectedRequests = connectionRequests.filter(req => req.status === 'rejected');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Panel de Entrenador
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona tus jugadores y revisa las solicitudes de conexión.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
              Solicitudes Pendientes
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">
              esperando tu respuesta
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

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Solicitudes de Conexión
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="players" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mis Jugadores
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Solicitudes de Conexión</h2>
              <p className="text-muted-foreground">
                Revisa y gestiona las solicitudes de jugadores que quieren conectarse contigo.
              </p>
            </div>
          </div>

          {/* Filtros de Estado */}
          <div className="flex gap-2">
            <Badge variant={pendingRequests.length > 0 ? "default" : "secondary"} className="cursor-pointer">
              <Clock className="mr-1 h-3 w-3" />
              Pendientes ({pendingRequests.length})
            </Badge>
            <Badge variant={acceptedRequests.length > 0 ? "default" : "secondary"} className="cursor-pointer">
              <CheckCircle className="mr-1 h-3 w-3" />
              Aceptadas ({acceptedRequests.length})
            </Badge>
            <Badge variant={rejectedRequests.length > 0 ? "default" : "secondary"} className="cursor-pointer">
              <XCircle className="mr-1 h-3 w-3" />
              Rechazadas ({rejectedRequests.length})
            </Badge>
          </div>

          {/* Lista de Solicitudes */}
          <div className="grid gap-6 md:grid-cols-2">
            {connectionRequests.length > 0 ? (
              connectionRequests.map((request) => (
                <ConnectionRequestCard
                  key={request.id}
                  request={request}
                  onStatusUpdate={handleStatusUpdate}
                />
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay solicitudes</h3>
                <p className="text-muted-foreground mb-4">
                  Aún no has recibido solicitudes de conexión de jugadores.
                </p>
                <p className="text-sm text-muted-foreground">
                  Los jugadores pueden enviarte solicitudes desde tu perfil público.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Mis Jugadores</h2>
            <p className="text-muted-foreground">
              Selecciona un jugador para ver su perfil detallado y su historial de análisis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {coachPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
            {coachPlayers.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tienes jugadores</h3>
                <p className="text-muted-foreground">
                  Aún no tienes jugadores asignados. Acepta solicitudes de conexión para comenzar.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Resumen General</h2>
            <p className="text-muted-foreground">
              Vista general de tu actividad como entrenador.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Actividad de Solicitudes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total de solicitudes</span>
                  <span className="font-semibold">{connectionRequests.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Solicitudes pendientes</span>
                  <span className="font-semibold text-orange-600">{pendingRequests.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Solicitudes aceptadas</span>
                  <span className="font-semibold text-green-600">{acceptedRequests.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Solicitudes rechazadas</span>
                  <span className="font-semibold text-red-600">{rejectedRequests.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Estadísticas de Jugadores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total de jugadores</span>
                  <span className="font-semibold">{coachPlayers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Análisis este mes</span>
                  <span className="font-semibold">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Progreso promedio</span>
                  <span className="font-semibold text-green-600">+8%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
