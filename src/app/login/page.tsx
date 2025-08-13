import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Shield } from "lucide-react";
import { BasketballIcon } from "@/components/icons";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BasketballIcon className="h-8 w-8" />
            </div>
            <CardTitle className="font-headline text-3xl">Iniciar Sesión</CardTitle>
            <CardDescription>
              Selecciona tu rol para continuar a ShotVision AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button asChild size="lg">
              <Link href="/dashboard">
                <User className="mr-2" />
                Ingresar como Jugador
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
               <Link href="/coach/dashboard">
                <Shield className="mr-2" />
                Ingresar como Entrenador
              </Link>
            </Button>
             <p className="text-center text-sm text-muted-foreground pt-4">
                ¿No tienes una cuenta?{' '}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                    Regístrate
                </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
