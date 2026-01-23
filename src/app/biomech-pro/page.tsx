import Link from "next/link";
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  Film,
  Layers,
  Sparkles,
  Timer,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SkeletonOverlayDemo } from "@/components/biomech/skeleton-overlay-demo";
import { TimelinePhases } from "@/components/biomech/timeline-phases";
import { EnergyFlowPanel } from "@/components/biomech/energy-flow-panel";
import { ComparisonView } from "@/components/biomech/comparison-view";
import { BiomechRecentAnalyses } from "@/components/biomech/biomech-recent-analyses";

const pipeline = [
  {
    title: "Upload inteligente",
    description: "Validación de duración, FPS y formato + metadata del tiro.",
    icon: Upload,
  },
  {
    title: "Pose detection",
    description: "Extracción de keypoints por frame con precisión biomecánica.",
    icon: Brain,
  },
  {
    title: "Detección de fases",
    description: "Segmentación automática del tiro en 6 fases clave.",
    icon: Timer,
  },
  {
    title: "Energy transfer",
    description: "Secuencia de cadena cinética, timing y pérdidas de energía.",
    icon: Zap,
  },
  {
    title: "Reportes",
    description: "Insights, recomendaciones y exportación PDF.",
    icon: BarChart3,
  },
];

const modules = [
  {
    title: "Video Uploader Pro",
    description: "Dropzone, presets por tipo de tiro y checklist visual.",
  },
  {
    title: "Skeleton Overlay",
    description: "Overlay de keypoints con capas y comparativa.",
  },
  {
    title: "Timeline & Phases",
    description: "Navegación por fases con mini-thumbs y zoom.",
  },
  {
    title: "Energy Flow",
    description: "Mapa de transferencia y score biomecánico.",
  },
  {
    title: "Comparison View",
    description: "Split screen jugador vs modelo óptimo.",
  },
  {
    title: "Report Generator",
    description: "PDF con frames clave y recomendaciones.",
  },
];

const availableStack = [
  "Next.js (App Router)",
  "TypeScript 5+",
  "Tailwind CSS + shadcn/ui",
  "Recharts",
  "React Hook Form + Zod",
  "MediaPipe (web)",
  "TensorFlow.js",
];

const missingStack = [
  "Framer Motion",
  "Zustand",
  "TanStack Query",
  "video.js / Plyr",
  "D3.js",
];

const backendSignals = [
  {
    title: "Pose service (FastAPI)",
    description: "Servicio Python con OpenCV + MediaPipe.",
  },
  {
    title: "Procesamiento en ML",
    description: "Carpeta `ml/` con scripts de entrenamiento.",
  },
];

export default function BiomechProPage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              BIOMECH PRO
            </Badge>
            <Badge variant="outline">Página independiente</Badge>
            <Badge variant="secondary">Modo diseño</Badge>
          </div>
          <h1 className="text-4xl font-headline font-semibold tracking-tight">
            Análisis biomecánico profesional del tiro
          </h1>
          <p className="text-muted-foreground text-lg">
            Esta página concentra el flujo completo de BIOMECH PRO para evolucionar en paralelo al
            resto del producto. Todo lo que ves acá es editable sin tocar los enlaces actuales.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/upload?mode=biomech-pro">Subir video</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Volver al dashboard</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Pipeline modular
            </span>
            <span className="inline-flex items-center gap-2">
              <Layers className="h-4 w-4" />
              UI/UX pro
            </span>
            <span className="inline-flex items-center gap-2">
              <Film className="h-4 w-4" />
              Video + overlay
            </span>
          </div>
        </div>
        <Card className="border-2 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Estado de preparación
            </CardTitle>
            <CardDescription>
              Vista rápida para alinear tecnología y alcance antes de integrar enlaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">MVP biomecánico</span>
                <span className="font-medium">En diseño</span>
              </div>
              <Progress value={35} />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="text-sm font-medium">Checklist crítico</div>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Pose detection base (web) disponible
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  UI kit y gráficos listos
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Servicio Python de poses existente
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Base de ML y scripts de entrenamiento
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {pipeline.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {step.title}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6">
        <BiomechRecentAnalyses />
      </section>

      

      <section className="grid gap-6">
        <SkeletonOverlayDemo />
      </section>

      <section className="grid gap-6">
        <TimelinePhases />
      </section>

      <section className="grid gap-6">
        <EnergyFlowPanel />
      </section>

      <section className="grid gap-6">
        <ComparisonView />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Modularización propuesta</CardTitle>
            <CardDescription>
              Cada bloque se desarrolla de forma independiente y se conecta cuando sea necesario.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <div key={module.title} className="rounded-lg border p-4">
                <div className="text-sm font-semibold">{module.title}</div>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stack actual vs. pendiente</CardTitle>
            <CardDescription>
              Revisión rápida de lo que ya tenemos instalado en este repo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium">Disponible</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableStack.map((item) => (
                  <Badge key={item} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium">Pendiente de instalar</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingStack.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Señales de backend ya existentes</CardTitle>
            <CardDescription>
              No tocamos estructura, solo identificamos lo disponible para conectar luego.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {backendSignals.map((item) => (
              <div key={item.title} className="rounded-lg border p-4">
                <div className="text-sm font-semibold">{item.title}</div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximos pasos (cuando quieras)</CardTitle>
            <CardDescription>
              Dejamos preparado el tablero de tareas para el siguiente sprint.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Crear `VideoUploader` con validaciones y metadata.
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Montar `SkeletonOverlay` con canvas y keypoints.
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Conectar timeline con fases detectadas.
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Integrar score y recomendaciones.
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Exportar PDF con frames clave.
            </span>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
