import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto w-full max-w-md">
         <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/landing-hero.jpeg"
              alt="Logo de Chaas"
              width={192}
              height={192}
              className="mb-4 h-48 w-48"
              priority
            />
            <h1 className="font-headline text-3xl font-bold tracking-tight">
              Iniciar Sesión
            </h1>
            <p className="mt-2 text-muted-foreground">
              Selecciona tu rol e ingresa tus credenciales.
            </p>
         </div>
        <Suspense
          fallback={
            <div className="p-6 text-center text-sm text-muted-foreground">
              Cargando...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
              Regístrate
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Acceso admin:{' '}
          <Link href="/admin" className="underline hover:text-primary">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
