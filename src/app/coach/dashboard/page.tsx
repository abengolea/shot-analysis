"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlayerCard } from "@/components/player-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BarChart2, Video, MessageSquare } from "lucide-react";
import type { Message, Player } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, updateDoc, doc, addDoc, serverTimestamp, setDoc, getDoc, limit, getDocs } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function CoachDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([] as any);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(collection(db as any, 'players'), where('coachId', '==', user.uid));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
        setPlayers(list as any);
      });
      return () => unsub();
    } catch (e) {
      console.error('Error cargando jugadores del coach:', e);
    }
  }, [user]);

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
  const markAsRead = async (m: Message) => {
    try {
      if (!m.read) {
        await updateDoc(doc(db as any, 'messages', m.id), { read: true, readAt: new Date().toISOString() });
      }
    } catch (e) {
      console.error('No se pudo marcar como leído:', e);
    }
  };

  const [replyFor, setReplyFor] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState<boolean>(false);
  const [acceptTargetUrl, setAcceptTargetUrl] = useState<string>("");
  const [acceptPlayerLabel, setAcceptPlayerLabel] = useState<string>("");
  const [rejectFor, setRejectFor] = useState<Message | null>(null);
  const [rejectText, setRejectText] = useState<string>("");
  const [rejecting, setRejecting] = useState<boolean>(false);

  const sendReply = async () => {
    if (!user || !replyFor || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const colRef = collection(db as any, 'messages');
      const payload = {
        fromId: user.uid,
        fromName: 'Entrenador',
        toId: replyFor.fromId,
        toName: replyFor.fromName || replyFor.fromId,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      } as any;
      await addDoc(colRef, payload);
      setReplyText("");
      setReplyFor(null);
    } catch (e) {
      console.error('Error enviando respuesta:', e);
    } finally {
      setSendingReply(false);
    }
  };

  const acceptPlayer = async (m: Message) => {
    try {
      setAcceptingId(m.id);
      // Vincula al jugador con el coach: set players/{fromId}.coachId = coach uid
      const playerRef = doc(db as any, 'players', m.fromId);
      const snap = await getDoc(playerRef);
      if (!snap.exists()) {
        console.warn('No existe el doc del jugador para vincular');
        toast({ title: 'No se pudo aceptar', description: 'No encontramos el perfil del jugador.', variant: 'destructive' });
        setAcceptingId(null);
        return;
      }
      await setDoc(playerRef, { coachId: user?.uid, updatedAt: new Date() }, { merge: true });
      // Marcar el mensaje como leído
      await updateDoc(doc(db as any, 'messages', m.id), { read: true, readAt: new Date().toISOString() });
      // Buscar último análisis del jugador
      let targetUrl = `/players/${m.fromId}`;
      try {
        const qa = query(collection(db as any, 'analyses'), where('playerId', '==', m.fromId), orderBy('createdAt', 'desc'), limit(1));
        const res = await getDocs(qa);
        if (!res.empty) {
          const docId = res.docs[0].id;
          targetUrl = `/analysis/${docId}`;
        }
      } catch {}
      setAcceptTargetUrl(targetUrl);
      setAcceptPlayerLabel(m.fromName || m.fromId);
      setAcceptDialogOpen(true);
    } catch (e) {
      console.error('Error aceptando jugador:', e);
      toast({ title: 'Error', description: 'No se pudo aceptar la propuesta.', variant: 'destructive' });
    } finally {
      setAcceptingId(null);
    }
  };

  const sendReject = async () => {
    if (!user || !rejectFor || !rejectText.trim()) return;
    try {
      setRejecting(true);
      const colRef = collection(db as any, 'messages');
      const payload = {
        fromId: user.uid,
        fromName: user.displayName || 'Entrenador',
        toId: rejectFor.fromId,
        toName: rejectFor.fromName || rejectFor.fromId,
        text: rejectText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      } as any;
      await addDoc(colRef, payload);
      // Marcar el mensaje original como leído
      try { await updateDoc(doc(db as any, 'messages', rejectFor.id), { read: true, readAt: new Date().toISOString() }); } catch {}
      setRejectFor(null);
      setRejectText("");
      toast({ title: 'Rechazado', description: 'Se envió tu respuesta al jugador.' });
    } catch (e) {
      console.error('Error enviando rechazo:', e);
      toast({ title: 'Error', description: 'No se pudo enviar el rechazo.', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Panel de Entrenador
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona tus jugadores y revisa las solicitudes de conexión.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Jugadores
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{players.length}</div>
            <p className="text-xs text-muted-foreground">
              jugadores actualmente bajo tu tutela
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Análisis Realizados
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              este mes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mensajes no leídos
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">
              esperando tu respuesta
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Progreso General
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+8%</div>
            <p className="text-xs text-muted-foreground">
              mejora promedio este mes
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensajes
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="players" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mis Jugadores
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Mensajes</h2>
              <p className="text-muted-foreground">Mensajes recibidos de jugadores.</p>
            </div>
          </div>
          <div className="grid gap-4">
            {messages.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">Sin mensajes</div>
            )}
            {messages.map((m) => (
              <Card key={m.id} className="hover:shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {m.fromName || m.fromId}
                    {!m.read && <Badge variant="secondary" className="ml-2">Nuevo</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {!m.read && (
                      <button className="text-xs text-primary" onClick={() => markAsRead(m)}>Marcar leído</button>
                    )}
                    <button className="text-xs text-green-600 disabled:opacity-50" disabled={acceptingId === m.id} onClick={() => acceptPlayer(m)}>
                      {acceptingId === m.id ? 'Aceptando…' : 'Aceptar propuesta'}
                    </button>
                    <Dialog open={rejectFor?.id === m.id} onOpenChange={(open) => { if (open) { setRejectFor(m); setRejectText(`Lamentablemente no puedo ayudarte en este momento. ¡Gracias por contactarme!\n\n— ${user?.displayName || 'Entrenador'}`); } else { setRejectFor(null); setRejectText(""); } }}>
                      <DialogTrigger asChild>
                        <button className="text-xs text-red-600">Rechazar</button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rechazar solicitud de {m.fromName || m.fromId}</DialogTitle>
                          <DialogDescription>Envía un mensaje opcional para explicar el rechazo.</DialogDescription>
                        </DialogHeader>
                        <Textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} rows={4} />
                        <DialogFooter>
                          <Button onClick={sendReject} disabled={rejecting || !rejectText.trim()} variant="destructive">
                            {rejecting ? 'Enviando…' : 'Enviar rechazo'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={replyFor?.id === m.id} onOpenChange={(open) => { setReplyFor(open ? m : null); if (!open) setReplyText(""); }}>
                      <DialogTrigger asChild>
                        <button className="text-xs text-primary">Responder</button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Responder a {m.fromName || m.fromId}</DialogTitle>
                          <DialogDescription>Escribe tu respuesta y se enviará al jugador.</DialogDescription>
                        </DialogHeader>
                        <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} />
                        <DialogFooter>
                          <Button onClick={sendReply} disabled={sendingReply || !replyText.trim()}>
                            {sendingReply ? 'Enviando…' : 'Enviar'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-1">
                    {new Date(m.createdAt || Date.now()).toLocaleString()}
                  </div>
                  <div className="text-sm">{m.text}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Mis Jugadores</h2>
            <p className="text-muted-foreground">
              Selecciona un jugador para ver su perfil detallado y su historial de análisis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <PlayerCard key={player.id} player={player as any} />
            ))}
            {players.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tienes jugadores</h3>
                <p className="text-muted-foreground">
                  Aún no tienes jugadores asignados. Acepta solicitudes de conexión para comenzar.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Resumen General</h2>
            <p className="text-muted-foreground">
              Vista general de tu actividad como entrenador.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Actividad de Mensajes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total de mensajes</span>
                  <span className="font-semibold">{messages.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>No leídos</span>
                  <span className="font-semibold text-orange-600">{unreadCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Estadísticas de Jugadores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total de jugadores</span>
                  <span className="font-semibold">{players.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Análisis este mes</span>
                  <span className="font-semibold">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Progreso promedio</span>
                  <span className="font-semibold text-green-600">+8%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal centrado para éxito de aceptación */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Jugador vinculado</DialogTitle>
            <DialogDescription>
              {acceptPlayerLabel ? `Ya podés trabajar con ${acceptPlayerLabel}.` : 'Ya podés trabajar con el jugador.'}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Te llevo al último análisis del jugador (si existe); si no, a su perfil.
          </div>
          <DialogFooter>
            <Button onClick={() => { if (acceptTargetUrl) window.location.href = acceptTargetUrl; }}>Ver ahora</Button>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
