"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { login } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Shield } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(1, "La contraseña es requerida."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Ingresando...
        </>
      ) : (
        "Ingresar"
      )}
    </Button>
  );
}

interface RoleSpecificFormProps {
    role: 'player' | 'coach';
}

function RoleSpecificForm({ role }: RoleSpecificFormProps) {
    const [state, formAction] = useActionState(login, { success: false, message: "" });
    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    return (
        <Form {...form}>
            <form action={formAction} className="space-y-4">
                 <input type="hidden" name="role" value={role} />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="tu@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="Tu contraseña" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <CardFooter className="p-0 pt-2">
                    <SubmitButton />
                </CardFooter>
                 {state?.message && !state.success && (
                    <p className="mt-2 text-sm text-center text-destructive">{state.message}</p>
                )}
            </form>
        </Form>
    )
}

export function LoginForm() {
  return (
    <Card>
      <CardContent className="p-0">
        <Tabs defaultValue="player" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="player"><User className="mr-2 h-4 w-4"/>Jugador</TabsTrigger>
            <TabsTrigger value="coach"><Shield className="mr-2 h-4 w-4"/>Entrenador</TabsTrigger>
          </TabsList>
          <TabsContent value="player">
            <div className="p-6">
                <RoleSpecificForm role="player" />
            </div>
          </TabsContent>
          <TabsContent value="coach">
             <div className="p-6">
                <RoleSpecificForm role="coach" />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
