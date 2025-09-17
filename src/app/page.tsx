import Link from "next/link";
import { Logo } from "@/components/logo";
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
    icon: <BarChart3 />,
    title: "Seguimiento de Progreso",
    description:
      "Visualiza tu evolución con gráficos claros y mantén un historial de todos tus análisis.",
  },
  {
    icon: <BarChart3 />,
    title: "Herramientas de medición",
    description:
      "Medí ángulos, distancias y ritmo para entender tu mecánica con precisión.",
  },
  {
    icon: <Video />,
    title: "Comparar antes/después",
    description:
      "Poné dos clips lado a lado y comprobá tu mejora cuadro a cuadro.",
  },
  {
    icon: <BotMessageSquare />,
    title: "Compartir con tu entrenador",
    description:
      "Enviá un link privado para recibir comentarios y planificar trabajos.",
  },
];

// Testimonials removed


export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
       <header className="container mx-auto flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
            <Logo size="md" />
        </Link>
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
        <section className="relative flex flex-col items-center justify-center pt-8 text-center md:pt-16 overflow-hidden">
          {/* Fondo sutil con colores de marca */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-[#0B4DA1]/15 to-transparent blur-2xl" />
            <div className="absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-bl from-[#FF6A00]/15 to-transparent blur-2xl" />
          </div>

          {/* Headline + Subheadline + CTAs */}
          <div className="container mx-auto max-w-5xl px-4">
            <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight">
              Subí tu video. Bajá tus errores.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Nuestra IA analiza tu mecánica y te da ejercicios personalizados para mejorar hoy.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Probar gratis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border px-3 py-1 bg-background/60 backdrop-blur">Sin tarjeta</span>
              <span className="rounded-full border px-3 py-1 bg-background/60 backdrop-blur">Feedback en 30s</span>
              <span className="rounded-full border px-3 py-1 bg-background/60 backdrop-blur">En etapa de prueba</span>
            </div>
          </div>

          <div className="mt-10 md:mt-16 w-full max-w-5xl">
            <img
              src="/landing-hero.png"
              alt="Portada ShotAnalysis"
              className="mx-auto w-full max-w-3xl h-auto"
            />
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto max-w-5xl text-center">
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
        <section className="container mx-auto max-w-5xl text-center">
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
        <section className="container mx-auto max-w-3xl">
          <h2 className="text-center font-headline text-3xl font-bold uppercase text-primary">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">¿Es gratis?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Sí, actualmente está en etapa de prueba.</p>
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
        <footer className="container mx-auto max-w-3xl py-10 text-center">
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">Crear cuenta <ArrowRight className="ml-2" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/coach-register">Entrenadores</Link>
            </Button>
          </div>
          <div className="mt-10 rounded-xl border bg-background/60 p-6 text-left">
            <h3 className="font-headline text-2xl font-bold">¿Sos entrenador?</h3>
            <ul className="mt-2 list-outside list-disc pl-5 text-muted-foreground">
              <li>Panel de jugadores y videos en un solo lugar</li>
              <li>Drills compartidos y checklist estandarizado</li>
              <li>Comentarios con marcas de tiempo</li>
            </ul>
            <div className="mt-4 flex gap-3">
              <Button asChild>
                <Link href="/coach-register">Registrarme como entrenador</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/prompts">Ver herramientas</Link>
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
