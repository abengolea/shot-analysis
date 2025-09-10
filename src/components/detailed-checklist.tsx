"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import type { DetailedChecklistItem, ChecklistCategory } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, XCircle, ListChecks, Loader2, Save } from "lucide-react";
// import { updateAnalysisScore } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeCategorySubtotal, getCategoryNominalWeight, getItemWeight } from "@/lib/scoring";


function ScoreForm({ analysisId, currentScore }: { analysisId: string, currentScore?: number }) {
    return (
         <div className="flex items-end gap-2 p-4 border rounded-lg bg-muted/50">
            <div className="grid flex-1 gap-1.5">
                <Label htmlFor="score">Puntuación General (0-100)</Label>
                <Input 
                    id="score" 
                    name="score" 
                    type="number" 
                    placeholder="Ej: 85" 
                    value={typeof currentScore === 'number' ? Number(currentScore.toFixed(2)) : ''}
                    readOnly
                />
            </div>
            <Button variant="outline" size="icon" disabled>
                <Save />
                <span className="sr-only">Guardar Puntuación</span>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
                Se recalcula automáticamente según los pesos
            </p>
         </div>
    );
}


function ChecklistItem({ 
    item, 
    categoryName,
    onItemChange,
    editable = true,
    showCoachBox = false,
}: { 
    item: DetailedChecklistItem;
    categoryName: string;
    onItemChange: (categoryName: string, itemId: string, newRating: DetailedChecklistItem['rating'], newComment: string, newRating10?: number, newNA?: boolean) => void;
    editable?: boolean;
    showCoachBox?: boolean;
}) {
  const [rating, setRating] = useState<number>(item.rating || 3);
  const [isNA, setIsNA] = useState<boolean>(Boolean((item as any).na));
  const [rating10, setRating10] = useState<number | undefined>(item.rating10);
  const [coachComment, setCoachComment] = useState(item.coachComment || "");

  useEffect(() => {
    // Si está marcado como N/A, forzar rating neutro pero UI y backend deberán ignorarlo en el cálculo
    onItemChange(categoryName, item.id, rating as DetailedChecklistItem['rating'], coachComment, rating10, isNA);
  }, [rating, rating10, coachComment, isNA]);

  const ratingLabel = (r: number) => {
    switch (r) {
      case 5: return 'Excelente';
      case 4: return 'Correcto';
      case 3: {
        // Etiqueta especial para mano no dominante en liberación (3 estados): 3 = sin otorgar, sin penalizar
        if (item.id === 'mano_no_dominante_liberacion') return 'Mejorable (sin empuje claro)';
        return 'Mejorable';
      }
      case 2: {
        if (item.id === 'mano_no_dominante_liberacion') return 'Empuje leve (penaliza -20%)';
        return 'Incorrecto leve';
      }
      case 1: {
        if (item.id === 'mano_no_dominante_liberacion') return 'Empuje fuerte (penaliza -30%)';
        return 'Incorrecto';
      }
      default: return 'Mejorable';
    }
  };

  const ratingIcon = (r: number) => {
    if (r >= 4) return <CheckCircle className="text-green-500" />;
    if (r === 3) return <AlertCircle className="text-yellow-500" />;
    return <XCircle className="text-red-500" />;
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">
          {item.name}
          {getItemWeight(item.id) > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">({getItemWeight(item.id)}%)</span>
          )}
        </h4>
        <div className="flex items-center gap-2">
          {ratingIcon(rating)}
          <span className="font-medium">{ratingLabel(rating)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{item.description}</p>

      <div className="flex items-center gap-2 text-xs">
        <input
          id={`${item.id}-na`}
          type="checkbox"
          className="accent-primary"
          checked={isNA}
          onChange={(e) => setIsNA(e.target.checked)}
          disabled={!editable}
        />
        <Label htmlFor={`${item.id}-na`}>No calificable por falta de datos (N/A)</Label>
      </div>

      {/* Nota UX: ítems de mano no dominante */}
      {(item.id === 'mano_no_dominante_ascenso' || item.id === 'mano_no_dominante_liberacion') && (
        <div className="rounded-md border p-2 text-xs bg-blue-50 text-blue-800">
          {item.id === 'mano_no_dominante_ascenso' ? (
            <span>Ascenso (2%): Debe acompañar sin interferir. Binario: Correcto (≥4) u Incorrecto (&lt;4).</span>
          ) : (
            <span>Liberación (3%): Sin empuje (≥4) = otorga 3%. Empuje leve (=2) penaliza -20% del total. Empuje fuerte (=1) penaliza -30%.</span>
          )}
        </div>
      )}

      {item.name === 'Fluidez / Armonía (transferencia energética)' && (
        <div className="rounded-md border p-3 bg-primary/5">
          <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800 text-xs">
            <AlertCircle className="h-4 w-4" />
            <span>Ítem clave: aporta el 65% del puntaje final del análisis.</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Puntuación específica (1–10)</span>
            <span className="text-base font-semibold">{rating10 ?? 5} / 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={rating10 ?? 5}
            onChange={(e) => setRating10(Number(e.target.value))}
            className="w-full accent-primary"
            disabled={!editable}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Describe brevemente la razón de esta puntuación para que el jugador reciba una devolución clara.
          </p>
        </div>
      )}
      
      <RadioGroup
        value={String(rating)}
        onValueChange={(value) => setRating(Number(value))}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="1" id={`${item.id}-r1`} disabled={!editable || isNA} />
          <Label htmlFor={`${item.id}-r1`}>1 - Incorrecto</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="2" id={`${item.id}-r2`} disabled={!editable || isNA} />
          <Label htmlFor={`${item.id}-r2`}>2 - Incorrecto leve</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="3" id={`${item.id}-r3`} disabled={!editable || isNA} />
          <Label htmlFor={`${item.id}-r3`}>3 - Mejorable</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="4" id={`${item.id}-r4`} disabled={!editable || isNA} />
          <Label htmlFor={`${item.id}-r4`}>4 - Correcto</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="5" id={`${item.id}-r5`} disabled={!editable || isNA} />
          <Label htmlFor={`${item.id}-r5`}>5 - Excelente</Label>
        </div>
      </RadioGroup>

      <div>
        <Label className="text-xs text-muted-foreground">Comentarios de la IA</Label>
        <Textarea
          placeholder="Generados automáticamente por la IA"
          value={item.comment || ''}
          readOnly
          className="mt-1 bg-muted/30"
        />
      </div>
      {showCoachBox && (
        <div>
          <Label className="text-xs text-muted-foreground">Comentarios del Entrenador</Label>
          <Textarea
            placeholder="Añade tus comentarios específicos aquí..."
            value={coachComment}
            onChange={(e) => setCoachComment(e.target.value)}
            className="mt-1"
            disabled={!editable}
          />
        </div>
      )}
    </div>
  );
}

interface DetailedChecklistProps {
    categories: ChecklistCategory[];
    onChecklistChange: (categoryName: string, itemId: string, newRating: DetailedChecklistItem['rating'], newComment: string, newRating10?: number, newNA?: boolean) => void;
    analysisId: string;
    currentScore?: number;
    editable?: boolean;
    showCoachBox?: boolean;
}

export function DetailedChecklist({ categories, onChecklistChange, analysisId, currentScore, editable = true, showCoachBox = false }: DetailedChecklistProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <ListChecks className="h-6 w-6" />
          Checklist Detallado del Lanzamiento
        </CardTitle>
        <CardDescription>
          Evalúa cada componente del lanzamiento y añade comentarios. Los cambios se guardan automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
         <Tabs defaultValue={categories[0]?.category || ''} className="w-full">
            <TabsList className="w-full flex flex-wrap justify-start gap-2">
                 {categories.map((category) => (
                    <TabsTrigger
                        value={category.category}
                        key={`tab-${category.category}`}
                        className="min-w-[160px] whitespace-normal text-center"
                    >
                        {category.category}
                    </TabsTrigger>
                ))}
            </TabsList>
            {categories.map((category) => (
                <TabsContent value={category.category} key={`tabc-${category.category}`} className="mt-4">
                    <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
                      {(() => { const s = computeCategorySubtotal(category); return (
                        <>
                          <span>Subtotal:</span>
                          <span>{s.achieved.toFixed(2)} / {s.max.toFixed(2)}</span>
                        </>
                      ); })()}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {category.items.map((item, idx) => (
                           <ChecklistItem 
                                key={`ci-${category.category}|${item.id}|${idx}`} 
                                item={item} 
                                categoryName={category.category}
                                onItemChange={onChecklistChange} 
                                editable={editable}
                                showCoachBox={showCoachBox}
                            />
                        ))}
                    </div>
                </TabsContent>
            ))}
         </Tabs>
      </CardContent>
       <CardFooter className="flex-col items-stretch gap-4 border-t px-6 py-4">
          <ScoreForm analysisId={analysisId} currentScore={currentScore} />
      </CardFooter>
    </Card>
  );
}
