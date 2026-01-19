"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Message } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function PlayerMessagesPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [replyFor, setReplyFor] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"messages" | "launches">("messages");

  const toDate = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value?._seconds === "number") {
      return new Date(value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1e6));
    }
    return null;
  };
  const getTime = (value: any) => toDate(value)?.getTime() ?? 0;
  const formatDate = (value: any) => {
    const d = toDate(value);
    return d ? d.toLocaleString() : "Fecha desconocida";
  };

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(
        collection(db as any, "messages"),
        where("toId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(q, (snap) => {
        const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
        const merged = [...incoming].reduce((acc: Record<string, Message>, m: Message) => {
          acc[m.id] = m;
          return acc;
        }, {} as Record<string, Message>);
        setMessages(Object.values(merged).sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt)));
      });
      return () => unsub();
    } catch (e) {
      console.error("Error cargando mensajes del jugador:", e);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const resolveNames = async () => {
      const targets = messages
        .filter((m) => m.fromId && !resolvedNames[m.fromId] && (!m.fromName || m.fromName === "Entrenador"))
        .map((m) => m.fromId);
      const unique = Array.from(new Set(targets));
      if (unique.length === 0) return;
      try {
        const updates: Record<string, string> = {};
        await Promise.all(unique.map(async (id) => {
          try {
            const snap = await getDoc(doc(db as any, "coaches", id));
            if (snap.exists()) {
              const data = snap.data() as any;
              if (data?.name) updates[id] = data.name;
            }
          } catch {}
        }));
        if (!cancelled && Object.keys(updates).length > 0) {
          setResolvedNames((prev) => ({ ...prev, ...updates }));
        }
      } catch {}
    };
    resolveNames();
    return () => { cancelled = true; };
  }, [messages, resolvedNames]);

  const visibleMessages = useMemo(
    () => (unreadOnly ? messages.filter((m) => !m.read) : messages),
    [messages, unreadOnly]
  );
  const tabMessages = useMemo(() => {
    if (activeTab === "launches") {
      return visibleMessages.filter((m) => !!m.analysisId);
    }
    return visibleMessages;
  }, [activeTab, visibleMessages]);

  const markAsRead = async (m: Message) => {
    try {
      if (!m.read) {
        await updateDoc(doc(db as any, "messages", m.id), { read: true, readAt: new Date().toISOString() });
      }
    } catch (e) {
      console.error("No se pudo marcar como leído:", e);
    }
  };

  const sendReply = async () => {
    if (!user || !replyFor || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const colRef = collection(db as any, "messages");
      const payload = {
        fromId: user.uid,
        fromName: (userProfile as any)?.name || user.displayName || "Jugador",
        fromAvatarUrl: (userProfile as any)?.avatarUrl || "",
        toId: replyFor.fromId,
        toCoachDocId: replyFor.fromId,
        toName: replyFor.fromName || replyFor.fromId,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      } as any;
      await addDoc(colRef, payload);
      setReplyText("");
      setReplyFor(null);
      toast({ title: "Mensaje enviado", description: "Tu respuesta fue enviada al entrenador." });
    } catch (e) {
      console.error("Error enviando respuesta:", e);
      toast({ title: "Error", description: "No se pudo enviar tu mensaje.", variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mensajes con entrenadores</h1>
          <p className="text-muted-foreground">Revisá las respuestas y continuá la conversación.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/coaches">Buscar entrenadores</Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Solo no leídos
        </label>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "messages" | "launches")}>
        <TabsList className="w-full flex gap-2 overflow-x-auto flex-nowrap">
          <TabsTrigger value="messages" className="whitespace-nowrap flex-shrink-0">
            Mensajes
          </TabsTrigger>
          <TabsTrigger value="launches" className="whitespace-nowrap flex-shrink-0">
            Lanzamientos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="mt-4">
          <div className="grid gap-4">
            {tabMessages.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">No hay mensajes todavía.</div>
            )}
            {tabMessages.map((m) => (
              <Card key={m.id} className="hover:shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {`Chat con ${resolvedNames[m.fromId] || m.fromName || m.fromId}`}
                    {!m.read && <Badge variant="secondary" className="ml-2">Nuevo</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {m.analysisId && (
                      <Link
                        className="text-xs text-primary"
                        href={`/analysis/${m.analysisId}#messages`}
                      >
                        Ir al lanzamiento
                      </Link>
                    )}
                    {!m.read && (
                      <button className="text-xs text-primary" onClick={() => markAsRead(m)}>Marcar leído</button>
                    )}
                    <Dialog open={replyFor?.id === m.id} onOpenChange={(open) => { setReplyFor(open ? m : null); if (!open) setReplyText(""); }}>
                      <DialogTrigger asChild>
                        <button className="text-xs text-primary">Responder</button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Responder a {m.fromName || m.fromId}</DialogTitle>
                          <DialogDescription>Escribí tu mensaje y se enviará al entrenador.</DialogDescription>
                        </DialogHeader>
                        <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} />
                        <DialogFooter>
                          <Button onClick={sendReply} disabled={sendingReply || !replyText.trim()}>
                            {sendingReply ? "Enviando…" : "Enviar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-1">
                    {formatDate(m.createdAt)}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="launches" className="mt-4">
          <div className="grid gap-4">
            {tabMessages.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">No hay mensajes de lanzamientos todavía.</div>
            )}
            {tabMessages.map((m) => (
              <Card key={m.id} className="hover:shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {`Chat con ${resolvedNames[m.fromId] || m.fromName || m.fromId}`}
                    {!m.read && <Badge variant="secondary" className="ml-2">Nuevo</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {m.analysisId && (
                      <Link
                        className="text-xs text-primary"
                        href={`/analysis/${m.analysisId}#messages`}
                      >
                        Ir al lanzamiento
                      </Link>
                    )}
                    {!m.read && (
                      <button className="text-xs text-primary" onClick={() => markAsRead(m)}>Marcar leído</button>
                    )}
                    <Dialog open={replyFor?.id === m.id} onOpenChange={(open) => { setReplyFor(open ? m : null); if (!open) setReplyText(""); }}>
                      <DialogTrigger asChild>
                        <button className="text-xs text-primary">Responder</button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Responder a {m.fromName || m.fromId}</DialogTitle>
                          <DialogDescription>Escribí tu mensaje y se enviará al entrenador.</DialogDescription>
                        </DialogHeader>
                        <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} />
                        <DialogFooter>
                          <Button onClick={sendReply} disabled={sendingReply || !replyText.trim()}>
                            {sendingReply ? "Enviando…" : "Enviar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-1">
                    {formatDate(m.createdAt)}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
