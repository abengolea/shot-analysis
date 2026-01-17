"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { adminCreateCoach, adminSendPasswordReset } from "@/app/actions";
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
          Creando entrenador...
        </>
      ) : (
        "Crear entrenador"
      )}
    </Button>
  );
}

export function CoachAdminForm() {
  const [state, formAction] = useActionState(adminCreateCoach as any, { success: false, message: "" } as any);
  const [sendState, sendAction] = useActionState(adminSendPasswordReset as any, { success: false, message: "" } as any);
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

  useEffect(() => {
    if (sendState.message) {
      toast({
        title: sendState.success ? "Email enviado" : "No se pudo enviar",
        description: sendState.message,
        variant: sendState.success ? "default" : "destructive",
      });
    }
  }, [sendState, toast]);

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
            <Input id="name" name="name" placeholder="" required />
            {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="experience">Experiencia</Label>
            <Textarea id="experience" name="experience" placeholder="Describe la experiencia del entrenador..." />
            {state.errors?.experience && <p className="text-sm text-destructive">{state.errors.experience[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="ejemplo@correo.com" required />
            {state.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarFile">Foto (JPG/PNG/WEBP, máx 5MB)</Label>
            <Input id="avatarFile" name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" required />
            {state.errors?.avatarFile && <p className="text-sm text-destructive">{state.errors.avatarFile[0]}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
      {state.success && (state as any).userId && (
        <CardContent>
          <div className="mt-2 grid gap-2">
            <div className="text-sm text-muted-foreground">Entrenador creado: {(state as any).userId}</div>
            <form action={sendAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={(state as any).userId} />
              <Button type="submit" size="sm" variant="outline">Enviar link para establecer contraseña</Button>
            </form>
            {sendState.link && (
              <div className="text-xs text-muted-foreground break-all">
                Link de contraseña:{" "}
                <a href={sendState.link} target="_blank" rel="noreferrer" className="underline text-primary">
                  {sendState.link}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
