"use client"

import { useFormState, useFormStatus } from "react-dom";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
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
import { Upload, Loader2 } from "lucide-react";

const analysisFormSchema = z.object({
  shotType: z.enum(['Tiro Libre', 'Tiro de Media Distancia (Jump Shot)', 'Tiro de Tres']),
  videoFile: z.any().optional(),
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
  const [state, formAction] = useFormState(startAnalysis, { message: "" });
  
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
              Proporciona detalles sobre la grabación del tiro.
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

            <FormItem>
                <FormLabel>Subir Video</FormLabel>
                <FormControl>
                    <div className="relative">
                        <Upload className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input type="file" className="pl-10" name="videoFile" />
                    </div>
                </FormControl>
                <FormMessage />
            </FormItem>

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
