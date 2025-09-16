"use client";

import { useEffect, useRef, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Message = {
  id: string;
  senderId: string;
  senderRole: 'user' | 'admin';
  text: string;
  createdAt: string;
};

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ticketId = String(params?.id || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<any>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const statusLabel = { open: 'Abierto', in_progress: 'En progreso', waiting_user: 'Esperando usuario', resolved: 'Resuelto', closed: 'Cerrado' } as Record<string,string>;
  const priorityLabel = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } as Record<string,string>;

  const scrollToEnd = () => {
    try { endRef.current?.scrollIntoView({ behavior: 'smooth' }); } catch {}
  };

  const load = async () => {
    try {
      setLoading(true);
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const [resTicket, resMsgs] = await Promise.all([
        fetch(`/api/tickets/${encodeURIComponent(ticketId)}`),
        fetch(`/api/tickets/${encodeURIComponent(ticketId)}/messages?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dataTicket = await resTicket.json();
      const dataMsgs = await resMsgs.json();
      if (!resTicket.ok) throw new Error(dataTicket?.error || `HTTP ${resTicket.status}`);
      if (!resMsgs.ok) throw new Error(dataMsgs?.error || `HTTP ${resMsgs.status}`);
      setTicket(dataTicket);
      setMessages(Array.isArray(dataMsgs.items) ? dataMsgs.items.reverse() : []);
      setTimeout(scrollToEnd, 50);
    } catch (e: any) {
      alert(e?.message || 'Error cargando ticket');
      router.push('/support');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (ticketId) load(); /* eslint-disable react-hooks/exhaustive-deps */ }, [ticketId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      setSending(true);
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setText("");
      await load();
      setTimeout(scrollToEnd, 50);
    } catch (e: any) {
      alert(e?.message || 'Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <Button variant="ghost" className="h-8 px-2 text-blue-600 mb-2" onClick={() => router.push('/support')}>← Volver</Button>
      <h1 className="text-2xl font-semibold mb-1">{ticket?.subject || 'Ticket'}</h1>
      <div className="flex items-center gap-2 mb-2">
        {ticket?.status ? <Badge variant={ticket.status === 'open' ? 'destructive' : (ticket.status === 'in_progress' ? 'default' : 'secondary')}>{statusLabel[ticket.status] || ticket.status}</Badge> : null}
        {ticket?.priority ? <Badge variant={(ticket.priority === 'high' || ticket.priority === 'urgent') ? 'destructive' : (ticket.priority === 'normal' ? 'default' : 'secondary')}>{priorityLabel[ticket.priority] || ticket.priority}</Badge> : null}
        <span className="text-xs text-gray-500">{ticket?.category}</span>
      </div>

      <div className="border rounded p-3 h-[60vh] overflow-y-auto bg-white">
        {loading && <div className="text-gray-500">Cargando...</div>}
        {!loading && messages.length === 0 && <div className="text-gray-500">Sin mensajes.</div>}
        {messages.map(m => (
          <div key={m.id} className={`mb-3 ${m.senderRole === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block px-3 py-2 rounded ${m.senderRole === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} className="flex-1" placeholder="Escribe un mensaje" />
        <Button disabled={sending} type="submit">{sending ? 'Enviando...' : 'Enviar'}</Button>
      </form>
    </div>
  );
}


