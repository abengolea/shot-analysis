"use client"

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startAnalysis } from "@/app/actions";
import { Upload, Loader2, Video } from "lucide-react";

const analysisFormSchema = z.object({
  shotType: z.enum(['Tiro Libre', 'Tiro de Media Distancia (Jump Shot)', 'Tiro de Tres']),
  videoFront: z.any().optional(),
  videoBack: z.any().optional(),
  videoSideLeft: z.any().optional(),
  videoSideRight: z.any().optional(),
});

type AnalysisFormValues = z.infer<typeof analysisFormSchema>;


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

export function AnalysisForm() {
  const [state, formAction] = useActionState(startAnalysis, { message: "" });
  
  const form = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisFormSchema),
    defaultValues: {
      shotType: "Tiro de Media Distancia (Jump Shot)",
    },
    shouldFocusError: true,
  });

  return (
    <Form {...form}>
      <form action={formAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Tiro</CardTitle>
            <CardDescription>
              Proporciona detalles sobre el tipo de tiro y sube los videos desde todos los ángulos requeridos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
             <FormField
                control={form.control}
                name="shotType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Tiro</FormLabel>
                     <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['Tiro Libre', 'Tiro de Media Distancia (Jump Shot)', 'Tiro de Tres'].map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormItem>
                    <FormLabel>Video Frontal</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Video className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input type="file" className="pl-10" name="videoFront" accept="video/*" />
                        </div>
                    </FormControl>
                    <FormDescription>Máximo 20 segundos.</FormDescription>
                    <FormMessage />
                </FormItem>

                <FormItem>
                    <FormLabel>Video Trasero</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Video className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input type="file" className="pl-10" name="videoBack" accept="video/*" />
                        </div>
                    </FormControl>
                    <FormDescription>Máximo 20 segundos.</FormDescription>
                    <FormMessage />
                </FormItem>

                <FormItem>
                    <FormLabel>Video Lateral (Izquierdo)</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Video className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input type="file" className="pl-10" name="videoSideLeft" accept="video/*" />
                        </div>
                    </FormControl>
                     <FormDescription>Máximo 20 segundos.</FormDescription>
                    <FormMessage />
                </FormItem>

                <FormItem>
                    <FormLabel>Video Lateral (Derecho)</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Video className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input type="file" className="pl-10" name="videoSideRight" accept="video/*" />
                        </div>
                    </FormControl>
                     <FormDescription>Máximo 20 segundos.</FormDescription>
                    <FormMessage />
                </FormItem>
            </div>


          </CardContent>
          <CardFooter className="flex flex-col items-stretch">
            <SubmitButton />
             {state?.message && !state.errors && (
                <p className="mt-2 text-sm text-destructive">{state.message}</p>
            )}
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
