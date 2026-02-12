import Image from "next/image";
import Link from "next/link";
import { RegisterForm } from "@/components/register-form";


export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-12 px-4">
       <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="flex flex-col items-center gap-2">
            <Image
              src="/landing-hero.jpeg"
              alt="Logo de Chaas"
              width={192}
              height={192}
              className="mb-4 h-48 w-48"
              priority
            />
        </Link>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Crea tu Cuenta
        </h1>
        <p className="mt-2 text-muted-foreground">
          Regístrate gratis y comienza con tu análisis hoy.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
