"use client"

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { registerPlayer } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creando Cuenta...
        </>
      ) : (
        "Registrarse"
      )}
    </Button>
  );
}

export function RegisterForm() {
    const [state, formAction] = useActionState(registerPlayer, { success: false, message: "" });
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message && !state.success) {
            toast({
                title: "Error de Registro",
                description: state.message,
                variant: "destructive",
            });
        }
    }, [state, toast]);

  return (
    <form action={formAction} className="w-full space-y-6">
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Detalles del Jugador</CardTitle>
                <CardDescription>
                   Completa tu información para crear una cuenta.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo</Label>
                    <Input id="name" name="name" placeholder="Tu nombre" />
                    {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="tu@email.com" />
                    {state.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input id="password" name="password" type="password" placeholder="Tu contraseña segura" />
                    {state.errors?.password && <p className="text-sm text-destructive">{state.errors.password[0]}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="dob">Fecha de Nacimiento</Label>
                    <Input id="dob" name="dob" type="date" className="block" />
                     {state.errors?.dob && <p className="text-sm text-destructive">{state.errors.dob[0]}</p>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="country">País</Label>
                        <Select name="country">
                            <SelectTrigger id="country">
                                <SelectValue placeholder="Selecciona tu país" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AR">Argentina</SelectItem>
                                <SelectItem value="ES">España</SelectItem>
                                <SelectItem value="MX">México</SelectItem>
                                <SelectItem value="US">Estados Unidos</SelectItem>
                                <SelectItem value="CO">Colombia</SelectItem>
                            </SelectContent>
                        </Select>
                        {state.errors?.country && <p className="text-sm text-destructive">{state.errors.country[0]}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input id="phone" name="phone" type="tel" placeholder="+54911..." />
                        {state.errors?.phone && <p className="text-sm text-destructive">{state.errors.phone[0]}</p>}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch">
               <SubmitButton />
                 {state?.message && !state.success && (
                    <p className="mt-2 text-sm text-center text-destructive">{state.message}</p>
                )}
            </CardFooter>
        </Card>
    </form>
  )
}
