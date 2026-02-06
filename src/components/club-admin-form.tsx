"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { adminCreateClub, adminSendPasswordReset } from "@/app/actions";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creando club...
        </>
      ) : (
        "Crear club"
      )}
    </Button>
  );
}

export function ClubAdminForm() {
  const [state, formAction] = useActionState(adminCreateClub as any, { success: false, message: "" } as any);
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
        <CardTitle>Añadir Nuevo Club</CardTitle>
        <CardDescription>
          Completa el formulario para dar de alta un club.
        </CardDescription>
      </CardHeader>
      <form ref={formRef} action={formAction}>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del club</Label>
            <Input id="name" name="name" required />
            {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
            {state.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Input id="province" name="province" required />
              {state.errors?.province && <p className="text-sm text-destructive">{state.errors.province[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" name="city" required />
              {state.errors?.city && <p className="text-sm text-destructive">{state.errors.city[0]}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
      {state.success && (state as any).userId && (
        <CardContent>
          <div className="mt-2 grid gap-2">
            <div className="text-sm text-muted-foreground">Club creado: {(state as any).userId}</div>
            <form action={adminSendPasswordReset as any} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={(state as any).userId} />
              <Button type="submit" size="sm" variant="outline">Enviar link para establecer contraseña</Button>
            </form>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
