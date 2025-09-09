import { CoachAdminForm } from "@/components/coach-admin-form";
import { BasketballIcon } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, Users, Award } from "lucide-react";

const benefits = [
  {
    icon: <Users className="h-6 w-6" />,
    title: "Acceso a Jugadores",
    description: "Conecta con jugadores que buscan mejorar su técnica"
  },
  {
    icon: <Star className="h-6 w-6" />,
    title: "Construye tu Reputación",
    description: "Recibe reseñas y construye tu marca personal"
  },
  {
    icon: <Award className="h-6 w-6" />,
    title: "Gana Dinero",
    description: "Establece tus tarifas y monetiza tu experiencia"
  }
];

export default function CoachRegisterPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <BasketballIcon className="h-16 w-16 text-primary" />
        </div>
        <h1 className="font-headline text-4xl font-bold tracking-tight mb-4">
          Únete como Entrenador
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Conecta con jugadores, comparte tu experiencia y construye tu negocio 
          en la plataforma líder de análisis de baloncesto con IA.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Formulario de Registro */}
        <div>
          <CoachAdminForm />
        </div>

        {/* Beneficios y Información */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                ¿Por qué unirte como Entrenador?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg text-primary">
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{benefit.title}</h4>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proceso Simple</CardTitle>
              <CardDescription>
                En solo 3 pasos estarás listo para empezar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                  1
                </Badge>
                <span>Completa tu perfil y experiencia</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                  2
                </Badge>
                <span>Establece tus tarifas y disponibilidad</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                  3
                </Badge>
                <span>¡Empieza a recibir solicitudes de jugadores!</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">¿Tienes Preguntas?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Nuestro equipo está aquí para ayudarte a comenzar tu viaje como entrenador.
              </p>
              <p className="text-sm font-medium">
                📧 Contacto: support@shotvision.ai
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

