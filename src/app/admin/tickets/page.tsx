"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [status, setStatus] = useState<string>("all");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const router = useRouter();
  const params = useSearchParams();

  const statuses = useMemo(() => [
    { value: "all", label: "Todos" },
    { value: "open", label: "Abiertos" },
    { value: "in_progress", label: "En progreso" },
    { value: "waiting_user", label: "Esperando usuario" },
    { value: "resolved", label: "Resueltos" },
    { value: "closed", label: "Cerrados" },
  ], []);
  const statusLabel = useMemo(() => ({
    open: 'Abierto', in_progress: 'En progreso', waiting_user: 'Esperando usuario', resolved: 'Resuelto', closed: 'Cerrado'
  } as Record<string,string>), []);
  const priorityLabel = useMemo(() => ({ low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } as Record<string,string>), []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const auth = getAuth(); const cu = auth.currentUser; if (!cu) throw new Error('No autenticado');
      const token = await getIdToken(cu, true);
      const url = new URL('/api/tickets', window.location.origin);
      url.searchParams.set('admin', '1');
      if (status && status !== 'all') url.searchParams.set('status', status);
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
    const qsStatus = params.get('status') || 'all';
    const qsAssignee = params.get('assigneeId') || '';
    const qsLimit = Number(params.get('limit') || 50);
    const allowed = new Set(['all','open','in_progress','waiting_user','resolved','closed']);
    setStatus(allowed.has(qsStatus) ? qsStatus : 'all');
    setAssigneeId(qsAssignee);
    setLimit(Math.max(1, Math.min(qsLimit, 100)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); /* eslint-disable react-hooks/exhaustive-deps */ }, [status, assigneeId, limit]);

  const applyFiltersToUrl = () => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    if (status && status !== 'all') sp.set('status', status); else sp.delete('status');
    if (assigneeId) sp.set('assigneeId', assigneeId); else sp.delete('assigneeId');
    sp.set('limit', String(limit));
    router.push(url.pathname + '?' + sp.toString());
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Tickets de Soporte</h1>

      <div className="border rounded p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="mb-1 block">Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">Asignado a (uid)</Label>
          <Input value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <Label className="mb-1 block">Límite</Label>
          <Input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} min={1} max={100} />
        </div>
        <div className="flex items-end">
          <Button onClick={applyFiltersToUrl}>Aplicar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && <div className="p-4 text-gray-500">Cargando...</div>}
        {error && <div className="p-4 text-red-600">{error}</div>}
        {!loading && !tickets.length && !error && (
          <div className="p-4 text-gray-500">No hay tickets con estos filtros.</div>
        )}
        {tickets.map(t => {
          const statusVariant = t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'default' : 'secondary';
          const priorityVariant = t.priority === 'high' || t.priority === 'urgent' ? 'destructive' : t.priority === 'normal' ? 'default' : 'secondary';
          return (
            <Card key={t.id} className="hover:shadow-sm transition">
              <Link href={`/admin/tickets/${t.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-base">{t.subject}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant as any}>{statusLabel[t.status] || t.status}</Badge>
                      <Badge variant={priorityVariant as any}>{priorityLabel[t.priority] || t.priority}</Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{t.category} · {t.userEmail || 'Usuario'}</div>
                  <div className="text-xs text-muted-foreground mt-1">Actualizado: {new Date(t.updatedAt).toLocaleString()} · Asignado: {t.adminAssigneeId || '—'}</div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


