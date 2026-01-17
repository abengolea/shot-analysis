"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, updateDoc, where, doc } from "firebase/firestore";
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
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [ticketsUnread, setTicketsUnread] = useState<number>(0);
  const unread = messages.filter(m => !m.read);
  const totalUnread = (unread?.length || 0) + (ticketsUnread || 0);
  const isAdmin = (userProfile as any)?.role === 'admin';
  // Determinar si está en vista de entrenador o jugador
  const isCoachView = pathname === '/coach' || pathname?.startsWith('/coach/');

  useEffect(() => {
    if (!user || isAdmin) return; // Admin no ve mensajes directos
    try {
      // Los jugadores solo deben ver mensajes donde toId == user.uid
      // Los entrenadores pueden ver mensajes con toId y toCoachDocId
      const q1 = query(
        collection(db as any, 'messages'),
        where('toId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubs: Array<() => void> = [];
      const apply = (snap: any) => {
        setMessages(prev => {
          const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
          console.log('Mensajes recibidos:', incoming.length, incoming.map(m => ({ id: m.id, read: m.read, text: m.text?.substring(0, 50) })));
          const merged = [...incoming, ...prev].reduce((acc: Record<string, Message>, m: Message) => { acc[m.id] = m; return acc; }, {} as any);
          const sorted = Object.values(merged).sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
          console.log('Mensajes totales después de merge:', sorted.length, sorted.map(m => ({ id: m.id, read: m.read, text: m.text?.substring(0, 50) })));
          return sorted;
        });
      };
      unsubs.push(onSnapshot(q1, apply, (error) => {
        console.error('Error en listener de mensajes (q1):', error);
        // No hacer nada más, el listener se cerrará automáticamente
      }));
      
      // Solo agregar consulta de toCoachDocId si está en vista de entrenador
      if (isCoachView) {
        const q2 = query(
          collection(db as any, 'messages'),
          where('toCoachDocId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        unsubs.push(onSnapshot(q2, apply, (error) => {
          console.error('Error en listener de mensajes (q2):', error);
          // No hacer nada más, el listener se cerrará automáticamente
        }));
      }
      
      return () => { unsubs.forEach(u => u()); };
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    }
  }, [user, isAdmin, isCoachView]);

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
        
        // Actualizar inmediatamente el estado local
        setMessages(prev => prev.map(m => 
          !m.read ? { ...m, read: true, readAt: new Date().toISOString() } : m
        ));
        
        // Actualizar en la base de datos
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

  const markMessageAsRead = async (messageId: string) => {
    try {
      if (!isAdmin) {
        console.log('Marcando mensaje como leído:', messageId);
        const ref = doc(db as any, 'messages', messageId);
        await updateDoc(ref, { read: true, readAt: new Date().toISOString() });
        console.log('Mensaje marcado como leído exitosamente');
        
        // Actualizar inmediatamente el estado local para reflejar el cambio
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, read: true, readAt: new Date().toISOString() } : m
        ));
      }
    } catch (e) {
      console.error('Error marcando mensaje como leído:', e);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Bell className="h-5 w-5" />
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
        {!isAdmin && messages.filter(m => !m.read).length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">Sin mensajes nuevos</div>
        )}
        {!isAdmin && messages.filter(m => !m.read).slice(0, 10).map((m) => (
          <DropdownMenuItem key={m.id} className="flex flex-col items-start gap-1 py-3" onClick={() => { 
            console.log('Click en mensaje:', m.id, 'leído:', m.read);
            console.log('Mensaje no leído, marcando como leído...');
            markMessageAsRead(m.id);
            try { router.push(isCoachView ? '/coach/dashboard' : '/player/messages'); } catch {} 
          }}>
            <div className="text-xs text-muted-foreground">{new Date(m.createdAt || Date.now()).toLocaleString()}</div>
            <div className="text-sm">{m.text}</div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

