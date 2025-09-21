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

export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [replyFor, setReplyFor] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    try {
      const q1 = query(collection(db as any, 'messages'), where('toId', '==', user.uid), orderBy('createdAt', 'desc'));
      const q2 = query(collection(db as any, 'messages'), where('toCoachDocId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubs: Array<() => void> = [];
      const apply = (snap: any) => {
        setMessages(prev => {
          const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
          const merged = [...incoming, ...prev].reduce((acc: Record<string, Message>, m: Message) => { acc[m.id] = m; return acc; }, {} as any);
          return Object.values(merged).sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        });
      };
      unsubs.push(onSnapshot(q1, apply));
      unsubs.push(onSnapshot(q2, apply));
      return () => { unsubs.forEach(u => u()); };
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    }
  }, [user]);

  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const visibleMessages = useMemo(() => unreadOnly ? messages.filter(m => !m.read) : messages, [messages, unreadOnly]);

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
          <label className="flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              checked={unreadOnly} 
              onChange={(e) => setUnreadOnly(e.target.checked)} 
              className="rounded"
            />
            Solo no leídos
          </label>
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
                  <AvatarImage src={m.fromAvatarUrl} alt={m.fromName || m.fromId} />
                  <AvatarFallback>
                    {(m.fromName || m.fromId || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">
                    {m.fromName || m.fromId}
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
                <Dialog open={replyFor?.id === m.id} onOpenChange={(open) => { setReplyFor(open ? m : null); if (!open) setReplyText(""); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="default">
                      Responder
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Responder a {m.fromName || m.fromId}</DialogTitle>
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
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
