"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerAdrian } from "@/app/actions";

export function TempRegisterButton() {
    const [state, formAction] = useActionState(registerAdrian, { success: false, message: "" });

    return (
        <form action={formAction} className="my-4 w-full">
            <Button type="submit" variant="secondary" className="w-full">
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
