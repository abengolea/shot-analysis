"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  updatedAt: string;
  userEmail?: string | null;
  adminAssigneeId?: string | null;
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const router = useRouter();
  const params = useSearchParams();

  const statuses = useMemo(() => [
    { value: "", label: "Todos" },
    { value: "open", label: "Abiertos" },
    { value: "in_progress", label: "En progreso" },
    { value: "waiting_user", label: "Esperando usuario" },
    { value: "resolved", label: "Resueltos" },
    { value: "closed", label: "Cerrados" },
  ], []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const url = new URL('/api/tickets', window.location.origin);
      url.searchParams.set('admin', '1');
      if (status) url.searchParams.set('status', status);
      if (assigneeId) url.searchParams.set('assigneeId', assigneeId);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setTickets(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || 'Error cargando tickets');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    // Prefill from query
    const qsStatus = params.get('status') || '';
    const qsAssignee = params.get('assigneeId') || '';
    const qsLimit = Number(params.get('limit') || 50);
    setStatus(qsStatus);
    setAssigneeId(qsAssignee);
    setLimit(Math.max(1, Math.min(qsLimit, 100)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); /* eslint-disable react-hooks/exhaustive-deps */ }, [status, assigneeId, limit]);

  const applyFiltersToUrl = () => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    sp.set('status', status);
    if (assigneeId) sp.set('assigneeId', assigneeId); else sp.delete('assigneeId');
    sp.set('limit', String(limit));
    router.push(url.pathname + '?' + sp.toString());
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Tickets de Soporte</h1>

      <div className="border rounded p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm mb-1">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded px-3 py-2">
            {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Asignado a (uid)</label>
          <input value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Opcional" />
        </div>
        <div>
          <label className="block text-sm mb-1">Límite</label>
          <input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full border rounded px-3 py-2" min={1} max={100} />
        </div>
        <div className="flex items-end">
          <button onClick={applyFiltersToUrl} className="bg-gray-100 border rounded px-4 py-2">Aplicar</button>
        </div>
      </div>

      <div className="border rounded divide-y">
        {loading && <div className="p-4 text-gray-500">Cargando...</div>}
        {error && <div className="p-4 text-red-600">{error}</div>}
        {!loading && !tickets.length && !error && (
          <div className="p-4 text-gray-500">No hay tickets con estos filtros.</div>
        )}
        {tickets.map(t => (
          <Link key={t.id} href={`/admin/tickets/${t.id}`} className="block p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t.subject}</div>
              <div className="text-xs uppercase text-gray-500">{t.status}</div>
            </div>
            <div className="text-sm text-gray-600">{t.category} · {t.priority} · {t.userEmail || 'Usuario'}</div>
            <div className="text-xs text-gray-400">Actualizado: {new Date(t.updatedAt).toLocaleString()} · Asignado: {t.adminAssigneeId || '—'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}


