"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Send, User, MessageSquare } from "lucide-react";

interface ConnectionRequestFormProps {
  coachId: string;
  coachName: string;
  onRequestSent?: () => void;
}

export function ConnectionRequestForm({ coachId, coachName, onRequestSent }: ConnectionRequestFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    playerLevel: "",
    position: "",
    ageGroup: "",
    country: ""
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Aquí deberías implementar la lógica para enviar la solicitud
      // Por ahora solo simulamos el envío
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Solicitud Enviada",
        description: `Tu solicitud de conexión a ${coachName} ha sido enviada exitosamente.`,
      });

      // Limpiar formulario
      setFormData({
        name: "",
        email: "",
        message: "",
        playerLevel: "",
        position: "",
        ageGroup: "",
        country: ""
      });

      // Notificar al componente padre
      onRequestSent?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Solicitar Conexión con {coachName}
        </CardTitle>
        <CardDescription>
          Completa el formulario para enviar una solicitud de conexión. El entrenador revisará tu información y te responderá.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información Personal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Tu nombre completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          {/* Información del Jugador */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="playerLevel">Nivel de Juego</Label>
              <Select
                value={formData.playerLevel}
                onValueChange={(value) => handleInputChange('playerLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Principiante">Principiante</SelectItem>
                  <SelectItem value="Intermedio">Intermedio</SelectItem>
                  <SelectItem value="Avanzado">Avanzado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Posición</Label>
              <Select
                value={formData.position}
                onValueChange={(value) => handleInputChange('position', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Base">Base</SelectItem>
                  <SelectItem value="Escolta">Escolta</SelectItem>
                  <SelectItem value="Alero">Alero</SelectItem>
                  <SelectItem value="Ala-Pívot">Ala-Pívot</SelectItem>
                  <SelectItem value="Pívot">Pívot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ageGroup">Grupo de Edad</Label>
              <Select
                value={formData.ageGroup}
                onValueChange={(value) => handleInputChange('ageGroup', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="U10">U10</SelectItem>
                  <SelectItem value="U13">U13</SelectItem>
                  <SelectItem value="U15">U15</SelectItem>
                  <SelectItem value="U18">U18</SelectItem>
                  <SelectItem value="Amateur">Amateur</SelectItem>
                  <SelectItem value="SemiPro">Semi-Profesional</SelectItem>
                  <SelectItem value="Pro">Profesional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="Tu país"
            />
          </div>

          {/* Mensaje Personal */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensaje Personal *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              placeholder="Cuéntale al entrenador por qué quieres conectarte con él/ella, qué esperas aprender, etc."
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sé específico sobre tus objetivos y por qué este entrenador te interesa.
            </p>
          </div>

          {/* Botón de Envío */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Enviando Solicitud...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Solicitud de Conexión
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Al enviar esta solicitud, aceptas que el entrenador pueda contactarte para discutir los detalles de la colaboración.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

