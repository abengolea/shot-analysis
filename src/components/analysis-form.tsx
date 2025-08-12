"use client";

import { useFormState, useFormStatus } from "react-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { startAnalysis } from "@/app/actions";
import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, Loader2 } from "lucide-react";

const analysisFormSchema = z.object({
  playerId: z.string().min(1, "Please select a player."),
  ageGroup: z.enum(['U10', 'U13', 'U15', 'U18', 'Amateur', 'SemiPro', 'Pro']),
  playerLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  shotType: z.enum(['Free Throw', 'Mid-Range', 'Three-Pointer', 'Layup']),
  videoFile: z.any().optional(), // In a real app, you'd have more robust file validation
});

type AnalysisFormValues = z.infer<typeof analysisFormSchema>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        "Start Analysis"
      )}
    </Button>
  );
}

export function AnalysisForm({ players }: { players: Player[] }) {
  const [state, formAction] = useFormState(startAnalysis, { message: "" });
  
  const form = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisFormSchema),
    defaultValues: {
      playerId: "",
      ageGroup: "U15",
      playerLevel: "Intermediate",
      shotType: "Mid-Range",
    },
  });

  return (
    <Form {...form}>
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Shot Details</CardTitle>
            <CardDescription>
              Select the player and provide details about the shot recording.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <FormField
              control={form.control}
              name="playerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    name={field.name}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a player" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="ageGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age Group</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['U10', 'U13', 'U15', 'U18', 'Amateur', 'SemiPro', 'Pro'].map((group) => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="playerLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player Level</FormLabel>
                     <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
             <FormField
                control={form.control}
                name="shotType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shot Type</FormLabel>
                     <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['Free Throw', 'Mid-Range', 'Three-Pointer', 'Layup'].map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormItem>
                <FormLabel>Video Upload</FormLabel>
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
  );
}
