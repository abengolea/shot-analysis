"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addCoach } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Añadiendo Entrenador...
        </>
      ) : (
        "Añadir Entrenador"
      )}
    </Button>
  );
}

export function CoachAdminForm() {
  const [state, formAction] = useActionState(addCoach, { success: false, message: "" });
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Éxito" : "Error",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      if (state.success) {
        formRef.current?.reset();
      }
    }
  }, [state, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Añadir Nuevo Entrenador</CardTitle>
        <CardDescription>
          Completa el formulario para añadir un nuevo entrenador a la plataforma.
        </CardDescription>
      </CardHeader>
      <form ref={formRef} action={formAction}>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input id="name" name="name" placeholder="Ej: Daniel Beltramo" />
            {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialties">Especialidades</Label>
            <Input id="specialties" name="specialties" placeholder="Ej: Técnica de Tiro, Desarrollo Juvenil" />
             <p className="text-xs text-muted-foreground">Separar por comas.</p>
             {state.errors?.specialties && <p className="text-sm text-destructive">{state.errors.specialties[0]}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="experience">Experiencia</Label>
            <Textarea id="experience" name="experience" placeholder="Describe la experiencia del entrenador..." />
            {state.errors?.experience && <p className="text-sm text-destructive">{state.errors.experience[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="ratePerAnalysis">Tarifa por Análisis</Label>
                <Input id="ratePerAnalysis" name="ratePerAnalysis" type="number" placeholder="Ej: 50" />
                {state.errors?.ratePerAnalysis && <p className="text-sm text-destructive">{state.errors.ratePerAnalysis[0]}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="avatarUrl">URL de la Foto</Label>
                <Input id="avatarUrl" name="avatarUrl" placeholder="https://placehold.co/128x128.png" />
                {state.errors?.avatarUrl && <p className="text-sm text-destructive">{state.errors.avatarUrl[0]}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
