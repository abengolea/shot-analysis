"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, MapPin, Award, Target } from "lucide-react";
import { ConnectionRequest } from "@/lib/types";

interface ConnectionRequestCardProps {
  request: ConnectionRequest;
  onStatusUpdate: (requestId: string, newStatus: 'accepted' | 'rejected') => void;
}

export function ConnectionRequestCard({ request, onStatusUpdate }: ConnectionRequestCardProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus: 'accepted' | 'rejected') => {
    setIsUpdating(true);
    try {
      // Aquí deberías implementar la lógica para actualizar el estado
      // Por ahora solo simulamos la actualización
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onStatusUpdate(request.id, newStatus);
      
      toast({
        title: newStatus === 'accepted' ? "Solicitud Aceptada" : "Solicitud Rechazada",
        description: newStatus === 'accepted' 
          ? `Ahora ${request.playerName} es tu jugador.` 
          : `Has rechazado la solicitud de ${request.playerName}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pendiente</Badge>;
      case 'accepted':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Aceptada</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Rechazada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={request.playerAvatarUrl} alt={request.playerName} />
              <AvatarFallback className="text-sm">
                {getInitials(request.playerName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{request.playerName}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <User className="h-3 w-3" />
                {request.playerEmail}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información del Jugador */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {request.playerLevel && (
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Nivel:</span>
              <span className="font-medium">{request.playerLevel}</span>
            </div>
          )}
          {request.position && (
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Posición:</span>
              <span className="font-medium">{request.position}</span>
            </div>
          )}
          {request.ageGroup && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Edad:</span>
              <span className="font-medium">{request.ageGroup}</span>
            </div>
          )}
          {request.country && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">País:</span>
              <span className="font-medium">{request.country}</span>
            </div>
          )}
        </div>

        {/* Mensaje del Jugador */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground mb-2">Mensaje del jugador:</p>
          <p className="text-sm italic">"{request.message}"</p>
        </div>

        {/* Fecha de Solicitud */}
        <div className="text-xs text-muted-foreground">
          Solicitado el: {formatDate(request.createdAt)}
        </div>

        {/* Acciones */}
        {request.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleStatusUpdate('accepted')}
              disabled={isUpdating}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isUpdating ? "Procesando..." : "Aceptar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleStatusUpdate('rejected')}
              disabled={isUpdating}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {isUpdating ? "Procesando..." : "Rechazar"}
            </Button>
          </div>
        )}

        {request.status === 'accepted' && (
          <div className="pt-2">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={`/players/${request.playerId}`}>
                Ver Perfil del Jugador
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

