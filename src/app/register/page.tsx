import Link from "next/link";
import { RegisterForm } from "@/components/register-form";
import { Logo } from "@/components/logo";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-12">
       <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="flex flex-col items-center gap-2">
            <Logo size="lg" className="mb-4" />
        </Link>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Crea tu Cuenta
        </h1>
        <p className="mt-2 text-muted-foreground">
          Regístrate gratis y comienza con tu análisis hoy.
        </p>
      </div>
      <RegisterForm />
      
      {/* Enlaces legales */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center w-full">
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
  );
}
