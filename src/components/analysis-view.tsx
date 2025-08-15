"use client";

import { useState } from "react";
import Image from "next/image";
import { getDrills } from "@/app/actions";
import type {
  ShotAnalysis,
  Player,
  Drill,
  ChecklistCategory,
  DetailedChecklistItem,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Loader2,
  Sparkles,
  ShieldAlert,
  Bot,
  FilePenLine,
  Dumbbell,
  Camera,
  MessageSquare,
  Move,
  Pencil,
  Circle as CircleIcon,
  Eraser,
  ListChecks,
} from "lucide-react";
import { DrillCard } from "./drill-card";
import { DetailedChecklist } from "./detailed-checklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalysisViewProps {
  analysis: ShotAnalysis;
  player: Player;
}

export function AnalysisView({ analysis, player }: AnalysisViewProps) {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [isLoadingDrills, setIsLoadingDrills] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checklistState, setChecklistState] = useState<ChecklistCategory[]>(
    analysis.detailedChecklist || []
  );

  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openKeyframeModal = (keyframeUrl: string) => {
    setSelectedKeyframe(keyframeUrl);
    setIsModalOpen(true);
  };


  const handleChecklistChange = (
    categoryName: string,
    itemId: string,
    newStatus: DetailedChecklistItem["status"],
    newComment: string
  ) => {
    setChecklistState((prevState) =>
      prevState.map((category) =>
        category.category === categoryName
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId
                  ? { ...item, status: newStatus, comment: newComment }
                  : item
              ),
            }
          : category
      )
    );
  };

  const derivedStrengths = checklistState
    .flatMap((c) => c.items)
    .filter((item) => item.status === "Correcto")
    .map((item) => item.name);

  const derivedWeaknesses = checklistState
    .flatMap((c) => c.items)
    .filter((item) => item.status === "Incorrecto")
    .map((item) => item.name);

  const derivedRecommendations = checklistState
    .flatMap((c) => c.items)
    .filter(
      (item) =>
        (item.status === "Mejorable" || item.status === "Incorrecto") &&
        item.comment.trim() !== ""
    )
    .map((item) => `${item.name}: ${item.comment}`);

  const handleGenerateDrills = async () => {
    setIsLoadingDrills(true);
    setError(null);
    const weaknessesSummary =
      derivedWeaknesses.length > 0
        ? `El jugador necesita mejorar en: ${derivedWeaknesses.join(", ")}.`
        : "El jugador no tiene debilidades marcadas, genera ejercicios generales de perfeccionamiento.";

    const result = await getDrills(weaknessesSummary, player.ageGroup);
    if (result.drills) {
      setDrills(result.drills);
    } else if (result.error) {
      setError(result.error);
    }
    setIsLoadingDrills(false);
  };
  
  const renderKeyframes = (keyframes: string[], angle: string) => (
     <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {keyframes.map((keyframe, index) => (
            <button key={`${angle}-${index}`} onClick={() => openKeyframeModal(keyframe)} className="overflow-hidden rounded-lg border aspect-square focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:scale-105">
                <Image
                    src={keyframe}
                    alt={`Fotograma ${angle} ${index + 1}`}
                    width={300}
                    height={300}
                    className="aspect-square object-cover"
                    data-ai-hint="basketball shot"
                />
            </button>
        ))}
    </div>
  );

  return (
    <>
    <Tabs defaultValue="ai-analysis" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="ai-analysis">
          <Bot className="mr-2" /> Análisis IA
        </TabsTrigger>
        <TabsTrigger value="coach-feedback">
          <FilePenLine className="mr-2" /> Feedback del Coach
        </TabsTrigger>
        <TabsTrigger value="checklist">
            <ListChecks className="mr-2" /> Checklist
        </TabsTrigger>
        <TabsTrigger value="improvement-plan">
          <Dumbbell className="mr-2" /> Plan de Mejora
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ai-analysis" className="mt-6">
        <div className="flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">
                Resumen del Análisis de IA
              </CardTitle>
              <Badge variant="outline" className="w-fit">
                {analysis.shotType}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{analysis.analysisSummary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Camera /> Fotogramas Clave
              </CardTitle>
              <CardDescription>
                Haz clic en un fotograma para ampliarlo y comentarlo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="front" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="front">Frente</TabsTrigger>
                  <TabsTrigger value="back">Espalda</TabsTrigger>
                  <TabsTrigger value="left">Lado Izquierdo</TabsTrigger>
                  <TabsTrigger value="right">Lado Derecho</TabsTrigger>
                </TabsList>
                <TabsContent value="front" className="mt-4">
                  {renderKeyframes(analysis.keyframes.front, 'frontal')}
                </TabsContent>
                <TabsContent value="back" className="mt-4">
                   {renderKeyframes(analysis.keyframes.back, 'espalda')}
                </TabsContent>
                <TabsContent value="left" className="mt-4">
                   {renderKeyframes(analysis.keyframes.left, 'izquierdo')}
                </TabsContent>
                <TabsContent value="right" className="mt-4">
                   {renderKeyframes(analysis.keyframes.right, 'derecho')}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="coach-feedback" className="mt-6">
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-green-600">
                  <CheckCircle2 /> Fortalezas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {derivedStrengths.length > 0 ? (
                  <ul className="grid list-inside list-disc grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                    {derivedStrengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    El entrenador aún no ha marcado fortalezas.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-destructive">
                  <XCircle /> Debilidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {derivedWeaknesses.length > 0 ? (
                  <ul className="grid list-inside list-disc grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                    {derivedWeaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    El entrenador aún no ha marcado debilidades.
                  </p>
                )}
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
              {derivedRecommendations.length > 0 ? (
                <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                  {derivedRecommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  El entrenador no ha dejado recomendaciones específicas en el
                  checklist.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
        <TabsContent value="checklist" className="mt-6">
             {analysis.detailedChecklist && (
                <DetailedChecklist
                categories={checklistState}
                onChecklistChange={handleChecklistChange}
                analysisId={analysis.id}
                currentScore={analysis.score}
                />
            )}
      </TabsContent>
      <TabsContent value="improvement-plan" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">
              Ejercicios Personalizados
            </CardTitle>
            <CardDescription>
              Genera ejercicios con IA para corregir debilidades.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drills.length === 0 && !isLoadingDrills && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted p-8 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground" />
                <h3 className="font-semibold">¿Listo para mejorar?</h3>
                <p className="text-sm text-muted-foreground">
                  Haz clic en el botón para generar ejercicios adaptados a este
                  análisis.
                </p>
                <Button onClick={handleGenerateDrills}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Ejercicios
                </Button>
              </div>
            )}
            {isLoadingDrills && (
              <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>Generando ejercicios personalizados...</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
                <ShieldAlert className="h-8 w-8" />
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
      </TabsContent>
    </Tabs>

     <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
            <DialogTitle>Análisis del Fotograma</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                    <Image
                        src={selectedKeyframe || "https://placehold.co/600x600.png"}
                        alt="Fotograma seleccionado"
                        width={600}
                        height={600}
                        className="rounded-lg border"
                    />
                     <div className="absolute top-2 left-2 flex flex-col gap-2 rounded-lg border bg-background/80 p-2 shadow-lg backdrop-blur-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Move /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><CircleIcon /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eraser /></Button>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare /> Comentarios del Entrenador
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {/* Placeholder for comments */}
                           <div className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg">
                             Aún no hay comentarios para este fotograma.
                           </div>
                           <Textarea placeholder="Añade tu comentario aquí..." />
                           <Button className="w-full">Guardar Comentario</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
