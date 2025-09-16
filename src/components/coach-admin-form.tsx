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
          Enviando solicitud...
        </>
      ) : (
        "Enviar solicitud de alta"
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
            <Input id="name" name="name" placeholder="" />
            {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="experience">Experiencia</Label>
            <Textarea id="experience" name="experience" placeholder="Describe la experiencia del entrenador..." />
            {state.errors?.experience && <p className="text-sm text-destructive">{state.errors.experience[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="ejemplo@correo.com" />
            {state.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarFile">Foto (JPG/PNG/WEBP, máx 5MB)</Label>
            <Input id="avatarFile" name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" />
            {state.errors?.avatarFile && <p className="text-sm text-destructive">{state.errors.avatarFile[0]}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
