"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, updateDoc, where, doc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import type { Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { getAuth, getIdToken } from "firebase/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationsBell() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [ticketsUnread, setTicketsUnread] = useState<number>(0);
  const unread = messages.filter(m => !m.read);
  const hasUnreadSystemMessage = unread.some((m) => m.fromId === "system" || m.toId === "system");
  const totalUnread = (unread?.length || 0) + (ticketsUnread || 0);
  const isAdmin = (userProfile as any)?.role === 'admin';
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
  const messagesPath = isAdmin
    ? "/admin/tickets"
    : ((userProfile as any)?.role === "coach" ? "/coach/dashboard#messages" : "/player/messages");

  useEffect(() => {
    if (!user || isAdmin) return; // Admin no ve mensajes directos
    try {
      const q1 = query(
        collection(db as any, 'messages'),
        where('toId', '==', user.uid)
      );
      const q2 = query(
        collection(db as any, 'messages'),
        where('toCoachDocId', '==', user.uid)
      );
      const unsubs: Array<() => void> = [];
      const apply = (snap: any) => {
        setMessages(prev => {
          const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
          const merged = [...incoming, ...prev].reduce((acc: Record<string, Message>, m: Message) => { acc[m.id] = m; return acc; }, {} as any);
          return Object.values(merged).sort((a, b) => (getTime(b.createdAt) - getTime(a.createdAt)));
        });
      };
      unsubs.push(onSnapshot(q1, apply));
      unsubs.push(onSnapshot(q2, apply));
      return () => { unsubs.forEach(u => u()); };
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    }
  }, [user, isAdmin]);

  // Contador de tickets no leídos (para user o admin)
  useEffect(() => {
    let mounted = true;
    let intervalId: any;
    const run = async () => {
      try {
        const auth = getAuth();
        const cu = auth.currentUser;
        if (!cu) { if (mounted) setTicketsUnread(0); return; }
        const token = await getIdToken(cu, true);
        const res = await fetch('/api/tickets/unread-count', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (mounted) setTicketsUnread(Math.max(0, Number(data?.unread || 0)));
      } catch {
        if (mounted) setTicketsUnread(0);
      }
    };
    run();
    intervalId = setInterval(run, 30000);
    return () => { mounted = false; if (intervalId) clearInterval(intervalId); };
  }, [user]);

  const markAllAsRead = async () => {
    try {
      if (!isAdmin) {
        const toMark = messages.filter(m => !m.read);
        await Promise.all(toMark.map(async (m) => {
          const ref = doc(db as any, 'messages', m.id);
          await updateDoc(ref, { read: true, readAt: new Date().toISOString() });
        }));
      }
      // Marcar tickets como leídos en backend
      try {
        const auth = getAuth();
        const cu = auth.currentUser;
        if (cu) {
          const token = await getIdToken(cu, true);
          await fetch('/api/tickets/mark-read', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          setTicketsUnread(0);
        }
      } catch {}
    } catch (e) {
      console.error('Error marcando como leído:', e);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Bell className={`h-5 w-5 ${hasUnreadSystemMessage ? "text-red-500" : ""}`} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] h-4 min-w-4 px-1">
              {totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Novedades</span>
          {((!isAdmin && unread.length > 0) || (isAdmin && ticketsUnread > 0)) && (
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={markAllAsRead}>
              <Check className="h-3 w-3 mr-1" /> Marcar leídas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-2 text-xs text-muted-foreground">Tickets sin leer: {ticketsUnread}</div>
        {!isAdmin && messages.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">Sin mensajes</div>
        )}
        {!isAdmin && messages.slice(0, 10).map((m) => (
          <DropdownMenuItem key={m.id} className="flex flex-col items-start gap-1 py-3" onClick={() => { try { router.push(messagesPath); } catch {} }}>
            <div className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</div>
            <div className="text-sm">{m.text}</div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


