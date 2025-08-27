import type { Drill } from "@/lib/types";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Target, ShieldCheck } from "lucide-react";

interface DrillCardProps {
  drill: Drill;
}

export function DrillCard({ drill }: DrillCardProps) {
  return (
    <AccordionItem value={drill.name}>
      <AccordionTrigger className="text-left font-headline hover:no-underline">
        <div className="flex flex-col items-start gap-1">
          <span className="text-lg">{drill.name}</span>
          <Badge variant="secondary">{drill.targetIssue}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 pt-2">
        <div>
          <h4 className="font-semibold mb-2">Instrucciones</h4>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            {drill.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3">
                <Dumbbell className="h-5 w-5 mt-0.5 shrink-0 text-primary"/>
                <div>
                    <h5 className="font-semibold">Series y Reps</h5>
                    <p className="text-muted-foreground">{drill.setsReps}</p>
                </div>
            </div>
             <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3">
                <Target className="h-5 w-5 mt-0.5 shrink-0 text-primary"/>
                <div>
                    <h5 className="font-semibold">Criterio de Éxito</h5>
                    <p className="text-muted-foreground">{drill.successCriteria}</p>
                </div>
            </div>
             <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3">
                <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0 text-primary"/>
                <div>
                    <h5 className="font-semibold">Seguridad</h5>
                    <p className="text-muted-foreground">{drill.safety || 'Ninguna'}</p>
                </div>
            </div>
        </div>

         <div>
          <h4 className="font-semibold mb-2">Progresión</h4>
          <p className="text-muted-foreground">{drill.progression}</p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
