"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send } from "lucide-react";
import type { Message } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);
  const [replyFor, setReplyFor] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    try {
      // Los jugadores solo deben ver mensajes donde toId == user.uid
      // No deben ver mensajes con toCoachDocId (esos son solo para entrenadores)
      const q1 = query(collection(db as any, 'messages'), where('toId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubs: Array<() => void> = [];
      const apply = (snap: any) => {
        setMessages(prev => {
          const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
          const merged = [...incoming, ...prev].reduce((acc: Record<string, Message>, m: Message) => { acc[m.id] = m; return acc; }, {} as any);
          return Object.values(merged).sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        });
      };
      unsubs.push(onSnapshot(q1, apply, (error) => {
        console.error('Error en listener de mensajes player:', error);
      }));
      return () => { unsubs.forEach(u => u()); };
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    }
  }, [user]);

  // Cargar análisis del jugador para poder encontrar el análisis relacionado con mensajes de revisión
  useEffect(() => {
    if (!user?.uid) return;
    const fetchAnalyses = async () => {
      try {
        const response = await fetch(`/api/analyses?userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          const arr = Array.isArray(data.analyses) ? data.analyses : [];
          setAnalyses(arr);
        }
      } catch (error) {
        console.error('Error fetching analyses:', error);
      }
    };
    fetchAnalyses();
  }, [user?.uid]);

  // Cargar mensajes ocultos desde localStorage al iniciar
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const stored = window.localStorage.getItem('playerHiddenMessageIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validIds = parsed.filter((id) => typeof id === 'string');
          if (validIds.length > 0) {
            setHiddenMessageIds(validIds);
          }
        }
      }
    } catch (e) {
      console.warn('No se pudieron recuperar mensajes ocultos:', e);
    }
  }, []);

  // Guardar mensajes ocultos en localStorage cuando cambien
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (hiddenMessageIds.length > 0) {
        window.localStorage.setItem('playerHiddenMessageIds', JSON.stringify(hiddenMessageIds));
      } else {
        // Si no hay mensajes ocultos, limpiar el localStorage para mantenerlo limpio
        window.localStorage.removeItem('playerHiddenMessageIds');
      }
    } catch (e) {
      console.warn('No se pudieron guardar mensajes ocultos:', e);
    }
  }, [hiddenMessageIds]);

  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const visibleMessages = useMemo(() => {
    // Filtrar mensajes que están dirigidos al entrenador (tienen toCoachDocId o texto del coach)
    const isCoachMessage = (m: Message) => {
      const hasToCoachDocId = (m as any).toCoachDocId && (m as any).toCoachDocId !== user?.uid;
      const isCoachText = m.text?.includes('ya abonó la revisión manual') && m.text?.includes('Podés ingresar y dejar tu devolución');
      return hasToCoachDocId || isCoachText;
    };
    
    let filtered = messages.filter(m => !isCoachMessage(m));
    filtered = unreadOnly ? filtered.filter(m => !m.read) : filtered;
    if (hiddenMessageIds.length === 0) return filtered;
    const hiddenSet = new Set(hiddenMessageIds);
    return filtered.filter((m) => !hiddenSet.has(m.id));
  }, [messages, unreadOnly, hiddenMessageIds, user?.uid]);

  // Función helper para normalizar el nombre del remitente de mensajes del sistema
  const getDisplayName = (message: Message) => {
    const fromName = message.fromName || message.fromId;
    if (message.fromId === 'system' || fromName === 'Shot Analysis' || fromName === 'msjs del sistema' || fromName === 'Chaaaas.com') {
      return 'Chaaaas.com';
    }
    return fromName;
  };

  const hideMessage = (id: string) => {
    setHiddenMessageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const restoreHiddenMessages = () => {
    setHiddenMessageIds([]);
  };

  const markAsRead = async (m: Message) => {
    try {
      if (!m.read) {
        await updateDoc(doc(db as any, 'messages', m.id), { read: true, readAt: new Date().toISOString() });
        toast({
          title: "Mensaje marcado como leído",
          description: "El mensaje se ha marcado como leído.",
        });
      }
    } catch (e) {
      console.error('No se pudo marcar como leído:', e);
      toast({
        title: "Error",
        description: "No se pudo marcar el mensaje como leído.",
        variant: "destructive",
      });
    }
  };

  const sendReply = async () => {
    if (!user || !replyFor || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const colRef = collection(db as any, 'messages');
      const payload = {
        fromId: user.uid,
        fromName: userProfile?.name || user.displayName || 'Jugador',
        toId: replyFor.fromId,
        toName: replyFor.fromName || replyFor.fromId,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      } as any;
      await addDoc(colRef, payload);
      setReplyText("");
      setReplyFor(null);
      toast({
        title: "Respuesta enviada",
        description: "Tu mensaje se ha enviado correctamente.",
      });
    } catch (e) {
      console.error('Error enviando respuesta:', e);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
    } finally {
      setSendingReply(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Inicia sesión</h3>
          <p className="text-muted-foreground">
            Necesitas iniciar sesión para ver tus mensajes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mensajes</h1>
          <p className="text-muted-foreground">
            Conversaciones con entrenadores y otros usuarios.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {unreadCount} mensaje{unreadCount !== 1 ? 's' : ''} no leído{unreadCount !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={unreadOnly} 
                onChange={(e) => setUnreadOnly(e.target.checked)} 
                className="rounded"
              />
              Solo no leídos
            </label>
            {hiddenMessageIds.length > 0 && (
              <button
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={restoreHiddenMessages}
              >
                Mostrar ocultos ({hiddenMessageIds.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {visibleMessages.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin mensajes</h3>
              <p className="text-muted-foreground">
                {unreadOnly 
                  ? "No tienes mensajes no leídos." 
                  : "Aún no tienes mensajes. Los entrenadores te contactarán aquí."
                }
              </p>
            </CardContent>
          </Card>
        )}
        
        {visibleMessages.map((m) => (
          <Card key={m.id} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.fromAvatarUrl} alt={getDisplayName(m)} />
                  <AvatarFallback>
                    {getDisplayName(m).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">
                    {getDisplayName(m)}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(m.createdAt || Date.now()).toLocaleString()}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!m.read && <Badge variant="secondary">Nuevo</Badge>}
                {!m.read && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => markAsRead(m)}
                  >
                    Marcar leído
                  </Button>
                )}
                {!(m.fromId === 'system' || m.fromName === 'Shot Analysis' || m.fromName === 'msjs del sistema' || m.fromName === 'Chaaaas.com') && (
                  <Dialog open={replyFor?.id === m.id} onOpenChange={(open) => { setReplyFor(open ? m : null); if (!open) setReplyText(""); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="default">
                        Responder
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Responder a {getDisplayName(m)}</DialogTitle>
                        <DialogDescription>
                          Escribe tu mensaje de respuesta.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Mensaje original:</p>
                          <p className="text-sm">{m.text}</p>
                        </div>
                        <Textarea 
                          value={replyText} 
                          onChange={(e) => setReplyText(e.target.value)} 
                          placeholder="Escribe tu respuesta aquí..."
                          rows={4}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setReplyFor(null); setReplyText(""); }}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={sendReply} 
                          disabled={sendingReply || !replyText.trim()}
                        >
                          {sendingReply ? (
                            <>
                              <Send className="mr-2 h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Enviar
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <button 
                  className="text-xs text-muted-foreground hover:text-foreground" 
                  onClick={() => hideMessage(m.id)}
                >
                  Ocultar
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
              {/* Mostrar botón para ir al análisis si el mensaje tiene analysisId o es sobre revisión completada */}
              {(() => {
                // Detectar si el mensaje es sobre una revisión completada
                const isReviewComplete = m.text?.includes('fue revisado por el entrenador') || m.text?.includes('disponible la devolución');
                
                // Usar analysisId del mensaje si está disponible, sino intentar extraerlo del texto
                let analysisId = (m as any).analysisId || m.text?.match(/(analysis_[a-zA-Z0-9_-]+)/i)?.[1];
                
                // Si es mensaje de revisión completada pero no tiene analysisId, buscar el análisis más reciente con coachCompleted
                if (isReviewComplete && !analysisId && analyses.length > 0) {
                  // Buscar análisis completados por el entrenador, ordenados por fecha de completado
                  const completedAnalyses = analyses
                    .filter((a: any) => a.coachCompleted === true && a.coachCompletedAt)
                    .sort((a: any, b: any) => {
                      const dateA = new Date(a.coachCompletedAt || 0).getTime();
                      const dateB = new Date(b.coachCompletedAt || 0).getTime();
                      return dateB - dateA;
                    });
                  
                  // Si hay análisis completados, tomar el más reciente que esté cerca de la fecha del mensaje
                  if (completedAnalyses.length > 0) {
                    const messageDate = new Date(m.createdAt || 0).getTime();
                    // Buscar el análisis completado más cercano a la fecha del mensaje (dentro de 24 horas)
                    const matchingAnalysis = completedAnalyses.find((a: any) => {
                      const completedDate = new Date(a.coachCompletedAt || 0).getTime();
                      const diff = Math.abs(messageDate - completedDate);
                      return diff < 24 * 60 * 60 * 1000; // 24 horas en milisegundos
                    });
                    
                    if (matchingAnalysis) {
                      analysisId = matchingAnalysis.id;
                    } else if (completedAnalyses.length > 0) {
                      // Si no hay coincidencia exacta, usar el más reciente
                      analysisId = completedAnalyses[0].id;
                    }
                  }
                }
                
                if (analysisId) {
                  const linkHref = isReviewComplete 
                    ? `/analysis/${analysisId}#coach-checklist` 
                    : `/analysis/${analysisId}`;
                  const linkText = isReviewComplete 
                    ? 'Ver revisión del entrenador' 
                    : 'Ver análisis';
                  
                  return (
                    <div className="mt-3 pt-3 border-t">
                      <Button asChild size="sm" variant="default">
                        <Link href={linkHref}>
                          {linkText}
                        </Link>
                      </Button>
                    </div>
                  );
                }
                return null;
              })()}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
