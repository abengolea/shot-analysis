import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Video, BarChart3, BotMessageSquare, LogIn } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


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
];

const testimonials = [
  {
    name: "Carlos R.",
    role: "Jugador Amateur",
    avatar: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    quote:
      "La plataforma cambió mi forma de entrenar. El feedback instantáneo sobre mi técnica de lanzamiento me ayudó a corregir errores que no sabía que tenía.",
  },
  {
    name: "Entrenador G.",
    role: "Coach de Juveniles",
    avatar: "https://placehold.co/100x100.png",
    "data-ai-hint": "male coach",
    quote:
      "Es una herramienta increíblemente poderosa para dar feedback visual y detallado a mis jugadores. El checklist es fundamental en mi día a día.",
  },
];


export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
       <header className="container mx-auto flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-headline text-xl font-bold uppercase">
            <img src="/chas-logo.svg" alt="chas.com logo" className="h-8 w-auto" />
            <span>chas.com</span>
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
        <section className="relative flex flex-col items-center justify-center pt-8 text-center md:pt-16">
          <img src="/chas-logo.svg" alt="chas.com logo" className="mb-4 h-16 w-auto" />
          <h1 className="font-headline text-5xl font-bold tracking-tight md:text-6xl uppercase">
            chas.com
          </h1>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">
                Crear cuenta <ArrowRight className="ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/coach-register">Entrenadores</Link>
            </Button>
          </div>
          <div className="relative mt-16 w-full max-w-5xl">
              <div className="absolute -bottom-8 -left-8 -right-8 top-8 bg-primary/10 rounded-3xl -z-10"></div>
              <Image
                  src="https://placehold.co/1200x675.png"
                  width={1200}
                  height={675}
                  alt="Panel de chas.com"
                  className="rounded-xl border shadow-2xl"
                  data-ai-hint="basketball analysis dashboard"
              />
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto max-w-5xl text-center">
          <h2 className="font-headline text-3xl font-bold uppercase">
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

        {/* Testimonials Section */}
        <section className="container mx-auto max-w-5xl text-center">
          <h2 className="font-headline text-3xl font-bold uppercase">
            Testimonios
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="text-left">
                <CardContent className="pt-6">
                  <blockquote className="italic text-muted-foreground">
                    "{testimonial.quote}"
                  </blockquote>
                </CardContent>
                <CardHeader className="flex-row items-center gap-4">
                  <Avatar>
                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} data-ai-hint={testimonial['data-ai-hint']} />
                    <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto max-w-3xl text-center">
          <h2 className="font-headline text-3xl font-bold uppercase">
            Comenzar
          </h2>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/register">Crear mi cuenta <ArrowRight className="ml-2" /></Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
