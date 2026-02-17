import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Video, BarChart3, BotMessageSquare, LogIn } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


const features = [
  {
    icon: <Video />,
    title: "Análisis con IA",
    description:
      "Sube tu video y nuestra IA desglosará tu lanzamiento, identificando puntos clave de mejora.",
  },
  {
    icon: <BotMessageSquare />,
    title: "Feedback Personalizado",
    description:
      "Recibe recomendaciones y ejercicios personalizados de entrenadores expertos basados en tu análisis.",
  },
  {
    icon: <BotMessageSquare />,
    title: "Entrenadores Expertos",
    description:
      "También te vinculamos con entrenadores expertos con pago previo.",
  },
  {
    icon: <BarChart3 />,
    title: "Seguimiento de Progreso",
    description:
      "Visualiza tu evolución con gráficos claros y mantén un historial de todos tus análisis.",
  },
];

// Testimonials removed


export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
       <header className="container mx-auto flex flex-wrap items-center justify-end gap-4 px-4 sm:px-6 py-2">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline">
                <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4"/>
                    Ingresar
                </Link>
            </Button>
        </div>
       </header>

      <div className="flex flex-1 flex-col gap-16 md:gap-24">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center pt-2 text-center md:pt-6 overflow-hidden">
          {/* Fondo sutil con colores de marca */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-[#0B4DA1]/15 to-transparent blur-2xl" />
            <div className="absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-bl from-[#FF6A00]/15 to-transparent blur-2xl" />
          </div>

          {/* Headline + Subheadline + CTAs */}
          <div className="container mx-auto max-w-5xl px-4">
            <h1 className="font-headline text-3xl md:text-5xl font-bold tracking-tight">
              Subí tu video. Bajá tus errores.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base md:text-lg text-muted-foreground">
              Análisis de lanzamiento con IA + feedback de entrenadores.
            </p>
            
          </div>

          <div className="mt-6 md:mt-10 w-full max-w-5xl">
            <img
              src="/landing-hero.jpeg"
              alt="Portada ShotAnalysis"
              className="mx-auto w-full max-w-3xl h-auto"
            />
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <h2 className="font-headline text-3xl font-bold uppercase text-primary">
            Funciones principales
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {features.map((feature, i) => (
              <Card key={i}>
                <CardHeader className="items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                  <CardTitle className="pt-2 font-headline">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <h2 className="font-headline text-3xl font-bold uppercase text-primary">
            Cómo funciona
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">1) Subí tu video</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Grabá con tu celu, preferentemente horizontal, y cargalo.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">2) Analizá con IA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">En 20–40 segundos detectamos puntos clave y te damos feedback.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">3) Entrená</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Recibí drills personalizados y medí tu progreso en cada sesión.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center font-headline text-3xl font-bold uppercase text-primary">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">¿Es gratis?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Te damos 2 análisis gratis con IA por año.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">¿Qué tipo de video sirve?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Grabación con celular, ideal horizontal y 1080p. Evitá movimientos bruscos.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">¿Privacidad?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Tus videos son privados y solo los compartís si querés.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">¿Cuánto tarda?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Entre 20 y 40 segundos por clip, según la duración.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer con botones */}
        <footer className="container mx-auto max-w-3xl px-4 sm:px-6 py-10 text-center">
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">Crear cuenta <ArrowRight className="ml-2" /></Link>
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
