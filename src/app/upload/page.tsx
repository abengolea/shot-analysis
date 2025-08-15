"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { startAnalysis } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analizando...
        </>
      ) : (
        "Iniciar Análisis"
      )}
    </Button>
  );
}

export default function UploadPage() {
  const [state, formAction] = useActionState(startAnalysis, { message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
      if (state?.message && !state.errors) {
          toast({
              title: "Error de Análisis",
              description: state.message,
              variant: "destructive",
          })
      }
  }, [state, toast]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Analizar Nuevo Lanzamiento
        </h1>
        <p className="mt-2 text-muted-foreground">
          Completa los detalles a continuación para obtener un análisis de lanzamiento de un jugador con IA.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Lanzamiento</CardTitle>
            <CardDescription>
              Para un análisis más preciso, graba un video continuo de 20 segundos con múltiples lanzamientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="space-y-2">
                <Label htmlFor="shotType">Tipo de Lanzamiento</Label>
                <Select name="shotType" defaultValue="Tiro Libre">
                    <SelectTrigger id="shotType">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {['Tiro Libre', 'Lanzamiento de Media Distancia (Jump Shot)', 'Lanzamiento de Tres'].map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="video">Video del Lanzamiento</Label>
                <div className="relative">
                    <Video className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="video" type="file" className="pl-10" name="video" accept="video/*" />
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch">
            <SubmitButton />
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
