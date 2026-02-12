"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  updatedAt: string;
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("soporte");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");

  const categories = useMemo(() => [
    { value: "soporte", label: "Soporte técnico" },
    { value: "facturacion", label: "Facturación" },
    { value: "cuenta", label: "Cuenta/Acceso" },
    { value: "bug", label: "Reporte de bug" },
    { value: "feedback", label: "Sugerencia/Feedback" },
    { value: "otro", label: "Otro" },
  ], []);

  const statusLabel = useMemo(() => ({
    open: 'Abierto',
    in_progress: 'En progreso',
    waiting_user: 'Esperando usuario',
    resolved: 'Resuelto',
    closed: 'Cerrado',
  } as Record<string, string>), []);
  const priorityLabel = useMemo(() => ({
    low: 'Baja',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  } as Record<string, string>), []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) throw new Error("No autenticado");
      const token = await getIdToken(cu, true);
      const url = new URL('/api/tickets', window.location.origin);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setTickets(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || 'Error cargando tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    try {
      setCreating(true);
      const auth = getAuth();
      const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, category, description, priority }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSubject(""); setDescription(""); setCategory("soporte"); setPriority("normal");
      await loadTickets();
      alert('Ticket creado');
    } catch (e: any) {
      alert(e?.message || 'Error creando ticket');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 min-w-0 overflow-x-hidden">
      <h1 className="text-2xl font-semibold mb-4">Soporte</h1>

      <form onSubmit={onCreate} className="border rounded p-4 mb-6 space-y-3">
        <h2 className="text-lg font-medium">Nuevo ticket</h2>
        <div>
          <Label className="mb-1 block">Asunto</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Breve título" maxLength={120} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block">Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Prioridad</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="mb-1 block">Descripción</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Contanos el problema o solicitud" />
        </div>
        <div>
          <Button disabled={creating} type="submit">{creating ? 'Creando...' : 'Crear ticket'}</Button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium">Mis tickets</h2>
        <Button onClick={loadTickets} variant="ghost" className="h-8 px-2 text-blue-600">Actualizar</Button>
      </div>
      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="border rounded divide-y text-sm">
        {tickets.length === 0 && !loading && (
          <div className="p-4 text-gray-500">No tenés tickets abiertos.</div>
        )}
        {tickets.map(t => (
          <Link key={t.id} href={`/support/${t.id}`} className="block p-4 hover:bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="font-medium break-words">{t.subject}</div>
              <div className="text-xs uppercase text-gray-500">{statusLabel[t.status] || t.status}</div>
            </div>
            <div className="text-sm text-gray-600">{t.category} · prioridad {priorityLabel[t.priority] || t.priority}</div>
            <div className="text-xs text-gray-400">Actualizado: {new Date(t.updatedAt).toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}


