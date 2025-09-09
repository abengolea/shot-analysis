"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Eye, EyeOff, Plus } from "lucide-react";
import { PlayerComment } from "@/lib/types";

interface PlayerCommentsSectionProps {
  comments: PlayerComment[];
  playerId: string;
  coachId?: string;
  coachName?: string;
  onCommentAdded?: (comment: PlayerComment) => void;
}

export function PlayerCommentsSection({ 
  comments, 
  playerId, 
  coachId, 
  coachName, 
  onCommentAdded 
}: PlayerCommentsSectionProps) {
  const { toast } = useToast();
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !coachId || !coachName) return;

    setIsSubmitting(true);
    try {
      // Aquí deberías implementar la lógica para guardar el comentario
      // Por ahora solo simulamos el envío
      await new Promise(resolve => setTimeout(resolve, 1000));

      const comment: PlayerComment = {
        id: `comment-${Date.now()}`,
        playerId,
        coachId,
        coachName,
        comment: newComment.trim(),
        createdAt: new Date(),
        isPublic
      };

      onCommentAdded?.(comment);
      
      toast({
        title: "Comentario Agregado",
        description: "Tu comentario ha sido guardado exitosamente.",
      });

      // Limpiar formulario
      setNewComment("");
      setIsPublic(true);
      setIsAddingComment(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el comentario. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const publicComments = comments.filter(c => c.isPublic);
  const privateComments = comments.filter(c => !c.isPublic);

  return (
    <div className="space-y-6">
      {/* Comentarios Públicos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentarios de Entrenadores
          </h3>
          {coachId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingComment(!isAddingComment)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Comentario
            </Button>
          )}
        </div>

        {/* Formulario para Agregar Comentario */}
        {isAddingComment && coachId && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Nuevo Comentario</CardTitle>
              <CardDescription>
                Comparte tus observaciones sobre el jugador. Los comentarios públicos serán visibles para otros entrenadores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitComment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="comment">Comentario</Label>
                  <Textarea
                    id="comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escribe tu comentario sobre el jugador..."
                    rows={4}
                    required
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                  />
                  <Label htmlFor="isPublic" className="text-sm">
                    Hacer público este comentario
                  </Label>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Guardar Comentario
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingComment(false);
                      setNewComment("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de Comentarios Públicos */}
        {publicComments.length > 0 ? (
          <div className="space-y-4">
            {publicComments.map((comment) => (
              <Card key={comment.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={comment.coachAvatarUrl} alt={comment.coachName} />
                      <AvatarFallback className="text-sm">
                        {getInitials(comment.coachName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{comment.coachName}</span>
                        <Badge variant="secondary" className="text-xs">
                          <Eye className="mr-1 h-3 w-3" />
                          Público
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.comment}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay comentarios públicos aún.</p>
            <p className="text-sm">Sé el primero en compartir tus observaciones.</p>
          </div>
        )}
      </div>

      {/* Comentarios Privados (solo para el entrenador actual) */}
      {coachId && privateComments.filter(c => c.coachId === coachId).length > 0 && (
        <div>
          <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
            <EyeOff className="h-4 w-4" />
            Mis Comentarios Privados
          </h4>
          <div className="space-y-4">
            {privateComments
              .filter(c => c.coachId === coachId)
              .map((comment) => (
                <Card key={comment.id} className="hover:shadow-sm transition-shadow border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.coachAvatarUrl} alt={comment.coachName} />
                        <AvatarFallback className="text-sm">
                          {getInitials(comment.coachName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Tú</span>
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="mr-1 h-3 w-3" />
                            Privado
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.comment}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

