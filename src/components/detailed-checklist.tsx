"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import type { DetailedChecklistItem, ShotAnalysis, ChecklistCategory } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, XCircle, FilePenLine, Loader2, Save } from "lucide-react";
import { updateAnalysisScore } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";


function ScoreForm({ analysisId, currentScore }: { analysisId: string, currentScore?: number }) {
    const [state, formAction] = useActionState(updateAnalysisScore, { success: false, message: "" });
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({
                title: state.success ? "Éxito" : "Error",
                description: state.message,
                variant: state.success ? "default" : "destructive",
            });
        }
    }, [state, toast]);


    const { pending } = useFormStatus();

    return (
         <form ref={formRef} action={formAction} className="flex items-end gap-2">
            <input type="hidden" name="analysisId" value={analysisId} />
            <div className="grid flex-1 gap-1.5">
                <Label htmlFor="score">Puntuación General (0-100)</Label>
                <Input 
                    id="score" 
                    name="score" 
                    type="number" 
                    placeholder="Ej: 85" 
                    defaultValue={currentScore}
                    min="0"
                    max="100"
                />
            </div>
            <Button type="submit" disabled={pending} size="icon">
                {pending ? <Loader2 className="animate-spin" /> : <Save />}
                <span className="sr-only">Guardar Puntuación</span>
            </Button>
        </form>
    );
}


function ChecklistItem({ item }: { item: DetailedChecklistItem }) {
  const [status, setStatus] = useState(item.status);
  const [comment, setComment] = useState(item.comment);

  const ICONS = {
    Correcto: <CheckCircle className="text-green-500" />,
    Mejorable: <AlertCircle className="text-yellow-500" />,
    Incorrecto: <XCircle className="text-red-500" />,
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{item.name}</h4>
        <div className="flex items-center gap-2">
          {ICONS[status]}
          <span className="font-medium">{status}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{item.description}</p>
      
      <RadioGroup
        value={status}
        onValueChange={(value) => setStatus(value as typeof status)}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="Correcto" id={`${item.id}-correct`} />
          <Label htmlFor={`${item.id}-correct`}>Correcto</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="Mejorable" id={`${item.id}-improvable`} />
          <Label htmlFor={`${item.id}-improvable`}>Mejorable</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="Incorrecto" id={`${item.id}-incorrect`} />
          <Label htmlFor={`${item.id}-incorrect`}>Incorrecto</Label>
        </div>
      </RadioGroup>

      <div>
        <Label className="text-xs text-muted-foreground">Comentarios del Entrenador</Label>
        <Textarea
          placeholder="Añade tus comentarios específicos aquí..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1"
        />
      </div>
    </div>
  );
}

export function DetailedChecklist({ analysis }: { analysis: ShotAnalysis }) {
  if (!analysis.detailedChecklist) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <FilePenLine className="h-6 w-6" />
          Checklist Detallado del Lanzamiento
        </CardTitle>
        <CardDescription>
          Evalúa cada componente del lanzamiento y añade comentarios.
        </CardDescription>
      </CardHeader>
      <CardContent>
         <Accordion type="multiple" className="w-full space-y-4">
            {analysis.detailedChecklist.map((category) => (
              <AccordionItem value={category.category} key={category.category} className="rounded-lg border px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {category.category}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  {category.items.map((item) => (
                    <ChecklistItem key={item.id} item={item} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
       <CardFooter className="flex-col items-stretch gap-4 border-t px-6 py-4">
          <ScoreForm analysisId={analysis.id} currentScore={analysis.score} />
      </CardFooter>
    </Card>
  );
}
