"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuth, getIdToken } from "firebase/auth";

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
      <button className="text-sm text-blue-600 mb-2" onClick={() => router.push('/admin/tickets')}>← Volver</button>
      <h1 className="text-2xl font-semibold mb-1">{ticket?.subject || 'Ticket'}</h1>
      <p className="text-sm text-gray-500 mb-4">{ticket?.userEmail || 'Usuario'} · {ticket?.category}</p>

      <div className="border rounded p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm mb-1">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded px-3 py-2">
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Prioridad</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border rounded px-3 py-2">
            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Asignado a (uid)</label>
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="uid de admin" />
        </div>
        <div className="flex items-end">
          <button onClick={saveMeta} className="bg-gray-100 border rounded px-4 py-2">Guardar</button>
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
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="border rounded px-3 py-2 min-h-[200px]" placeholder="Responder al usuario" />
          <div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Enviar</button>
          </div>
        </form>
      </div>
    </div>
  );
}


