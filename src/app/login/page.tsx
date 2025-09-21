import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { BasketballIcon } from "@/components/icons";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto w-full max-w-md">
         <div className="mb-8 flex flex-col items-center text-center">
            <BasketballIcon className="mb-4 h-12 w-12 text-primary" />
            <h1 className="font-headline text-3xl font-bold tracking-tight">
              Iniciar Sesión
            </h1>
            <p className="mt-2 text-muted-foreground">
              Selecciona tu rol e ingresa tus credenciales.
            </p>
         </div>
        <LoginForm />
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
        
        {/* Enlaces legales */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <span>© 2025 Notificas SRL. Todos los derechos reservados.</span>
            <Link 
              href="/bases-y-condiciones" 
              className="text-primary hover:text-primary/80 underline"
            >
              Bases y Condiciones
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
