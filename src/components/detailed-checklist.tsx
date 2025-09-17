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
import { Badge } from "@/components/ui/badge";


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
                    value={typeof currentScore === 'number' ? Math.round(currentScore <= 10 ? currentScore * 10 : (currentScore <= 5 ? (currentScore/5)*100 : currentScore)) : ''}
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
    coachInline = false,
    coachIsEditable = false,
    coachValue,
    onCoachChange,
}: { 
    item: DetailedChecklistItem;
    categoryName: string;
    onItemChange: (categoryName: string, itemId: string, newRating: DetailedChecklistItem['rating'], newComment: string, newRating10?: number, newNA?: boolean) => void;
    editable?: boolean;
    showCoachBox?: boolean;
    coachInline?: boolean;
    coachIsEditable?: boolean;
    coachValue?: { rating?: number; comment?: string };
    onCoachChange?: (itemId: string, next: { rating?: number; comment?: string }) => void;
}) {
  const [rating, setRating] = useState<number>(item.rating || 3);
  const [isNA, setIsNA] = useState<boolean>(Boolean((item as any).na));
  const [rating10, setRating10] = useState<number | undefined>(item.rating10);
  const [coachComment, setCoachComment] = useState(item.coachComment || "");
  const [showCoachMobile, setShowCoachMobile] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const isReviewed = Boolean(
    (typeof coachValue?.rating === 'number') ||
    (String(coachValue?.comment || '').trim() !== '')
  );

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
    <div className={`space-y-3 sm:space-y-4 rounded-lg border p-3 sm:p-4 ${coachInline && typeof coachValue?.rating === 'number' ? 'bg-emerald-50 border-emerald-300' : ''}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-1">
        <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2">
          {item.name}
          {coachInline && typeof coachValue?.rating === 'number' && (
            <Badge variant="secondary" className="text-[11px]">Visto</Badge>
          )}
        </h4>
        <div className="flex items-center gap-2">
          {isNA ? (
            <>
              <AlertCircle className="text-muted-foreground" />
              <span className="font-medium text-sm sm:text-base">No calificable por falta de datos (N/A)</span>
            </>
          ) : (
            <>
              {ratingIcon(rating)}
              <span className="font-medium text-sm sm:text-base">{ratingLabel(rating)}</span>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{item.description}</p>

      {/* Controles IA */}
      {!isNA && (
        <RadioGroup
          value={String(rating)}
          onValueChange={(value) => setRating(Number(value))}
          className="flex flex-col gap-2 sm:flex sm:flex-wrap sm:gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="1" id={`${item.id}-r1`} disabled={!editable} />
            <Label htmlFor={`${item.id}-r1`}>1 - Incorrecto</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="2" id={`${item.id}-r2`} disabled={!editable} />
            <Label htmlFor={`${item.id}-r2`}>2 - Incorrecto leve</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="3" id={`${item.id}-r3`} disabled={!editable} />
            <Label htmlFor={`${item.id}-r3`}>3 - Mejorable</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="4" id={`${item.id}-r4`} disabled={!editable} />
            <Label htmlFor={`${item.id}-r4`}>4 - Correcto</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="5" id={`${item.id}-r5`} disabled={!editable} />
            <Label htmlFor={`${item.id}-r5`}>5 - Excelente</Label>
          </div>
        </RadioGroup>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Comentarios de la IA</Label>
        <Textarea
          placeholder="Generados automáticamente por la IA"
          value={item.comment || ''}
          readOnly
          className="mt-1 bg-muted/30 text-sm"
        />
      </div>

      {/* Controles del entrenador inline */}
      {coachInline && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!coachIsEditable}
              onClick={() => onCoachChange?.(item.id, { rating: rating as any, comment: coachValue?.comment })}
            >
              De acuerdo con la IA ({rating})
            </Button>
            <Button size="sm" variant="outline" disabled={!coachIsEditable} onClick={() => setShowReview((s)=>!s)}>
              {showReview ? 'Cerrar revisión' : (isReviewed ? 'Revisado' : 'Revisar')}
            </Button>
          </div>
          {showReview && (
            <div className="rounded-md border p-2">
              <div className="flex items-center gap-2 text-xs mb-2">
                <span>Calificación:</span>
                {[1,2,3,4,5].map((r) => (
                  <label key={`rev-${item.id}-${r}`} className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name={`rev-${item.id}`}
                      checked={coachValue?.rating === r}
                      onChange={() => onCoachChange?.(item.id, { rating: r, comment: coachValue?.comment })}
                      disabled={!coachIsEditable}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <Textarea
                placeholder="Comentario para el jugador / IA"
                value={coachValue?.comment || ''}
                onChange={(e) => onCoachChange?.(item.id, { rating: coachValue?.rating, comment: e.target.value })}
                className="text-xs"
                disabled={!coachIsEditable}
              />
            </div>
          )}
          {!showReview && isReviewed && (
            <div className="rounded-md border p-2 bg-emerald-50/50">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="font-medium">Revisado</span>
                {typeof coachValue?.rating === 'number' && (
                  <Badge variant="secondary">Calificación: {coachValue.rating}</Badge>
                )}
              </div>
              {String(coachValue?.comment || '').trim() !== '' && (
                <div className="text-xs text-muted-foreground whitespace-pre-line">{coachValue?.comment}</div>
              )}
            </div>
          )}
        </div>
      )}

      {showCoachBox && (
        <div>
          <div className="sm:hidden">
            <button
              type="button"
              className="w-full text-left text-xs font-medium text-muted-foreground underline"
              onClick={() => setShowCoachMobile((prev) => !prev)}
              aria-controls={`${item.id}-coach-comment-mobile`}
              aria-expanded={showCoachMobile}
            >
              Comentarios del Entrenador (tocar para editar)
            </button>
            {showCoachMobile && (
              <div id={`${item.id}-coach-comment-mobile`} className="mt-1">
                <Textarea
                  placeholder="Añade tus comentarios específicos aquí..."
                  value={coachComment}
                  onChange={(e) => setCoachComment(e.target.value)}
                  className="text-sm"
                  disabled={!editable}
                />
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            <Label className="text-xs text-muted-foreground">Comentarios del Entrenador</Label>
            <Textarea
              placeholder="Añade tus comentarios específicos aquí..."
              value={coachComment}
              onChange={(e) => setCoachComment(e.target.value)}
              className="mt-1 text-sm"
              disabled={!editable}
            />
          </div>
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
    coachInline?: boolean;
    coachIsEditable?: boolean;
    coachFeedbackByItemId?: Record<string, { rating?: number; comment?: string }>;
    onCoachFeedbackChange?: (itemId: string, next: { rating?: number; comment?: string }) => void;
}

export function DetailedChecklist({ categories, onChecklistChange, analysisId, currentScore, editable = true, showCoachBox = false, coachInline = false, coachIsEditable = false, coachFeedbackByItemId, onCoachFeedbackChange }: DetailedChecklistProps) {
  const totalItems = Array.isArray(categories)
    ? categories.reduce((sum, c) => sum + ((c.items && c.items.length) || 0), 0)
    : 0;
  const hasAnyActiveItem = Array.isArray(categories)
    ? categories.some((c) => (c.items || []).some((it) => !Boolean((it as any).na)))
    : false;
  const showPlaceholder = totalItems === 0 || !hasAnyActiveItem;

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
         {showPlaceholder ? (
           <div className="p-6 text-center text-muted-foreground">Sin calificación</div>
         ) : (
           <Tabs defaultValue={categories[0]?.category || ''} className="w-full">
             <TabsList className="w-full flex justify-start gap-2 overflow-x-auto flex-nowrap md:flex-wrap">
               {categories.map((category) => (
                 <TabsTrigger
                   value={category.category}
                   key={`tab-${category.category}`}
                   className="min-w-[120px] md:min-w-[160px] whitespace-nowrap text-center flex-shrink-0"
                 >
                   {category.category}
                 </TabsTrigger>
               ))}
             </TabsList>
             {categories.map((category) => (
               <TabsContent value={category.category} key={`tabc-${category.category}`} className="mt-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {category.items.map((item, idx) => (
                     <ChecklistItem
                       key={`ci-${category.category}|${item.id}|${idx}`}
                       item={item}
                       categoryName={category.category}
                       onItemChange={onChecklistChange}
                       editable={editable}
                       showCoachBox={showCoachBox}
                       coachInline={coachInline}
                       coachIsEditable={coachIsEditable}
                       coachValue={coachFeedbackByItemId?.[item.id]}
                       onCoachChange={onCoachFeedbackChange}
                     />
                   ))}
                 </div>
               </TabsContent>
             ))}
           </Tabs>
         )}
      </CardContent>
      {!showPlaceholder && (
        <CardFooter className="flex-col items-stretch gap-4 border-t px-6 py-4">
          <ScoreForm analysisId={analysisId} currentScore={currentScore} />
        </CardFooter>
      )}
    </Card>
  );
}
