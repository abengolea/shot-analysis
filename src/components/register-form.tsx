"use client"

import { useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Switch } from "@/components/ui/switch";

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? (
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

const registerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  role: z.literal('player'),
  publicRankingOptIn: z.boolean().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
    const { signUp } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            role: "player" as const,
            publicRankingOptIn: false,
        },
    });

    const onSubmit = async (data: RegisterFormValues) => {
        setLoading(true);
        try {
            const userData = {
                name: data.name,
                role: data.role,
                ...(data.role === 'player' ? { publicRankingOptIn: !!data.publicRankingOptIn } : {}),
            };

            const result = await signUp(data.email, data.password, userData);
            
            if (result.success) {
                toast({
                    title: "¡Cuenta creada!",
                    description: result.message,
                });
                
                // Redirigir a la página de verificación de email
                window.location.href = '/verify-email';
            } else {
                toast({
                    title: "Error de registro",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Ocurrió un error inesperado",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Crear Cuenta</CardTitle>
                <CardDescription>
                   Completa la información básica para crear tu cuenta.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo</Label>
                    <Input 
                        id="name" 
                        placeholder="Tu nombre" 
                        {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                    )}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                        id="email" 
                        type="email" 
                        placeholder="tu@email.com" 
                        {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                        <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                </div>

                 <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                        <Input 
                            id="password" 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Tu contraseña segura" 
                            {...form.register("password")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                            )}
                        </button>
                    </div>
                    {form.formState.errors.password && (
                        <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                    )}
                </div>
                {form.getValues("role") === 'player' && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Hacer públicas mis puntuaciones para el ranking</Label>
                        <p className="text-xs text-muted-foreground">Podrás cambiarlo luego en tu perfil.</p>
                      </div>
                      <Switch
                        checked={!!form.watch("publicRankingOptIn")}
                        onCheckedChange={(v) => form.setValue("publicRankingOptIn", v)}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                        💡 <strong>Nota:</strong> Solo necesitamos estos datos básicos para crear tu cuenta. 
                        Podrás completar tu perfil completo después del registro.
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch">
               <SubmitButton loading={loading} />
            </CardFooter>
        </Card>
    </form>
  )
}
