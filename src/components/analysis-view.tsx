"use client";

import { useState } from "react";
import Image from "next/image";
import { getDrills } from "@/app/actions";
import type { ShotAnalysis, Player, Drill } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Loader2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { DrillCard } from "./drill-card";

interface AnalysisViewProps {
  analysis: ShotAnalysis;
  player: Player;
}

export function AnalysisView({ analysis, player }: AnalysisViewProps) {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [isLoadingDrills, setIsLoadingDrills] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateDrills = async () => {
    setIsLoadingDrills(true);
    setError(null);
    const result = await getDrills(analysis.analysisSummary, player.ageGroup);
    if (result.drills) {
      setDrills(result.drills);
    } else if (result.error) {
      setError(result.error);
    }
    setIsLoadingDrills(false);
  };

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Resumen del Análisis de IA</CardTitle>
          <Badge variant="outline" className="w-fit">{analysis.shotType}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{analysis.analysisSummary}</p>
        </CardContent>
      </Card>

      {analysis.keyframes.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Fotogramas Clave</CardTitle>
                <CardDescription>Desglose fotograma a fotograma del tiro.</CardDescription>
            </CardHeader>
            <CardContent>
                <Carousel className="w-full">
                <CarouselContent>
                    {analysis.keyframes.map((keyframe, index) => (
                    <CarouselItem key={index}>
                        <div className="p-1">
                        <Card className="overflow-hidden">
                            <CardContent className="flex aspect-video items-center justify-center p-0">
                                <Image
                                    src={keyframe}
                                    alt={`Fotograma clave ${index + 1}`}
                                    width={1280}
                                    height={720}
                                    className="object-cover"
                                    data-ai-hint="basketball shot"
                                />
                            </CardContent>
                        </Card>
                        </div>
                    </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
                </Carousel>
            </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2 text-green-600">
              <CheckCircle2 /> Fortalezas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              {analysis.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2 text-destructive">
              <XCircle /> Debilidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              {analysis.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-accent">
            <Lightbulb /> Recomendaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-muted-foreground">
            {analysis.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline">Ejercicios Personalizados</CardTitle>
            <CardDescription>Genera ejercicios con IA para corregir debilidades.</CardDescription>
        </CardHeader>
        <CardContent>
             {drills.length === 0 && !isLoadingDrills && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted p-8 text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground" />
                    <h3 className="font-semibold">¿Listo para mejorar?</h3>
                    <p className="text-sm text-muted-foreground">Haz clic en el botón para generar ejercicios adaptados a este análisis.</p>
                    <Button onClick={handleGenerateDrills}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generar Ejercicios
                    </Button>
                </div>
            )}
            {isLoadingDrills && (
                <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin"/>
                    <p>Generando ejercicios personalizados...</p>
                </div>
            )}
            {error && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
                    <ShieldAlert className="h-8 w-8"/>
                    <p className="font-semibold">Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}
            {drills.length > 0 && (
                 <Accordion type="single" collapsible className="w-full">
                    {drills.map((drill, index) => (
                        <DrillCard key={index} drill={drill} />
                    ))}
                </Accordion>
            )}
        </CardContent>
      </Card>

    </div>
  );
}
