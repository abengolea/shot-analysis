"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { mockAnalyses, mockPlayers, mockComments, mockCoaches } from "@/lib/mock-data";
import { AnalysisView } from "@/components/analysis-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Send, UserCheck } from "lucide-react";
// import { moderateAndAddComment } from "@/app/actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";


function CommentForm({ analysisId }: { analysisId: string }) {
    // TODO: Implementar funcionalidad de comentarios
    // const [state, formAction] = useActionState(moderateAndAddComment, { message: "" });
    // const { pending } = useFormStatus();

    return (
        <div className="grid w-full gap-2 p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
                Funcionalidad de comentarios en desarrollo
            </p>
            <Textarea placeholder="Escribe tu mensaje aquí." name="comment" disabled />
            <Button disabled>
                <Send className="mr-2 h-4 w-4" />
                Publicar Comentario
            </Button>
        </div>
    );
}


export function AnalysisPageClient({ id }: { id: string }) {
  const analysis = mockAnalyses.find((a) => a.id === id);
  const [formattedDate, setFormattedDate] = useState("");

  useEffect(() => {
    if (analysis) {
      setFormattedDate(new Date(analysis.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'}));
    }
  }, [analysis]);

  if (!analysis) {
    notFound();
  }
  
  const player = mockPlayers.find((p) => p.id === analysis.playerId);
  
  if (!player) {
    notFound();
  }
  
  const coach = player.coachId ? mockCoaches.find(c => c.id === player.coachId) : null;
  const comments = mockComments;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/players/${player.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">{player.name}</p>
          <h1 className="font-headline text-2xl font-bold">
            Análisis de {analysis.shotType}
          </h1>
          <p className="font-semibold text-muted-foreground">
            {formattedDate || "..."}
            {coach && (
              <span className="ml-2 inline-flex items-center gap-1.5 font-normal">
                <UserCheck className="h-4 w-4" />
                Entrenador: {coach.name}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="w-full">
         <AnalysisView analysis={analysis} player={player} />
      </div>
    </div>
  );
}
