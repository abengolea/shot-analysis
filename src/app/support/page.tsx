"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";

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
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Soporte</h1>

      <form onSubmit={onCreate} className="border rounded p-4 mb-6 space-y-3">
        <h2 className="text-lg font-medium">Nuevo ticket</h2>
        <div>
          <label className="block text-sm mb-1">Asunto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Breve título" maxLength={120} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded px-3 py-2">
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Prioridad</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={4} placeholder="Contanos el problema o solicitud"></textarea>
        </div>
        <div>
          <button disabled={creating} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{creating ? 'Creando...' : 'Crear ticket'}</button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium">Mis tickets</h2>
        <button onClick={loadTickets} className="text-sm text-blue-600">Actualizar</button>
      </div>
      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="border rounded divide-y">
        {tickets.length === 0 && !loading && (
          <div className="p-4 text-gray-500">No tenés tickets abiertos.</div>
        )}
        {tickets.map(t => (
          <Link key={t.id} href={`/support/${t.id}`} className="block p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t.subject}</div>
              <div className="text-xs uppercase text-gray-500">{t.status}</div>
            </div>
            <div className="text-sm text-gray-600">{t.category} · prioridad {t.priority}</div>
            <div className="text-xs text-gray-400">Actualizado: {new Date(t.updatedAt).toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}


