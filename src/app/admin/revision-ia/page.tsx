"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getAuth, getIdToken } from "firebase/auth";

type AdminAnalysisListItem = {
  id: string;
  playerId: string;
  playerName?: string | null;
  playerEmail?: string | null;
  createdAt: string;
  shotType?: string;
  score?: number;
  startFrameDetection?: { confidence?: number } | null;
  adminReviewStatus?: 'pendiente' | 'listo';
};

export default function AdminRevisionIAPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminAnalysisListItem[]>([]);
  const [filterPlayer, setFilterPlayer] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendientes" | "listos">("todos");
  const [onlyHighDoubt, setOnlyHighDoubt] = useState<boolean>(false);

  const filtered = useMemo(() => {
    const query = filterPlayer.trim().toLowerCase();
    return items.filter((it) => {
      const idStr = String(it.playerId || '').toLowerCase();
      const nameStr = String(it.playerName || '').toLowerCase();
      const emailStr = String(it.playerEmail || '').toLowerCase();
      const byPlayer = query ? (idStr.includes(query) || nameStr.includes(query) || emailStr.includes(query)) : true;
      const byStatus = filterStatus === 'todos'
        ? true
        : (filterStatus === 'listos' ? it.adminReviewStatus === 'listo' : it.adminReviewStatus !== 'listo');
      const conf = Number(it?.startFrameDetection?.confidence || 1);
      const byDoubt = onlyHighDoubt ? !(conf >= 0.6) : true;
      return byPlayer && byStatus && byDoubt;
    });
  }, [items, filterPlayer, filterStatus, onlyHighDoubt]);

  const loadAllAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) throw new Error("Usuario no autenticado");
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses?admin=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const arr = Array.isArray(data?.analyses) ? data.analyses : [];
      arr.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      setItems(
        arr.map((d: any) => ({
          id: String(d.id),
          playerId: String(d.playerId || ""),
          playerName: typeof d.playerName === 'string' ? d.playerName : null,
          playerEmail: typeof d.playerEmail === 'string' ? d.playerEmail : null,
          createdAt: String(d.createdAt || ""),
          shotType: d.shotType,
          score: typeof d.score === "number" ? d.score : undefined,
          startFrameDetection: d.startFrameDetection || null,
          adminReviewStatus: d.adminReviewStatus || 'pendiente',
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Revisión IA</h1>
        <button
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
          onClick={loadAllAnalyses}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Recargar"}
        </button>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm">Jugador</label>
            <input className="rounded border px-2 py-1" value={filterPlayer} onChange={(e)=>setFilterPlayer(e.target.value)} placeholder="id, nombre o email" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Estado</label>
            <select className="rounded border px-2 py-1" value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value as any)}>
              <option value="todos">Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="listos">Listos</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyHighDoubt} onChange={(e)=>setOnlyHighDoubt(e.target.checked)} />
            Solo "duda alta" (&lt; 0.6)
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Jugador</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Confianza</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{new Date(it.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <div>{it.playerName || it.playerEmail || it.playerId}</div>
                    {(it.playerName || it.playerEmail) && (
                      <div className="text-xs text-slate-500">{it.playerEmail || it.playerId}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">{it.shotType || "-"}</td>
                  <td className="py-2 pr-3">{typeof it.score === 'number' ? it.score : '-'}</td>
                  <td className="py-2 pr-3">
                    {typeof it?.startFrameDetection?.confidence === 'number' ? (
                      <span className={it.startFrameDetection.confidence >= 0.6 ? 'text-slate-700' : 'text-amber-700 font-medium'}>
                        {it.startFrameDetection.confidence.toFixed(2)}{it.startFrameDetection.confidence < 0.6 ? ' (duda)' : ''}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={it.adminReviewStatus === 'listo' ? 'text-green-700' : 'text-slate-700'}>
                      {it.adminReviewStatus === 'listo' ? 'Listo' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <Link className="text-blue-600 underline" href={`/admin/revision-ia/${it.id}`}>Revisar</Link>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={7}>Sin elementos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


