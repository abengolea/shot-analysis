import { RegisterForm } from "@/components/register-form";
import { BasketballIcon } from "@/components/icons";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-12">
       <div className="mb-8 flex flex-col items-center text-center">
        <BasketballIcon className="mb-4 h-12 w-12 text-primary" />
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Crea tu Cuenta
        </h1>
        <p className="mt-2 text-muted-foreground">
          Únete a ShotVision AI para empezar a mejorar tu tiro hoy.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
