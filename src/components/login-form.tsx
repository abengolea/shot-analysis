"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
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
import { Loader2, User, Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(1, "La contraseña es requerida."),
  role: z.enum(['player', 'coach']),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? (
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
    const { signIn, resetPassword } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [resetting, setResetting] = useState(false);
    
    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
            role: role,
        },
    });

    const onSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        try {
            const result = await signIn(data.email, data.password);
            
            if (result.success) {
                toast({
                    title: "¡Bienvenido!",
                    description: result.message,
                });
                
                // Redirigir según existencia de perfil coach
                if (role === 'coach') {
                    try {
                        const { db } = await import('@/lib/firebase');
                        const { doc, getDoc } = await import('firebase/firestore');
                        const userId = (await import('firebase/auth')).getAuth().currentUser?.uid;
                        if (userId) {
                            const snap = await getDoc(doc(db as any, 'coaches', userId));
                            if (snap.exists()) {
                                window.location.href = '/coach/dashboard';
                                return;
                            }
                        }
                    } catch {}
                    window.location.href = '/coach-register';
                } else {
                    window.location.href = '/dashboard';
                }
            } else {
                toast({
                    title: "Error de inicio de sesión",
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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                <div className="relative">
                                    <Input 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="Tu contraseña" 
                                        {...field} 
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
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex items-center justify-end -mt-2">
                    <button
                        type="button"
                        className="text-xs text-primary underline disabled:opacity-50"
                        onClick={async () => {
                            const emailValue = form.getValues("email");
                            if (!emailValue) {
                                toast({
                                    title: "Ingresa tu email",
                                    description: "Escribe tu email arriba para enviar el enlace de recuperación.",
                                    variant: "destructive",
                                });
                                return;
                            }
                            setResetting(true);
                            try {
                                const res = await resetPassword(emailValue);
                                if (res.success) {
                                    toast({ title: "Revisa tu correo", description: "Te enviamos un enlace para restablecer tu contraseña." });
                                } else {
                                    toast({ title: "No se pudo enviar", description: res.message, variant: "destructive" });
                                }
                            } finally {
                                setResetting(false);
                            }
                        }}
                        disabled={resetting}
                    >
                        {resetting ? "Enviando…" : "¿Olvidaste tu contraseña?"}
                    </button>
                </div>
                <CardFooter className="p-0 pt-2">
                    <SubmitButton loading={loading} />
                </CardFooter>
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
