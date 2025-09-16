"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuth, getIdToken } from "firebase/auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Ticket = any;
type Message = { id: string; senderId: string; senderRole: 'user' | 'admin'; text: string; createdAt: string };

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ticketId = String(id || "");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string>("in_progress");
  const [priority, setPriority] = useState<string>("normal");
  const [assignee, setAssignee] = useState<string>("");
  const statuses = useMemo(() => ['open','in_progress','waiting_user','resolved','closed'], []);
  const priorities = useMemo(() => ['low','normal','high','urgent'], []);
  const statusLabel = { open: 'Abierto', in_progress: 'En progreso', waiting_user: 'Esperando usuario', resolved: 'Resuelto', closed: 'Cerrado' } as Record<string,string>;
  const priorityLabel = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } as Record<string,string>;

  const load = async () => {
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const [resT, resM] = await Promise.all([
        fetch(`/api/tickets/${encodeURIComponent(ticketId)}`),
        fetch(`/api/tickets/${encodeURIComponent(ticketId)}/messages?limit=200`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dt = await resT.json();
      const dm = await resM.json();
      if (!resT.ok) throw new Error(dt?.error || `HTTP ${resT.status}`);
      if (!resM.ok) throw new Error(dm?.error || `HTTP ${resM.status}`);
      setTicket(dt);
      setStatus(dt?.status || 'in_progress');
      setPriority(dt?.priority || 'normal');
      setAssignee(dt?.adminAssigneeId || '');
      setMessages(Array.isArray(dm.items) ? dm.items.reverse() : []);
    } catch (e: any) {
      alert(e?.message || 'Error cargando ticket');
      router.push('/admin/tickets');
    }
  };

  useEffect(() => { if (ticketId) load(); /* eslint-disable react-hooks/exhaustive-deps */ }, [ticketId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setText("");
      await load();
    } catch (e: any) { alert(e?.message || 'Error'); }
  };

  const saveMeta = async () => {
    try {
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status, priority, adminAssigneeId: assignee || null }) });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load();
      alert('Actualizado');
    } catch (e: any) { alert(e?.message || 'Error'); }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <Button variant="ghost" className="h-8 px-2 text-blue-600 mb-2" onClick={() => router.push('/admin/tickets')}>← Volver</Button>
      <h1 className="text-2xl font-semibold mb-1">{ticket?.subject || 'Ticket'}</h1>
      <div className="flex items-center gap-2 mb-4">
        {ticket?.status ? <Badge variant={ticket.status === 'open' ? 'destructive' : (ticket.status === 'in_progress' ? 'default' : 'secondary')}>{statusLabel[ticket.status] || ticket.status}</Badge> : null}
        {ticket?.priority ? <Badge variant={(ticket.priority === 'high' || ticket.priority === 'urgent') ? 'destructive' : (ticket.priority === 'normal' ? 'default' : 'secondary')}>{priorityLabel[ticket.priority] || ticket.priority}</Badge> : null}
        <span className="text-xs text-gray-500">{ticket?.userEmail || 'Usuario'} · {ticket?.category}</span>
      </div>

      <div className="border rounded p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="mb-1 block">Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">Prioridad</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
            <SelectContent>
              {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">Asignado a (uid)</Label>
          <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="uid de admin" />
        </div>
        <div className="flex items-end">
          <Button onClick={saveMeta}>Guardar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3 h-[60vh] overflow-y-auto bg-white">
          {messages.map(m => (
            <div key={m.id} className={`mb-3 ${m.senderRole === 'admin' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block px-3 py-2 rounded ${m.senderRole === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex flex-col gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Responder al usuario" />
          <div>
            <Button type="submit">Enviar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}


