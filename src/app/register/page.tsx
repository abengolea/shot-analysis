import Link from "next/link";
import { RegisterForm } from "@/components/register-form";
import { BasketballIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { registerAdrian } from "@/app/actions";
import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Info } from "lucide-react";


function TempRegisterButton() {
    const [state, formAction] = useActionState(registerAdrian, { success: false, message: "" });

    return (
        <form action={formAction} className="my-4 w-full">
            <Button type="submit" variant="destructive" className="w-full">
                Registrar a Adrián Bengolea (Temporal)
            </Button>
            {state.message && (
                <Alert className="mt-4" variant={state.success ? "default" : "destructive"}>
                    {state.success ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    <AlertTitle>{state.success ? "Éxito" : "Info"}</AlertTitle>
                    <AlertDescription>
                        {state.message}
                    </AlertDescription>
                </Alert>
            )}
        </form>
    )
}

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-12">
       <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="flex flex-col items-center gap-2">
            <BasketballIcon className="mb-4 h-12 w-12 text-primary" />
        </Link>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Crea tu Cuenta
        </h1>
        <p className="mt-2 text-muted-foreground">
          Únete a ShotVision AI para empezar a mejorar tu lanzamiento hoy.
        </p>
      </div>
      <RegisterForm />
      <TempRegisterButton />
    </div>
  );
}
