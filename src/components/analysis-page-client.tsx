"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { mockAnalyses, mockPlayers, mockComments } from "@/lib/mock-data";
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
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { moderateAndAddComment } from "@/app/actions";
import { useFormState, useFormStatus } from "react-dom";


function CommentForm({ analysisId }: { analysisId: string }) {
    const [state, formAction] = useFormState(moderateAndAddComment, { message: "" });
    const { pending } = useFormStatus();

    return (
        <form action={formAction} className="grid w-full gap-2">
            <input type="hidden" name="analysisId" value={analysisId} />
            <Textarea placeholder="Escribe tu mensaje aquí." name="comment" />
            {state?.message && <p className={`text-sm ${state.comment ? 'text-green-600' : 'text-destructive'}`}>{state.message}</p>}
            <Button type="submit" disabled={pending}>
                {pending ? (
                    <>
                        <Send className="mr-2 h-4 w-4 animate-pulse" />
                        Enviando...
                    </>
                ) : (
                    <>
                        <Send className="mr-2 h-4 w-4" />
                        Publicar Comentario
                    </>
                )}
            </Button>
        </form>
    );
}


export function AnalysisPageClient({ id }: { id: string }) {
  const analysis = mockAnalyses.find((a) => a.id === id);

  if (!analysis) {
    notFound();
  }
  const player = mockPlayers.find((p) => p.id === analysis.playerId);

  if (!player) {
    // Or handle this case gracefully
    notFound();
  }

  const comments = mockComments;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/players/${player.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-headline text-2xl font-bold">{player.name}</h1>
          <p className="text-muted-foreground">
            Análisis de {analysis.shotType} -{" "}
            {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <AnalysisView analysis={analysis} player={player} />
        </div>
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <MessageSquare className="h-6 w-6" />
                        Feedback y Comentarios
                    </CardTitle>
                    <CardDescription>
                        Conversación privada entre entrenador y jugador.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                   <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-2">
                       {comments.map(comment => (
                           <div key={comment.id} className="flex items-start gap-3">
                               <Avatar className="h-8 w-8">
                                   <AvatarFallback>{comment.author.charAt(0)}</AvatarFallback>
                               </Avatar>
                               <div className="flex-1 rounded-lg bg-muted p-3">
                                   <p className="text-sm font-semibold">{comment.author}</p>
                                   <p className="text-sm text-muted-foreground">{comment.text}</p>
                               </div>
                           </div>
                       ))}
                   </div>
                   <CommentForm analysisId={analysis.id}/>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
